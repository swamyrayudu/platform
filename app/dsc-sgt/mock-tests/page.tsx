'use client'

// ============================================================
// app/dsc-sgt/mock-tests/page.tsx — SGT Mock Test Modules
// ============================================================
// Two independent pagination concepts meet here:
//
//   MODULE PAGINATION  (this page)  Module 1-20, 21-40, 41-60, ...
//   QUESTION PAGINATION (exam page) Q1-50, Q51-100, Q101-160
//
// The module list is driven entirely by the API. Nothing here caps how many
// modules can exist — add modules in the database and they appear.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileCheck2,
  Lock,
  Play,
  Crown,
  Search,
  CheckCircle2,
  RotateCcw,
  Trophy,
  Loader2,
  RefreshCw,
  Languages,
  Globe,
  Award,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'
import { toast } from 'sonner'
import type {
  MockTestListItem,
  MockTestListResponse,
  ExamMediumKey,
  ModuleProgressStatus,
} from '@/types/mock-tests'

// Previous Year Paper and Subject Mock were removed from the product (and from
// the database), leaving a single category. A filter row whose only options are
// "All" and the one category that exists is two buttons doing the same thing,
// so the row is gone and the list simply shows every published module.
// To reintroduce categories, filter on the `category` query param the list API
// still supports.

/** Modules per page in the module list. */
const MODULES_PER_PAGE = 20

