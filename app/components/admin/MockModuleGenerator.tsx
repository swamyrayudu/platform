'use client'

// ============================================================
// app/components/admin/MockModuleGenerator.tsx
// ============================================================
// Admin flow for the predefined module series:
//
//   Select Medium → Select Blueprint → choose module range
//     → Dry Run (validate + review coverage, writes nothing)
//     → Generate & Publish (writes, validates each module, warms Redis)
//
// The dry run exists so the coverage / repetition report can be reviewed
// BEFORE anything is committed. Nothing is published unless it validates.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import {
  Layers,
  Loader2,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Rocket,
} from 'lucide-react'

interface SectionCoverage {
  section_id: string
  section_name: string
  questions_per_module: number
  slots: number
  eligible_pool: number
  unique_used: number
  repeated_assignments: number
  coverage_pct: number
  min_usage: number
  max_usage: number
}

interface GenerationReport {
  series: string
  medium: string
  blueprint_id: string
  modules_generated: number
  module_from: number
  module_to: number
  total_slots: number
  unique_questions_used: number
  repeated_assignments: number
  eligible_pool_size: number
  coverage_pct: number
  per_section: SectionCoverage[]
  warnings: string[]
}

interface BlueprintOption {
  id: string
  name: string
  total_questions: number
  total_marks: number
  duration_minutes: number
}

interface UsageStat {
  medium: string
  tracked_questions: number
  total_assignments: number
  max_usage: number
  histogram: Record<string, number>
}

type Medium = 'english' | 'telugu'

