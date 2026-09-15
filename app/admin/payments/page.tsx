'use client'

// ============================================================
// app/admin/payments/page.tsx — Money: revenue, pricing, transactions
// ============================================================
// Everything to do with payments in one place. It used to be three sections
// scattered through the dashboard — revenue cards near the top, the plan
// pricing editor in the middle, recent transactions eight hundred lines
// further down — with the question bank in between them.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Activity,
  CreditCard,
  IndianRupee,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { type PlanId } from '@/lib/payments/plans'
import {
  PlanEditor,
  StatCard,
  STATUS_STYLES,
  formatDateTime,
  formatPaise,
  type AdminPlanView,
  type RecentPayment,
  type RevenueStats,
} from '@/app/components/admin/shared'

export default function AdminPaymentsPage() {
  const [revenue, setRevenue] = useState<RevenueStats | null>(null)
  const [payments, setPayments] = useState<RecentPayment[]>([])
  const [plans, setPlans] = useState<AdminPlanView[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [savingPlanId, setSavingPlanId] = useState<PlanId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const [dashRes, plansRes] = await Promise.all([
        fetch('/api/admin/dashboard', { credentials: 'include' }),
        fetch('/api/admin/plans', { credentials: 'include' }),
      ])

      if (dashRes.ok) {
        const data = await dashRes.json()
        setRevenue(data.revenueStats ?? null)
        setPayments(data.recentPayments ?? [])
      } else {
        setError('Could not load revenue figures.')
      }

      if (plansRes.ok) {
        const data = await plansRes.json()
        setPlans(data.plans ?? [])
      }
    } catch {
      setError('Network error while loading payment data.')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
  }, [fetchAll])

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
    setSavingPlanId(planId)
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId, ...data }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error('Could not save the plan', { description: json.error })
        return
      }
      setPlans((prev) => prev.map((p) => (p.id === planId ? (json.plan as AdminPlanView) : p)))
      toast.success('Plan updated', { description: 'New pricing is live for future purchases.' })
    } catch {
      toast.error('Network error while saving the plan')
    } finally {
      setSavingPlanId(null)
    }
  }

  const handlePlanReset = async (planId: PlanId) => {
    setSavingPlanId(planId)
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error('Could not reset the plan', { description: json.error })
        return
      }
      setPlans((prev) => prev.map((p) => (p.id === planId ? (json.plan as AdminPlanView) : p)))
      toast.success('Plan reset to its code default')
    } catch {
      toast.error('Network error while resetting the plan')
    } finally {
      setSavingPlanId(null)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Payments</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Revenue, plan pricing and recent transactions.
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loadingData}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-[13px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <Activity className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Revenue ── */}
      <section className="mb-9">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Revenue
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={IndianRupee}
            label="Total revenue"
            value={formatPaise(revenue?.totalRevenuePaise ?? 0)}
            color="emerald"
          />
          <StatCard
            icon={TrendingUp}
            label="Successful payments"
            value={revenue?.successfulPayments ?? 0}
            color="primary"
          />
          <StatCard
            icon={XCircle}
            label="Failed"
            value={revenue?.failedPayments ?? 0}
            color="red"
          />
          <StatCard
            icon={CreditCard}
            label="Pending"
            value={revenue?.pendingPayments ?? 0}
            color="amber"
          />
        </div>
      </section>

      {/* ── Plan pricing ── */}
      <section className="mb-9">
        <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Plan pricing
        </h3>
        <p className="mb-3 text-[13px] text-muted-foreground">
          Changes apply to future purchases only. A plan somebody has already paid for is not
          affected.
        </p>

        {plans.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-[13px] text-muted-foreground">
            {loadingData ? 'Loading plans…' : 'No plans returned.'}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanEditor
                key={plan.id}
                plan={plan}
                onSave={handlePlanSave}
                onReset={handlePlanReset}
                isSaving={savingPlanId === plan.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Recent transactions ── */}
      <section>
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Recent transactions
        </h3>

        {payments.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-[13px] text-muted-foreground">
            {loadingData ? 'Loading…' : 'No payments yet.'}
          </div>
        ) : (
          <>
            {/* Cards on a phone, a table once there is width for one. A
                six-column table on a 375px screen is a horizontal scroll
                nobody wins. */}
            <div className="grid gap-2.5 sm:hidden">
              {payments.map((p) => (
                <article key={p.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {p.userName ?? p.userEmail ?? 'Unknown'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{p.planId}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                        STATUS_STYLES[p.status] ?? 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="text-base font-bold text-foreground">
                      {formatPaise(p.amount)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(p.createdAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-border bg-card sm:block">
              <table className="w-full text-left">
                <thead className="border-b border-border bg-muted/40">
                  <tr className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Candidate</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-foreground">
                          {p.userName ?? '—'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{p.userEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground">{p.planId}</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-foreground">
                        {formatPaise(p.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                            STATUS_STYLES[p.status] ??
                            'border-border bg-muted text-muted-foreground'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
