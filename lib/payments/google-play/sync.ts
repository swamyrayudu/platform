// ============================================================
// lib/payments/google-play/sync.ts — Verify + store a Play token (SERVER ONLY)
// ============================================================
// Shared by:
//   POST /api/payments/google-play/verify  (app, after purchase / restore)
//   POST /api/payments/google-play/rtdn    (Google, on every lifecycle change)
//
// Every call re-reads the token from Google, so the order notifications
// arrive in never matters, and a missed notification is repaired by the
// next one or by the app's restore on start-up.
// ============================================================

import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logSecurityEvent } from '@/lib/auth/db'
import { acknowledgeSubscription, getSubscriptionV2, PlayApiError, type SubscriptionPurchaseV2 } from './api'
import { getPlaySubscriptionId } from './config'
import { evaluateSubscription, type EvaluatedSubscription } from './evaluate'

export type SyncVia = 'client' | 'rtdn' | 'reconcile'

export type SyncOutcome =
  | { status: 'synced'; userId: string; subscription: EvaluatedSubscription; entitled: boolean; playExpiresAt: string | null }
  /** Valid token, but no account can be linked yet (RTDN before the app reported it). */
  | { status: 'unclaimed' }
  | { status: 'rejected'; reason: SyncRejectReason }

export type SyncRejectReason =
  | 'TOKEN_NOT_FOUND'
  | 'UNKNOWN_PRODUCT'
  | 'UNKNOWN_BASE_PLAN'
  | 'INVALID_EXPIRY'
  | 'OWNED_BY_OTHER_USER'

/** Thrown for configuration / upstream failures that should be retried. */
export class PlaySyncError extends Error {
  constructor(public readonly kind: 'NOT_CONFIGURED' | 'UPSTREAM' | 'DATABASE', message: string) {
    super(message)
    this.name = 'PlaySyncError'
  }
}

// ---- obfuscatedAccountId ------------------------------------------

/**
 * The opaque id the app passes to Google as obfuscatedAccountId. Random,
 * not derived from email or user id, so it is not PII. Created once.
 */
export async function ensurePlayAccountId(userId: string, current: string | null | undefined): Promise<string> {
  if (current) return current
  const candidate = randomBytes(24).toString('base64url') // 32 chars; Google allows 64
  const { error } = await supabaseAdmin
    .from('users')
    .update({ play_account_id: candidate })
    .eq('id', userId)
    .is('play_account_id', null)
  if (error) {
    console.error('[Google Play] ensurePlayAccountId update failed:', error)
    throw new PlaySyncError('DATABASE', 'Could not prepare Google Play purchase')
  }
  // Re-read: a concurrent request may have won the race with its own id.
  const { data, error: readError } = await supabaseAdmin
    .from('users').select('play_account_id').eq('id', userId).maybeSingle()
  if (readError || !data?.play_account_id) {
    throw new PlaySyncError('DATABASE', 'Could not prepare Google Play purchase')
  }
  return data.play_account_id as string
}

// ---- Ownership ------------------------------------------------------

async function existingOwner(purchaseToken: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('play_subscriptions').select('user_id').eq('purchase_token', purchaseToken).maybeSingle()
  if (error) throw new PlaySyncError('DATABASE', error.message)
  return (data?.user_id as string | undefined) ?? null
}

async function userByPlayAccountId(obfuscatedId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('users').select('id').eq('play_account_id', obfuscatedId).maybeSingle()
  if (error) throw new PlaySyncError('DATABASE', error.message)
  return (data?.id as string | undefined) ?? null
}

/**
 * Who owns this token?
 *   1. A token already stored belongs to its first owner, forever.
 *   2. Else the obfuscatedAccountId we gave Google at purchase time.
 *   3. Else the account it replaced (plan change / resubscribe).
 *   4. Else the signed-in claimant. Tokens are only readable on a device
 *      signed in to the buyer's Google Play account, so possession is proof.
 */
export async function resolveOwner(
  purchaseToken: string,
  sub: Pick<EvaluatedSubscription, 'obfuscatedAccountId' | 'linkedPurchaseToken'>,
  claimantUserId: string | null
): Promise<{ owner: string | null; conflict: boolean }> {
  const stored = await existingOwner(purchaseToken)
  if (stored) return { owner: stored, conflict: !!claimantUserId && claimantUserId !== stored }

  if (sub.obfuscatedAccountId) {
    const byAccount = await userByPlayAccountId(sub.obfuscatedAccountId)
    if (byAccount) return { owner: byAccount, conflict: !!claimantUserId && claimantUserId !== byAccount }
    // Unknown id (e.g. the buyer deleted their account): fall through.
  }

  if (sub.linkedPurchaseToken) {
    const previous = await existingOwner(sub.linkedPurchaseToken)
    if (previous) return { owner: previous, conflict: !!claimantUserId && claimantUserId !== previous }
  }

  return { owner: claimantUserId, conflict: false }
}

// ---- Refund / revoke memory ------------------------------------------

/**
 * Is the order that currently pays for this subscription refunded / voided?
 *
 * Read from the RTDN log, so a refund that arrived BEFORE the app reported the
 * token still applies when it is claimed later. Matched per ORDER, not per
 * token: a subscription renews with a new order id each period, so refunding
 * one month must remove access for that month only. If the subscription then
 * renews with a new paid order, access comes back. A voided notification
 * without an order id is treated as covering the current order.
 */
