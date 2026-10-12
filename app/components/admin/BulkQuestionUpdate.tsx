'use client'

// ============================================================
// Shared CSV workflow for whole-table and subject/topic bulk updates.
// ============================================================
// Built around how the work actually happens: the bank is too large to fix in
// one pass, and a chat tool can only hold a hundred rows at a time. So the
// page is a loop — copy a range out, paste the rewritten range back — and
// everything on it exists to make the paste safe.
//
// Rows are matched on question_id, never on paste order, so changing the range
// box after copying cannot overwrite the wrong questions. Nothing is written
// until a preview has been read back from the server, and the server recomputes
// that same diff when it writes.
//
// Which ranges are already done is kept in localStorage rather than the
// database: it is one admin's place-marker, not shared state, and it does not
// justify a table.
// ============================================================

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCopy,
  Download,
  FileWarning,
  Loader2,
  RefreshCw,
  Upload,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/loading-screen'
import { QUESTION_TABLES } from '@/lib/questions/tables'
import { toCsv, type CsvRow } from '@/lib/questions/csv'
import { isTopicCompleted, topicCompletionKey } from '@/lib/questions/topic-completion'
import { readTopicCompletion, useTopicCompletion } from '@/app/components/admin/useTopicCompletion'
import { canAdvanceTopic, findUnreviewedTopicBatch, nextUnfinishedTopic } from '@/lib/questions/topic-workflow'
import { sortTopicsByCount } from '@/lib/questions/topic-order'
import TopicQuestionImport from '@/app/components/admin/TopicQuestionImport'
import {
  BULK_CSV_COLUMNS,
  BULK_MAX_ROWS,
  type BulkExportResponse,
  type BulkPreviewResponse,
  type BulkRowResult,
  type BulkTopicOption,
  type BulkTopicsResponse,
} from '@/types/bulk-update'

/** Only the real subject tables — the legacy ones are not worth rewriting. */
const TABLES = QUESTION_TABLES.filter((t) => !t.legacy)

const PROGRESS_KEY = 'admin_bulk_update_progress'

/** Highest row number finished per table, remembered on this machine. */
type Progress = Record<string, number>

// localStorage is read through useSyncExternalStore rather than an effect.
// An effect would render once with no progress and then again with it, and
// a lazy useState initialiser would disagree with the prerendered HTML —
// this gives the server an explicit empty snapshot and the client the real
// one, with no mismatch and no second render.
const progressListeners = new Set<() => void>()

function subscribeProgress(onChange: () => void): () => void {
  progressListeners.add(onChange)
  // Another tab finishing a range should show up here too.
  window.addEventListener('storage', onChange)
  return () => {
    progressListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** A primitive, so the snapshot is referentially stable between renders. */
function progressSnapshot(): string {
  try {
    return window.localStorage.getItem(PROGRESS_KEY) ?? ''
  } catch {
    return ''
  }
}

const EMPTY_SNAPSHOT = ''

function parseProgress(raw: string): Progress {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Progress) : {}
  } catch {
    return {}
  }
}

function readProgress(): Progress {
  if (typeof window === 'undefined') return {}
  return parseProgress(progressSnapshot())
}

function writeProgress(next: Progress): void {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next))
  } catch {
    // A place-marker is not worth failing the page over.
  }
  // `storage` does not fire in the tab that wrote, so tell this one directly.
  for (const listener of progressListeners) listener()
}

