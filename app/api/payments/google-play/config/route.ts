// ============================================================
// GET /api/payments/google-play/config
// ============================================================
// What the Android store build needs before opening Google's purchase
// sheet. No prices: the app shows Google's own localized prices.
//
// Also returns obfuscatedAccountId, which the app MUST pass to
// BillingFlowParams.setObfuscatedAccountId. The server later reads it back
// from Google to prove which account bought a purchase token.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { PLANS } from '@/lib/payments/plans'
import { PLAY_PLANS } from '@/lib/payments/google-play/catalog'
import { getPlayPackageName, getPlaySubscriptionId, isPlayBillingConfigured } from '@/lib/payments/google-play/config'
import { ensurePlayAccountId } from '@/lib/payments/google-play/sync'

export const GET = requireAuth(async (_request, _ctx, { user }) => {
  if (!isPlayBillingConfigured()) {
    return NextResponse.json({ configured: false }, { status: 200 })
  }

  let obfuscatedAccountId: string
  try {
    obfuscatedAccountId = await ensurePlayAccountId(user.id, user.play_account_id)
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }

  return NextResponse.json({
    configured: true,
    packageName: getPlayPackageName(),
    productId: getPlaySubscriptionId(),
    obfuscatedAccountId,
    plans: PLAY_PLANS.map(({ key, basePlanId, name, period, badge, popular }) => ({ key, basePlanId, name, period, badge, popular })),
    // Same Pro feature list the website shows: every plan unlocks the same thing.
    features: PLANS.pro_full.features,
  })
})
