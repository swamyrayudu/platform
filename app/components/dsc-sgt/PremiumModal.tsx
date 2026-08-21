'use client'

import React, { useState } from 'react'
import {
  Crown,
  Check,
  Zap,
  Sparkles,
  X,
  ShieldCheck,
  BookOpen,
  Trophy,
  Flame,
  CheckCircle2,
} from 'lucide-react'
import { usePremium, type PremiumPlan } from './PremiumContext'

const PLANS = [
  {
    id: 'pro_sprint' as PremiumPlan,
    name: '30-Day Sprint',
    price: '₹299',
    originalPrice: '₹599',
    discount: '50% OFF',
    period: '/ 1 Month',
    badge: 'Popular for Quick Revision',
    popular: false,
    features: [
      'Access to 25+ Full Grand Mocks',
      'All 10,000+ Practice MCQs',
      'Instant Answer Keys & Solutions',
      'Chapter-wise Tests',
    ],
  },
  {
    id: 'pro_full' as PremiumPlan,
    name: 'DSC SGT Pro Pass',
    price: '₹599',
    originalPrice: '₹1,499',
    discount: '60% OFF',
    period: '/ 6 Months',
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
  {
    id: 'lifetime' as PremiumPlan,
    name: 'Ultimate All-Exams Pass',
    price: '₹999',
    originalPrice: '₹2,999',
    discount: '67% OFF',
    period: '/ 1 Year',
    badge: 'Best Value',
    popular: false,
    features: [
      'Everything in DSC SGT Pro Pass',
      'Free Access to DSC TET & APPSC',
      'Priority Doubt Support',
      'Future AP DSC Notification Updates',
    ],
  },
]

export default function PremiumModal() {
  const { isModalOpen, closeModal, isPremium, upgradePlan, resetToFree, currentPlan } = usePremium()
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlan>('pro_full')
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isModalOpen) return null

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault()
    if (couponCode.trim().toUpperCase() === 'APDSC50' || couponCode.trim().toUpperCase() === 'PRO100') {
      setCouponApplied(true)
    } else {
      setCouponApplied(true) // accept any demo code for pleasant experience
    }
  }

  const handleSubscribe = () => {
    setIsProcessing(true)
    setTimeout(() => {
      upgradePlan(selectedPlan)
      setIsProcessing(false)
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-amber-500/30 bg-background text-foreground shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Glow accent */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />

        {/* Close Button */}
        <button
          onClick={closeModal}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
            <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>
                  <strong>Pro Active!</strong> You currently have full access ({currentPlan}).
                </span>
              </div>
              <button
                onClick={resetToFree}
                className="rounded-lg border border-border/80 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                Switch to Free Demo
              </button>
            </div>
          )}

          {/* Pricing Plans Grid */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
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
                        {couponApplied ? `₹${Math.round(parseInt(plan.price.replace('₹', '')) * 0.8)}` : plan.price}
                      </span>
                      <span className="text-xs text-muted-foreground line-through">{plan.originalPrice}</span>
                      <span className="text-[10px] font-bold text-emerald-500">{plan.discount}</span>
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
            <form onSubmit={handleApplyCoupon} className="flex items-center gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Promo Code (e.g. APDSC50)"
                className="h-8.5 w-44 rounded-lg border border-border bg-background px-3 text-xs uppercase placeholder:normal-case placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                className="h-8.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-accent"
              >
                Apply
              </button>
              {couponApplied && (
                <span className="text-[11px] font-bold text-emerald-500">✓ Extra 20% Applied!</span>
              )}
            </form>

            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Instant Unlock
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-amber-500" /> 100% Syllabus Coverage
              </span>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
            <button
              onClick={closeModal}
              className="rounded-xl border border-border px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Continue with Free Tier
            </button>
            <button
              onClick={handleSubscribe}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-6 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-105 active:scale-[0.99] disabled:opacity-70 transition-all"
            >
              {isProcessing ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Unlocking Pro Access...</span>
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4" />
                  <span>
                    {isPremium ? 'Renew / Update Pro Plan' : 'Unlock DSC / SGT Pro Instantly'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
