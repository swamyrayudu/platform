// ============================================================
// lib/payments/plans.ts — Subscription plan catalog (SHARED)
// ============================================================
// Safe to import from both server and client code.
// This file is the ONLY source of truth for pricing. The client
// never sends an amount — it sends a planId, and the server looks
// the price up here before creating a Razorpay order.
// ============================================================

// `lifetime` used to be the third id while the plan itself ran for 365 days.
// Nothing in the database ever used it — every order and every subscription
// was pro_sprint — so it was renamed rather than aliased. An id that says
// "lifetime" next to durationDays: 365 is the kind of thing that eventually
// gets read as a promise.
export type PlanId = 'pro_sprint' | 'pro_full' | 'pro_year'

export interface Plan {
  id: PlanId
  name: string
  /** Price in paise (₹1 = 100 paise) */
  amountPaise: number
  /** Struck-through "original" price in paise, for display only */
  originalAmountPaise: number
  /** Human label like "/ 6 Months" */
  period: string
  /** How long the subscription lasts once activated */
  durationDays: number
  badge: string
  popular: boolean
  features: string[]
}

export const CURRENCY = 'INR'

// All plans unlock the SAME feature set — duration is the only difference.
// These features are the fallback shown when the admin has not set DB overrides.
// The PremiumModal renders a shared feature list from PREMIUM_FEATURES (in PremiumModal.tsx)
// and only uses the plan.features field inside the admin pricing editor.
// Every plan unlocks the same thing — only the length differs — so this list
// is shared, and it is what the product actually does.
//
// What it used to claim, and why those lines are gone:
//   "Previous Year Papers 2018-2024"   no such feature exists anywhere
//   "AI-powered Instant Explanations"  there is no AI in this codebase
//   "Downloadable PDF Revision Notes"  no such feature exists anywhere
// It also undersold the real thing: 150+ mocks when there are 200, and
// 12,000+ MCQs when the bank holds 39,181.
const ALL_PLAN_FEATURES = [
  '200 full-length mock papers — 100 Telugu medium, 100 English medium',
  'Every paper 160 questions in 150 minutes, on the official pattern',
  '39,181 practice questions — 22,389 Telugu medium, 16,792 English medium',
  'Practice by subject, chapter and topic, with unlimited attempts',
  'Answers and explanations revealed after every submission',
  'Rank and percentile against everyone who sat the same paper',
  'Weak-topic tracking that shows where your marks are going',
  'Performance dashboard across practice and mock tests',
  'Progress saved and synced across every device you sign in on',
]

export const PLANS: Record<PlanId, Plan> = {
  pro_sprint: {
    id: 'pro_sprint',
    name: '30-Day Sprint',
    amountPaise: 29900,
    originalAmountPaise: 59900,
    period: '/ 1 Month',
    durationDays: 30,
    badge: 'Quick Exam Revision',
    popular: false,
    features: ALL_PLAN_FEATURES,
  },
  pro_full: {
    id: 'pro_full',
    name: 'DSC SGT Pro Pass',
    amountPaise: 59900,
    originalAmountPaise: 149900,
    period: '/ 6 Months',
    durationDays: 180,
    badge: '★ Most Recommended',
    popular: true,
    features: ALL_PLAN_FEATURES,
  },
  pro_year: {
    id: 'pro_year',
    name: 'Ultimate All-Exams Pass',
    amountPaise: 99900,
    originalAmountPaise: 299900,
    period: '/ 1 Year',
    durationDays: 365,
    badge: 'Best Value',
    popular: false,
    features: ALL_PLAN_FEATURES,
  },
}

export const PLAN_LIST: Plan[] = [PLANS.pro_sprint, PLANS.pro_full, PLANS.pro_year]

export function isPlanId(value: unknown): value is PlanId {
  // hasOwnProperty, NOT `in`: `in` walks the prototype chain, so `in PLANS`
  // returned true for 'constructor', '__proto__', 'toString', 'valueOf' and
  // 'hasOwnProperty'. getPlan() then returned a non-Plan object whose
  // amountPaise was undefined, which propagated NaN into the order amount.
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value)
}

export function getPlan(planId: PlanId): Plan {
  const plan = PLANS[planId]
  // Fail loudly rather than returning undefined: verify/route.ts feeds
  // plan.durationDays straight into the activation RPC.
  if (!plan) throw new Error(`Unknown plan: ${String(planId)}`)
  return plan
}

/** Percentage discount label, e.g. "50% OFF" */
export function discountLabel(plan: Plan): string {
  const pct = Math.round((1 - plan.amountPaise / plan.originalAmountPaise) * 100)
  return `${pct}% OFF`
}

/** Format paise as "₹599" (no decimals when whole rupees) */
export function formatPaise(paise: number): string {
  const rupees = paise / 100
  return `₹${Number.isInteger(rupees) ? rupees.toLocaleString('en-IN') : rupees.toFixed(2)}`
}

/** Apply a percentage discount to an amount in paise, rounded to whole paise. */
export function applyDiscount(amountPaise: number, discountPercent: number): number {
  const discounted = Math.round(amountPaise * (1 - discountPercent / 100))
  // Razorpay requires a minimum of ₹1 (100 paise)
  return Math.max(discounted, 100)
}