function downloadCsv(filename: string, csv: string): void {
  // The BOM is what makes Excel open Telugu correctly instead of as mojibake.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BulkQuestionUpdate({ topicMode = false }: { topicMode?: boolean }) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [table, setTable] = useState(TABLES[0]!.table)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(100)
  // JSON preserves null, empty strings and exact topic spellings separately.
  const [topicKey, setTopicKey] = useState('')
  const selectedTopic: string | null | undefined = topicKey ? JSON.parse(topicKey) : undefined
  const [topicsRevision, setTopicsRevision] = useState(0)
  const [topicsState, setTopicsState] = useState<{
    table: string; revision: number; topics: BulkTopicOption[]; error?: string
  } | null>(null)
  const topicsLoading = topicMode &&
    (topicsState?.table !== table || topicsState?.revision !== topicsRevision)
  const topics = topicsLoading ? [] : sortTopicsByCount(topicsState?.topics ?? [])
  const selectedCount = topics.find((entry) => entry.topic === selectedTopic)?.count ?? 0

  const [total, setTotal] = useState<number | null>(null)
  const [exported, setExported] = useState<BulkExportResponse | null>(null)
  const [exporting, setExporting] = useState(false)

  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [allowAnswerChange, setAllowAnswerChange] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddQuestions, setShowAddQuestions] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null)
  const reviewedByTopic = useRef(new Map<string, Set<string>>())
  const busy = exporting || previewing || applying || importBusy
  const { completion, setCompleted } = useTopicCompletion()
  const completionKey = selectedTopic === undefined ? ''
    : topicCompletionKey(user?.id ?? '', table, selectedTopic)
  const topicCompleted = isTopicCompleted(completion, completionKey, selectedCount)
  const completedCount = topics.filter((entry) => isTopicCompleted(completion,
    topicCompletionKey(user?.id ?? '', table, entry.topic), entry.count)).length

  const progressRaw = useSyncExternalStore(
    subscribeProgress,
    progressSnapshot,
    () => EMPTY_SNAPSHOT
  )
  const progress = useMemo(() => parseProgress(progressRaw), [progressRaw])

  // Non-admins never see this page; the API refuses them regardless.
  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') router.replace('/dsc-sgt')
    if (!authLoading && !user) router.replace('/')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!topicMode || user?.role !== 'admin') return
    const controller = new AbortController()
    async function loadTopics() {
      try {
        const res = await fetch(`/api/admin/questions/bulk?table=${encodeURIComponent(table)}&topics=1`, {
          credentials: 'include', signal: controller.signal,
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.error ?? 'Could not load topics')
        if (!controller.signal.aborted) {
          setTopicsState({ table, revision: topicsRevision, topics: (data as BulkTopicsResponse).topics })
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setTopicsState({ table, revision: topicsRevision, topics: [],
            error: err instanceof Error ? err.message : 'Could not load topics' })
        }
      }
    }
    void loadTopics()
    return () => controller.abort()
  }, [table, topicMode, topicsRevision, user?.role])

  function resetBatch() {
    setExported(null)
    setPreview(null)
    setCsv('')
    setTotal(null)
    setError(null)
    setWorkflowMessage(null)
  }

  function changeTable(nextTable: string) {
    setTable(nextTable)
    setTopicKey('')
    setShowAddQuestions(false)
    resetBatch()
    const done = topicMode ? 0 : readProgress()[nextTable] ?? 0
    setFrom(done + 1)
    setTo(done + 100)
  }

  function changeTopic(nextKey: string) {
    setTopicKey(nextKey)
    setShowAddQuestions(false)
    resetBatch()
    const count = topics.find((entry) => JSON.stringify(entry.topic) === nextKey)?.count ?? 100
    setFrom(1)
    setTo(Math.min(count, 100))
  }

  function toggleTopicCompleted() {
    if (!completionKey || busy || topicsLoading || selectedCount === 0) return
    const saved = setCompleted(completionKey, topicCompleted ? null : selectedCount)
    if (saved && topicCompleted) reviewedByTopic.current.delete(completionKey)
    if (saved) toast.success(topicCompleted ? 'Topic reopened for review' : 'Topic marked as completed')
    else toast.error('Could not save completion status in this browser.')
  }

  function questionsAdded() {
    reviewedByTopic.current.delete(completionKey)
    if (!setCompleted(completionKey, null)) {
      toast.error('Questions added, but completion status could not be cleared in this browser.')
    }
    setTopicsRevision((revision) => revision + 1)
    setTotal(null)
  }

  // Editing the paste or the answer policy invalidates its preview.
  const [lastCsv, setLastCsv] = useState(csv)
  const [lastAnswerPolicy, setLastAnswerPolicy] = useState(allowAnswerChange)
  if (lastCsv !== csv || lastAnswerPolicy !== allowAnswerChange) {
    setLastCsv(csv)
    setLastAnswerPolicy(allowAnswerChange)
    if (preview) setPreview(null)
  }

  const rangeSize = to - from + 1
  const rangeValid = Number.isInteger(from) && Number.isInteger(to) &&
    from >= 1 && to >= from && rangeSize <= BULK_MAX_ROWS
  const topicReady = !topicMode || (!topicsLoading && topicKey !== '' && selectedCount > 0)

  async function fetchRange() {
    if (!topicReady) return
    if (!rangeValid) {
      setError(`Range must start at 1 or more and cover at most ${BULK_MAX_ROWS} questions.`)
      return
    }
    setExporting(true)
    setExported(null)
    setPreview(null)
    setCsv('')
    setError(null)
    try {
      const params = new URLSearchParams({ table, from: String(from), to: String(to) })
      if (topicMode && selectedTopic !== undefined) {
        if (selectedTopic === null) params.set('topicMissing', '1')
        else params.set('topic', selectedTopic)
      }
      const res = await fetch(
        `/api/admin/questions/bulk?${params}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Could not read that range')
        return
      }
      setExported(data as BulkExportResponse)
      setTotal(data.total)
      if (data.rows.length === 0) {
        toast.info(`That range is past the end of this ${topicMode ? 'topic' : 'table'}.`)
      }
    } catch {
      setError('Network error while reading the range.')
    } finally {
      setExporting(false)
    }
  }

  const exportCsvText = useMemo(() => {
    if (!exported) return ''
    return toCsv(BULK_CSV_COLUMNS, exported.rows as unknown as CsvRow[])
  }, [exported])

  async function readTopicBatch(topic: string | null, from: number, to: number): Promise<BulkExportResponse> {
    const params = new URLSearchParams({ table, from: String(from), to: String(to) })
    if (topic === null) params.set('topicMissing', '1')
    else params.set('topic', topic)
    const res = await fetch(`/api/admin/questions/bulk?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.error ?? 'Could not load the next batch')
    return data as BulkExportResponse
  }

  function openAutomaticBatch(batch: BulkExportResponse) {
    resetBatch()
    setShowAddQuestions(false)
    setTopicKey(JSON.stringify(batch.topic))
    setFrom(batch.from)
    setTo(batch.to)
    setExported(batch)
    setTotal(batch.total)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function advanceAfterTopicApply(result: BulkPreviewResponse, loaded: BulkExportResponse) {
    const currentTopic = loaded.topic
    if (currentTopic === undefined) return
    if (!canAdvanceTopic(result)) {
      setError('Some changes were not saved. This topic remains open; review the result before continuing.')
      return
    }
    const key = topicCompletionKey(user?.id ?? '', table, currentTopic)
    const reviewed = new Set(reviewedByTopic.current.get(key) ?? [])
    for (const row of result.rows) reviewed.add(row.questionId)
    reviewedByTopic.current.set(key, reviewed)
    // A successful rewrite reopens a previously completed topic until every
    // question currently assigned to it has appeared in an applied CSV.
    if (!setCompleted(key, null)) {
      setError('Questions were updated, but completion could not be saved in this browser. The topic was not advanced.')
      return
    }
    try {
      const response = await fetch(`/api/admin/questions/bulk?table=${encodeURIComponent(table)}&topics=1`, { credentials: 'include' })
      const refreshed = await response.json()
      if (!response.ok || !refreshed.success) throw new Error(refreshed.error ?? 'Could not refresh topics')
      const remaining = await findUnreviewedTopicBatch(reviewed, (from, to) => readTopicBatch(currentTopic, from, to))
      const freshTopics = (refreshed as BulkTopicsResponse).topics.filter((entry) => entry.topic !== currentTopic)
      if (remaining.total > 0) freshTopics.push({ topic: currentTopic, count: remaining.total })
      setTopicsState({ table, revision: topicsRevision, topics: sortTopicsByCount(freshTopics) })
      if (remaining.batch) {
        openAutomaticBatch(remaining.batch)
        setWorkflowMessage('Changes saved. The next unreviewed batch in this topic is loaded. Apply it to continue.')
        return
      }
      if (!setCompleted(key, remaining.total > 0 ? remaining.total : null)) {
        setError('Questions were updated, but completion could not be saved in this browser. The topic was not advanced.')
        return
      }
      const next = nextUnfinishedTopic(freshTopics, currentTopic, readTopicCompletion(), user?.id ?? '', table)
      if (!next) {
        setWorkflowMessage('Topic completed. All topics in this subject and medium are now completed.')
        toast.success('All topics completed')
        return
      }
      const nextBatch = await readTopicBatch(next.topic, 1, Math.min(next.count, BULK_MAX_ROWS))
      if (!nextBatch.rows.length) throw new Error('The next topic changed. Reload its questions to continue.')
      // This newly opened topic is a fresh review pass.
      reviewedByTopic.current.delete(topicCompletionKey(user?.id ?? '', table, next.topic))
      openAutomaticBatch(nextBatch)
      setWorkflowMessage(`Topic completed. Next topic loaded: ${next.topic || 'No topic'}.`)
      toast.success('Topic completed', { description: `Next topic: ${next.topic || 'No topic'}` })
    } catch (err) {
      setError(`Questions were updated, but automatic navigation could not finish. ${err instanceof Error ? err.message : 'Reload the topics to continue.'}`)
    }
  }

  async function runPreview(apply: boolean) {
    if (!exported?.rows.length || (apply && !preview)) return
    if (!csv.trim()) {
      setError('Paste the rewritten CSV first.')
      return
    }
    if (apply) {
      setApplying(true)
      setWorkflowMessage(null)
    }
    else setPreviewing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          table,
          csv,
          apply,
          allowAnswerChange,
          // The range that was actually loaded, not whatever the number
          // boxes say now — editing them after copying must not move the
          // target.
          from: exported?.from,
          to: exported?.to,
          ...(topicMode ? {
            topic: exported.topic,
            questionIds: exported.rows.map((row) => row.question_id),
          } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Request failed')
        return
      }
      setPreview(data as BulkPreviewResponse)

      if (apply) {
        const { written = 0, modulesInvalidated = 0 } = data.summary
        toast.success(`Updated ${written} question${written === 1 ? '' : 's'}`, {
          description:
            modulesInvalidated > 0
              ? `${modulesInvalidated} mock module${modulesInvalidated === 1 ? '' : 's'} refreshed. Practice is already live.`
              : 'Live in practice now.',
        })
        if (topicMode) {
          await advanceAfterTopicApply(data as BulkPreviewResponse, exported)
        } else {
          const current = readProgress()
          const reached = exported?.to ?? 0
          writeProgress({ ...current, [table]: Math.max(current[table] ?? 0, reached) })
        }
      }
    } catch {
      setError('Network error.')
    } finally {
      if (apply) setApplying(false)
      else setPreviewing(false)
    }
  }

  if (authLoading) return <LoadingScreen message="Checking access…" />
  if (!user || user.role !== 'admin') return null

  const done = topicMode ? 0 : progress[table] ?? 0
  const summary = preview?.summary
  const applied = preview?.applied === true

  // Nothing downstream of step 1 exists until a range has actually been
  // loaded: the paste is only ever checked against rows that were handed out.
  const rangeLoaded = Boolean(exported && exported.rows.length > 0)
  // A paste carrying rows from some other slice of the table is not a
  // validation problem to fix row by row — it is the wrong file.
  const wrongRange = (summary?.outOfRange ?? 0) > 0
  // Not a mistake in the paste — a timing problem. Applying is off until the
  // candidates sitting those modules are done.
  const liveBlocked = (summary?.liveLocked ?? 0) > 0
  const blocked = (summary?.invalid ?? 0) > 0 || (summary?.changed ?? 0) === 0

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </button>
        <h1 className="text-2xl font-black tracking-tight text-foreground">
          {topicMode ? 'Subject & topic question update' : 'Bulk question update'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {topicMode
            ? 'Choose a subject and topic, copy its questions, rewrite them and paste them back. Existing IDs stay the same. Rows are matched on '
            : 'Copy a range out, rewrite it elsewhere, paste it back. Rows are matched on '}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">question_id</code>, so the
          range you pick here cannot overwrite the wrong questions.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {workflowMessage && (
        <div role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />{workflowMessage}
        </div>
      )}

      {/* ── Step 1: pick a range ── */}
      <section className="mb-5 rounded-2xl border border-border bg-card p-5">
        <StepHeading n={1} title={topicMode ? 'Choose a subject, topic and batch' : 'Choose a table and range'} />

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {topicMode ? 'Subject & medium' : 'Subject table'}
            </span>
            <select
              value={table}
              onChange={(e) => changeTable(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {TABLES.map((t) => (
                <option key={t.table} value={t.table}>
                  {t.subjectDisplayName} · {t.medium === 'telugu' ? 'Telugu medium' : 'English medium'}
                </option>
              ))}
            </select>
          </label>

          <NumberField label="From" value={from} onChange={setFrom} disabled={busy} />
          <NumberField label="To" value={to} onChange={setTo} disabled={busy} />

          <div className="flex items-end">
            <button
              onClick={fetchRange}
              disabled={busy || !rangeValid || !topicReady}
              className="flex h-[38px] items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Load {rangeValid ? rangeSize : '…'} rows
            </button>
          </div>
        </div>

        {topicMode && (
          <div className="mt-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Topic</span>
              <select value={topicKey} onChange={(e) => changeTopic(e.target.value)}
                disabled={busy || topicsLoading}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                <option value="">{topicsLoading ? 'Loading topics…' : 'Select a topic'}</option>
                {topics.map((entry) => (
                  <option key={JSON.stringify(entry.topic)} value={JSON.stringify(entry.topic)}>
                    {entry.topic === null ? 'No topic (unassigned)' : entry.topic === '' ? 'No topic (empty)' : entry.topic} · {entry.count} questions
                    {isTopicCompleted(completion, topicCompletionKey(user.id, table, entry.topic), entry.count) ? ' · ✓ Completed' : ''}
                  </option>
                ))}
              </select>
            </label>
            {!topicsLoading && topicsState?.error && (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {topicsState.error}{' '}
                <button onClick={() => setTopicsRevision((revision) => revision + 1)} disabled={busy} className="underline">Retry</button>
              </p>
            )}
            {!topicsLoading && !topicsState?.error && topics.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">No questions found for this subject and medium.</p>
            )}
            {!topicsLoading && topics.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {completedCount} of {topics.length} topics completed. Largest topics first. Completion is remembered in this browser.
              </p>
            )}
            {topicKey !== '' && selectedCount > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{selectedCount} questions in this topic. From / To count rows within this topic.</span>
                {selectedCount <= BULK_MAX_ROWS && (
                  <button disabled={busy} onClick={() => { setFrom(1); setTo(selectedCount) }}
                    className="rounded-lg border border-border px-3 py-1.5 font-semibold hover:bg-accent disabled:opacity-50">
                    Select all {selectedCount}
                  </button>
                )}
                {selectedCount > BULK_MAX_ROWS && (
                  <span>Load up to {BULK_MAX_ROWS} at a time, then continue with the next range.</span>
                )}
              </div>
            )}
            {topicKey !== '' && selectedCount > 0 && !topicsLoading && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button onClick={toggleTopicCompleted} disabled={busy}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${topicCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-border bg-background text-foreground hover:bg-accent'}`}>
                  <Check className="h-3.5 w-3.5" />
                  {topicCompleted ? 'Completed · Reopen topic' : 'Mark as completed'}
                </button>
                <button onClick={() => setShowAddQuestions((show) => !show)} disabled={busy}
                  aria-expanded={showAddQuestions}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50">
                  <Plus className="h-3.5 w-3.5" /> {showAddQuestions ? 'Close new questions' : 'Add new questions'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {total !== null && <span>{total.toLocaleString('en-IN')} questions in this {topicMode ? 'topic' : 'table'}</span>}
          {done > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">
              Finished up to row {done} on this device
            </span>
          )}
          {!rangeValid && (
            <span className="text-destructive">
              Range must start at 1 or more and cover at most {BULK_MAX_ROWS} rows
            </span>
          )}
        </div>

        {exported && exported.rows.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <p className="w-full text-xs font-medium text-foreground">
              Loaded rows {exported.from}–{exported.to}{topicMode ? ` of topic: ${exported.topic || 'No topic'}` : ''} · {exported.rows.length} questions
            </p>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(exportCsvText)
                toast.success(`Copied ${exported.rows.length} rows as CSV`)
              }}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-accent"
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy {exported.rows.length} rows as CSV
            </button>
            <button
              onClick={() =>
                downloadCsv(`${table}${topicMode ? '_topic' : ''}_${exported.from}-${exported.to}_original.csv`, exportCsvText)
              }
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              Download backup
            </button>
            <p className="w-full pt-1 text-[11px] text-muted-foreground">
              Keep the backup — it contains the original question IDs and content.
            </p>
          </div>
        )}
      </section>

      {topicMode && showAddQuestions && selectedTopic !== undefined && (
        <TopicQuestionImport key={completionKey} table={table} topic={selectedTopic}
          disabled={exporting || previewing || applying} onBusyChange={setImportBusy} onAdded={questionsAdded} />
      )}

      {/* ── Step 2: paste it back ── */}
      <section className="mb-5 rounded-2xl border border-border bg-card p-5">
        <StepHeading n={2} title="Paste the rewritten CSV" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Keep the header row and the{' '}
          <code className="rounded bg-muted px-1 py-0.5">question_id</code> column. Only{' '}
          <code className="rounded bg-muted px-1 py-0.5">question</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">option_a…d</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">correct_answer</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">explanation</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">topic</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">subtopic</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">chapter</code> and{' '}
          <code className="rounded bg-muted px-1 py-0.5">difficulty</code> are written.{' '}
          <code className="rounded bg-muted px-1 py-0.5">subject</code> and everything else in the
          file is ignored. An empty cell leaves that field as it is, and an older 8-column file
          still works.
        </p>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          disabled={busy}
          aria-label="Rewritten question CSV"
          spellCheck={false}
          placeholder={`question_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation,topic,subtopic,chapter,difficulty
Q000001,"Rewritten stem","opt A","opt B","opt C","opt D",B,"why B is right","జీవశాస్త్రం","కణం","అధ్యాయం 1","Medium"`}
          className="mt-3 h-56 w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/50"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={allowAnswerChange}
              onChange={(e) => setAllowAnswerChange(e.target.checked)}
              disabled={busy}
              className="h-3.5 w-3.5 accent-primary"
            />
            Allow the paste to change{' '}
            <code className="rounded bg-muted px-1 py-0.5">correct_answer</code>
          </label>

          {rangeLoaded ? (
            <button
              onClick={() => runPreview(false)}
              disabled={busy || !csv.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {previewing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              Preview rows {exported!.from}–{exported!.to}
            </button>
          ) : (
            <p className="text-[11px] font-medium text-muted-foreground">
              Load a range in step 1 first — a paste can only update the rows you loaded.
            </p>
          )}
        </div>
      </section>

      {/* ── Step 3: review and apply ── */}
      {preview && summary && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <StepHeading n={3} title={applied ? 'Applied' : 'Review before applying'} />

          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Checked against rows {preview.rangeFrom}–{preview.rangeTo} of {preview.table}
            {topicMode ? `, topic: ${exported?.topic || 'No topic'}` : ''}.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Will change" value={summary.changed} tone="primary" />
            <Stat label="Already match" value={summary.unchanged} />
            <Stat label="Not in range" value={summary.outOfRange} tone={wrongRange ? 'bad' : undefined} />
            <Stat label="Exam live" value={summary.liveLocked} tone={liveBlocked ? 'bad' : undefined} />
            <Stat label="Not found" value={summary.notFound} tone={summary.notFound ? 'warn' : undefined} />
            <Stat label="Invalid" value={summary.invalid} tone={summary.invalid ? 'bad' : undefined} />
            <Stat
              label="Answer key"
              value={summary.answerChanges}
              tone={summary.answerChanges ? 'bad' : undefined}
            />
            <Stat
              label="Reclassified"
              value={summary.taxonomyChanges}
              tone={
                summary.newTaxonomyValues.length || summary.unrecognisedDifficulty.length
                  ? 'warn'
                  : undefined
              }
            />
          </div>

          {summary.newTaxonomyValues.length > 0 && !applied && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>
                  {summary.newTaxonomyValues.length} topic/subtopic value(s) are new to this table.
                </strong>{' '}
                Practice filters on topic, so a near-miss spelling of one that already exists splits
                that filter in two instead of fixing anything. Check these are deliberate:
                <span className="mt-1.5 block font-medium">
                  {summary.newTaxonomyValues.join(' · ')}
                </span>
              </span>
            </div>
          )}

          {liveBlocked && !applied && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>
                  {summary.liveAttempts} candidate(s) are mid-exam on modules containing these
                  questions.
                </strong>{' '}
                {summary.liveLocked} row(s) change an option or the answer key. A stored answer is
                only the letter they tapped, so moving what B says marks them on an answer they
                never gave. Wait until those attempts finish, or paste a version that changes only
                the wording.
              </span>
            </div>
          )}

          {summary.unrecognisedDifficulty.length > 0 && !applied && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>
                  {summary.unrecognisedDifficulty.length} difficulty label(s) the mock generator
                  cannot read.
                </strong>{' '}
                These will not fail — they are silently treated as Medium when a module is built,
                so the difficulty mix would be wrong without any error. Use a label it knows (Easy
                / Medium / Hard / Difficult / సులభం / మధ్యస్థం / కఠినం, among others):
                <span className="mt-1.5 block font-medium">
                  {summary.unrecognisedDifficulty.join(' · ')}
                </span>
              </span>
            </div>
          )}

          {wrongRange && !applied && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>
                  {topicMode ? 'This paste does not belong to the loaded topic batch.'
                    : `This paste does not belong to rows ${preview.rangeFrom}–${preview.rangeTo}.`}
                </strong>{' '}
                {summary.outOfRange} row(s) come from somewhere else in {preview.table}. Load the
                range those rows came from, or re-copy this one and paste its rewrite. Nothing can
                be written until they match.
              </span>
            </div>
          )}

          {!wrongRange && summary.missing > 0 && !applied && (
            <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
              {summary.missing} of the {exported?.rows.length ?? 0} loaded rows are not
              in this paste — they will be left exactly as they are.
            </p>
          )}

          {summary.answerChanges > 0 && !applied && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{summary.answerChanges} row(s) change the correct answer.</strong> That is
                normal when options are reworded or reordered — but check them below, because a
                wrong key here marks real candidates wrong.
              </span>
            </div>
          )}

          {preview.fileErrors.length > 0 && (
            <ul className="mt-4 space-y-1 text-[11px] text-muted-foreground">
              {preview.fileErrors.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
          )}

          <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {preview.rows
              .filter((r) => r.status !== 'unchanged')
              .map((row) => (
                <RowCard key={`${row.line}-${row.questionId}`} row={row} />
              ))}
            {preview.rows.every((r) => r.status === 'unchanged') && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Every pasted row already matches the database.
              </p>
            )}
          </div>

          {!applied && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <p className="text-[11px] text-muted-foreground">
                {wrongRange
                  ? 'Applying is off until the paste matches the range you loaded.'
                  : liveBlocked
                    ? 'Applying is off while those attempts are in progress.'
                    : blocked
                    ? summary.invalid > 0
                      ? 'Fix the invalid rows above — nothing can be written until they are valid.'
                      : 'Nothing to write.'
                    : `${summary.changed} question(s) will be updated. Their question IDs will stay the same.${topicMode ? ' When every question in this topic is reviewed, it will be marked completed and the next unfinished topic will load automatically.' : ''}`}
              </p>
              {/* Not merely disabled: a paste from the wrong range is not
                  something to nudge past, so the control is not offered. */}
              {!wrongRange && !liveBlocked && (
                <button
                  onClick={() => runPreview(true)}
                  disabled={busy || blocked}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {applying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Apply {summary.changed} change{summary.changed === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}

          {applied && (
            <div className="mt-5 flex items-center gap-2 border-t border-border pt-5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              {summary.written ?? 0} written. Live in practice now
              {(summary.modulesInvalidated ?? 0) > 0 &&
                `, ${summary.modulesInvalidated} mock module(s) refreshed`}
              .
            </div>
          )}
        </section>
      )}
    </main>
  )
}

