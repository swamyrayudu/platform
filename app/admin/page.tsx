'use client'

// ============================================================
// app/admin/page.tsx — Admin Dashboard (client-side)
// ============================================================
// Protected at two layers:
//   1. Frontend: redirects non-admin users to /home (role check)
//   2. Backend: all /api/admin/* routes return 403 for non-admins
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import TopNav from '@/app/components/home/TopNav'
import { LoadingScreen } from '@/components/ui/loading-screen'
import {
  ShieldCheck,
  Users,
  TrendingUp,
  CreditCard,
  Crown,
  Pencil,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Calendar,
  UserCheck,
  UserX,
  Activity,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { PLAN_LIST, type Plan, type PlanId } from '@/lib/payments/plans'

// ---- Types -------------------------------------------------------

interface UserStats {
  total: number
  premium: number
  free: number
  newToday: number
  newThisWeek: number
}

interface RevenueStats {
  totalRevenuePaise: number
  successfulPayments: number
  failedPayments: number
  pendingPayments: number
}

interface RecentPayment {
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

interface AdminPlanView extends Plan {
  hasOverride: boolean
  updatedAt: string | null
}

interface DashboardData {
  userStats: UserStats
  revenueStats: RevenueStats
  recentPayments: RecentPayment[]
  timestamp: string
}

// ---- Helpers -----------------------------------------------------

function formatPaise(paise: number): string {
  const rupees = paise / 100
  return `₹${Number.isInteger(rupees) ? rupees.toLocaleString('en-IN') : rupees.toFixed(2)}`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_STYLES: Record<string, string> = {
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

function PlanEditor({ plan, onSave, onReset, isSaving }: PlanEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [price, setPrice] = useState(String(plan.amountPaise / 100))
  const [origPrice, setOrigPrice] = useState(String(plan.originalAmountPaise / 100))
  const [name, setName] = useState(plan.name)
  const [period, setPeriod] = useState(plan.period)
  const [badge, setBadge] = useState(plan.badge)
  const [featuresText, setFeaturesText] = useState(plan.features.join('\n'))
  const [showFeatures, setShowFeatures] = useState(false)

  // Reset local state when plan data changes (after save)
  useEffect(() => {
    setPrice(String(plan.amountPaise / 100))
    setOrigPrice(String(plan.originalAmountPaise / 100))
    setName(plan.name)
    setPeriod(plan.period)
    setBadge(plan.badge)
    setFeaturesText(plan.features.join('\n'))
  }, [plan])

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
        <div className="absolute right-3 top-3 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
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
              <p className="mt-0.5 text-[10px] text-amber-500/80">
                Updated {formatDateTime(plan.updatedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Price inputs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
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
            <label className="mb-1 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
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
            <label className="mb-1 block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
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

function StatCard({
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
    blue: 'bg-blue-500/10 text-blue-500',
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

// ---- Main Page ---------------------------------------------------

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading, logout, logoutAll } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [plans, setPlans] = useState<AdminPlanView[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ---- Auth guard
  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return }
    if (!loading && user && user.role !== 'admin') { router.replace('/home'); return }
  }, [user, loading, router])

  // ---- Fetch dashboard + plans
  const fetchAll = useCallback(async () => {
    if (!user || user.role !== 'admin') return
    setLoadingData(true)
    setError(null)
    try {
      const [dashRes, plansRes] = await Promise.all([
        fetch('/api/admin/dashboard', { credentials: 'include' }),
        fetch('/api/admin/plans', { credentials: 'include' }),
      ])

      if (dashRes.status === 403 || plansRes.status === 403) {
        router.replace('/home')
        return
      }

      if (!dashRes.ok) {
        setError('Failed to load dashboard stats')
      } else {
        const data = await dashRes.json()
        setDashboardData(data)
      }

      if (plansRes.ok) {
        const data = await plansRes.json()
        setPlans(data.plans ?? [])
      }
    } catch {
      setError('Network error loading admin dashboard')
    } finally {
      setLoadingData(false)
    }
  }, [user, router])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ---- Plan save handler
  const handlePlanSave = async (
    planId: PlanId,
    data: {
      amountPaise: number
      originalAmountPaise: number
      name: string
      period: string
      badge: string
      features: string[]
    }
  ) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId, ...data }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error('Failed to save plan', { description: json.message ?? json.error ?? 'Server error' })
        return
      }

      toast.success(`✅ ${planId} updated — prices live immediately`)
      // Update local plan list
      setPlans(prev => prev.map(p => (p.id === planId ? (json.plan as AdminPlanView) : p)))
    } catch {
      toast.error('Network error saving plan')
    } finally {
      setIsSaving(false)
    }
  }

  // ---- Plan reset handler
  const handlePlanReset = async (planId: PlanId) => {
    if (!confirm(`Reset "${planId}" to code defaults? This removes the DB override.`)) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId }),
      })

      if (!res.ok) {
        toast.error('Failed to reset plan')
        return
      }

      toast.success(`${planId} reset to code defaults`)
      // Restore to code defaults
      const defaultPlan = PLAN_LIST.find(p => p.id === planId)
      if (defaultPlan) {
        setPlans(prev => prev.map(p =>
          p.id === planId ? { ...defaultPlan, hasOverride: false, updatedAt: null } : p
        ))
      }
    } catch {
      toast.error('Network error resetting plan')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading admin dashboard..." />
  if (!user || user.role !== 'admin') return null

  const { userStats, revenueStats, recentPayments } = dashboardData ?? {
    userStats: { total: 0, premium: 0, free: 0, newToday: 0, newThisWeek: 0 },
    revenueStats: { totalRevenuePaise: 0, successfulPayments: 0, failedPayments: 0, pendingPayments: 0 },
    recentPayments: [],
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <TopNav user={user} logout={logout} logoutAll={logoutAll} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-primary/20 text-red-500">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-foreground">Admin Dashboard</h1>
                <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-500 uppercase tracking-wide">
                  Restricted
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Welcome, <span className="font-semibold text-foreground">{user.name ?? user.email}</span>
                {dashboardData && (
                  <span className="ml-2 text-[11px] text-muted-foreground/60">
                    · Last refreshed {formatDateTime(dashboardData.timestamp)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={fetchAll}
            disabled={loadingData}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
          >
            <Activity className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Error ───────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── User Stats ──────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-4 text-base font-bold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> User Overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard icon={Users} label="Total Users" value={userStats.total.toLocaleString()} color="primary" />
            <StatCard icon={UserCheck} label="Active Premium" value={userStats.premium.toLocaleString()} sub={userStats.total > 0 ? `${Math.round(userStats.premium / userStats.total * 100)}% conversion` : ''} color="emerald" />
            <StatCard icon={UserX} label="Free Users" value={userStats.free.toLocaleString()} color="blue" />
            <StatCard icon={Clock} label="New Today" value={userStats.newToday.toLocaleString()} color="amber" />
            <StatCard icon={TrendingUp} label="New This Week" value={userStats.newThisWeek.toLocaleString()} color="primary" />
          </div>
        </section>

        {/* ── Revenue Stats ───────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-4 text-base font-bold text-foreground flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-primary" /> Revenue
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={IndianRupee} label="Total Revenue" value={formatPaise(revenueStats.totalRevenuePaise)} color="emerald" />
            <StatCard icon={CreditCard} label="Successful Payments" value={revenueStats.successfulPayments.toLocaleString()} color="emerald" />
            <StatCard icon={AlertTriangle} label="Failed Payments" value={revenueStats.failedPayments.toLocaleString()} color="red" />
            <StatCard icon={Clock} label="Pending Orders" value={revenueStats.pendingPayments.toLocaleString()} color="amber" />
          </div>
        </section>

        {/* ── Premium Pricing Manager ─────────────────────────── */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" /> Premium Pricing Manager
            </h2>
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin-only · Changes are live immediately
            </div>
          </div>

          {plans.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {PLAN_LIST.map(plan => (
                <div key={plan.id} className="h-64 rounded-2xl border border-border bg-card animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {plans.map(plan => (
                <PlanEditor
                  key={plan.id}
                  plan={plan}
                  onSave={handlePlanSave}
                  onReset={handlePlanReset}
                  isSaving={isSaving}
                />
              ))}
            </div>
          )}

          <div className="mt-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-[11px] text-muted-foreground">
            <strong className="text-foreground">How it works:</strong> Price overrides are stored in the{' '}
            <code className="rounded bg-muted px-1">plan_overrides</code> DB table.
            The payment server reads them at order-creation time — no redeployment required.
            Resetting removes the override and restores the code default from{' '}
            <code className="rounded bg-muted px-1">lib/payments/plans.ts</code>.
          </div>
        </section>

        {/* ── Recent Payments ─────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-base font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Recent Payments
            <span className="text-xs font-normal text-muted-foreground">(last 20)</span>
          </h2>

          {recentPayments.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {loadingData ? 'Loading payment history…' : 'No payments yet'}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Plan</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Coupon</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                        <Calendar className="inline h-3.5 w-3.5" /> Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {recentPayments.map(payment => (
                      <tr key={payment.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground truncate max-w-32">
                            {payment.userName ?? '—'}
                          </div>
                          <div className="text-muted-foreground truncate max-w-32">
                            {payment.userEmail ?? payment.userId.slice(0, 12) + '…'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            {payment.planId}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatPaise(payment.amount)}
                          {payment.discountPercent > 0 && (
                            <div className="text-[10px] text-emerald-500 font-semibold">
                              -{payment.discountPercent}% off
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[payment.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {payment.couponCode ?? <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                          {formatDate(payment.paidAt ?? payment.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
