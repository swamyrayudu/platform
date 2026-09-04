// ============================================================
// app/api/payments/orders/route.ts — POST /api/payments/orders
// ============================================================
// Creates a Razorpay order for a plan. The browser sends ONLY a
// planId (+ optional coupon); the price is looked up server-side.
//
// Response: { orderId, amount, currency, keyId, plan, prefill }
// The browser hands these straight to Razorpay Checkout.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { logSecurityEvent } from '@/lib/auth/db'
import { getHashedIp } from '@/lib/auth/ip'
import { CURRENCY, applyDiscount, getPlan, isPlanId } from '@/lib/payments/plans'
import { findCoupon } from '@/lib/payments/coupons'
import { getRazorpay, getRazorpayKeyId, isRazorpayConfigured } from '@/lib/payments/razorpay'
import { createPaymentOrder } from '@/lib/payments/db'

export const POST = requireAuth(async (request, _ctx, { user, session }) => {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: 'PAYMENTS_UNAVAILABLE' }, { status: 503 })
  }

  // Per-user rate limit — prevents order spam against the Razorpay account
  const limit = await checkRateLimit(`payment_order:${user.id}`, 'payment_order')
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', retryAfter: limit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } }
    )
  }

  let body: { planId?: unknown; couponCode?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  if (!isPlanId(body.planId)) {
    return NextResponse.json({ error: 'INVALID_PLAN' }, { status: 400 })
  }

  const plan = getPlan(body.planId)

  // Coupon: silently ignore unknown codes (the UI already validated them),
  // but never trust a client-provided discount.
  const coupon = body.couponCode ? findCoupon(body.couponCode) : null
  const discountPercent = coupon?.discountPercent ?? 0
  const amount = applyDiscount(plan.amountPaise, discountPercent)

  // Razorpay receipts are limited to 40 chars
  const receipt = `dsc_${Date.now().toString(36)}_${user.id.replace(/-/g, '').slice(0, 12)}`

  let razorpayOrder: { id: string; amount: number | string; currency: string }
  try {
    razorpayOrder = await getRazorpay().orders.create({
      amount,
      currency: CURRENCY,
      receipt,
      notes: {
        user_id: user.id,
        plan_id: plan.id,
        coupon: coupon?.code ?? '',
      },
    })
  } catch (err) {
    console.error('[Payments] Razorpay order create failed:', err)
    return NextResponse.json({ error: 'GATEWAY_ERROR' }, { status: 502 })
  }

  const order = await createPaymentOrder({
    userId: user.id,
    planId: plan.id,
    amount,
    currency: CURRENCY,
    couponCode: coupon?.code ?? null,
    discountPercent,
    razorpayOrderId: razorpayOrder.id,
  })

  await logSecurityEvent({
    userId: user.id,
    eventType: 'PAYMENT_ORDER_CREATED',
    deviceId: session.device_id,
    ipHash: getHashedIp(request),
    metadata: { orderId: order.razorpay_order_id, planId: plan.id, amount, coupon: coupon?.code ?? null },
  })

  return NextResponse.json({
    orderId: order.razorpay_order_id,
    amount: order.amount,
    currency: order.currency,
    keyId: getRazorpayKeyId(),
    plan: { id: plan.id, name: plan.name, durationDays: plan.durationDays },
    discountPercent,
    prefill: {
      name: user.name ?? '',
      email: user.email,
    },
  })
})
