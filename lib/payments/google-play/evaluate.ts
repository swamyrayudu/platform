// ============================================================
// lib/payments/google-play/evaluate.ts — Play state → entitlement (PURE)
// ============================================================
// No I/O. Turns Google's SubscriptionPurchaseV2 into the row we store,
// so the rules can be unit-tested without Google or a database.
//
// Entitlement rule (Google's recommended mapping):
//   ACTIVE            → access until expiry (renews)
//   IN_GRACE_PERIOD   → access (renewal payment is being retried)
//   CANCELED          → access until expiry (will not renew)
//   ON_HOLD / PAUSED  → no access (payment failed after grace / user paused)
//   PENDING           → no access yet (e.g. UPI / cash payment not complete)
//   EXPIRED / PENDING_PURCHASE_CANCELED → no access
// Plus: a refunded/revoked token never entitles (applied by the caller).
// ============================================================

import { PLAY_PLANS, playPlanByBasePlanId, type PlayPlanKey } from './catalog'
import type { SubscriptionPurchaseV2, SubscriptionState } from './api'

const ENTITLING_STATES: ReadonlySet<SubscriptionState> = new Set([
  'SUBSCRIPTION_STATE_ACTIVE',
  'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  'SUBSCRIPTION_STATE_CANCELED',
])

/**
 * Sanity cap on how far ahead Google's expiry may be. Prepaid passes can be
 * topped up (bought again) and each top-up extends the time, so allow several
 * years of accumulated passes — but never an absurd value.
 */
const MAX_FUTURE_DAYS = Math.max(...PLAY_PLANS.map((p) => p.maxPeriodDays)) * 5

export interface EvaluatedSubscription {
  productId: string
  basePlanId: string
  planKey: PlayPlanKey
  state: SubscriptionState
  entitled: boolean
  pending: boolean
  expiryTime: string | null
  startTime: string | null
  autoRenewing: boolean
  needsAcknowledgement: boolean
  acknowledgementState: string | null
  latestOrderId: string | null
  linkedPurchaseToken: string | null
  obfuscatedAccountId: string | null
  isTest: boolean
}

export type EvaluationResult =
  | { ok: true; value: EvaluatedSubscription }
  | { ok: false; reason: 'UNKNOWN_PRODUCT' | 'UNKNOWN_BASE_PLAN' | 'INVALID_EXPIRY' }

export function evaluateSubscription(
  purchase: SubscriptionPurchaseV2,
  expectedProductId: string,
  now: number = Date.now()
): EvaluationResult {
  const item = (purchase.lineItems ?? []).find((li) => li.productId === expectedProductId)
  if (!item) return { ok: false, reason: 'UNKNOWN_PRODUCT' }

  const plan = playPlanByBasePlanId(item.offerDetails?.basePlanId)
  if (!plan) return { ok: false, reason: 'UNKNOWN_BASE_PLAN' }

  const state = purchase.subscriptionState ?? 'SUBSCRIPTION_STATE_UNSPECIFIED'
  const expiryMs = item.expiryTime ? Date.parse(item.expiryTime) : NaN
  const expiryTime = Number.isFinite(expiryMs) ? new Date(expiryMs).toISOString() : null

  // Defence in depth, like the 400-day clamp on Razorpay activation: a
  // malformed or unexpected expiry must never mint years of access.
  if (expiryTime && expiryMs - now > MAX_FUTURE_DAYS * 86_400_000) {
    return { ok: false, reason: 'INVALID_EXPIRY' }
  }

  const entitled = ENTITLING_STATES.has(state) && expiryTime !== null && expiryMs > now
  const ackPending = purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING'

  return {
    ok: true,
    value: {
      productId: item.productId,
      basePlanId: item.offerDetails?.basePlanId ?? plan.basePlanIds[0],
      planKey: plan.key,
      state,
      entitled,
      pending: state === 'SUBSCRIPTION_STATE_PENDING',
      expiryTime,
      startTime: purchase.startTime ?? null,
      autoRenewing: item.autoRenewingPlan?.autoRenewEnabled === true,
      // Only a paid, live purchase can (and must) be acknowledged.
      needsAcknowledgement: ackPending && entitled,
      acknowledgementState: purchase.acknowledgementState ?? null,
      latestOrderId: item.latestSuccessfulOrderId ?? purchase.latestOrderId ?? null,
      linkedPurchaseToken: purchase.linkedPurchaseToken ?? null,
      obfuscatedAccountId: purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
      isTest: purchase.testPurchase !== undefined,
    },
  }
}
