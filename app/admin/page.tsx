'use client'

// ============================================================
// app/admin/page.tsx — Admin overview
// ============================================================
// This file used to be 1,324 lines and did six unrelated jobs: user stats,
// revenue, plan pricing, the question bank and its exports, recent payments
// and the module generator, all stacked in one scroll. Each of those now has
// its own route under /admin, and this is what is left — who is signed up,
// and a way in to everything else.
//
// The auth check and the section navigation live in app/admin/layout.tsx, so
// they are not repeated here.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  CreditCard,
  Crown,
  Database,
  FileCheck2,
  FileSpreadsheet,
  Flag,
  Plus,
  Replace,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react'
import { useAuth } from '@/app/contexts/AuthContext'
import { StatCard, formatDateTime, type UserStats } from '@/app/components/admin/shared'

const SHORTCUTS = [
  {
    href: '/admin/payments',
    icon: CreditCard,
    title: 'Payments',
    body: 'Revenue, plan pricing and recent transactions.',
  },
  {
    href: '/admin/question-bank',
    icon: Database,
    title: 'Question bank',
    body: 'What is in the bank by subject and medium, and exports.',
  },
  {
    href: '/admin/mock-tests',
    icon: FileCheck2,
    title: 'Mock modules',
    body: 'Generate a series of full-length papers.',
  },
  {
    href: '/admin/module-questions',
    icon: Replace,
    title: 'Module questions',
    body: 'Read a module and swap out a weak question.',
  },
  {
    href: '/admin/bulk-update',
    icon: FileSpreadsheet,
    title: 'Bulk update',
    body: 'Rewrite a range of questions through a CSV round trip.',
  },
  {
    href: '/admin/import-questions',
    icon: Plus,
    title: 'Import questions',
    body: 'Add new questions to a subject from a CSV.',
  },
  {
    href: '/admin/question-feedback',
    icon: Flag,
    title: 'Question reports',
    body: 'What candidates have flagged, and fixing it.',
  },
] as const

export default function AdminOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/dashboard', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setStats(data.userStats ?? null)
        setUpdatedAt(data.timestamp ?? null)
      } else {
        setError('Could not load the dashboard.')
      }
    } catch {
      setError('Network error while loading the dashboard.')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats()
  }, [fetchStats])

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Overview</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{user?.name ?? user?.email}</span>
            {updatedAt && <> · refreshed {formatDateTime(updatedAt)}</>}
          </p>
        </div>
        <button
          onClick={fetchStats}
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

      {/* ── Candidates ── */}
      <section className="mb-9">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Candidates
        </h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard icon={Users} label="Total" value={stats?.total ?? 0} color="primary" />
          <StatCard icon={Crown} label="Pro" value={stats?.premium ?? 0} color="amber" />
          <StatCard icon={UserX} label="Free" value={stats?.free ?? 0} color="blue" />
          <StatCard icon={UserCheck} label="New today" value={stats?.newToday ?? 0} color="emerald" />
          <StatCard
            icon={UserCheck}
            label="New this week"
            value={stats?.newThisWeek ?? 0}
            color="emerald"
          />
        </div>
      </section>

      {/* ── Everything else ── */}
      <section>
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Sections
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-20 items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-accent/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {item.body}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </main>
  )
}
