// ============================================================
// lib/payments/plans.ts — Subscription plan catalog (SHARED)
// ============================================================
// Safe to import from both server and client code.
// This file is the ONLY source of truth for pricing. The client
// never sends an amount — it sends a planId, and the server looks
// the price up here before creating a Razorpay order.
// ============================================================

export type PlanId = 'pro_sprint' | 'pro_full' | 'lifetime'

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
const ALL_PLAN_FEATURES = [
  'All 150+ Grand Mock Tests (Telugu & English medium)',
  '12,000+ Practice MCQs — Chapter-wise & Subject-wise',
  'Previous Year Papers 2018–2024 with Answer Keys',
  'AI-powered Instant Question Explanations',
  'Live State-level Rank & Percentile Tracking',
  'Mock Exam Simulator — Full Paper Mode',
  'Weak Topic Diagnostic & Targeted Drills',
  'Performance Analytics Dashboard',
  'Chapter-wise Topic Picker (unlimited topics)',
  'Downloadable PDF High-Yield Revision Notes',
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
  lifetime: {
    id: 'lifetime',
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

export const PLAN_LIST: Plan[] = [PLANS.pro_sprint, PLANS.pro_full, PLANS.lifetime]

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && value in PLANS
}

export function getPlan(planId: PlanId): Plan {
  return PLANS[planId]
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
