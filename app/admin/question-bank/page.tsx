'use client'

// ============================================================
// app/admin/question-bank/page.tsx — Download the practice question bank
// ============================================================
// One card per practice subject, with a row per medium (one table each):
// its question count and a CSV / JSON download of the whole table, e.g.
// "GK · Telugu medium". The Telugu and English language papers have one table
// each, used by both mediums. Data: /api/admin/practice-data.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BookOpen, Brain, Calculator, FileJson, FileSpreadsheet, FlaskConical, Globe, Languages, Loader2, Newspaper, RefreshCw } from 'lucide-react'

interface TableStat {
  table: string
  subjectKey: string
  subjectName: string
  subjectTeluguName: string
  medium: 'english' | 'telugu'
  count: number
}

/** Practice subjects in the order of the exam paper, with their icons. */
const SUBJECTS: { key: string; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'gk', name: 'GK & Current Affairs', icon: Newspaper },
  { key: 'pedagogy', name: 'Psychology & Perspectives', icon: Brain },
  { key: 'telugu', name: 'Telugu (Language I)', icon: BookOpen },
  { key: 'english', name: 'English (Language II)', icon: Languages },
  { key: 'mathematics', name: 'Mathematics', icon: Calculator },
  { key: 'science', name: 'Science', icon: FlaskConical },
  { key: 'social_studies', name: 'Social Studies', icon: Globe },
]
const LANGUAGE_PAPERS = new Set(['telugu', 'english'])
const number = (n: number) => n.toLocaleString('en-IN')

export default function AdminQuestionBankPage() {
  const [tables, setTables] = useState<TableStat[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/practice-data?action=stats', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !Array.isArray(data.tables)) throw new Error(data.error || 'Could not load the question bank.')
      setTables(data.tables)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the question bank.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const download = async (t: TableStat, format: 'csv' | 'json') => {
    const key = `${t.table}:${format}`
    const label = `${t.subjectName} · ${t.medium === 'telugu' ? 'Telugu' : 'English'} medium`
    setDownloading(key)
    const toastId = toast.loading(`Preparing ${label} (${format.toUpperCase()})…`)
    try {
      const params = new URLSearchParams({ action: 'download', table: t.table, format })
      const res = await fetch(`/api/admin/practice-data?${params}`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Download failed.')
      }
      const blob = await res.blob()
      const match = res.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)
      const filename = match?.[1] ?? `dsc_practice_${t.subjectKey}_${t.medium}_medium.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${filename}`, { id: toastId })
    } catch (err) {
      toast.error('Download failed', { id: toastId, description: err instanceof Error ? err.message : undefined })
    } finally {
      setDownloading(null)
    }
  }

  const total = (tables ?? []).reduce((n, t) => n + t.count, 0)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Question bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Download any practice subject, medium by medium: the whole table as Excel-ready CSV (UTF-8) or JSON.
          </p>
          {tables && <p className="mt-2 text-xs font-medium text-foreground">{number(total)} questions in {tables.length} tables</p>}
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50 cursor-pointer">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      )}

      {!tables && !error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SUBJECTS.map((s) => <div key={s.key} className="h-44 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      )}

      {tables && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SUBJECTS.map((s) => {
            const rows = tables.filter((t) => t.subjectKey === s.key).sort((a, b) => (a.medium === 'english' ? -1 : 1) - (b.medium === 'english' ? -1 : 1))
            if (!rows.length) return null
            const Icon = s.icon
            const subjectTotal = rows.reduce((n, t) => n + t.count, 0)
            return (
              <section key={s.key} className="flex flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-bold text-foreground">{s.name}</h2>
                    <p className="truncate text-xs text-muted-foreground">{rows[0].subjectTeluguName}</p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">{number(subjectTotal)}</span>
                </div>
                <div className="mt-auto space-y-2">
                  {rows.map((t) => {
                    const mediumName = LANGUAGE_PAPERS.has(s.key) ? 'Both mediums' : t.medium === 'telugu' ? 'Telugu medium' : 'English medium'
                    return (
                      <div key={t.table} className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground">{mediumName}</p>
                          <p className="text-[11px] text-muted-foreground">{number(t.count)} questions</p>
                        </div>
                        <DownloadButton busy={downloading === `${t.table}:csv`} disabled={!!downloading || t.count === 0}
                          onClick={() => void download(t, 'csv')} icon={FileSpreadsheet} label="CSV" primary />
                        <DownloadButton busy={downloading === `${t.table}:json`} disabled={!!downloading || t.count === 0}
                          onClick={() => void download(t, 'json')} icon={FileJson} label="JSON" />
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}

function DownloadButton({ busy, disabled, onClick, icon: Icon, label, primary }: {
  busy: boolean
  disabled: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  primary?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={`Download ${label}`}
      className={`inline-flex h-8 w-[74px] shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer ${
        primary ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border bg-card text-foreground hover:bg-accent'
      }`}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />} {label}
    </button>
  )
}
