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

export const PLANS: Record<PlanId, Plan> = {
  pro_sprint: {
    id: 'pro_sprint',
    name: '30-Day Sprint',
    amountPaise: 29900,
    originalAmountPaise: 59900,
    period: '/ 1 Month',
    durationDays: 30,
    badge: 'Popular for Quick Revision',
    popular: false,
    features: [
      'Access to 25+ Full Grand Mocks',
      'All 10,000+ Practice MCQs',
      'Instant Answer Keys & Solutions',
      'Chapter-wise Tests',
    ],
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
    features: [
      'All 100+ Grand Mocks & Mini Tests',
      'Previous Papers (2018–2024 with key)',
      'Detailed AI Question Explanations',
      'Live State-level Rank & Percentile',
      'Weak Topic Diagnostic & Drills',
      'Unlimited Mock Exam Simulator Attempts',
      'Downloadable PDF High-Yield Notes',
    ],
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
    features: [
      'Everything in DSC SGT Pro Pass',
      'Free Access to DSC TET & APPSC',
      'Priority Doubt Support',
      'Future AP DSC Notification Updates',
    ],
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
