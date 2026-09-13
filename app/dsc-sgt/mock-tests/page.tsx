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

import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  ListChecks,
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

/** Modules fetched per batch as the list scrolls. */
const MODULES_PER_BATCH = 18

interface ListMeta {
  total: number
  totalPages: number
  mediumCounts: Record<ExamMediumKey, number>
  /** Highest module submitted; the next rung of the ladder is this + 1. */
  highestCompleted: number
}

/** "Module 07" — the module a locked one is waiting on. */
const moduleName = (n: number) => `Module ${String(n).padStart(2, '0')}`

export default function MockTestsPage() {
  const router = useRouter()
  const { isPremium, openModal } = usePremium()

  const [medium, setMedium] = useState<ExamMediumKey>('telugu')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Modules accumulate as the reader scrolls rather than being replaced.
  const [tests, setTests] = useState<MockTestListItem[]>([])
  const [meta, setMeta] = useState<ListMeta | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Identifies the active query. A response whose key no longer matches
  // belongs to a medium or search the reader has already moved on from, and
  // appending it would interleave two different lists.
  const queryKey = `${medium}|${debouncedSearch}`
  const activeQuery = useRef(queryKey)

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchBatch = useCallback(
    async (targetPage: number, key: string) => {
      const isFirst = targetPage === 1
      // The first batch is already in its loading state — set either by the
      // initial render or by the reset below. Setting it again here would be a
      // synchronous state write inside the effect that triggers this fetch.
      if (!isFirst) {
        setLoadingMore(true)
        setError(null)
      }

      try {
        const params = new URLSearchParams({
          medium,
          page: String(targetPage),
          pageSize: String(MODULES_PER_BATCH),
        })
        if (debouncedSearch) params.set('search', debouncedSearch)

        const res = await fetch(`/api/dsc-sgt/mock-tests?${params.toString()}`)
        const json = (await res.json()) as MockTestListResponse & { error?: string }

        if (activeQuery.current !== key) return

        if (!json.success) {
          setError(json.error || 'Failed to load modules')
          return
        }

        setTests((prev) => (isFirst ? json.tests : [...prev, ...json.tests]))
        setMeta({
          total: json.total,
          totalPages: json.total_pages,
          mediumCounts: json.medium_counts,
          highestCompleted: json.highest_completed_module ?? 0,
        })
      } catch {
        if (activeQuery.current !== key) return
        setError('Network error — please try again')
      } finally {
        if (activeQuery.current === key) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [medium, debouncedSearch]
  )

  // Medium or search changed: drop what is on screen and start again at page
  // 1. Adjusting during render rather than in an effect means the stale list
  // never paints for a frame on the way out.
  const [lastQuery, setLastQuery] = useState(queryKey)
  if (lastQuery !== queryKey) {
    setLastQuery(queryKey)
    setTests([])
    setPage(1)
    setError(null)
    setLoading(true)
  }

  // Fetching is the side effect, so that part stays in an effect.
  useEffect(() => {
    activeQuery.current = queryKey
    void fetchBatch(1, queryKey)
  }, [queryKey, fetchBatch])

  const totalModules = meta?.total ?? 0
  const mediumCounts = meta?.mediumCounts ?? { english: 0, telugu: 0 }
  const hasMore = meta ? page < meta.totalPages : false

  const loadNextBatch = useCallback(() => {
    if (!hasMore || loading || loadingMore) return
    const next = page + 1
    setPage(next)
    void fetchBatch(next, activeQuery.current)
  }, [hasMore, loading, loadingMore, page, fetchBatch])

  // Infinite scroll: a sentinel below the grid pulls the next batch in early
  // enough (400px) that the reader does not meet a spinner.
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading || loadingMore) return

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadNextBatch()
      },
      { rootMargin: '400px' }
    )
    io.observe(el)
    return () => io.disconnect()
    // tests.length is a dependency on purpose: re-attaching after each batch
    // re-fires the initial callback, so a sentinel that is still on screen
    // (tall viewport, short batch) pulls the next batch instead of stalling
    // until the reader scrolls again.
  }, [hasMore, loading, loadingMore, tests.length, loadNextBatch])

  const switchMedium = (next: ExamMediumKey) => {
    if (next === medium) return
    setMedium(next)
  }

  const handleStartTest = async (test: MockTestListItem) => {
    if (!test.is_free && !isPremium) {
      openModal(`mock_test_${test.id}`)
      return
    }

    // Series gate — modules open one at a time.
    if (test.is_sequence_locked && test.progress_status !== 'completed') {
      toast.info(`${moduleName(nextModule)} is next`, {
        description:
          test.module_number != null
            ? `Submit ${moduleName(test.module_number - 1)} to unlock this module.`
            : 'Work through the series in order to unlock this module.',
        duration: 4000,
      })
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
        if (json.error === 'SEQUENCE_LOCKED') {
          // The list was stale — refresh so the gate shows correctly.
          toast.info('Locked for now', {
            id: 'mock-start',
            description: json.message,
          })
          void fetchBatch(1, activeQuery.current)
          setPage(1)
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
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-primary">
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
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-secondary px-2 py-0.5 text-[10px] font-bold text-primary">
        <Globe className="h-3 w-3 text-primary" />
        English Medium
      </span>
    )

  const moduleLabel = (test: MockTestListItem) =>
    test.module_number != null
      ? `Module ${String(test.module_number).padStart(2, '0')}`
      : 'Special Paper'

  /** The next module in the ladder, and whether anything is still gated. */
  const nextModule = (meta?.highestCompleted ?? 0) + 1
  const anyGated = tests.some((t) => t.is_sequence_locked)

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary" />
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
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-muted hover:text-primary dark:hover:text-primary'
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
              <span className="font-semibold text-primary">
                ✨ 100% English Medium Papers (Math, Science, Social, GK in English)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Category Filters & Search ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-primary/30 bg-secondary px-4 py-1.5 text-xs font-semibold text-primary">
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
            className="h-9 w-full rounded-xl border border-border/80 bg-card pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* ── Series gate notice ── */}
      {!loading && !error && anyGated && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/25 bg-secondary px-4 py-3">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
          <p className="text-xs leading-relaxed text-secondary-foreground">
            <span className="font-semibold">
              Modules unlock one at a time — {moduleName(nextModule)} is next.
            </span>{' '}
            Submit it to open {moduleName(nextModule + 1)}, and so on through the
            series.
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading modules…</p>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => {
              setTests([])
              setPage(1)
              setError(null)
              setLoading(true)
              void fetchBatch(1, activeQuery.current)
            }}
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
              className="text-xs text-primary hover:underline"
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
            const status = test.progress_status
            const isCompleted = status === 'completed'
            const isInProgress = status === 'in_progress'

            // Two independent gates. Pro is checked first so each candidate is
            // shown the one that actually blocks them next: a free reader sees
            // the upgrade path, a subscriber sees the series gate.
            const isLocked = !test.is_free && !isPremium
            const isSeriesLocked = !isLocked && test.is_sequence_locked && !isCompleted

            return (
              <div
                key={test.id}
                className={`group relative flex flex-col justify-between rounded-3xl border p-5 transition-all duration-200 ${
                  isLocked
                    ? 'border-border/70 bg-card/60 hover:border-amber-500/40'
                    : isSeriesLocked
                      ? 'border-border/70 bg-card/60'
                      : isCompleted
                        ? 'border-emerald-500/40 bg-card shadow-sm hover:shadow-md'
                        : 'border-border/80 bg-card shadow-sm hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md border border-primary/30 bg-secondary px-2 py-0.5 text-[10px] font-black text-primary">
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

                  <h3 className="mt-3.5 text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-primary dark:group-hover:text-primary sm:text-base">
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
                        : isSeriesLocked
                          ? 'cursor-not-allowed border border-border bg-muted/50 text-muted-foreground'
                          : isCompleted
                            ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                            : isInProgress
                              ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary'
                              : 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:shadow-md active:scale-[0.99]'
                    }`}
                  >
                    {isLocked ? (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Unlock with Pro</span>
                      </>
                    ) : isSeriesLocked ? (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>
                          {test.module_number != null
                            ? `Finish ${moduleName(test.module_number - 1)} first`
                            : 'Locked'}
                        </span>
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

      {/* ── Infinite scroll sentinel & tail state ── */}
      {!loading && !error && tests.length > 0 && (
        <div ref={sentinelRef} className="mt-8 flex flex-col items-center gap-3 py-4">
          {loadingMore && (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading more modules…
            </span>
          )}

          {/* Explicit control as well as the observer — it covers a reader who
              prefers to click, and a browser that never fires the callback. */}
          {!loadingMore && hasMore && (
            <button
              onClick={loadNextBatch}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Load more modules
            </button>
          )}

          {!hasMore && (
            <span className="text-xs text-muted-foreground">
              Showing all {totalModules} module{totalModules === 1 ? '' : 's'}.
            </span>
          )}
        </div>
      )}
    </main>
  )
}
