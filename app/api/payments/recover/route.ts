// ============================================================
// app/api/payments/recover/route.ts — POST /api/payments/recover
// ============================================================
// "I paid, then my tab died."
//
// The browser remembers the order id it last opened checkout for. When
// the app starts and that order has not been confirmed, it posts it
// here. We ask Razorpay whether money actually arrived and, if it did,
// activate the subscription — no admin, no support ticket, no waiting
// for a webhook that may be misconfigured.
//
// This is the same work /api/payments/verify does, minus the signature:
// there is no signature to check, because the browser never got one —
// it was gone when Razorpay tried to hand it over. Razorpay's own record
// of the payment is the proof instead, which is strictly stronger than a
// signature the client could have replayed.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { getUserById, logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { toPublicUser } from '@/lib/auth/types'
import { isRazorpayConfigured } from '@/lib/payments/razorpay'
import { reconcileOrderForUser } from '@/lib/payments/reconcile'

export const POST = requireAuth(async (request, _ctx, { user, session }) => {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: 'PAYMENTS_UNAVAILABLE' }, { status: 503 })
  }

  // Reuses the verify bucket: this is the same "settle my payment" action
  // from the same user, so it should share the same budget.
  const limit = await checkRateLimit(`payment_verify:${user.id}`, 'payment_verify')
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', retryAfter: limit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } }
    )
  }

  let orderId: unknown
  try {
    orderId = (await request.json())?.orderId
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  if (typeof orderId !== 'string' || !orderId.startsWith('order_') || orderId.length > 64) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  // Returns null for an order that does not exist OR is not this user's —
  // deliberately the same answer, so this cannot be used to probe order ids.
  const row = await reconcileOrderForUser(orderId, user.id)
  if (!row) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })
  }

  if (row.outcome === 'activated') {
    await logSecurityEvent({
      userId: user.id,
      eventType: 'SUBSCRIPTION_ACTIVATED',
      deviceId: session.device_id,
      ipHash: getHashedIp(request),
      metadata: { planId: row.planId, via: 'recover', orderId, paymentId: row.paymentId },
    })
  }

  const fresh = await getUserById(user.id)

  return NextResponse.json({
    success: true,
    // 'activated'   — money was found, they are Pro now
    // 'already_paid'— someone else settled it first (webhook or verify)
    // 'no_payment'  — they never paid; stop asking
    // 'failed'      — the bank declined; stop asking
    outcome: row.outcome,
    /** Whether the browser should forget this order and stop retrying. */
    settled: row.outcome !== 'error',
    user: toPublicUser(fresh ?? user),
  })
})