export default function MockTestsPage() {
  const router = useRouter()
  const { isPremium, openModal } = usePremium()

  const [medium, setMedium] = useState<ExamMediumKey>('telugu')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  const [data, setData] = useState<MockTestListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Debounce the search box so typing does not fire a request per keystroke.
  // The page reset happens in the same tick as the debounced value so the list
  // refetches once, not twice.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  const loadModules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        medium,
        page: String(page),
        pageSize: String(MODULES_PER_PAGE),
      })
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/dsc-sgt/mock-tests?${params.toString()}`)
      const json = (await res.json()) as MockTestListResponse & { error?: string }

      if (json.success) setData(json)
      else setError(json.error || 'Failed to load modules')
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [medium, page, debouncedSearch])

  useEffect(() => {
    void loadModules()
  }, [loadModules])

  // Changing medium / filter / search resets to the first page of modules.
  const switchMedium = (next: ExamMediumKey) => {
    if (next === medium) return
    setMedium(next)
    setPage(1)
  }

  const tests = data?.tests ?? []
  const totalModules = data?.total ?? 0
  const totalPages = data?.total_pages ?? 1
  const mediumCounts = data?.medium_counts ?? { english: 0, telugu: 0 }

  const handleStartTest = async (test: MockTestListItem) => {
    if (!test.is_free && !isPremium) {
      openModal(`mock_test_${test.id}`)
      return
    }

    // Already completed — go straight to the result.
    if (test.progress_status === 'completed' && test.user_attempt) {
      router.push(`/dsc-sgt/mock-result?attemptId=${test.user_attempt.attempt_id}`)
      return
    }

    toast.loading(`Loading ${test.title}…`, { id: 'mock-start' })
    try {
      const res = await fetch(`/api/dsc-sgt/mock-tests/${test.id}/start`, { method: 'POST' })
      const json = await res.json()

      if (!res.ok || !json.success) {
        if (json.error === 'PREMIUM_REQUIRED') {
          toast.dismiss('mock-start')
          openModal(`mock_test_${test.id}`)
          return
        }
        toast.error(json.error || 'Failed to start test', { id: 'mock-start' })
        return
      }

      toast.success('Launching exam environment…', { id: 'mock-start' })
      router.push(`/dsc-sgt/mock-exam?testId=${test.id}&attemptId=${json.attempt_id}`)
    } catch {
      toast.error('Network error — please try again', { id: 'mock-start' })
    }
  }

  // ---- Presentation helpers ---------------------------------------

  const statusBadge = (status: ModuleProgressStatus, test: MockTestListItem) => {
    if (status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Completed
          {test.user_attempt?.percentage != null && (
            <span className="opacity-80">· {test.user_attempt.percentage.toFixed(1)}%</span>
          )}
        </span>
      )
    }
    if (status === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
          <RotateCcw className="h-3 w-3" />
          In Progress
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
        Not Started
      </span>
    )
  }

  const mediumBadge = (m: string) =>
    m === 'telugu' ? (
      <span className="inline-flex items-center gap-1 rounded-md border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
        <Languages className="h-3 w-3 text-teal-600 dark:text-teal-400" />
        తెలుగు మాధ్యమం
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
        <Globe className="h-3 w-3 text-sky-600 dark:text-sky-400" />
        English Medium
      </span>
    )

  const moduleLabel = (test: MockTestListItem) =>
    test.module_number != null
      ? `Module ${String(test.module_number).padStart(2, '0')}`
      : 'Special Paper'

  // Page range chips: 1–20, 21–40, … derived from the server's total.
  const pageRanges = Array.from({ length: totalPages }, (_, i) => {
    const start = i * MODULES_PER_PAGE + 1
    const end = Math.min((i + 1) * MODULES_PER_PAGE, totalModules)
    return { page: i + 1, label: totalModules > 0 ? `${start}–${end}` : `${i + 1}` }
  })

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-purple-500" />
            <h1 className="text-xl font-black text-foreground sm:text-2xl">SGT Mock Tests</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Predefined full-length exam modules · 160 Questions · 80 Marks · 150 Minutes
          </p>
        </div>

        {!isPremium && (
          <button
            onClick={() => openModal('mock_tests_top')}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-105"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>Unlock All Modules (₹599)</span>
          </button>
        )}
      </div>

      {/* ── Medium Tabs ── */}
      <div className="mb-6 rounded-3xl border border-border/80 bg-card/60 p-2 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/40 p-1">
            <button
              onClick={() => switchMedium('telugu')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                medium === 'telugu'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-muted-foreground hover:bg-muted hover:text-teal-600 dark:hover:text-teal-400'
              }`}
            >
              <Languages className="h-4 w-4" />
              <span>తెలుగు మాధ్యమం (Telugu Medium)</span>
              <span
                className={`ml-1 rounded-full px-1.5 text-[10px] ${
                  medium === 'telugu' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                {mediumCounts.telugu}
              </span>
            </button>

            <button
              onClick={() => switchMedium('english')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                medium === 'english'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-muted-foreground hover:bg-muted hover:text-sky-600 dark:hover:text-sky-400'
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>English Medium</span>
              <span
                className={`ml-1 rounded-full px-1.5 text-[10px] ${
                  medium === 'english' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                {mediumCounts.english}
              </span>
            </button>
          </div>

          <div className="px-3 text-xs text-muted-foreground">
            {medium === 'telugu' ? (
              <span className="font-semibold text-teal-600 dark:text-teal-400">
                ✨ 100% తెలుగు మాధ్యమం పేపర్లు (గణితం, సైన్స్, సోషల్, జీకే తెలుగులో)
              </span>
            ) : (
              <span className="font-semibold text-sky-600 dark:text-sky-400">
                ✨ 100% English Medium Papers (Math, Science, Social, GK in English)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Category Filters & Search ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
            All Modules ({totalModules})
          </span>
        </div>

        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search module name…"
            className="h-9 w-full rounded-xl border border-border/80 bg-card pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* ── Module page ranges (MODULE pagination) ── */}
      {totalPages > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Modules
          </span>
          {pageRanges.map((r) => (
            <button
              key={r.page}
              onClick={() => setPage(r.page)}
              className={`rounded-lg border px-3 py-1 text-xs font-bold transition ${
                page === r.page
                  ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <p className="text-sm text-muted-foreground">Loading modules…</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => void loadModules()}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && tests.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <FileCheck2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {debouncedSearch
              ? 'No modules match your search.'
              : 'No published modules for this medium yet.'}
          </p>
          {debouncedSearch && (
            <button
              onClick={() => {
                setSearch('')
                setPage(1)
              }}
              className="text-xs text-purple-500 hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* ── Module Cards ── */}
      {!loading && !error && tests.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => {
            const isLocked = !test.is_free && !isPremium
            const status = test.progress_status
            const isCompleted = status === 'completed'
            const isInProgress = status === 'in_progress'

            return (
              <div
                key={test.id}
                className={`group relative flex flex-col justify-between rounded-3xl border p-5 transition-all duration-200 ${
                  isLocked
                    ? 'border-border/70 bg-card/60 hover:border-amber-500/40'
                    : isCompleted
                      ? 'border-emerald-500/40 bg-card shadow-sm hover:shadow-md'
                      : 'border-border/80 bg-card shadow-sm hover:-translate-y-0.5 hover:border-purple-500/50 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-black text-purple-600 dark:text-purple-400">
                        {moduleLabel(test)}
                      </span>
                      {mediumBadge(test.medium)}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {test.is_free ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Free
                        </span>
                      ) : isPremium ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500">
                          <Crown className="h-3 w-3 fill-amber-500" /> Pro
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500">
                          <Lock className="h-3 w-3" /> Pro
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="mt-3.5 text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-purple-600 dark:group-hover:text-purple-400 sm:text-base">
                    {test.title}
                  </h3>

                  <div className="mt-2">{statusBadge(status, test)}</div>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-border/60 bg-muted/30 p-2.5 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground">Questions</span>
                      <p className="font-bold text-foreground">{test.total_questions}</p>
                    </div>
                    <div className="border-x border-border/60">
                      <span className="text-[10px] text-muted-foreground">Marks</span>
                      <p className="font-bold text-foreground">{test.total_marks} M</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Duration</span>
                      <p className="font-bold text-foreground">{test.duration_minutes} Min</p>
                    </div>
                  </div>

                  {isCompleted && test.user_attempt && (
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                        Best Score
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {test.user_attempt.score} / {test.total_marks}
                        {test.user_attempt.percentage != null &&
                          ` (${test.user_attempt.percentage.toFixed(1)}%)`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-border/60 pt-3.5">
                  <button
                    id={`mock-test-btn-${test.id}`}
                    onClick={() => void handleStartTest(test)}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition-all ${
                      isLocked
                        ? 'border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 hover:border-amber-500 dark:text-amber-400'
                        : isCompleted
                          ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                          : isInProgress
                            ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                            : 'bg-purple-600 text-white shadow-sm hover:bg-purple-700 hover:shadow-md active:scale-[0.99]'
                    }`}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Unlock with Pro</span>
                      </>
                    ) : isCompleted ? (
                      <>
                        <Award className="h-3.5 w-3.5" />
                        <span>View Result & Analysis</span>
                      </>
                    ) : isInProgress ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Continue</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Start</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Prev / Next module page ── */}
      {!loading && !error && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-xs font-semibold text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </main>
  )
}