/* ── Pieces ── */

function StepHeading({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
        {n}
      </span>
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        min={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
    </label>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'primary' | 'warn' | 'bad'
}) {
  const colour =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'bad'
        ? 'text-destructive'
        : tone === 'warn'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-foreground'
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <p className={`text-lg font-black leading-none ${colour}`}>{value}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

const STATUS_STYLE: Record<BulkRowResult['status'], string> = {
  changed: 'border-border',
  unchanged: 'border-border',
  not_found: 'border-amber-500/40',
  out_of_range: 'border-destructive/50',
  live_locked: 'border-destructive/50',
  invalid: 'border-destructive/50',
}

function RowCard({ row }: { row: BulkRowResult }) {
  return (
    <article className={`rounded-xl border bg-background p-3.5 ${STATUS_STYLE[row.status]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-[11px] font-semibold text-foreground">{row.questionId || '—'}</code>
        <span className="text-[10px] text-muted-foreground">line {row.line}</span>
        {row.changesAnswer && (
          <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
            answer changed
          </span>
        )}
        {row.changesTaxonomy && (
          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            reclassified
          </span>
        )}
        {row.status === 'not_found' && (
          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            not found
          </span>
        )}
        {row.status === 'live_locked' && (
          <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
            exam in progress
          </span>
        )}
        {row.status === 'out_of_range' && (
          <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
            wrong range
          </span>
        )}
        {row.status === 'invalid' && (
          <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
            invalid
          </span>
        )}
      </div>

      {row.errors.map((e) => (
        <p key={e} className="mt-1.5 text-[11px] text-destructive">
          {e}
        </p>
      ))}
      {row.warnings.map((w) => (
        <p key={w} className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          {w}
        </p>
      ))}

      {row.diffs.length > 0 && (
        <dl className="mt-2.5 space-y-2">
          {row.diffs.map((d) => (
            <div key={d.column}>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d.column.replace('_', ' ')}
              </dt>
              <dd className="mt-1 space-y-1">
                <p className="rounded-lg bg-destructive/5 px-2 py-1 text-[11px] leading-relaxed text-muted-foreground line-through decoration-destructive/40">
                  {d.before || <em>empty</em>}
                </p>
                <p className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] leading-relaxed text-foreground">
                  {d.after}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}
