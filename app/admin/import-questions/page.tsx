'use client'

// ============================================================
// app/admin/import-questions/page.tsx — Add new questions from CSV
// ============================================================
// The counterpart to /admin/bulk-update: that one rewrites questions the bank
// already has, this one adds questions it does not.
//
// Kept as its own page rather than a tab, because the two are one wrong click
// apart and the wrong click is expensive: pasting new questions into the
// updater matches nothing, while pasting a rewrite into the importer would
// add a second copy of every question. Different pages, different buttons,
// different words.
//
// Nothing here touches a mock test. A module is a fixed list chosen when it
// was generated, so a row that did not exist then is in no module now.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileWarning,
  Loader2,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/loading-screen'
import { QUESTION_TABLES } from '@/lib/questions/tables'
import type {
  ImportPreviewResponse,
  ImportRowResult,
  ImportTableInfo,
} from '@/types/bulk-import'

const TABLES = QUESTION_TABLES.filter((t) => !t.legacy)

const HEADER =
  'question,option_a,option_b,option_c,option_d,correct_answer,explanation,topic,subtopic,chapter,difficulty,class_level'

export default function ImportQuestionsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [table, setTable] = useState(TABLES[0]!.table)
  const [info, setInfo] = useState<ImportTableInfo | null>(null)
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') router.replace('/dsc-sgt')
    if (!authLoading && !user) router.replace('/')
  }, [authLoading, user, router])

  // Switching table invalidates everything downstream: a preview says which
  // questions are duplicates *of that table*, and means nothing against another.
  const [lastTable, setLastTable] = useState(table)
  if (lastTable !== table) {
    setLastTable(table)
    setInfo(null)
    setPreview(null)
    setError(null)
  }

  const [lastCsv, setLastCsv] = useState(csv)
  if (lastCsv !== csv) {
    setLastCsv(csv)
    if (preview) setPreview(null)
  }

  const loadInfo = useCallback(async (target: string) => {
    try {
      const res = await fetch(`/api/admin/questions/import?table=${encodeURIComponent(target)}`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (res.ok && data.success) setInfo(data as ImportTableInfo)
    } catch {
      // The page still works without it; it is a preview of the next id.
    }
  }, [])

  // Fetching from the server when the selected table changes is the case
  // effects exist for — synchronising with an external system. The rule fires
  // because the response lands in state, which every data fetch does; there is
  // no render-phase alternative for "ask the server about this table".
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInfo(table)
  }, [table, loadInfo])

  const run = useCallback(
    async (apply: boolean) => {
      if (!csv.trim()) {
        setError('Paste the new questions first.')
        return
      }
      if (apply) setApplying(true)
      else setPreviewing(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/questions/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ table, csv, apply }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          setError(data.error ?? 'Request failed')
          return
        }
        setPreview(data as ImportPreviewResponse)
        if (apply) {
          const n = data.summary.inserted ?? 0
          toast.success(`Imported ${n} question${n === 1 ? '' : 's'}`, {
            description: 'Live in practice now. No mock module changed.',
          })
          loadInfo(table)
        }
      } catch {
        setError('Network error.')
      } finally {
        if (apply) setApplying(false)
        else setPreviewing(false)
      }
    },
    [table, csv, loadInfo]
  )

  if (authLoading) return <LoadingScreen message="Checking access…" />
  if (!user || user.role !== 'admin') return null

  const summary = preview?.summary
  const applied = preview?.applied === true
  const refused =
    (summary?.invalid ?? 0) + (summary?.duplicateId ?? 0) + (summary?.duplicateText ?? 0)
  const blocked = refused > 0 || (summary?.toInsert ?? 0) === 0

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </button>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Import new questions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adds questions a subject does not have yet. Existing questions are never touched — use{' '}
          <button
            onClick={() => router.push('/admin/bulk-update')}
            className="font-semibold text-primary underline underline-offset-2"
          >
            Bulk update
          </button>{' '}
          to rewrite those.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Step 1: where ── */}
      <section className="mb-5 rounded-2xl border border-border bg-card p-5">
        <StepHeading n={1} title="Choose the subject to add to" />
        <div className="mt-4">
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className="w-full max-w-md rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {TABLES.map((t) => (
              <option key={t.table} value={t.table}>
                {t.subjectDisplayName} · {t.medium === 'telugu' ? 'Telugu medium' : 'English medium'}
              </option>
            ))}
          </select>
        </div>

        {info && (
          <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            <p>{info.total.toLocaleString('en-IN')} questions already in this table.</p>
            <p>
              Rows without a{' '}
              <code className="rounded bg-muted px-1 py-0.5">question_id</code> are numbered
              automatically, continuing from{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">{info.idPattern}</code>
              {info.idDerived ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {' '}
                  — this table has no consistent id pattern, so a separate IMP- series is used
                </span>
              ) : (
                <span> ({info.idCoverage}% of the table follows this pattern)</span>
              )}
              .
            </p>
          </div>
        )}
      </section>

      {/* ── Step 2: paste ── */}
      <section className="mb-5 rounded-2xl border border-border bg-card p-5">
        <StepHeading n={2} title="Paste the new questions" />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Required: <code className="rounded bg-muted px-1 py-0.5">question</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">option_a…d</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">correct_answer</code>. Optional:{' '}
          <code className="rounded bg-muted px-1 py-0.5">question_id</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">explanation</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">topic</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">subtopic</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">chapter</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">difficulty</code>,{' '}
          <code className="rounded bg-muted px-1 py-0.5">class_level</code>. Subject and medium come
          from the table you picked. Anything left out takes the table&apos;s default.
        </p>

        <button
          onClick={async () => {
            await navigator.clipboard.writeText(HEADER)
            toast.success('Header row copied')
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          Copy the header row
        </button>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          spellCheck={false}
          placeholder={`${HEADER}\n"కొత్త ప్రశ్న?","opt A","opt B","opt C","opt D",C,"why C","topic","subtopic","chapter","Medium","Class 8"`}
          className="mt-3 h-56 w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/50"
        />

        <div className="mt-3 flex justify-end">
          <button
            onClick={() => run(false)}
            disabled={previewing || !csv.trim()}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {previewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            Check these questions
          </button>
        </div>
      </section>

      {/* ── Step 3: review ── */}
      {preview && summary && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <StepHeading n={3} title={applied ? 'Imported' : 'Review before importing'} />

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Will add" value={summary.toInsert} tone="primary" />
            <Stat label="Duplicate id" value={summary.duplicateId} tone={summary.duplicateId ? 'bad' : undefined} />
            <Stat label="Already exists" value={summary.duplicateText} tone={summary.duplicateText ? 'bad' : undefined} />
            <Stat label="Invalid" value={summary.invalid} tone={summary.invalid ? 'bad' : undefined} />
            <Stat label="Ids generated" value={summary.generatedIds} />
          </div>

          {!applied && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-background p-3.5 text-xs text-muted-foreground">
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Importing adds rows; it changes nothing that already exists. No mock module is
                touched — a module is a fixed list chosen when it was generated, so these appear
                only in modules generated from now on. They are live in practice immediately.
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
            {preview.rows.map((row) => (
              <RowCard key={`${row.line}-${row.questionId ?? 'new'}`} row={row} />
            ))}
          </div>

          {!applied && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <p className="text-[11px] text-muted-foreground">
                {refused > 0
                  ? `${refused} row(s) are refused. Fix or remove them — nothing is written until every row is importable.`
                  : summary.toInsert === 0
                    ? 'Nothing to import.'
                    : `${summary.toInsert} new question(s) will be added to this subject.`}
              </p>
              <button
                onClick={() => run(true)}
                disabled={applying || blocked}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {applying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Import {summary.toInsert} question{summary.toInsert === 1 ? '' : 's'}
              </button>
            </div>
          )}

          {applied && (
            <div className="mt-5 flex items-center gap-2 border-t border-border pt-5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              {summary.inserted ?? 0} added. Live in practice now; no mock module changed.
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'primary' | 'bad'
}) {
  const colour =
    tone === 'primary' ? 'text-primary' : tone === 'bad' ? 'text-destructive' : 'text-foreground'
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <p className={`text-lg font-black leading-none ${colour}`}>{value}</p>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

const STATUS_STYLE: Record<ImportRowResult['status'], string> = {
  new: 'border-border',
  duplicate_id: 'border-destructive/50',
  duplicate_text: 'border-destructive/50',
  invalid: 'border-destructive/50',
}

const STATUS_LABEL: Record<ImportRowResult['status'], string | null> = {
  new: null,
  duplicate_id: 'duplicate id',
  duplicate_text: 'already exists',
  invalid: 'invalid',
}

function RowCard({ row }: { row: ImportRowResult }) {
  const label = STATUS_LABEL[row.status]
  return (
    <article className={`rounded-xl border bg-background p-3.5 ${STATUS_STYLE[row.status]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="text-[11px] font-semibold text-foreground">
          {row.questionId ?? '(id will be generated)'}
        </code>
        <span className="text-[10px] text-muted-foreground">line {row.line}</span>
        {label && (
          <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
            {label}
          </span>
        )}
        {row.status === 'new' && (
          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            new
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{row.preview}</p>

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
    </article>
  )
}
