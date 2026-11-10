// ============================================================
// lib/payments/google-play/catalog.ts — Play subscription catalog (SHARED)
// ============================================================
// Safe to import from server and client code: no secrets.
//
// Google Play Console setup this file expects (Monetize → Subscriptions):
//   Subscription (product) id : rsd_pro            (override: GOOGLE_PLAY_SUBSCRIPTION_ID)
//   Base plans — type PREPAID (one-time payment, no auto-renewal, no auto-pay):
//     monthly    (or monthly-prepaid)    duration 1 month
//     quarterly  (or quarterly-prepaid)  duration 3 months
//     yearly     (or yearly-prepaid)     duration 1 year
//   The "-prepaid" ids exist because a base plan's type cannot be changed and
//   deleted ids cannot be reused: if monthly/quarterly/yearly were already
//   created as auto-renewing, deactivate those and create the -prepaid ones.
//   The app only shows prepaid offers, so it never sells auto-renewal.
//
// PRICES ARE NOT HERE. Play Billing policy requires the price the user
// sees to come from Google (ProductDetails.formattedPrice), so prices are
// set per country in Play Console and the app shows Google's strings.
//
// This catalog is separate from the Razorpay catalog in ../plans.ts: Razorpay
// sells 30/180/365-day passes on the web; Play sells 1/3/12-month prepaid
// passes inside the store app. Both are one-time payments and unlock the same
// Pro features (see effectiveSubscription in lib/auth/types.ts). Buying a Play
// pass again while one is active is a Google "top-up": it extends the time.
// ============================================================

export type PlayPlanKey = 'play_monthly' | 'play_quarterly' | 'play_yearly'

export interface PlayPlan {
  key: PlayPlanKey
  /** Base plan ids accepted for this plan in Play Console (first = recommended) */
  basePlanIds: string[]
  name: string
  /** Human label, e.g. "3 months of Pro" */
  period: string
  badge: string | null
  popular: boolean
  /** Upper bound for a single paid period, used as a sanity check on Google's expiry */
  maxPeriodDays: number
}

export const DEFAULT_PLAY_SUBSCRIPTION_ID = 'rsd_pro'

export const PLAY_PLANS: readonly PlayPlan[] = [
  { key: 'play_monthly', basePlanIds: ['monthly', 'monthly-prepaid'], name: 'Pro · 1 Month', period: '1 month of Pro · one-time payment', badge: null, popular: false, maxPeriodDays: 31 },
  { key: 'play_quarterly', basePlanIds: ['quarterly', 'quarterly-prepaid'], name: 'Pro · 3 Months', period: '3 months of Pro · one-time payment', badge: 'Most popular', popular: true, maxPeriodDays: 92 },
  { key: 'play_yearly', basePlanIds: ['yearly', 'yearly-prepaid'], name: 'Pro · 1 Year', period: '12 months of Pro · one-time payment', badge: 'Best value', popular: false, maxPeriodDays: 366 },
]

export function playPlanByBasePlanId(basePlanId: string | null | undefined): PlayPlan | null {
  if (!basePlanId) return null
  return PLAY_PLANS.find((plan) => plan.basePlanIds.includes(basePlanId)) ?? null
}

export function isPlayPlanKey(value: unknown): value is PlayPlanKey {
  return typeof value === 'string' && PLAY_PLANS.some((plan) => plan.key === value)
}
