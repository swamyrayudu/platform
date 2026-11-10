'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { PLANS, isPlanId } from '@/lib/payments/plans'
import type { AdminUserHistoryResponse, UserHistorySection } from '@/types/admin-users'
import { duration, money, StatusBadge, UserDataTable, UserPagination, userDate } from './UserDataUI'

const RESOURCE_CATEGORY: Record<string, string> = {
  book: 'Book', study_material: 'Study material', bit_bank: 'Bit bank', previous_paper: 'Previous paper', other: 'Other',
}

const PLAY_PLAN_LABEL: Record<string, string> = { play_monthly: 'Pro · 1 Month', play_quarterly: 'Pro · 3 Months', play_yearly: 'Pro · 1 Year' }

function playStatus(row: { state: string; revoked_at: string | null; superseded_by: string | null; entitled: boolean }): string {
  if (row.revoked_at) return 'Refunded'
  if (row.superseded_by) return 'Replaced'
  const labels: Record<string, string> = {
    SUBSCRIPTION_STATE_ACTIVE: 'Active', SUBSCRIPTION_STATE_PENDING: 'Payment pending', SUBSCRIPTION_STATE_EXPIRED: 'Expired',
    SUBSCRIPTION_STATE_CANCELED: 'Active', SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'Grace period', SUBSCRIPTION_STATE_ON_HOLD: 'On hold',
    SUBSCRIPTION_STATE_PAUSED: 'Paused', SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'Payment cancelled',
  }
  const label = labels[row.state] ?? row.state
  return label === 'Active' && !row.entitled ? 'Expired' : label
}

const SECTIONS: { key: UserHistorySection; label: string }[] = [
  { key: 'activity', label: 'Activity' }, { key: 'practice', label: 'Practice sessions' },
  { key: 'questions', label: 'Question attempts' }, { key: 'mocks', label: 'Mock tests' },
  { key: 'resources', label: 'Resources' },
  { key: 'payments', label: 'Payments' }, { key: 'play', label: 'Google Play' }, { key: 'devices', label: 'Devices' },
]

