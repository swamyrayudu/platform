'use client'

// ============================================================
// app/admin/question-bank/page.tsx — What is in the bank, and exporting it
// ============================================================
// Four hundred lines that used to sit in the middle of the dashboard, between
// the plan pricing editor and the recent payments table. Nothing about it
// changed except that it now has an address of its own.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Brain,
  Calculator,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FlaskConical,
  Globe,
  Languages,
  Newspaper,
  Sparkles,
  Loader2,
  Layers,
  Filter,
} from 'lucide-react'
import { StatCard, type PracticeDataStats } from '@/app/components/admin/shared'

const SUBJECT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Languages,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe,
  Brain,
  Newspaper,
}

export default function AdminQuestionBankPage() {
  const [practiceStats, setPracticeStats] = useState<PracticeDataStats | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const [customMedium, setCustomMedium] = useState<string>('all')
  const [customSubject, setCustomSubject] = useState<string>('all')
  const [customFormat, setCustomFormat] = useState<'csv' | 'json'>('csv')
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/practice-data?action=stats', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setPracticeStats(data.stats ?? null)
      } else {
        setError('Could not load question bank statistics.')
      }
    } catch {
      setError('Network error while loading the question bank.')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats()
  }, [fetchStats])

  const handlePracticeDownload = async (options: {
    medium?: string
    subject?: string
    format?: 'csv' | 'json'
    label?: string
  }) => {
    const { medium = 'all', subject = 'all', format = 'csv', label } = options
    const downloadId = `${subject}_${medium}_${format}`
    setDownloadingKey(downloadId)
    const toastId = toast.loading(`Preparing ${label || 'practice data'} (${format.toUpperCase()})...`)

    try {
      const params = new URLSearchParams({
        action: 'download',
        medium,
        subject,
        format,
      })

      const response = await fetch(`/api/admin/practice-data?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to download practice data')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition')
      let filename = `dsc_practice_${subject}_${medium}.${format}`
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/)
        if (match && match[1]) {
          filename = match[1]
        }
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Download ready: ${filename}`, { id: toastId })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Download error'
      toast.error('Download failed', {
        id: toastId,
        description: message,
      })
    } finally {
      setDownloadingKey(null)
    }
  }

  const getCustomEstimatedCount = (): number => {
    if (!practiceStats) return 0
    if (customSubject === 'all') {
      if (customMedium === 'english') return practiceStats.englishQuestions
      if (customMedium === 'telugu') return practiceStats.teluguQuestions
      return practiceStats.totalQuestions
    }
    const subj = practiceStats.subjects.find((s) => s.key === customSubject)
    if (!subj) return 0
    if (customMedium === 'english') return subj.englishCount
    if (customMedium === 'telugu') return subj.teluguCount
    return subj.totalCount
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Question bank</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            What is in the bank, by subject and medium — and how to export it.
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

        {/* ── Practice Question Bank & Data Export ────────────── */}
        <section className="mb-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 via-primary/15 to-emerald-500/10 text-emerald-500 shadow-inner">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-foreground">Practice Question Bank & Data Export</h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="h-2.5 w-2.5" /> Live Database Sync · 12 Tables
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Export complete question repositories, medium-wise archives, or subject-specific questions in Excel-ready CSV (UTF-8) and JSON
                </p>
              </div>
            </div>

            {/* Total Data 1-Click Action Buttons */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => handlePracticeDownload({ medium: 'all', subject: 'all', format: 'csv', label: 'All Practice Questions' })}
                disabled={Boolean(downloadingKey)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 text-xs font-bold shadow-sm shadow-emerald-500/20 disabled:opacity-60 transition-all cursor-pointer"
                title="Download all practice questions across all subjects and mediums as CSV"
              >
                {downloadingKey === 'all_all_csv' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                <span>Download Total CSV</span>
                {practiceStats && (
                  <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-extrabold tracking-tight">
                    {practiceStats.totalQuestions.toLocaleString()} Qs
                  </span>
                )}
              </button>

              <button
                onClick={() => handlePracticeDownload({ medium: 'all', subject: 'all', format: 'json', label: 'All Practice Questions' })}
                disabled={Boolean(downloadingKey)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-60 transition-colors cursor-pointer"
                title="Download all practice questions in JSON format"
              >
                {downloadingKey === 'all_all_json' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileJson className="h-3.5 w-3.5 text-primary" />
                )}
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Overview Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              icon={Database}
              label="Total Questions in Bank"
              value={practiceStats ? practiceStats.totalQuestions.toLocaleString() : '...'}
              sub="Combined across 12 indexed tables"
              color="emerald"
            />
            <StatCard
              icon={Languages}
              label="English Medium Questions"
              value={practiceStats ? practiceStats.englishQuestions.toLocaleString() : '...'}
              sub={practiceStats && practiceStats.totalQuestions > 0 ? `${Math.round((practiceStats.englishQuestions / practiceStats.totalQuestions) * 100)}% of question bank` : ''}
              color="blue"
            />
            <StatCard
              icon={BookOpen}
              label="Telugu Medium Questions"
              value={practiceStats ? practiceStats.teluguQuestions.toLocaleString() : '...'}
              sub={practiceStats && practiceStats.totalQuestions > 0 ? `${Math.round((practiceStats.teluguQuestions / practiceStats.totalQuestions) * 100)}% of question bank` : ''}
              color="amber"
            />
            <StatCard
              icon={Layers}
              label="Subject Coverage"
              value={practiceStats ? `${practiceStats.subjects.length} Subjects` : '7 Subjects'}
              sub="Languages, Math, Sciences & Pedagogy"
              color="primary"
            />
          </div>

          {/* Medium-Wise Quick Download Cards */}
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {/* English Medium Card */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-blue-500/5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary border border-primary/20">
                    <Languages className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">English Medium Dataset</h3>
                    <p className="text-[11px] text-muted-foreground">Complete English medium practice archive</p>
                  </div>
                </div>
                <span className="rounded-full border border-primary/30 bg-secondary px-2.5 py-0.5 text-xs font-bold text-primary">
                  {practiceStats ? practiceStats.englishQuestions.toLocaleString() : '...'} Questions
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Includes English (Language II), Math (EM), General Science (EM), Social Studies (EM), Pedagogy & Educational Psychology (EM), GK & Current Affairs (EM).
              </p>
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <button
                  onClick={() => handlePracticeDownload({ medium: 'english', subject: 'all', format: 'csv', label: 'English Medium Dataset' })}
                  disabled={Boolean(downloadingKey)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground px-3.5 py-2 text-xs font-bold shadow-sm shadow-blue-500/20 disabled:opacity-60 transition-all cursor-pointer"
                >
                  {downloadingKey === 'all_english_csv' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  <span>Download English CSV</span>
                </button>
                <button
                  onClick={() => handlePracticeDownload({ medium: 'english', subject: 'all', format: 'json', label: 'English Medium Dataset' })}
                  disabled={Boolean(downloadingKey)}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-accent px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {downloadingKey === 'all_english_json' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileJson className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* Telugu Medium Card */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 via-card to-card p-5 transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Telugu Medium Dataset</h3>
                    <p className="text-[11px] text-muted-foreground font-serif">తెలుగు మీడియం సమగ్ర ప్రశ్నల నిధి</p>
                  </div>
                </div>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  {practiceStats ? practiceStats.teluguQuestions.toLocaleString() : '...'} Questions
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Includes తెలుగు (భాష I), గణితం (TM), సాధారణ సైన్స్ (TM), సాంఘిక శాస్త్రం (TM), విద్యా మనోవిజ్ఞాన శాస్త్రం (TM), సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు (TM).
              </p>
              <div className="flex items-center gap-2 pt-3 border-t border-border/60">
                <button
                  onClick={() => handlePracticeDownload({ medium: 'telugu', subject: 'all', format: 'csv', label: 'Telugu Medium Dataset' })}
                  disabled={Boolean(downloadingKey)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 text-xs font-bold shadow-sm shadow-amber-500/20 disabled:opacity-60 transition-all cursor-pointer"
                >
                  {downloadingKey === 'all_telugu_csv' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  )}
                  <span>Download Telugu CSV</span>
                </button>
                <button
                  onClick={() => handlePracticeDownload({ medium: 'telugu', subject: 'all', format: 'json', label: 'Telugu Medium Dataset' })}
                  disabled={Boolean(downloadingKey)}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-accent px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {downloadingKey === 'all_telugu_json' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileJson className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span>JSON</span>
                </button>
              </div>
            </div>
          </div>

          {/* Subject-Wise Breakdown & Download Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
            <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" /> Subject-Wise Question Inventory & Downloads
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select and download specific subject pools with independent English and Telugu medium packages
                </p>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg self-start sm:self-auto">
                All downloads include UTF-8 BOM encoding for Excel
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                    <th className="px-4 py-3 text-left font-semibold">Subject</th>
                    <th className="px-4 py-3 text-center font-semibold">English Medium</th>
                    <th className="px-4 py-3 text-center font-semibold">Telugu Medium</th>
                    <th className="px-4 py-3 text-right font-semibold">Total Questions</th>
                    <th className="px-4 py-3 text-right font-semibold">Export Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {practiceStats?.subjects.map((subj) => {
                    const SubjectIcon = SUBJECT_ICON_MAP[subj.icon] || Database
                    return (
                      <tr key={subj.key} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <SubjectIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-bold text-foreground text-xs">{subj.name}</div>
                              <div className="text-[11px] text-muted-foreground">{subj.teluguName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {subj.englishCount > 0 ? (
                            <span className="inline-flex items-center rounded-md border border-primary/20 bg-secondary px-2 py-0.5 text-[11px] font-semibold text-primary">
                              {subj.englishCount.toLocaleString()} Qs
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {subj.teluguCount > 0 ? (
                            <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                              {subj.teluguCount.toLocaleString()} Qs
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-foreground">
                          {subj.totalCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Download All CSV for this subject */}
                            <button
                              onClick={() => handlePracticeDownload({ medium: 'all', subject: subj.key, format: 'csv', label: `${subj.name} (All)` })}
                              disabled={Boolean(downloadingKey)}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                              title={`Download all ${subj.name} questions (both mediums) as CSV`}
                            >
                              {downloadingKey === `${subj.key}_all_csv` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileSpreadsheet className="h-3 w-3" />
                              )}
                              <span>All CSV</span>
                            </button>

                            {/* Download Telugu Medium CSV if present */}
                            {subj.teluguCount > 0 && (
                              <button
                                onClick={() => handlePracticeDownload({ medium: 'telugu', subject: subj.key, format: 'csv', label: `${subj.name} (Telugu)` })}
                                disabled={Boolean(downloadingKey)}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                title={`Download ${subj.name} Telugu medium questions (${subj.teluguCount.toLocaleString()})`}
                              >
                                {downloadingKey === `${subj.key}_telugu_csv` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <span>TM CSV</span>
                                )}
                              </button>
                            )}

                            {/* Download English Medium CSV if present */}
                            {subj.englishCount > 0 && (
                              <button
                                onClick={() => handlePracticeDownload({ medium: 'english', subject: subj.key, format: 'csv', label: `${subj.name} (English)` })}
                                disabled={Boolean(downloadingKey)}
                                className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-secondary hover:bg-secondary text-primary px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                title={`Download ${subj.name} English medium questions (${subj.englishCount.toLocaleString()})`}
                              >
                                {downloadingKey === `${subj.key}_english_csv` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <span>EM CSV</span>
                                )}
                              </button>
                            )}

                            {/* Download JSON for this subject */}
                            <button
                              onClick={() => handlePracticeDownload({ medium: 'all', subject: subj.key, format: 'json', label: `${subj.name}` })}
                              disabled={Boolean(downloadingKey)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border hover:bg-accent px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
                              title={`Download ${subj.name} in JSON format`}
                            >
                              {downloadingKey === `${subj.key}_all_json` ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <FileJson className="h-3 w-3" />
                              )}
                              <span>JSON</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom Export Builder */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Custom Export Builder</h3>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Filtered subset export
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Select Medium
                </label>
                <select
                  value={customMedium}
                  onChange={(e) => setCustomMedium(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="all">All Mediums (Both English & Telugu)</option>
                  <option value="english">English Medium Only</option>
                  <option value="telugu">Telugu Medium Only (తెలుగు)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Select Subject
                </label>
                <select
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="all">All Subjects (Complete Syllabus)</option>
                  <option value="english">English (భాష II)</option>
                  <option value="telugu">Telugu (భాష I - తెలుగు)</option>
                  <option value="mathematics">Mathematics (గణితం)</option>
                  <option value="science">Science (సాధారణ సైన్స్)</option>
                  <option value="social_studies">Social Studies (సాంఘిక శాస్త్రం)</option>
                  <option value="pedagogy">Educational Psychology & Pedagogy (సైకాలజీ)</option>
                  <option value="gk">GK & Current Affairs (సాధారణ జ్ఞానం)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  File Format
                </label>
                <select
                  value={customFormat}
                  onChange={(e) => setCustomFormat(e.target.value as 'csv' | 'json')}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="csv">CSV Spreadsheet (.csv - Excel UTF-8)</option>
                  <option value="json">JSON Object Array (.json)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Estimated matching questions:</span>
                <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-bold text-primary">
                  {getCustomEstimatedCount().toLocaleString()} Questions
                </span>
              </div>

              <button
                onClick={() =>
                  handlePracticeDownload({
                    medium: customMedium,
                    subject: customSubject,
                    format: customFormat,
                    label: `Custom ${customSubject} (${customMedium})`,
                  })
                }
                disabled={Boolean(downloadingKey) || getCustomEstimatedCount() === 0}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {downloadingKey === `${customSubject}_${customMedium}_${customFormat}` ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Download Custom Dataset ({customFormat.toUpperCase()})</span>
              </button>
            </div>
          </div>
        </section>
    </main>
  )
}
