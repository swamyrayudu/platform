'use client'

import React, { useEffect, useState } from 'react'
import {
  Crown,
  Check,
  X,
  CheckCircle2,
  RefreshCw,
  FileCheck2,
  BookOpen,
  Timer,
  BarChart3,
  Brain,
  Layers,
  TrendingUp,
  Download,
  Zap,
  Shield,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePremium } from './PremiumContext'
import {
  PLAN_LIST,
  formatPaise,
  getPlan,
  isPlanId,
  type Plan,
  type PlanId,
} from '@/lib/payments/plans'

// ---- Types -------------------------------------------------------

interface AppliedCoupon {
  code: string
  discountPercent: number
  prices: Record<string, number>
}

// ---- Actual premium features (same for ALL plans) ----------------
// Every plan unlocks the exact same feature set — only duration differs.

// What the product actually does. Three entries were removed rather than
// reworded, because no amount of rewording makes them true:
//   "Previous Year Papers 2018-2024"   no such feature exists in this codebase
//   "AI-powered Question Explanations" there is no AI integration anywhere
//   "Downloadable PDF High-Yield Notes" no such feature exists
// The two headline numbers were also wrong in the other direction — 150+ mocks
// against a real 200, and 12,000+ MCQs against a real 39,181.
const PREMIUM_FEATURES = [
  {
    icon: FileCheck2,
    title: '200 full-length mock papers',
    desc: '100 Telugu medium and 100 English medium, on the official pattern',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Timer,
    title: '160 questions in 150 minutes',
    desc: 'The same structure and timing as the paper you will sit',
    color: 'text-primary',
    bg: 'bg-secondary',
  },
  {
    icon: BookOpen,
    title: '39,181 practice questions',
    desc: '22,389 Telugu medium and 16,792 English medium',
    color: 'text-primary',
    bg: 'bg-secondary',
  },
  {
    icon: Layers,
    title: 'Practice by subject, chapter and topic',
    desc: 'Pick any area and attempt it as many times as you need',
    color: 'text-primary',
    bg: 'bg-secondary',
  },
  {
    icon: Brain,
    title: 'Answers and explanations after every paper',
    desc: 'Every question reviewed with the correct answer and why',
    color: 'text-primary',
    bg: 'bg-secondary',
  },
  {
    icon: BarChart3,
    title: 'Rank and percentile',
    desc: 'Where you stand among everyone who sat the same paper',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: TrendingUp,
    title: 'Weak-topic tracking',
    desc: 'Which topics are costing you marks, from your own attempts',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Download,
    title: 'Progress on every device',
    desc: 'Scores and history follow your account, not your phone',
    color: 'text-primary',
    bg: 'bg-secondary',
  },
]


// ---- Helpers -----------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ---- Plan card skeleton ------------------------------------------

function PlanSkeleton() {
  return (
    <div className="h-28 rounded-2xl border border-border/60 bg-muted/40 animate-pulse" />
  )
}

// ---- Main Modal --------------------------------------------------

