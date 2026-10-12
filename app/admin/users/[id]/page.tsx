'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import type { AdminUserSummary } from '@/types/admin-users'
import UserHistory from '@/app/components/admin/UserHistory'
import { AccessBadge, money, userDate } from '@/app/components/admin/UserDataUI'

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>()
  const [refresh, setRefresh] = useState(0)
  const [resource, setResource] = useState<{ key: string; data?: AdminUserSummary; error?: string } | null>(null)
  const key = `${id}:${refresh}`
  const loading = resource?.key !== key
  const data = loading ? undefined : resource?.data

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, { credentials: 'include', signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.error ?? 'Could not load this user')
        if (!controller.signal.aborted) setResource({ key, data: result as AdminUserSummary })
      } catch (err) {
        if (!controller.signal.aborted) setResource({ key, error: err instanceof Error ? err.message : 'Could not load this user' })
      }
    }
    void load()
    return () => controller.abort()
  }, [id, key])

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-5 flex items-center justify-between">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All users</Link>
      <button disabled={loading} onClick={() => setRefresh((n) => n + 1)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh profile & usage</button>
    </div>
    {loading ? <div className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading user data…</div>
      : resource?.error ? <p role="alert" className="rounded-xl border border-destructive/30 p-5 text-sm text-destructive">{resource.error} <button onClick={() => setRefresh((n) => n + 1)} className="underline">Retry</button></p>
        : data && <>
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-2xl font-bold tracking-tight">{data.user.name || 'Unnamed user'}</h2><p className="mt-1 break-all text-sm text-muted-foreground">{data.user.email}</p></div>
              <AccessBadge user={data.user} />
            </div>
            <dl className="mt-5 grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Role / medium', `${data.user.role} · ${data.user.educationMedium ?? 'Not selected'}`],
                ['Joined (IST)', userDate(data.user.createdAt)], ['Last active (IST)', userDate(data.user.lastActivityAt)],
                ['Subscription', `${data.user.subscriptionPlan ?? 'None'} · ${data.user.subscriptionStatus}`],
                ['Subscription started (IST)', userDate(data.user.subscriptionStartedAt)],
                ['Expires (IST)', userDate(data.user.subscriptionExpiresAt)],
                ['Onboarding', data.user.onboardingCompleted ? 'Completed' : 'Incomplete'],
                ['Learning goals', data.user.learningGoals.map((goal) => goal.replaceAll('_', ' ')).join(', ') || 'Not selected'],
              ].map(([label, value]) => <div key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold capitalize">{value}</dd></div>)}
            </dl>
            <p className="mt-4 break-all text-[11px] text-muted-foreground">User ID: {data.user.id}</p>
          </section>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Practice sessions', `${data.usage.practiceSessions}`, `${data.usage.practiceCompleted} completed`],
              ['Practice questions answered', `${data.usage.questionsAnswered}`, `${data.usage.correctAnswers} correct · ${data.usage.questionsAnswered - data.usage.correctAnswers} incorrect`],
              ['Practice accuracy', data.usage.practiceAccuracy === null ? '—' : `${data.usage.practiceAccuracy}%`, 'Across recorded answers'],
              ['Mock attempts', `${data.usage.mockAttempts}`, `${data.usage.mockSubmitted} submitted`],
              ['Payments received', data.payments.totals.map((total) => money(total.amount, total.currency)).join(' + ') || '—', `${data.payments.orders} orders · ${data.payments.paid} paid · ${data.payments.failed} failed · ${data.payments.pending} pending`],
              ['Devices & activity', `${data.usage.devices} devices`, `${data.usage.activeSessions} active login sessions · ${data.usage.activityEvents} account events`],
            ].map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-2 text-[11px] text-muted-foreground">{detail}</p></div>)}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Usage totals cover all stored records. Last active reflects the latest recorded login-session activity. Dates are shown in IST.</p>
          <UserHistory key={id} userId={id} />
        </>}
  </main>
}
