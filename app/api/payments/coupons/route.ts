// ============================================================
// app/api/payments/coupons/route.ts — POST /api/payments/coupons
// ============================================================
// Validates a coupon code and returns the discounted amount for a
// plan. Purely informational for the UI — the order endpoint
// re-validates the coupon itself and never trusts this result.
//
// Prices are resolved from plan_overrides (DB) first so that
// coupon discounts apply to the same price the admin set.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { findCoupon, normalizeCouponCode } from '@/lib/payments/coupons'
import { PLAN_LIST, applyDiscount, type Plan } from '@/lib/payments/plans'
import { supabaseAdmin } from '@/lib/supabase-admin'

interface PlanOverrideRow {
  plan_id: string
  amount_paise: number
}

/** Resolve effective plan prices from DB overrides (falls back to code defaults). */
async function getEffectivePrices(): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  for (const plan of PLAN_LIST) {
    prices[plan.id] = plan.amountPaise
  }

  try {
    const { data } = await supabaseAdmin
      .from('plan_overrides')
      .select('plan_id, amount_paise')

    for (const row of (data ?? []) as PlanOverrideRow[]) {
      if (row.plan_id in prices) {
        prices[row.plan_id] = row.amount_paise
      }
    }
  } catch {
    // Silently fall back to code defaults
  }

  return prices
}

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

  // Resolve effective (admin-overridden) base prices, then apply discount
  const basePrices = await getEffectivePrices()
  const prices: Record<string, number> = {}
  for (const plan of PLAN_LIST) {
    prices[plan.id] = applyDiscount(basePrices[plan.id] ?? plan.amountPaise, coupon.discountPercent)
  }

  return NextResponse.json({
    valid: true,
    code: coupon.code,
    discountPercent: coupon.discountPercent,
    prices,
  })
})
