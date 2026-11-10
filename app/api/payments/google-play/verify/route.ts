// ============================================================
// POST /api/payments/google-play/verify
// ============================================================
// Called by the Android store build after Google's purchase sheet returns,
// and on start-up / "Restore purchases" for every purchase Play reports.
//
// Body: { purchaseToken: string }
//
// Nothing in the body is trusted beyond the token itself. The server:
//   1. reads the token's real state from the Google Play Developer API
//   2. checks product + base plan against the catalog
//   3. checks the token belongs to this account (obfuscatedAccountId)
//   4. stores it atomically and recomputes Play access
//   5. acknowledges the purchase with Google (server-side)
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { getUserById, logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { toPublicUser } from '@/lib/auth/types'
import { isPlayBillingConfigured } from '@/lib/payments/google-play/config'
import { PlaySyncError, syncPlayPurchase, type SyncRejectReason } from '@/lib/payments/google-play/sync'

const REJECT_STATUS: Record<SyncRejectReason, number> = {
  TOKEN_NOT_FOUND: 400,
  UNKNOWN_PRODUCT: 400,
  UNKNOWN_BASE_PLAN: 400,
  INVALID_EXPIRY: 400,
  OWNED_BY_OTHER_USER: 409,
}

function isToken(value: unknown): value is string {
  // Play purchase tokens are long opaque strings; bound the size we accept.
  return typeof value === 'string' && value.length >= 10 && value.length <= 4096 && /^[\w.\-:]+$/.test(value)
}

export const POST = requireAuth(async (request, _ctx, { user, session }) => {
  if (!isPlayBillingConfigured()) {
    return NextResponse.json({ error: 'PAYMENTS_UNAVAILABLE' }, { status: 503 })
  }

  const limit = await checkRateLimit(`play_verify:${user.id}`, 'play_verify')
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', retryAfter: limit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }
  if (!isToken(body.purchaseToken)) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  let outcome
  try {
    outcome = await syncPlayPurchase({ purchaseToken: body.purchaseToken, via: 'client', claimantUserId: user.id })
  } catch (err) {
    const kind = err instanceof PlaySyncError ? err.kind : 'UPSTREAM'
    console.error('[Google Play verify] failed:', (err as Error).message)
    return NextResponse.json(
      { error: kind === 'NOT_CONFIGURED' ? 'PAYMENTS_UNAVAILABLE' : 'GATEWAY_ERROR' },
      { status: kind === 'NOT_CONFIGURED' ? 503 : 502 }
    )
  }

  if (outcome.status === 'rejected') {
    await logSecurityEvent({
      userId: user.id,
      eventType: 'PLAY_PURCHASE_REJECTED',
      deviceId: session.device_id,
      ipHash: getHashedIp(request),
      metadata: { reason: outcome.reason },
    })
    return NextResponse.json({ error: outcome.reason }, { status: REJECT_STATUS[outcome.reason] })
  }
  if (outcome.status === 'unclaimed') {
    // Cannot happen with a claimant, but never grant on an unexpected branch.
    return NextResponse.json({ error: 'GATEWAY_ERROR' }, { status: 502 })
  }

  const fresh = await getUserById(user.id)
  const sub = outcome.subscription
  return NextResponse.json({
    success: true,
    subscription: {
      planKey: sub.planKey,
      state: sub.state,
      entitled: outcome.entitled,
      pending: sub.pending,
      autoRenewing: sub.autoRenewing,
      expiresAt: sub.expiryTime,
    },
    user: toPublicUser(fresh ?? user),
  })
})
