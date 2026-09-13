'use client'

// ============================================================
// app/admin/question-feedback/page.tsx — Question report queue
// ============================================================
// PAGINATION, NOT INFINITE SCROLL. This is a work queue, not a feed: an admin
// needs to see how many reports are outstanding, work a page, and come back to
// the same place afterwards. Infinite scroll hides the total, loses position
// on navigate-back, and makes "have I handled everything?" unanswerable. The
// candidate-facing module list is the opposite case, which is why that one
// scrolls.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Flag,
  Loader2,
  RefreshCw,
  Search,
  Check,
  Ban,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/loading-screen'
import QuestionEditor from '@/app/components/admin/QuestionEditor'
import {
  FEEDBACK_REASONS,
  FEEDBACK_REASON_LABEL,
  type AdminFeedbackItem,
  type AdminFeedbackListResponse,
  type FeedbackReason,
  type FeedbackStatus,
} from '@/types/question-feedback'

const STATUS_TABS: { id: FeedbackStatus | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' },
]

/** Reasons this question was flagged for, busiest first. */
function reasonBreakdown(item: AdminFeedbackItem): [FeedbackReason, number][] {
  return (Object.entries(item.reason_counts ?? {}) as [FeedbackReason, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function QuestionFeedbackPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [status, setStatus] = useState<FeedbackStatus | 'all'>('open')
  const [reason, setReason] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  const [data, setData] = useState<AdminFeedbackListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  // Non-admins never see this page; the API refuses them regardless.
  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') router.replace('/dsc-sgt')
    if (!authLoading && !user) router.replace('/')
  }, [authLoading, user, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // Filters changing resets to page 1, adjusted during render so a stale page
  // number never reaches the request.
  const filterKey = `${status}|${reason}|${debouncedSearch}`
  const [lastFilter, setLastFilter] = useState(filterKey)
  if (lastFilter !== filterKey) {
    setLastFilter(filterKey)
    setPage(1)
  }

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status, page: String(page), pageSize: '20' })
      if (reason !== 'all') params.set('reason', reason)
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/admin/question-feedback?${params.toString()}`)
      const json = (await res.json()) as AdminFeedbackListResponse
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not load reports')
        return
      }
      setError(null)
      setData(json)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [status, reason, debouncedSearch, page])

  useEffect(() => {
    void load()
  }, [load])

  const setItemStatus = async (item: AdminFeedbackItem, next: FeedbackStatus) => {
    setUpdating(item.id)
    try {
      const res = await fetch(`/api/admin/question-feedback/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error('Could not update', { description: json.error })
        return
      }
      toast.success(next === 'resolved' ? 'Marked resolved' : next === 'dismissed' ? 'Dismissed' : 'Reopened')
      await load()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setUpdating(null)
    }
  }

  if (authLoading) return <LoadingScreen message="Checking access…" />
  if (!user || user.role !== 'admin') return null

  const items = data?.items ?? []
  const counts = data?.counts ?? { open: 0, resolved: 0, dismissed: 0 }
  const totalPages = data?.total_pages ?? 1

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Admin dashboard
        </button>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="bloom-eyebrow">Content quality</p>
            <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-medium text-foreground">
              <Flag className="h-5 w-5 text-primary" strokeWidth={1.7} />
              Question reports
            </h1>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
              One entry per question, however many candidates flagged it.
              Editing a question here updates the question bank, so the fix
              reaches both practice and every mock module using it.
            </p>
          </div>

          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setStatus(t.id)}
              className={`rounded-full px-3.5 py-1.5 text-[11px] font-medium transition ${
                status === t.id ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {t.id !== 'all' && (
                <span className="ml-1.5 opacity-60">{counts[t.id as FeedbackStatus]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-9 rounded-full border border-border bg-card px-3 text-[11px] text-foreground focus:outline-none"
          >
            <option value="all">All reasons</option>
            {FEEDBACK_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question id…"
              className="h-9 w-48 rounded-full border border-border bg-card pl-9 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── States ── */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading reports…</p>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-xs text-destructive">{error}</p>
          <button
            onClick={() => void load()}
            className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <Flag className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground">Nothing here</p>
          <p className="text-xs text-muted-foreground">
            {status === 'open' ? 'No open reports — the queue is clear.' : 'No reports match these filters.'}
          </p>
        </div>
      )}

      {/* ── Queue ── */}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const isOpen = expanded === item.id
            return (
              <article key={item.id} className="rounded-2xl border border-border bg-card">
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* How many people, and what they each said */}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          item.report_count >= 5
                            ? 'bg-destructive/15 text-destructive'
                            : item.report_count > 1
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        {item.report_count} report{item.report_count === 1 ? '' : 's'}
                      </span>

                      {reasonBreakdown(item).map(([reasonId, n]) => (
                        <span
                          key={reasonId}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {FEEDBACK_REASON_LABEL[reasonId] ?? reasonId}
                          {n > 1 ? ` ×${n}` : ''}
                        </span>
                      ))}

                      {item.subject_label && (
                        <span className="text-[11px] text-muted-foreground">
                          {item.subject_label}
                          {item.medium ? ` · ${item.medium}` : ''}
                        </span>
                      )}
                      {item.status !== 'open' && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {item.status}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground">
                      {item.reported_question ?? item.question_uid}
                    </p>

                    {item.recent_reports.slice(0, 2).map(
                      (r) =>
                        r.details && (
                          <p
                            key={r.id}
                            className="mt-1.5 line-clamp-2 text-[11px] italic text-muted-foreground"
                          >
                            “{r.details}” — {r.reporter?.name ?? r.reporter?.email ?? 'Unknown'}
                          </p>
                        )
                    )}

                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Last reported {item.last_reported_at ? formatWhen(item.last_reported_at) : '—'}{' '}
                      · <code>{item.question_uid}</code>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {item.status !== 'resolved' && (
                      <button
                        onClick={() => void setItemStatus(item, 'resolved')}
                        disabled={updating === item.id}
                        title="Mark resolved"
                        className="rounded-full border border-emerald-500/30 p-2 text-emerald-600 transition hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {item.status !== 'dismissed' && (
                      <button
                        onClick={() => void setItemStatus(item, 'dismissed')}
                        disabled={updating === item.id}
                        title="Dismiss"
                        className="rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {item.status !== 'open' && (
                      <button
                        onClick={() => void setItemStatus(item, 'open')}
                        disabled={updating === item.id}
                        className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isOpen ? 'Close' : 'Edit question'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border p-4">
                    <QuestionEditor questionUid={item.question_uid} onSaved={() => void load()} />
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <span className="text-[11px] text-muted-foreground">
            Page {page} of {totalPages} · {data?.total ?? 0} report
            {(data?.total ?? 0) === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </main>
  )
}
