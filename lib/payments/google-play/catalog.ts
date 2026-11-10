// ============================================================
// lib/payments/google-play/catalog.ts — Play subscription catalog (SHARED)
// ============================================================
// Safe to import from server and client code: no secrets.
//
// Google Play Console setup this file expects (Monetize → Subscriptions):
//   Subscription (product) id : rsd_pro            (override: GOOGLE_PLAY_SUBSCRIPTION_ID)
//   Base plans (auto-renewing):
//     monthly    billing period 1 month
//     quarterly  billing period 3 months
//     yearly     billing period 1 year
//
// PRICES ARE NOT HERE. Play Billing policy requires the price the user
// sees to come from Google (ProductDetails.formattedPrice), so prices are
// set per country in Play Console and the app shows Google's strings.
//
// This catalog is separate from the Razorpay catalog in ../plans.ts on
// purpose: Razorpay sells one-time passes (30/180/365 days) on the web;
// Play sells auto-renewing subscriptions inside the store app. Both unlock
// the same Pro features (see effectiveSubscription in lib/auth/types.ts).
// ============================================================

export type PlayPlanKey = 'play_monthly' | 'play_quarterly' | 'play_yearly'

export interface PlayPlan {
  key: PlayPlanKey
  /** Base plan id configured in Play Console */
  basePlanId: string
  name: string
  /** Human label, e.g. "Billed every 3 months" */
  period: string
  badge: string | null
  popular: boolean
  /** Upper bound for a single paid period, used as a sanity check on Google's expiry */
  maxPeriodDays: number
}

export const DEFAULT_PLAY_SUBSCRIPTION_ID = 'rsd_pro'

export const PLAY_PLANS: readonly PlayPlan[] = [
  { key: 'play_monthly', basePlanId: 'monthly', name: 'Pro Monthly', period: 'Billed every month', badge: null, popular: false, maxPeriodDays: 31 },
  { key: 'play_quarterly', basePlanId: 'quarterly', name: 'Pro Quarterly', period: 'Billed every 3 months', badge: 'Most popular', popular: true, maxPeriodDays: 92 },
  { key: 'play_yearly', basePlanId: 'yearly', name: 'Pro Yearly', period: 'Billed every year', badge: 'Best value', popular: false, maxPeriodDays: 366 },
]

export function playPlanByBasePlanId(basePlanId: string | null | undefined): PlayPlan | null {
  if (!basePlanId) return null
  return PLAY_PLANS.find((plan) => plan.basePlanId === basePlanId) ?? null
}

export function isPlayPlanKey(value: unknown): value is PlayPlanKey {
  return typeof value === 'string' && PLAY_PLANS.some((plan) => plan.key === value)
}