export function isCurrentOrderVoided(voidedOrderIds: (string | null)[], latestOrderId: string | null): boolean {
  return voidedOrderIds.some((orderId) => orderId === null || (latestOrderId !== null && orderId === latestOrderId))
}

async function voidedOrderIds(purchaseToken: string): Promise<(string | null)[]> {
  const { data, error } = await supabaseAdmin
    .from('play_rtdn_events')
    .select('payload')
    .eq('purchase_token', purchaseToken)
    .eq('kind', 'voided')
    .limit(200)
  if (error) throw new PlaySyncError('DATABASE', error.message)
  return (data ?? []).map((row) => {
    const orderId = (row.payload as { voidedPurchaseNotification?: { orderId?: unknown } } | null)?.voidedPurchaseNotification?.orderId
    return typeof orderId === 'string' && orderId ? orderId : null
  })
}

// ---- Main -----------------------------------------------------------------

export async function syncPlayPurchase(input: {
  purchaseToken: string
  via: SyncVia
  /** Signed-in user reporting the token (client verify). null for RTDN. */
  claimantUserId: string | null
  /** True when the triggering notification itself is SUBSCRIPTION_REVOKED. Applies to this read only. */
  revoked?: boolean
  revocationReason?: string
}): Promise<SyncOutcome> {
  const fetchedAt = new Date().toISOString()

  let purchase: SubscriptionPurchaseV2
  try {
    purchase = await getSubscriptionV2(input.purchaseToken)
  } catch (err) {
    if (err instanceof PlayApiError && err.kind === 'NOT_FOUND') return { status: 'rejected', reason: 'TOKEN_NOT_FOUND' }
    if (err instanceof PlayApiError && err.kind === 'NOT_CONFIGURED') throw new PlaySyncError('NOT_CONFIGURED', err.message)
    throw new PlaySyncError('UPSTREAM', (err as Error).message)
  }

  const evaluated = evaluateSubscription(purchase, getPlaySubscriptionId())
  if (!evaluated.ok) return { status: 'rejected', reason: evaluated.reason }
  const sub = evaluated.value

  const { owner, conflict } = await resolveOwner(input.purchaseToken, sub, input.claimantUserId)
  if (conflict) {
    await logSecurityEvent({
      userId: input.claimantUserId,
      eventType: 'PLAY_PURCHASE_REJECTED',
      metadata: { reason: 'OWNED_BY_OTHER_USER', via: input.via, orderId: sub.latestOrderId },
    })
    return { status: 'rejected', reason: 'OWNED_BY_OTHER_USER' }
  }
  if (!owner) return { status: 'unclaimed' }

  const revoked = input.revoked === true || isCurrentOrderVoided(await voidedOrderIds(input.purchaseToken), sub.latestOrderId)

  const { data, error } = await supabaseAdmin.rpc('upsert_play_subscription', {
    p_purchase_token: input.purchaseToken,
    p_user_id: owner,
    p_product_id: sub.productId,
    p_base_plan_id: sub.basePlanId,
    p_plan_key: sub.planKey,
    p_latest_order_id: sub.latestOrderId,
    p_linked_purchase_token: sub.linkedPurchaseToken,
    p_state: sub.state,
    p_acknowledgement_state: sub.acknowledgementState,
    p_auto_renewing: sub.autoRenewing,
    p_started_at: sub.startTime,
    p_expiry_time: sub.expiryTime,
    p_entitled: sub.entitled,
    p_revoked: revoked,
    p_revocation_reason: revoked ? (input.revocationReason ?? 'voided_or_revoked') : null,
    p_is_test: sub.isTest,
    p_verified_via: input.via,
    p_fetched_at: fetchedAt,
    p_raw: purchase as unknown as Record<string, unknown>,
  })

  if (error) {
    if (error.code === '42501' || error.message?.includes('PLAY_PURCHASE_OWNED_BY_OTHER_USER')) {
      return { status: 'rejected', reason: 'OWNED_BY_OTHER_USER' }
    }
    console.error('[Google Play] upsert_play_subscription failed:', error)
    throw new PlaySyncError('DATABASE', 'Could not save Google Play subscription')
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { user_id: string; play_expires_at: string | null; entitled: boolean; stale: boolean }
    | undefined

  // Acknowledge only AFTER access is saved. If this fails, the next verify /
  // RTDN retries it; Google's 3-day auto-refund is the backstop.
  if (sub.needsAcknowledgement && !revoked) {
    try {
      await acknowledgeSubscription(sub.productId, input.purchaseToken)
      sub.acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'
    } catch (err) {
      console.error('[Google Play] acknowledge failed (will retry on next sync):', (err as Error).message)
    }
  }

  await logSecurityEvent({
    userId: owner,
    eventType: input.via === 'client' ? 'PLAY_PURCHASE_VERIFIED' : 'PLAY_SUBSCRIPTION_UPDATED',
    metadata: {
      via: input.via,
      planKey: sub.planKey,
      state: sub.state,
      entitled: row?.entitled ?? false,
      expiresAt: sub.expiryTime,
      orderId: sub.latestOrderId,
      test: sub.isTest,
      revoked,
      stale: row?.stale ?? false,
    },
  })

  return {
    status: 'synced',
    userId: owner,
    subscription: sub,
    entitled: row?.entitled ?? false,
    playExpiresAt: row?.play_expires_at ?? null,
  }
}
