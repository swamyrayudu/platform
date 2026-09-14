'use client'

// ============================================================
// app/admin/page.tsx — Admin Dashboard (client-side)
// ============================================================
// Protected at two layers:
//   1. Frontend: redirects non-admin users to /home (role check)
//   2. Backend: all /api/admin/* routes return 403 for non-admins
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import MockModuleGenerator from '@/app/components/admin/MockModuleGenerator'
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
  Database,
  Flag,
  Replace,
  Plus,
  Download,
  FileSpreadsheet,
  FileJson,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe,
  Brain,
  Languages,
  Newspaper,
  Layers,
  Sparkles,
  Loader2,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { PLAN_LIST, type Plan, type PlanId } from '@/lib/payments/plans'

// ---- Types -------------------------------------------------------

interface PracticeSubjectStat {
  key: string
  name: string
  teluguName: string
  icon: string
  englishCount: number
  teluguCount: number
  totalCount: number
}

interface PracticeDataStats {
  totalQuestions: number
  englishQuestions: number
  teluguQuestions: number
  subjects: PracticeSubjectStat[]
  timestamp: string
}

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

// ---- Main Page ---------------------------------------------------

const SUBJECT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Languages,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe,
  Brain,
  Newspaper,
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading, logout, logoutAll } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [plans, setPlans] = useState<AdminPlanView[]>([])
  const [practiceStats, setPracticeStats] = useState<PracticeDataStats | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [customMedium, setCustomMedium] = useState<string>('all')
  const [customSubject, setCustomSubject] = useState<string>('all')
  const [customFormat, setCustomFormat] = useState<'csv' | 'json'>('csv')
  const [error, setError] = useState<string | null>(null)

  // ---- Auth guard
  useEffect(() => {
    if (!loading && !user) { router.replace('/'); return }
    if (!loading && user && user.role !== 'admin') { router.replace('/home'); return }
  }, [user, loading, router])

  // ---- Fetch dashboard + plans + practice stats
  const fetchAll = useCallback(async () => {
    if (!user || user.role !== 'admin') return
    setLoadingData(true)
    setError(null)
    try {
      const [dashRes, plansRes, practiceRes] = await Promise.all([
        fetch('/api/admin/dashboard', { credentials: 'include' }),
        fetch('/api/admin/plans', { credentials: 'include' }),
        fetch('/api/admin/practice-data?action=stats', { credentials: 'include' }),
      ])

      if (dashRes.status === 403 || plansRes.status === 403 || practiceRes.status === 403) {
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

      if (practiceRes.ok) {
        const data = await practiceRes.json()
        setPracticeStats(data)
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

  // ---- Practice data download handler
  const handlePracticeDownload = async (options: {
    medium?: string
    subject?: string
    format?: 'csv' | 'json'
    label?: string
  }) => {
    const { medium = 'all', subject = 'all', format = 'csv', label } = options
    const downloadId = `${subject}_${medium}_${format}`
    setDownloadingKey(downloadId)
    const toastId = toast.loading(`Preparing ${label || 'practice data'} (${format.toUpperCase()})...`)

    try {
      const params = new URLSearchParams({
        action: 'download',
        medium,
        subject,
        format,
      })

      const response = await fetch(`/api/admin/practice-data?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to download practice data')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition')
      let filename = `dsc_practice_${subject}_${medium}.${format}`
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/)
        if (match && match[1]) {
          filename = match[1]
        }
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Download ready: ${filename}`, { id: toastId })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Download error'
      toast.error('Download failed', {
        id: toastId,
        description: message,
      })
    } finally {
      setDownloadingKey(null)
    }
  }

  // Helper for dynamic question count in Custom Builder
  const getCustomEstimatedCount = (): number => {
    if (!practiceStats) return 0
    if (customSubject === 'all') {
      if (customMedium === 'english') return practiceStats.englishQuestions
      if (customMedium === 'telugu') return practiceStats.teluguQuestions
      return practiceStats.totalQuestions
    }
    const subj = practiceStats.subjects.find((s) => s.key === customSubject)
    if (!subj) return 0
    if (customMedium === 'english') return subj.englishCount
    if (customMedium === 'telugu') return subj.teluguCount
    return subj.totalCount
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
                <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-black text-red-500 uppercase tracking-wide">
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
          <div className="flex items-center gap-2">
            <Link
              href="/admin/module-questions"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Replace className="h-3.5 w-3.5" />
              Module questions
            </Link>

            <Link
              href="/admin/import-questions"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Import questions
            </Link>

            <Link
              href="/admin/bulk-update"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Bulk update
            </Link>

            <Link
              href="/admin/question-feedback"
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Flag className="h-3.5 w-3.5" />
              Question reports
            </Link>

            <button
              onClick={fetchAll}
              disabled={loadingData}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
            >
              <Activity className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
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

        {/* ── Practice Question Bank & Data Export ────────────── */}
        <section className="mb-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 via-primary/15 to-emerald-500/10 text-emerald-500 shadow-inner">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-foreground">Practice Question Bank & Data Export</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="h-2.5 w-2.5" /> Live Database Sync · 12 Tables
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Export complete question repositories, medium-wise archives, or subject-specific questions in Excel-ready CSV (UTF-8) and JSON
                </p>
              </div>
            </div>

            {/* Total Data 1-Click Action Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => handlePracticeDownload({ medium: 'all', subject: 'all', format: 'csv', label: 'All Practice Questions' })}
                disabled={Boolean(downloadingKey)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 text-xs font-bold shadow-sm shadow-emerald-500/20 disabled:opacity-60 transition-all cursor-pointer"
                title="Download all practice questions across all subjects and mediums as CSV"
              >
                {downloadingKey === 'all_all_csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                <span>Download Total CSV</span>
                {practiceStats && (
                  <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-extrabold tracking-tight">
                    {practiceStats.totalQuestions.toLocaleString()} Qs
                  </span>
                )}
              </button>

              <button
                onClick={() => handlePracticeDownload({ medium: 'all', subject: 'all', format: 'json', label: 'All Practice Questions' })}
                disabled={Boolean(downloadingKey)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-60 transition-colors cursor-pointer"
                title="Download all practice questions in JSON format"
              >
                {downloadingKey === 'all_all_json' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileJson className="h-3.5 w-3.5 text-primary" />
                )}
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Overview Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              icon={Database}
              label="Total Questions in Bank"
              value={practiceStats ? practiceStats.totalQuestions.toLocaleString() : '...'}
              sub="Combined across 12 indexed tables"
              color="emerald"
            />
            <StatCard
              icon={Languages}
              label="English Medium Questions"
              value={practiceStats ? practiceStats.englishQuestions.toLocaleString() : '...'}
              sub={practiceStats && practiceStats.totalQuestions > 0 ? `${Math.round((practiceStats.englishQuestions / practiceStats.totalQuestions) * 100)}% of question bank` : ''}
              color="blue"
            />
            <StatCard
              icon={BookOpen}
              label="Telugu Medium Questions"
              value={practiceStats ? practiceStats.teluguQuestions.toLocaleString() : '...'}
              sub={practiceStats && practiceStats.totalQuestions > 0 ? `${Math.round((practiceStats.teluguQuestions / practiceStats.totalQuestions) * 100)}% of question bank` : ''}
              color="amber"
            />
            <StatCard
              icon={Layers}
              label="Subject Coverage"
              value={practiceStats ? `${practiceStats.subjects.length} Subjects` : '7 Subjects'}
              sub="Languages, Math, Sciences & Pedagogy"
              color="primary"
            />
          </div>

          {/* Medium-Wise Quick Download Cards */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {/* English Medium Card */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-blue-500/5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary border border-primary/20">
                    <Languages className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">English Medium Dataset</h3>
                    <p className="text-[11px] text-muted-foreground">Complete English medium practice archive</p>
                  </div>
                </div>
                <span className="rounded-full border border-primary/30 bg-secondary px-2.5 py-0.5 text-xs font-bold text-primary">
                  {practiceStats ? practiceStats.englishQuestions.toLocaleString() : '...'} Questions
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Includes English (Language II), Math (EM), General Science (EM), Social Studies (EM), Pedagogy & Educational Psychology (EM), GK & Current Affairs (EM).
              </p>
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <button
                  onClick={() => handlePracticeDownload({ medium: 'english', subject: 'all', format: 'csv', label: 'English Medium Dataset' })}
                  disabled={Boolean(downloadingKey)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground px-3.5 py-2 text-xs font-bold shadow-sm shadow-blue-500/20 disabled:opacity-60 transition-all cursor-pointer"
                >
                  {downloadingKey === 'all_english_csv' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  <span>Download English CSV</span>
                </button>
                <button
                  onClick={() => handlePracticeDownload({ medium: 'english', subject: 'all', format: 'json', label: 'English Medium Dataset' })}
                  disabled={Boolean(downloadingKey)}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-accent px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {downloadingKey === 'all_english_json' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileJson className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* Telugu Medium Card */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 via-card to-card p-5 transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Telugu Medium Dataset</h3>
                    <p className="text-[11px] text-muted-foreground font-serif">తెలుగు మీడియం సమగ్ర ప్రశ్నల నిధి</p>
                  </div>
                </div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  {practiceStats ? practiceStats.teluguQuestions.toLocaleString() : '...'} Questions
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Includes తెలుగు (భాష I), గణితం (TM), సాధారణ సైన్స్ (TM), సాంఘిక శాస్త్రం (TM), విద్యా మనోవిజ్ఞాన శాస్త్రం (TM), సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు (TM).
              </p>
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <button
                  onClick={() => handlePracticeDownload({ medium: 'telugu', subject: 'all', format: 'csv', label: 'Telugu Medium Dataset' })}
                  disabled={Boolean(downloadingKey)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 text-xs font-bold shadow-sm shadow-amber-500/20 disabled:opacity-60 transition-all cursor-pointer"
                >
                  {downloadingKey === 'all_telugu_csv' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  <span>Download Telugu CSV</span>
                </button>
                <button
                  onClick={() => handlePracticeDownload({ medium: 'telugu', subject: 'all', format: 'json', label: 'Telugu Medium Dataset' })}
                  disabled={Boolean(downloadingKey)}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-accent px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {downloadingKey === 'all_telugu_json' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileJson className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span>JSON</span>
                </button>
              </div>
            </div>
          </div>

          {/* Subject-Wise Breakdown & Download Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
            <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" /> Subject-Wise Question Inventory & Downloads
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select and download specific subject pools with independent English and Telugu medium packages
                </p>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg self-start sm:self-auto">
                All downloads include UTF-8 BOM encoding for Excel
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="px-4 py-3 text-left font-semibold">Subject</th>
                    <th className="px-4 py-3 text-center font-semibold">English Medium</th>
                    <th className="px-4 py-3 text-center font-semibold">Telugu Medium</th>
                    <th className="px-4 py-3 text-right font-semibold">Total Questions</th>
                    <th className="px-4 py-3 text-right font-semibold">Export Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {practiceStats?.subjects.map((subj) => {
                    const SubjectIcon = SUBJECT_ICON_MAP[subj.icon] || Database
                    return (
                      <tr key={subj.key} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <SubjectIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-bold text-foreground text-xs">{subj.name}</div>
                              <div className="text-[11px] text-muted-foreground">{subj.teluguName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {subj.englishCount > 0 ? (
                            <span className="inline-flex items-center rounded-md border border-primary/20 bg-secondary px-2 py-0.5 text-[11px] font-semibold text-primary">
                              {subj.englishCount.toLocaleString()} Qs
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {subj.teluguCount > 0 ? (
                            <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              {subj.teluguCount.toLocaleString()} Qs
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-foreground">
                          {subj.totalCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Download All CSV for this subject */}
                            <button
                              onClick={() => handlePracticeDownload({ medium: 'all', subject: subj.key, format: 'csv', label: `${subj.name} (All)` })}
                              disabled={Boolean(downloadingKey)}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                              title={`Download all ${subj.name} questions (both mediums) as CSV`}
                            >
                              {downloadingKey === `${subj.key}_all_csv` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileSpreadsheet className="h-3 w-3" />
                              )}
                              <span>All CSV</span>
                            </button>

                            {/* Download Telugu Medium CSV if present */}
                            {subj.teluguCount > 0 && (
                              <button
                                onClick={() => handlePracticeDownload({ medium: 'telugu', subject: subj.key, format: 'csv', label: `${subj.name} (Telugu)` })}
                                disabled={Boolean(downloadingKey)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                title={`Download ${subj.name} Telugu medium questions (${subj.teluguCount.toLocaleString()})`}
                              >
                                {downloadingKey === `${subj.key}_telugu_csv` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <span>TM CSV</span>
                                )}
                              </button>
                            )}

                            {/* Download English Medium CSV if present */}
                            {subj.englishCount > 0 && (
                              <button
                                onClick={() => handlePracticeDownload({ medium: 'english', subject: subj.key, format: 'csv', label: `${subj.name} (English)` })}
                                disabled={Boolean(downloadingKey)}
                                className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-secondary hover:bg-secondary text-primary px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                title={`Download ${subj.name} English medium questions (${subj.englishCount.toLocaleString()})`}
                              >
                                {downloadingKey === `${subj.key}_english_csv` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <span>EM CSV</span>
                                )}
                              </button>
                            )}

                            {/* Download JSON for this subject */}
                            <button
                              onClick={() => handlePracticeDownload({ medium: 'all', subject: subj.key, format: 'json', label: `${subj.name}` })}
                              disabled={Boolean(downloadingKey)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border hover:bg-accent px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                              title={`Download ${subj.name} in JSON format`}
                            >
                              {downloadingKey === `${subj.key}_all_json` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileJson className="h-3 w-3" />
                              )}
                              <span>JSON</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom Export Builder */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Custom Export Builder</h3>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Filtered subset export
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Select Medium
                </label>
                <select
                  value={customMedium}
                  onChange={(e) => setCustomMedium(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="all">All Mediums (Both English & Telugu)</option>
                  <option value="english">English Medium Only</option>
                  <option value="telugu">Telugu Medium Only (తెలుగు)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Select Subject
                </label>
                <select
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="all">All Subjects (Complete Syllabus)</option>
                  <option value="english">English (భాష II)</option>
                  <option value="telugu">Telugu (భాష I - తెలుగు)</option>
                  <option value="mathematics">Mathematics (గణితం)</option>
                  <option value="science">Science (సాధారణ సైన్స్)</option>
                  <option value="social_studies">Social Studies (సాంఘిక శాస్త్రం)</option>
                  <option value="pedagogy">Educational Psychology & Pedagogy (సైకాలజీ)</option>
                  <option value="gk">GK & Current Affairs (సాధారణ జ్ఞానం)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  File Format
                </label>
                <select
                  value={customFormat}
                  onChange={(e) => setCustomFormat(e.target.value as 'csv' | 'json')}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="csv">CSV Spreadsheet (.csv - Excel UTF-8)</option>
                  <option value="json">JSON Object Array (.json)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Estimated matching questions:</span>
                <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-bold text-primary">
                  {getCustomEstimatedCount().toLocaleString()} Questions
                </span>
              </div>

              <button
                onClick={() =>
                  handlePracticeDownload({
                    medium: customMedium,
                    subject: customSubject,
                    format: customFormat,
                    label: `Custom ${customSubject} (${customMedium})`,
                  })
                }
                disabled={Boolean(downloadingKey) || getCustomEstimatedCount() === 0}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {downloadingKey === `${customSubject}_${customMedium}_${customFormat}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Download Custom Dataset ({customFormat.toUpperCase()})</span>
              </button>
            </div>
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
                          <span className="rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                            {payment.planId}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatPaise(payment.amount)}
                          {payment.discountPercent > 0 && (
                            <div className="text-[11px] text-emerald-500 font-semibold">
                              -{payment.discountPercent}% off
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[payment.status] ?? 'bg-muted text-muted-foreground border-border'}`}>
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

        {/* ── Mock Module Series Generator ── */}
        <section className="mt-8">
          <MockModuleGenerator />
        </section>

      </main>
    </div>
  )
}
