'use client'

// ============================================================
// app/admin/bulk-update/page.tsx — Rewrite questions a range at a time
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

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/loading-screen'
import { QUESTION_TABLES } from '@/lib/questions/tables'
import { toCsv, type CsvRow } from '@/lib/questions/csv'
import {
  BULK_CSV_COLUMNS,
  BULK_MAX_ROWS,
  type BulkExportResponse,
  type BulkPreviewResponse,
  type BulkRowResult,
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

export default function BulkUpdatePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [table, setTable] = useState(TABLES[0]!.table)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(100)

  const [total, setTotal] = useState<number | null>(null)
  const [exported, setExported] = useState<BulkExportResponse | null>(null)
  const [exporting, setExporting] = useState(false)

  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [allowAnswerChange, setAllowAnswerChange] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Switching table drops everything downstream — a preview computed against
  // one table must never be applied to another.
  const [lastTable, setLastTable] = useState(table)
  if (lastTable !== table) {
    setLastTable(table)
    setExported(null)
    setPreview(null)
    setCsv('')
    setTotal(null)
    setError(null)
    const done = readProgress()[table] ?? 0
    setFrom(done + 1)
    setTo(done + 100)
  }

  // Editing the paste invalidates the preview it produced.
  const [lastCsv, setLastCsv] = useState(csv)
  if (lastCsv !== csv) {
    setLastCsv(csv)
    if (preview) setPreview(null)
  }

  const rangeSize = to - from + 1
  const rangeValid = from >= 1 && to >= from && rangeSize <= BULK_MAX_ROWS

  const fetchRange = useCallback(async () => {
    if (!rangeValid) {
      setError(`Range must start at 1 or more and cover at most ${BULK_MAX_ROWS} questions.`)
      return
    }
    setExporting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/questions/bulk?table=${encodeURIComponent(table)}&from=${from}&to=${to}`,
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
        toast.info('That range is past the end of this table.')
      }
    } catch {
      setError('Network error while reading the range.')
    } finally {
      setExporting(false)
    }
  }, [table, from, to, rangeValid])

  const exportCsvText = useMemo(() => {
    if (!exported) return ''
    return toCsv(BULK_CSV_COLUMNS, exported.rows as unknown as CsvRow[])
  }, [exported])

  const runPreview = useCallback(
    async (apply: boolean) => {
      if (!csv.trim()) {
        setError('Paste the rewritten CSV first.')
        return
      }
      if (apply) setApplying(true)
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
          const current = readProgress()
          const reached = exported?.to ?? 0
          writeProgress({ ...current, [table]: Math.max(current[table] ?? 0, reached) })
        }
      } catch {
        setError('Network error.')
      } finally {
        if (apply) setApplying(false)
        else setPreviewing(false)
      }
    },
    [table, csv, allowAnswerChange, exported]
  )

  if (authLoading) return <LoadingScreen message="Checking access…" />
  if (!user || user.role !== 'admin') return null

  const done = progress[table] ?? 0
  const summary = preview?.summary
  const applied = preview?.applied === true

  // Nothing downstream of step 1 exists until a range has actually been
  // loaded: the paste is only ever checked against rows that were handed out.
  const rangeLoaded = Boolean(exported && exported.rows.length > 0)
  // A paste carrying rows from some other slice of the table is not a
  // validation problem to fix row by row — it is the wrong file.
  const wrongRange = (summary?.outOfRange ?? 0) > 0
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
        <h1 className="text-2xl font-black tracking-tight text-foreground">Bulk question update</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy a range out, rewrite it elsewhere, paste it back. Rows are matched on{' '}
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

      {/* ── Step 1: pick a range ── */}
      <section className="mb-5 rounded-2xl border border-border bg-card p-5">
        <StepHeading n={1} title="Choose a table and range" />

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Subject table
            </span>
            <select
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {TABLES.map((t) => (
                <option key={t.table} value={t.table}>
                  {t.subjectDisplayName} · {t.medium === 'telugu' ? 'Telugu medium' : 'English medium'}
                </option>
              ))}
            </select>
          </label>

          <NumberField label="From" value={from} onChange={setFrom} />
          <NumberField label="To" value={to} onChange={setTo} />

          <div className="flex items-end">
            <button
              onClick={fetchRange}
              disabled={exporting || !rangeValid}
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

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {total !== null && <span>{total.toLocaleString('en-IN')} questions in this table</span>}
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
                downloadCsv(`${table}_${from}-${to}_original.csv`, exportCsvText)
              }
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              Download backup
            </button>
            <p className="w-full pt-1 text-[11px] text-muted-foreground">
              Keep the backup — pasting it back is how you undo this range.
            </p>
          </div>
        )}
      </section>

      {/* ── Step 2: paste it back ── */}
      <section className="mb-5 rounded-2xl border border-border bg-card p-5">
        <StepHeading n={2} title="Paste the rewritten CSV" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Keep the header row and the{' '}
          <code className="rounded bg-muted px-1 py-0.5">question_id</code> column. Only{' '}
          <code className="rounded bg-muted px-1 py-0.5">question</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">option_a…d</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">correct_answer</code> and{' '}
          <code className="rounded bg-muted px-1 py-0.5">explanation</code> are written — anything
          else in the file is ignored. An empty cell leaves that field as it is.
        </p>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          spellCheck={false}
          placeholder={'question_id,question,option_a,option_b,option_c,option_d,correct_answer,explanation\nQ000001,"Rewritten stem…","…","…","…","…",B,"…"'}
          className="mt-3 h-56 w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/50"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={allowAnswerChange}
              onChange={(e) => setAllowAnswerChange(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Allow the paste to change{' '}
            <code className="rounded bg-muted px-1 py-0.5">correct_answer</code>
          </label>

          {rangeLoaded ? (
            <button
              onClick={() => runPreview(false)}
              disabled={previewing || !csv.trim()}
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
            Checked against rows {preview.rangeFrom}–{preview.rangeTo} of {preview.table}.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Will change" value={summary.changed} tone="primary" />
            <Stat label="Already match" value={summary.unchanged} />
            <Stat label="Not in range" value={summary.outOfRange} tone={wrongRange ? 'bad' : undefined} />
            <Stat label="Not found" value={summary.notFound} tone={summary.notFound ? 'warn' : undefined} />
            <Stat label="Invalid" value={summary.invalid} tone={summary.invalid ? 'bad' : undefined} />
            <Stat
              label="Answer key"
              value={summary.answerChanges}
              tone={summary.answerChanges ? 'bad' : undefined}
            />
          </div>

          {wrongRange && !applied && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>
                  This paste does not belong to rows {preview.rangeFrom}–{preview.rangeTo}.
                </strong>{' '}
                {summary.outOfRange} row(s) come from somewhere else in {preview.table}. Load the
                range those rows came from, or re-copy this one and paste its rewrite. Nothing can
                be written until they match.
              </span>
            </div>
          )}

          {!wrongRange && summary.missing > 0 && !applied && (
            <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
              {summary.missing} of the {preview.rangeTo - preview.rangeFrom + 1} loaded rows are not
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
                  : blocked
                    ? summary.invalid > 0
                      ? 'Fix the invalid rows above — nothing can be written until they are valid.'
                      : 'Nothing to write.'
                    : `${summary.changed} question(s) will be overwritten. This cannot be undone from here.`}
              </p>
              {/* Not merely disabled: a paste from the wrong range is not
                  something to nudge past, so the control is not offered. */}
              {!wrongRange && (
                <button
                  onClick={() => runPreview(true)}
                  disabled={applying || blocked}
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
}: {
  label: string
  value: number
  onChange: (n: number) => void
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
        {row.status === 'not_found' && (
          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            not found
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