export default function UserHistory({ userId }: { userId: string }) {
  const [selection, setSelection] = useState({ section: 'activity' as UserHistorySection, page: 1, pageSize: 25 })
  const [refresh, setRefresh] = useState(0)
  const [resource, setResource] = useState<{ key: string; data?: AdminUserHistoryResponse; error?: string } | null>(null)
  const query = new URLSearchParams({ section: selection.section, page: String(selection.page), pageSize: String(selection.pageSize) }).toString()
  const key = `${userId}:${query}:${refresh}`
  const loading = resource?.key !== key
  const data = loading ? undefined : resource?.data

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}?${query}`, { credentials: 'include', signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.error ?? 'Could not load history')
        if (controller.signal.aborted) return
        if (result.pagination.totalPages > 0 && result.pagination.page > result.pagination.totalPages) {
          setSelection((current) => ({ ...current, page: result.pagination.totalPages }))
          return
        }
        setResource({ key, data: result as AdminUserHistoryResponse })
      } catch (err) {
        if (!controller.signal.aborted) setResource({ key, error: err instanceof Error ? err.message : 'Could not load history' })
      }
    }
    void load()
    return () => controller.abort()
  }, [userId, query, key])

  return <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      <nav aria-label="User history sections" className="flex flex-wrap gap-1.5">
        {SECTIONS.map(({ key: section, label }) => <button key={section} aria-current={selection.section === section ? 'page' : undefined}
          onClick={() => setSelection((current) => ({ ...current, section, page: 1 }))}
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${selection.section === section ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{label}</button>)}
      </nav>
      <button aria-label="Refresh user history" disabled={loading} onClick={() => setRefresh((n) => n + 1)} className="rounded-lg border border-border p-2 disabled:opacity-50"><RefreshCw className="h-4 w-4" /></button>
    </div>
    <div aria-busy={loading}>
      {loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading history…</div>
        : resource?.error ? <p role="alert" className="p-6 text-sm text-destructive">{resource.error} <button onClick={() => setRefresh((n) => n + 1)} className="underline">Retry</button></p>
          : data && <>
            <HistoryRows data={data} />
            <UserPagination pagination={data.pagination}
              onPageChange={(page) => setSelection((current) => ({ ...current, page }))}
              onPageSizeChange={(pageSize) => setSelection((current) => ({ ...current, pageSize, page: 1 }))} />
          </>}
    </div>
  </section>
}

function HistoryRows({ data }: { data: AdminUserHistoryResponse }) {
  switch (data.section) {
    case 'activity': return <UserDataTable headings={['Event', 'When (IST)']} empty="No recorded account activity."
      rows={data.rows.map((row) => ({ id: row.id, cells: [<span key="event" className="capitalize">{row.event_type.replaceAll('_', ' ').toLowerCase()}</span>, userDate(row.created_at)] }))} />
    case 'practice': return <UserDataTable headings={['Subject / topics', 'Status', 'Questions / score', 'Accuracy', 'Time', 'Started / completed (IST)']} empty="No practice sessions yet."
      rows={data.rows.map((row) => ({ id: row.id, cells: [
        <div key="subject" className="max-w-72"><p className="font-semibold">{row.subject} · {row.medium}</p><p className="mt-1 text-muted-foreground">{row.topics?.join(', ') || 'All topics'}</p><p className="mt-1 text-[11px] text-muted-foreground">{row.mode.replaceAll('_', ' ')}</p></div>,
        <StatusBadge key="status" value={row.status} />, `${row.question_count} questions · score ${row.score}`,
        `${Number(row.accuracy_pct).toFixed(1)}%`, duration(row.time_spent_seconds),
        <div key="date" className="whitespace-nowrap">{userDate(row.started_at)}<p className="mt-1 text-muted-foreground">Completed: {userDate(row.completed_at)}</p></div>,
      ] }))} />
    case 'questions': return <UserDataTable headings={['Question / topic', 'Answer', 'Result', 'Time', 'Attempted (IST)']} empty="No recorded question attempts."
      rows={data.rows.map((row) => ({ id: row.id, cells: [
        <div key="question" className="max-w-72"><p className="font-semibold">{row.subject} · {row.topic}</p><p className="mt-1 break-all text-[11px] text-muted-foreground">{row.question_id} · {row.difficulty}</p></div>, row.selected_answer ?? 'Skipped',
        <StatusBadge key="result" value={!row.selected_answer ? 'Skipped' : row.is_correct ? 'Correct' : 'Incorrect'} />, duration(row.time_taken_seconds), userDate(row.attempted_at),
      ] }))} />
    case 'mocks': return <UserDataTable headings={['Mock module', 'Status', 'Score', 'Correct / wrong / skipped', 'Rank', 'Time', 'Started / submitted (IST)']} empty="No mock test attempts yet."
      rows={data.rows.map((row) => ({ id: row.id, cells: [row.mock_tests?.title ?? 'Mock test', <StatusBadge key="status" value={row.status} />,
        row.status === 'submitted' ? `${row.score} / ${row.total_marks} (${Number(row.percentage).toFixed(1)}%)` : '—',
        row.status === 'submitted' ? `${row.correct_count} / ${row.incorrect_count} / ${row.unanswered_count}` : '—',
        row.rank ?? '—', duration(row.time_spent_seconds), <div key="date" className="whitespace-nowrap">{userDate(row.started_at)}<p className="mt-1 text-muted-foreground">Submitted: {userDate(row.submitted_at)}</p></div>,
      ] }))} />
    case 'resources': return <UserDataTable headings={['Resource', 'Access', 'Opens', 'Platform', 'First / last opened (IST)']} empty="This user has not opened any resources yet."
      rows={data.rows.map((row) => ({ id: row.id, cells: [
        <div key="resource" className="max-w-80"><p className="font-semibold">{row.resources?.title ?? 'Deleted resource'}</p>{row.resources && <p className="mt-1 text-muted-foreground">{RESOURCE_CATEGORY[row.resources.category] ?? row.resources.category} · {row.resources.subject} · {row.resources.medium}</p>}</div>,
        <StatusBadge key="access" value={row.resources?.access === 'pro' ? 'Pro' : 'Free'} />,
        <div key="opens" className="whitespace-nowrap"><p className="font-semibold">{row.open_count} {row.open_count === 1 ? 'open' : 'opens'}</p>{row.blocked_count > 0 && <p className="mt-1 text-[11px] text-destructive">{row.blocked_count} blocked (Pro required)</p>}</div>,
        row.last_platform ?? '—',
        <div key="date" className="whitespace-nowrap">{userDate(row.first_opened_at)}<p className="mt-1 text-muted-foreground">Last: {userDate(row.last_opened_at)}</p></div>,
      ] }))} />
    case 'payments': return <UserDataTable headings={['Plan', 'Amount / discount', 'Status', 'Created / paid (IST)', 'Payment details']} empty="No payment orders for this user."
      rows={data.rows.map((row) => ({ id: row.id, cells: [isPlanId(row.plan_id) ? PLANS[row.plan_id].name : row.plan_id,
        <div key="amount" className="whitespace-nowrap font-semibold">{money(row.amount, row.currency)}{row.coupon_code && <p className="mt-1 text-[11px] font-normal text-muted-foreground">{row.coupon_code} · {row.discount_percent}% off</p>}</div>,
        <StatusBadge key="status" value={row.status} />, <div key="date" className="whitespace-nowrap">{userDate(row.created_at)}<p className="mt-1 text-muted-foreground">Paid: {userDate(row.paid_at)}</p></div>,
        <details key="details" className="max-w-72"><summary className="cursor-pointer font-semibold text-primary">View references</summary><div className="mt-2 space-y-1 break-all text-[11px] text-muted-foreground"><p>Order: {row.razorpay_order_id}</p><p>Payment: {row.razorpay_payment_id ?? '—'}</p><p>Confirmed via: {row.confirmed_via ?? '—'}</p>{row.failure_reason && <p className="text-destructive">{row.failure_reason}</p>}</div></details>,
      ] }))} />
    case 'play': return <UserDataTable headings={['Plan', 'Status', 'Pro until (IST)', 'Bought (IST)', 'Order / details']} empty="No Google Play purchases on this account."
      rows={data.rows.map((row) => ({ id: row.purchase_token, cells: [
        <div key="plan"><p className="font-semibold">{PLAY_PLAN_LABEL[row.plan_key] ?? row.plan_key}</p>{row.is_test && <p className="mt-1 text-[11px] text-muted-foreground">Test purchase (license tester)</p>}</div>,
        <StatusBadge key="status" value={playStatus(row)} />,
        <div key="expiry" className="whitespace-nowrap">{userDate(row.expiry_time)}{row.entitled && <p className="mt-1 text-[11px] text-emerald-600">Giving Pro now</p>}</div>,
        userDate(row.started_at ?? row.created_at),
        <details key="details" className="max-w-80"><summary className="cursor-pointer font-semibold text-primary">{row.latest_order_id ?? 'View details'}</summary><div className="mt-2 space-y-1 break-all text-[11px] text-muted-foreground">
          <p>Order: {row.latest_order_id ?? '—'}</p><p>Base plan: {row.base_plan_id ?? '—'}</p><p>Google state: {row.state.replace('SUBSCRIPTION_STATE_', '')}</p>
          <p>Acknowledged: {row.acknowledgement_state === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' ? 'Yes' : 'Not yet'}</p>
          <p>Last checked: {userDate(row.updated_at)} via {row.last_verified_via}</p>
          {row.revoked_at && <p className="text-destructive">Refunded / revoked {userDate(row.revoked_at)}{row.revocation_reason ? ` (${row.revocation_reason})` : ''}</p>}
          <p>Purchase token: {row.purchase_token.slice(0, 16)}…</p></div></details>,
      ] }))} />
    case 'devices': return <UserDataTable headings={['Platform / browser', 'Logins', 'First login (IST)', 'Last login (IST)']} empty="No registered devices."
      rows={data.rows.map((row) => ({ id: row.id, cells: [<div key="device"><p className="font-semibold">{row.platform}</p>{row.user_agent && <details className="mt-1 max-w-80 text-muted-foreground"><summary className="cursor-pointer">Browser details</summary><p className="mt-2 break-all">{row.user_agent}</p></details>}</div>, row.login_count, userDate(row.first_login_at), userDate(row.last_login_at)] }))} />
  }
}
