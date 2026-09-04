// ============================================================
// app/api/payments/verify/route.ts — POST /api/payments/verify
// ============================================================
// Called by the browser after Razorpay Checkout succeeds.
//
// Steps (all server-side, nothing here trusts the browser):
//   1. Order must exist and belong to the caller
//   2. HMAC signature must match (order_id|payment_id)
//   3. Payment is fetched from Razorpay: amount + currency must match,
//      status must be "captured" (authorized payments are captured here)
//   4. activate_subscription() runs atomically + idempotently
//
// The webhook (/api/payments/webhook) performs the same activation,
// so a user still gets access if they close the tab before this runs.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { getUserById, logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { toPublicUser } from '@/lib/auth/types'
import { getPlan } from '@/lib/payments/plans'
import {
  fetchPayment,
  getRazorpay,
  isRazorpayConfigured,
  verifyCheckoutSignature,
} from '@/lib/payments/razorpay'
import { activateSubscription, getPaymentOrderByRazorpayId, markPaymentOrderFailed } from '@/lib/payments/db'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length < 256
}

export const POST = requireAuth(async (request, _ctx, { user, session }) => {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: 'PAYMENTS_UNAVAILABLE' }, { status: 503 })
  }

  const limit = await checkRateLimit(`payment_verify:${user.id}`, 'payment_verify')
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

  const orderId = body.razorpay_order_id
  const paymentId = body.razorpay_payment_id
  const signature = body.razorpay_signature

  if (!isNonEmptyString(orderId) || !isNonEmptyString(paymentId) || !isNonEmptyString(signature)) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const ipHash = getHashedIp(request)

  // 1. Order must exist and belong to this user
  const order = await getPaymentOrderByRazorpayId(orderId)
  if (!order) {
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })
  }
  if (order.user_id !== user.id) {
    await logSecurityEvent({
      userId: user.id,
      eventType: 'PAYMENT_SIGNATURE_INVALID',
      deviceId: session.device_id,
      ipHash,
      metadata: { reason: 'ORDER_OWNER_MISMATCH', orderId },
    })
    return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })
  }

  // Idempotent replay: the webhook (or a previous call) already handled it
  if (order.status === 'PAID') {
    const fresh = await getUserById(user.id)
    return NextResponse.json({
      success: true,
      alreadyProcessed: true,
      user: toPublicUser(fresh ?? user),
    })
  }

  // 2. Signature check
  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    await logSecurityEvent({
      userId: user.id,
      eventType: 'PAYMENT_SIGNATURE_INVALID',
      deviceId: session.device_id,
      ipHash,
      metadata: { reason: 'HMAC_MISMATCH', orderId, paymentId },
    })
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })
  }

  // 3. Confirm with Razorpay that the payment is real, captured, and for the right amount
  let payment
  try {
    payment = await fetchPayment(paymentId)
  } catch (err) {
    console.error('[Payments] fetchPayment failed:', err)
    return NextResponse.json({ error: 'GATEWAY_ERROR' }, { status: 502 })
  }

  const amountMatches = Number(payment.amount) === order.amount && payment.currency === order.currency
  if (payment.order_id !== orderId || !amountMatches) {
    await logSecurityEvent({
      userId: user.id,
      eventType: 'PAYMENT_SIGNATURE_INVALID',
      deviceId: session.device_id,
      ipHash,
      metadata: {
        reason: 'PAYMENT_MISMATCH',
        orderId,
        paymentId,
        expectedAmount: order.amount,
        actualAmount: payment.amount,
      },
    })
    return NextResponse.json({ error: 'PAYMENT_MISMATCH' }, { status: 400 })
  }

  if (payment.status === 'authorized') {
    // Auto-capture is normally on, but capture explicitly if it isn't
    try {
      await getRazorpay().payments.capture(paymentId, order.amount, order.currency)
      payment.status = 'captured'
    } catch (err) {
      console.error('[Payments] capture failed:', err)
      return NextResponse.json({ error: 'CAPTURE_FAILED' }, { status: 502 })
    }
  }

  if (payment.status !== 'captured') {
    await markPaymentOrderFailed(orderId, paymentId, payment.error_description ?? `status:${payment.status}`)
    await logSecurityEvent({
      userId: user.id,
      eventType: 'PAYMENT_FAILED',
      deviceId: session.device_id,
      ipHash,
      metadata: { orderId, paymentId, status: payment.status },
    })
    return NextResponse.json({ error: 'PAYMENT_NOT_CAPTURED', status: payment.status }, { status: 402 })
  }

  // 4. Activate (atomic + idempotent)
  const plan = getPlan(order.plan_id)
  const result = await activateSubscription({
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    durationDays: plan.durationDays,
    confirmedVia: 'checkout',
  })

  await logSecurityEvent({
    userId: user.id,
    eventType: 'PAYMENT_VERIFIED',
    deviceId: session.device_id,
    ipHash,
    metadata: { orderId, paymentId, planId: plan.id, amount: order.amount },
  })
  if (result.activated) {
    await logSecurityEvent({
      userId: user.id,
      eventType: 'SUBSCRIPTION_ACTIVATED',
      deviceId: session.device_id,
      ipHash,
      metadata: { planId: plan.id, expiresAt: result.expiresAt, via: 'checkout' },
    })
  }

  const fresh = await getUserById(user.id)
  return NextResponse.json({
    success: true,
    alreadyProcessed: !result.activated,
    expiresAt: result.expiresAt,
    user: toPublicUser(fresh ?? user),
  })
})