export default function MockModuleGenerator() {
  const [medium, setMedium] = useState<Medium>('english')
  const [blueprintId, setBlueprintId] = useState('ap_dsc_sgt_official')
  const [blueprints, setBlueprints] = useState<BlueprintOption[]>([])
  const [series, setSeries] = useState('grand_mock_v1')
  const [moduleFrom, setModuleFrom] = useState(1)
  const [moduleTo, setModuleTo] = useState(100)

  const [running, setRunning] = useState<'dry' | 'write' | null>(null)
  const [report, setReport] = useState<GenerationReport | null>(null)
  const [wasDryRun, setWasDryRun] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [publishedCounts, setPublishedCounts] = useState<Record<string, number>>({})
  const [usageStats, setUsageStats] = useState<UsageStat[]>([])

  // ---- Load blueprints + current state ----------------------------

  const loadContext = useCallback(async () => {
    try {
      const [listRes, reportsRes] = await Promise.all([
        fetch('/api/admin/mock-tests?pageSize=1'),
        fetch('/api/admin/mock-tests/reports?limit=1'),
      ])
      const listJson = await listRes.json()
      const reportsJson = await reportsRes.json()

      if (listJson.success && Array.isArray(listJson.blueprints)) {
        setBlueprints(listJson.blueprints)
      }
      if (reportsJson.success) {
        setPublishedCounts(reportsJson.published_module_counts ?? {})
        setUsageStats(reportsJson.usage_stats ?? [])
      }
    } catch {
      // Non-fatal — the panel still works without the summary.
    }
  }, [])

  useEffect(() => {
    void loadContext()
  }, [loadContext])

  // ---- Run generation --------------------------------------------

  const run = async (dryRun: boolean) => {
    setRunning(dryRun ? 'dry' : 'write')
    setError(null)
    setMessage(null)
    if (dryRun) setReport(null)

    try {
      const res = await fetch('/api/admin/mock-tests/generate-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medium,
          blueprintId,
          series,
          moduleFrom,
          moduleTo,
          dryRun,
          publish: true,
        }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        setError(json.error || 'Generation failed')
        if (json.report) setReport(json.report)
        return
      }

      setReport(json.report ?? null)
      setWasDryRun(dryRun)

      if (dryRun) {
        setMessage(`Dry run complete — ${json.modules_planned} modules planned. Nothing was written.`)
      } else {
        setMessage(
          `Wrote ${json.modules_written} modules` +
            (json.modules_failed ? `, ${json.modules_failed} failed` : '') +
            `. Redis cache warmed at publish.`
        )
        void loadContext()
      }
    } catch {
      setError('Network error while generating modules')
    } finally {
      setRunning(null)
    }
  }

  const moduleCount = Math.max(0, moduleTo - moduleFrom + 1)
  const uniqueRate =
    report && report.total_slots > 0
      ? ((report.unique_questions_used / report.total_slots) * 100).toFixed(1)
      : null

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-base font-black text-foreground">Generate Mock Modules</h2>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            Published — English:{' '}
            <strong className="text-foreground">{publishedCounts.english ?? 0}</strong>
          </span>
          <span>
            Telugu: <strong className="text-foreground">{publishedCounts.telugu ?? 0}</strong>
          </span>
          <button
            onClick={() => void loadContext()}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 hover:bg-accent"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Medium
          </label>
          <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {(['english', 'telugu'] as Medium[]).map((m) => (
              <button
                key={m}
                onClick={() => setMedium(m)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold capitalize transition ${
                  medium === m
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Blueprint
          </label>
          <select
            value={blueprintId}
            onChange={(e) => setBlueprintId(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-card px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
          >
            {blueprints.length === 0 && <option value={blueprintId}>{blueprintId}</option>}
            {blueprints.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.total_questions}Q)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Series
          </label>
          <input
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-card px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Module from
          </label>
          <input
            type="number"
            min={1}
            value={moduleFrom}
            onChange={(e) => setModuleFrom(Math.max(1, Number(e.target.value) || 1))}
            className="h-9 w-full rounded-xl border border-border bg-card px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Module to
          </label>
          <input
            type="number"
            min={1}
            value={moduleTo}
            onChange={(e) => setModuleTo(Math.max(1, Number(e.target.value) || 1))}
            className="h-9 w-full rounded-xl border border-border bg-card px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void run(true)}
          disabled={running !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-accent disabled:opacity-50"
        >
          {running === 'dry' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BarChart3 className="h-3.5 w-3.5" />
          )}
          Dry Run &amp; Review ({moduleCount} modules)
        </button>

        <button
          onClick={() => void run(false)}
          disabled={running !== null}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary disabled:opacity-50"
        >
          {running === 'write' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Rocket className="h-3.5 w-3.5" />
          )}
          Generate, Validate &amp; Publish
        </button>

        <span className="text-[11px] text-muted-foreground">
          A dry run writes nothing. Publishing validates each module and warms its Redis cache.
        </span>
      </div>

      {/* ── Messages ── */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* ── Coverage report ── */}
      {report && (
        <div className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-black uppercase tracking-wide text-foreground">
              Coverage Report {wasDryRun && <span className="text-muted-foreground">(dry run)</span>}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {report.medium} · modules {report.module_from}–{report.module_to}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Modules', value: report.modules_generated },
              { label: 'Question slots', value: report.total_slots.toLocaleString() },
              { label: 'Unique questions', value: report.unique_questions_used.toLocaleString() },
              { label: 'Repeated assignments', value: report.repeated_assignments.toLocaleString() },
              { label: 'Slots filled uniquely', value: uniqueRate ? `${uniqueRate}%` : '—' },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
                <p className="text-sm font-black text-foreground">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[11px]">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Section</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Q/mod</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Slots</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Pool</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Unique</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Repeats</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Pool cover</th>
                  <th className="py-1.5 text-right font-semibold">Max uses</th>
                </tr>
              </thead>
              <tbody>
                {report.per_section.map((s) => (
                  <tr key={s.section_id} className="border-t border-border/60">
                    <td className="py-1.5 pr-3 font-semibold text-foreground">{s.section_name}</td>
                    <td className="py-1.5 pr-3 text-right">{s.questions_per_module}</td>
                    <td className="py-1.5 pr-3 text-right">{s.slots}</td>
                    <td className="py-1.5 pr-3 text-right">{s.eligible_pool}</td>
                    <td className="py-1.5 pr-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {s.unique_used}
                    </td>
                    <td
                      className={`py-1.5 pr-3 text-right font-bold ${
                        s.repeated_assignments > 0 ? 'text-amber-600 dark:text-amber-400' : ''
                      }`}
                    >
                      {s.repeated_assignments}
                    </td>
                    <td className="py-1.5 pr-3 text-right">{s.coverage_pct}%</td>
                    <td className="py-1.5 text-right">{s.max_usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.warnings.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-[11px] font-bold text-amber-600 dark:text-amber-400">
                {[...new Set(report.warnings)].length} warning(s) — pools too small for full
                uniqueness
              </summary>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {[...new Set(report.warnings)].slice(0, 30).map((w, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-amber-500">•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* ── Live usage tracking ── */}
      {usageStats.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {usageStats.map((u) => (
            <div key={u.medium} className="rounded-2xl border border-border bg-card p-3">
              <p className="mb-1 text-[11px] font-black uppercase tracking-wide text-foreground">
                {u.medium} — question usage
              </p>
              <p className="text-[11px] text-muted-foreground">
                {u.tracked_questions.toLocaleString()} questions tracked ·{' '}
                {u.total_assignments.toLocaleString()} assignments · max {u.max_usage} uses
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(u.histogram)
                  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                  .map(([uses, count]) => (
                    <span
                      key={uses}
                      className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {uses} use{uses === '1' ? '' : 's'}:{' '}
                      <strong className="text-foreground">{count}</strong>
                    </span>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