export default function PremiumModal() {
  const {
    isModalOpen,
    closeModal,
    isPremium,
    currentPlan,
    expiresAt,
    startCheckout,
    isCheckingOut,
  } = usePremium()

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro_full')
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null)
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false)

  // Live plan prices fetched from server (admin-managed)
  const [livePlans, setLivePlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)

  useEffect(() => {
    if (!isModalOpen) return
    let cancelled = false
    setLoadingPlans(true)

    fetch('/api/payments/plans', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => {
        if (!cancelled && Array.isArray(data.plans) && data.plans.length > 0) {
          setLivePlans(data.plans as Plan[])
        }
      })
      .catch(() => {
        if (!cancelled) setLivePlans(PLAN_LIST)
      })
      .finally(() => { if (!cancelled) setLoadingPlans(false) })

    return () => { cancelled = true }
  }, [isModalOpen])

  if (!isModalOpen) return null

  const displayPlans = livePlans.length > 0 ? livePlans : PLAN_LIST

  // ---- Price helpers
  const priceFor = (planId: PlanId): number => {
    if (coupon?.prices[planId] !== undefined) return coupon.prices[planId]
    return displayPlans.find(p => p.id === planId)?.amountPaise ?? getPlan(planId).amountPaise
  }

  const origPriceFor = (planId: PlanId): number =>
    displayPlans.find(p => p.id === planId)?.originalAmountPaise ?? getPlan(planId).originalAmountPaise

  const discountPctFor = (planId: PlanId): number => {
    const orig = origPriceFor(planId)
    const sell = priceFor(planId)
    return orig > 0 ? Math.round((1 - sell / orig) * 100) : 0
  }

  // ---- Coupon
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    setIsCheckingCoupon(true)
    try {
      const res = await fetch('/api/payments/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.valid) {
        setCoupon({ code: data.code, discountPercent: data.discountPercent, prices: data.prices })
        toast.success(`✓ ${data.code} applied — ${data.discountPercent}% off!`)
      } else {
        setCoupon(null)
        toast.error(res.status === 429 ? 'Too many attempts. Wait a moment.' : 'Invalid promo code.')
      }
    } catch {
      toast.error('Could not check the promo code.')
    } finally {
      setIsCheckingCoupon(false)
    }
  }

  const handleSubscribe = async () => {
    await startCheckout(selectedPlan, coupon?.code)
  }

  const activePlanName = isPlanId(currentPlan) ? getPlan(currentPlan).name : 'Pro'
  const selectedPlanData = displayPlans.find(p => p.id === selectedPlan)
  const payAmount = formatPaise(priceFor(selectedPlan))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 p-0 sm:p-4">
      <div className="relative w-full sm:max-w-5xl max-h-[95dvh] overflow-hidden sm:rounded-3xl rounded-t-3xl border border-white/10 bg-background text-foreground shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 flex flex-col">

        {/* Top gradient strip */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-primary" />

        {/* Glow blobs */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 -bottom-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

        {/* Close */}
        <button
          onClick={closeModal}
          disabled={isCheckingOut}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-muted/80 text-muted-foreground backdrop-blur transition hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── Scrollable content ── */}
        <div className="relative overflow-y-auto flex-1">
          <div className="grid lg:grid-cols-[1fr_380px]">

            {/* ═══ TOP — Identity, full width ══════════════════════
                Lifted out of the features column so it stays above the fold
                on a phone. Below lg the grid stacks, and a title trapped in
                the features column would otherwise sit above eight feature
                cards — pushing the prices off-screen entirely. */}
            <div className="p-6 pb-0 sm:p-8 sm:pb-0 lg:col-span-2">
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
                  <Crown className="h-4.5 w-4.5 fill-white text-white" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-amber-500 uppercase tracking-widest">
                    AP DSC / SGT Pro Pass
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground leading-tight">
                    Everything Unlocked.<br className="hidden sm:block" />
                    <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-primary bg-clip-text text-transparent">
                      Score 135+.
                    </span>
                  </h2>
                </div>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed mb-5">
                All plans unlock the <strong className="text-foreground">exact same features</strong> — the only difference is how long your access lasts. Pick the plan that fits your exam timeline.
              </p>

              {/* Active premium banner */}
              {isPremium && (
                <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div className="text-xs">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Pro Active</span>
                    <span className="text-muted-foreground"> — {activePlanName}</span>
                    {expiresAt && (
                      <span className="text-muted-foreground"> · valid until <strong className="text-foreground">{formatDate(expiresAt)}</strong></span>
                    )}
                    <span className="block text-muted-foreground/70 mt-0.5">Buying another plan extends your access.</span>
                  </div>
                </div>
              )}

            </div>

            {/* ═══ LEFT — Features ═════════════════════════════════
                order-2 on a phone: the plans come first, because someone who
                opened this wants to know the price, and reading eight feature
                cards before finding it is the wrong way round. On lg both
                columns are visible at once and the natural order returns. */}
            <div className="order-2 p-6 pt-5 sm:p-8 sm:pt-5 lg:order-1 lg:border-r border-border/60">

              {/* Feature grid */}
              <div className="grid sm:grid-cols-2 gap-2.5">
                {PREMIUM_FEATURES.map((feat) => {
                  const Icon = feat.icon
                  return (
                    <div
                      key={feat.title}
                      className="group flex items-start gap-3 rounded-xl border border-border/50 bg-card/60 p-3 transition-all hover:border-amber-500/30 hover:bg-amber-500/5"
                    >
                      <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg ${feat.bg} ${feat.color} mt-0.5`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground leading-tight">{feat.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{feat.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Trust badges */}
              <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground border-t border-border/50 pt-4">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  Secured by Razorpay
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Instant activation
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" />
                  UPI · Cards · Net Banking
                </span>
              </div>
            </div>

            {/* ═══ RIGHT — Plan Selector + Checkout ════════════════ */}
            <div className="order-1 flex flex-col gap-5 bg-muted/20 p-6 sm:p-8 lg:order-2">

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground">Choose Your Plan</h3>
                  {!loadingPlans && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                      <RefreshCw className="h-2.5 w-2.5" />
                      Live pricing
                    </span>
                  )}
                </div>

                {/* Plan cards */}
                <div className="flex flex-col gap-2.5">
                  {loadingPlans ? (
                    [1, 2, 3].map(i => <PlanSkeleton key={i} />)
                  ) : (
                    displayPlans.map((plan) => {
                      const isSelected = selectedPlan === plan.id
                      const pct = discountPctFor(plan.id)
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          disabled={isCheckingOut}
                          onClick={() => setSelectedPlan(plan.id)}
                          className={`relative w-full rounded-2xl border p-4 text-left transition-all focus:outline-none ${
                            plan.popular && isSelected
                              ? 'border-amber-500 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10'
                              : isSelected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                              : 'border-border bg-card hover:border-border/80 hover:bg-card'
                          }`}
                        >
                          {/* Popular pill */}
                          {plan.popular && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-0.5 text-[11px] font-black text-white whitespace-nowrap shadow-sm">
                              ★ MOST POPULAR
                            </span>
                          )}

                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-foreground">{plan.name}</span>
                                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                                  pct >= 60
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                }`}>
                                  {pct}% OFF
                                </span>
                              </div>
                              <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-xl font-extrabold text-foreground">
                                  {formatPaise(priceFor(plan.id))}
                                </span>
                                <span className="text-xs text-muted-foreground line-through">
                                  {formatPaise(origPriceFor(plan.id))}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {plan.period} · {plan.durationDays} days access
                              </div>
                            </div>

                            {/* Radio indicator */}
                            <div className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                              isSelected
                                ? plan.popular
                                  ? 'border-amber-500 bg-amber-500'
                                  : 'border-primary bg-primary'
                                : 'border-muted-foreground/30 bg-transparent'
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Promo code */}
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                  Promo Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="e.g. APDSC50"
                    disabled={isCheckingOut}
                    maxLength={32}
                    className="flex-1 h-9 rounded-xl border border-border bg-background px-3 text-xs uppercase placeholder:normal-case placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={isCheckingCoupon || isCheckingOut || !couponCode.trim()}
                    className="h-9 rounded-xl border border-border bg-background px-3.5 text-xs font-bold hover:bg-accent disabled:opacity-50 transition-colors"
                  >
                    {isCheckingCoupon ? '…' : 'Apply'}
                  </button>
                </div>
                {coupon && (
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {coupon.code} — {coupon.discountPercent}% off applied
                  </div>
                )}
              </form>

              {/* CTA */}
              <div className="flex flex-col gap-2 mt-auto">
                <button
                  onClick={handleSubscribe}
                  disabled={isCheckingOut || loadingPlans}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary py-3.5 text-sm font-black text-white shadow-lg shadow-amber-500/25 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.99] disabled:opacity-70"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {isCheckingOut ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Opening secure payment…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Crown className="h-4 w-4 fill-white" />
                      {isPremium
                        ? `Extend Access · Pay ${payAmount}`
                        : `Unlock Pro · Pay ${payAmount}`}
                    </span>
                  )}
                </button>

                <button
                  onClick={closeModal}
                  disabled={isCheckingOut}
                  className="w-full rounded-2xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {isPremium ? 'Close' : 'Continue with Free Tier'}
                </button>

                <p className="text-center text-[11px] text-muted-foreground/60 leading-relaxed">
                  No auto-renewal · One-time payment · Razorpay secured
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
