// ============================================================
// app/api/payments/coupons/route.ts — POST /api/payments/coupons
// ============================================================
// Validates a coupon code and returns the discounted amount for a
// plan. Purely informational for the UI — the order endpoint
// re-validates the coupon itself and never trusts this result.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { findCoupon, normalizeCouponCode } from '@/lib/payments/coupons'
import { PLAN_LIST, applyDiscount } from '@/lib/payments/plans'

export const POST = requireAuth(async (request, _ctx, { user }) => {
  const limit = await checkRateLimit(`coupon:${user.id}`, 'coupon')
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', retryAfter: limit.retryAfter },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } }
    )
  }

  let body: { code?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const code = normalizeCouponCode(body.code)
  if (!code) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const coupon = findCoupon(code)
  if (!coupon) {
    return NextResponse.json({ valid: false, code })
  }

  // Discounted price for every plan so the UI can update all cards at once
  const prices: Record<string, number> = {}
  for (const plan of PLAN_LIST) {
    prices[plan.id] = applyDiscount(plan.amountPaise, coupon.discountPercent)
  }

  return NextResponse.json({
    valid: true,
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    prices,
  })
})
