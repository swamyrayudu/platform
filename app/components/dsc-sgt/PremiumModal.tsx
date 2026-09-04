'use client'

import React, { useState } from 'react'
import {
  Crown,
  Check,
  Sparkles,
  X,
  ShieldCheck,
  Trophy,
  CheckCircle2,
  Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePremium } from './PremiumContext'
import {
  PLAN_LIST,
  discountLabel,
  formatPaise,
  getPlan,
  isPlanId,
  type PlanId,
} from '@/lib/payments/plans'

interface AppliedCoupon {
  code: string
  discountPercent: number
  /** planId → discounted amount in paise */
  prices: Record<string, number>
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

  if (!isModalOpen) return null

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
        toast.success(`Coupon ${data.code} applied — ${data.discountPercent}% off`)
      } else {
        setCoupon(null)
        toast.error(
          res.status === 429 ? 'Too many attempts. Please wait a moment.' : 'That promo code is not valid.'
        )
      }
    } catch {
      toast.error('Could not check the promo code. Please try again.')
    } finally {
      setIsCheckingCoupon(false)
    }
  }

  const priceFor = (planId: PlanId): number => {
    const plan = getPlan(planId)
    return coupon?.prices[planId] ?? plan.amountPaise
  }

  const handleSubscribe = async () => {
    await startCheckout(selectedPlan, coupon?.code)
  }

  const activePlanName = isPlanId(currentPlan) ? getPlan(currentPlan).name : 'Pro'
  const payAmount = formatPaise(priceFor(selectedPlan))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-amber-500/30 bg-background text-foreground shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Glow accent */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />

        {/* Close Button */}
        <button
          onClick={closeModal}
          disabled={isCheckingOut}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-6 sm:p-8">
          {/* Header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-500">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AP DSC / SGT PREPARATION PASS</span>
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              Unlock Your Teacher Rank with <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-primary bg-clip-text text-transparent">Pro Access</span>
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-xs sm:text-sm text-muted-foreground">
              Get unlimited access to all AP DSC SGT Grand Mocks, 12,000+ Telugu medium & English medium questions, instant AI explanations, and rank analytics.
            </p>
          </div>

          {/* Current Status banner if already premium */}
          {isPremium && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>
                <strong>Pro Active</strong> — {activePlanName}
                {expiresAt && <> · valid until <strong>{formatDate(expiresAt)}</strong></>}.
                Buying another plan extends your access from that date.
              </span>
            </div>
          )}

          {/* Pricing Plans Grid */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PLAN_LIST.map((plan) => {
              const isSelected = selectedPlan === plan.id
              return (
                <div
                  key={plan.id}
                  onClick={() => !isCheckingOut && setSelectedPlan(plan.id)}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-4.5 transition-all cursor-pointer ${
                    plan.popular
                      ? 'border-amber-500 bg-gradient-to-b from-amber-500/5 to-transparent shadow-lg ring-2 ring-amber-500/20'
                      : isSelected
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border/80 bg-card hover:border-border'
                  }`}
                >
                  {plan.badge && (
                    <div
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-xs whitespace-nowrap ${
                        plan.popular
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                          : 'bg-muted border border-border text-muted-foreground'
                      }`}
                    >
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/40'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5" />}
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-2xl font-extrabold text-foreground">
                        {formatPaise(priceFor(plan.id))}
                      </span>
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPaise(plan.originalAmountPaise)}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-500">{discountLabel(plan)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{plan.period}</p>

                    <div className="my-3 border-t border-border/60" />

                    <ul className="space-y-1.5">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-tight">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    className={`mt-4 w-full rounded-xl py-2 text-xs font-bold transition-colors ${
                      isSelected
                        ? plan.popular
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-105 shadow-xs'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border border-border bg-card text-foreground hover:bg-accent'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select Plan'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Promo code + Trust row */}
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/30 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <form onSubmit={handleApplyCoupon} className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Promo Code (e.g. APDSC50)"
                disabled={isCheckingOut}
                maxLength={32}
                className="h-8.5 w-44 rounded-lg border border-border bg-background px-3 text-xs uppercase placeholder:normal-case placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isCheckingCoupon || isCheckingOut || !couponCode.trim()}
                className="h-8.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-accent disabled:opacity-60"
              >
                {isCheckingCoupon ? 'Checking…' : 'Apply'}
              </button>
              {coupon && (
                <span className="text-[11px] font-bold text-emerald-500">
                  ✓ {coupon.code}: {coupon.discountPercent}% off applied
                </span>
              )}
            </form>

            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-primary" /> Secured by Razorpay
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Instant Unlock
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-amber-500" /> 100% Syllabus
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
            <button
              onClick={closeModal}
              disabled={isCheckingOut}
              className="rounded-xl border border-border px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60"
            >
              {isPremium ? 'Close' : 'Continue with Free Tier'}
            </button>
            <button
              onClick={handleSubscribe}
              disabled={isCheckingOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-6 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-105 active:scale-[0.99] disabled:opacity-70 transition-all"
            >
              {isCheckingOut ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Opening secure payment…</span>
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4" />
                  <span>
                    {isPremium ? `Extend Pro Access · Pay ${payAmount}` : `Unlock Pro · Pay ${payAmount}`}
                  </span>
                </>
              )}
            </button>
          </div>

          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            UPI, cards, net banking and wallets accepted. Payments are processed by Razorpay; we never see your card details.
          </p>
        </div>
      </div>
    </div>
  )
}
