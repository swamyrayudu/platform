'use client'

// ============================================================
// app/components/admin/shared.tsx — Pieces used by more than one admin page
// ============================================================
// Lifted out of the single 1,300-line dashboard when it was split into
// routes. Nothing here is new: the types, the money and date formatters, the
// plan editor and the stat card all came from that file unchanged, and they
// live here because Overview, Payments and Question bank each need some of
// them.
// ============================================================

import React, { useState } from 'react'
import { toast } from 'sonner'
import {
  Crown,
  Pencil,
  RotateCcw,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { type Plan, type PlanId } from '@/lib/payments/plans'

export interface PracticeSubjectStat {
  key: string
  name: string
  teluguName: string
  icon: string
  englishCount: number
  teluguCount: number
  totalCount: number
}

export interface PracticeDataStats {
  totalQuestions: number
  englishQuestions: number
  teluguQuestions: number
  subjects: PracticeSubjectStat[]
  timestamp: string
}

export interface UserStats {
  total: number
  premium: number
  free: number
  newToday: number
  newThisWeek: number
}

export interface RevenueStats {
  totalRevenuePaise: number
  successfulPayments: number
  failedPayments: number
  pendingPayments: number
}

export interface RecentPayment {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  planId: string
  amount: number
  currency: string
  status: string
  couponCode: string | null
  discountPercent: number
  paidAt: string | null
  createdAt: string
}

export interface AdminPlanView extends Plan {
  hasOverride: boolean
  updatedAt: string | null
}

export interface DashboardData {
  userStats: UserStats
  revenueStats: RevenueStats
  recentPayments: RecentPayment[]
  timestamp: string
}

// ---- Helpers -----------------------------------------------------

export function formatPaise(paise: number): string {
  const rupees = paise / 100
  return `₹${Number.isInteger(rupees) ? rupees.toLocaleString('en-IN') : rupees.toFixed(2)}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  CREATED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
}

// ---- Plan Editor -------------------------------------------------

interface PlanEditorProps {
  plan: AdminPlanView
  onSave: (planId: PlanId, data: {
    amountPaise: number
    originalAmountPaise: number
    name: string
    period: string
    badge: string
    features: string[]
  }) => Promise<void>
  onReset: (planId: PlanId) => Promise<void>
  isSaving: boolean
}

export function PlanEditor({ plan, onSave, onReset, isSaving }: PlanEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [price, setPrice] = useState(String(plan.amountPaise / 100))
  const [origPrice, setOrigPrice] = useState(String(plan.originalAmountPaise / 100))
  const [name, setName] = useState(plan.name)
  const [period, setPeriod] = useState(plan.period)
  const [badge, setBadge] = useState(plan.badge)
  const [featuresText, setFeaturesText] = useState(plan.features.join('\n'))
  const [showFeatures, setShowFeatures] = useState(false)

  // Re-sync the form when the saved plan comes back from the server.
  //
  // Adjusted during render rather than in an effect: an effect keyed on [plan]
  // also fires on mount, and it renders once with the old values before
  // correcting them — on a price field that is a visible flicker between two
  // numbers. Comparing the previous plan object here corrects it before
  // anything is painted.
  const [lastPlan, setLastPlan] = useState(plan)
  if (lastPlan !== plan) {
    setLastPlan(plan)
    setPrice(String(plan.amountPaise / 100))
    setOrigPrice(String(plan.originalAmountPaise / 100))
    setName(plan.name)
    setPeriod(plan.period)
    setBadge(plan.badge)
    setFeaturesText(plan.features.join('\n'))
  }

  const pricePaise = Math.round(parseFloat(price || '0') * 100)
  const origPricePaise = Math.round(parseFloat(origPrice || '0') * 100)
  const discountPct = origPricePaise > 0
    ? Math.round((1 - pricePaise / origPricePaise) * 100)
    : 0

  const handleSave = async () => {
    if (pricePaise < 100) {
      toast.error('Price must be at least ₹1')
      return
    }
    if (origPricePaise < pricePaise) {
      toast.error('Original price must be ≥ selling price')
      return
    }
    const features = featuresText.split('\n').map(f => f.trim()).filter(Boolean)
    await onSave(plan.id, {
      amountPaise: pricePaise,
      originalAmountPaise: origPricePaise,
      name: name.trim() || plan.name,
      period: period.trim() || plan.period,
      badge: badge.trim(),
      features,
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setPrice(String(plan.amountPaise / 100))
    setOrigPrice(String(plan.originalAmountPaise / 100))
    setName(plan.name)
    setPeriod(plan.period)
    setBadge(plan.badge)
    setFeaturesText(plan.features.join('\n'))
    setIsEditing(false)
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
      plan.hasOverride
        ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent'
        : 'border-border bg-card'
    }`}>
      {/* Override badge */}
      {plan.hasOverride && (
        <div className="absolute right-3 top-3 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-500">
          OVERRIDDEN
        </div>
      )}

      <div className="p-5">
        {/* Plan header */}
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            {isEditing ? (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1 text-sm font-bold text-foreground focus:border-primary focus:outline-none"
              />
            ) : (
              <h3 className="text-sm font-bold text-foreground">{plan.name}</h3>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">{plan.id}</p>
            {plan.hasOverride && plan.updatedAt && (
              <p className="mt-0.5 text-[11px] text-amber-500/80">
                Updated {formatDateTime(plan.updatedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Price inputs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Selling Price (₹)
            </label>
            {isEditing ? (
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                min="1"
                step="0.01"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-foreground focus:border-primary focus:outline-none"
              />
            ) : (
              <div className="text-2xl font-extrabold text-foreground">{formatPaise(plan.amountPaise)}</div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Original Price (₹)
            </label>
            {isEditing ? (
              <input
                type="number"
                value={origPrice}
                onChange={e => setOrigPrice(e.target.value)}
                min="1"
                step="0.01"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold text-foreground line-through decoration-red-400 focus:border-primary focus:outline-none"
              />
            ) : (
              <div className="text-sm font-semibold text-muted-foreground line-through">{formatPaise(plan.originalAmountPaise)}</div>
            )}
          </div>
        </div>

        {/* Discount + period */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
            discountPct >= 50 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
          }`}>
            {discountPct}% OFF
          </span>
          {isEditing ? (
            <input
              value={period}
              onChange={e => setPeriod(e.target.value)}
              placeholder="e.g. / 6 Months"
              className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground focus:border-primary focus:outline-none"
            />
          ) : (
            <span className="text-xs text-muted-foreground">{plan.period} · {plan.durationDays} days</span>
          )}
        </div>

        {/* Badge */}
        {isEditing && (
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Badge Text
            </label>
            <input
              value={badge}
              onChange={e => setBadge(e.target.value)}
              placeholder="e.g. ★ Most Recommended"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {/* Features toggle */}
        <button
          type="button"
          onClick={() => setShowFeatures(v => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/50 transition-colors mb-3"
        >
          <span>{plan.features.length} Features</span>
          {showFeatures ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showFeatures && (
          <div className="mb-3">
            {isEditing ? (
              <textarea
                value={featuresText}
                onChange={e => setFeaturesText(e.target.value)}
                rows={5}
                placeholder="One feature per line"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none resize-y"
              />
            ) : (
              <ul className="space-y-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/60 mt-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {isSaving ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save Changes
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-60 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Plan
              </button>
              {plan.hasOverride && (
                <button
                  onClick={() => onReset(plan.id)}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-red-500/10 hover:text-red-500 disabled:opacity-60 transition-colors"
                  title="Reset to code defaults"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---- Stat Card ---------------------------------------------------

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'primary',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  color?: 'primary' | 'emerald' | 'amber' | 'red' | 'blue'
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    blue: 'bg-secondary text-primary',
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-2xl font-extrabold text-foreground">{value}</div>
      <div className="text-xs font-semibold text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground/70 mt-1">{sub}</div>}
    </div>
  )
}
