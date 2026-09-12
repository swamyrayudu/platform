'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileCheck2,
  Lock,
  Play,
  Clock,
  Award,
  Users,
  Crown,
  Search,
  CheckCircle2,
  Layers,
  RotateCcw,
  TrendingUp,
  Trophy,
  Loader2,
  RefreshCw,
  Languages,
  Globe,
} from 'lucide-react'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'
import { toast } from 'sonner'
import type { MockTestListItem, MockTestMedium } from '@/types/mock-tests'

type FilterCategory = 'All' | 'Full Grand Mock' | 'Subject Mock' | 'Previous Year Paper'
type MediumFilter = 'telugu' | 'english'

export default function MockTestsPage() {
  const router = useRouter()
  const { isPremium, openModal } = usePremium()
  const [selectedMedium, setSelectedMedium] = useState<MediumFilter>('telugu')
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('All')
  const [search, setSearch] = useState('')
  const [tests, setTests] = useState<MockTestListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTests = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dsc-sgt/mock-tests')
      const data = await res.json()
      if (data.success) {
        setTests(data.tests)
      } else {
        setError(data.error || 'Failed to load tests')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTests()
  }, [])

  const categoryMap: Record<string, FilterCategory> = {
    grand_mock: 'Full Grand Mock',
    previous_paper: 'Previous Year Paper',
    subject_mock: 'Subject Mock',
    practice_mock: 'Subject Mock',
  }

  const teluguCount = tests.filter((t) => t.medium === 'telugu').length
  const englishCount = tests.filter((t) => t.medium === 'english').length

  const filteredTests = tests.filter((t) => {
    const matchesMedium = t.medium === selectedMedium
    const displayCat = categoryMap[t.category] || 'Full Grand Mock'
    const matchesFilter = selectedFilter === 'All' || displayCat === selectedFilter
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase())
    return matchesMedium && matchesFilter && matchesSearch
  })

  const testsInCurrentMedium = tests.filter((t) => t.medium === selectedMedium)

  const handleStartTest = async (test: MockTestListItem) => {
    if (!test.is_free && !isPremium) {
      openModal(`mock_test_${test.id}`)
      return
    }

    // If already submitted — go to result
    if (test.user_attempt?.status === 'submitted') {
      router.push(`/dsc-sgt/mock-result?attemptId=${test.user_attempt.attempt_id}`)
      return
    }

    toast.loading(`Loading ${test.title}...`, { id: 'mock-start' })
    try {
      const res = await fetch(`/api/dsc-sgt/mock-tests/${test.id}/start`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.error === 'PREMIUM_REQUIRED') {
          toast.dismiss('mock-start')
          openModal(`mock_test_${test.id}`)
          return
        }
        toast.error(data.error || 'Failed to start test', { id: 'mock-start' })
        return
      }

      toast.success('Launching exam environment…', { id: 'mock-start' })
      router.push(`/dsc-sgt/mock-exam?testId=${test.id}&attemptId=${data.attempt_id}`)
    } catch {
      toast.error('Network error — please try again', { id: 'mock-start' })
    }
  }

  const getAttemptBadge = (test: MockTestListItem) => {
    if (!test.user_attempt) return null
    if (test.user_attempt.status === 'submitted') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Score: {test.user_attempt.percentage?.toFixed(1)}%
        </span>
      )
    }
    if (test.user_attempt.status === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
          <RotateCcw className="h-3 w-3" />
          In Progress
        </span>
      )
    }
    return null
  }

  const getCategoryLabel = (category: string): FilterCategory => {
    return (categoryMap[category] as FilterCategory) || 'Full Grand Mock'
  }

  const getMediumBadge = (medium: MockTestMedium | string) => {
    if (medium === 'telugu') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
          <Languages className="h-3 w-3 text-teal-600 dark:text-teal-400" />
          తెలుగు మాధ్యమం
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
        <Globe className="h-3 w-3 text-sky-600 dark:text-sky-400" />
        English Medium
      </span>
    )
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          <p className="text-sm text-muted-foreground">Loading mock tests…</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={loadTests}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> Try Again
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-purple-500" />
            <h1 className="text-xl font-black text-foreground sm:text-2xl">
              AP DSC / SGT Mock Test Series
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Medium-Wise Grand Mocks, Previous Solved Papers & Sectional Speed Tests (80 Marks · 150 Mins)
          </p>
        </div>

        {!isPremium && (
          <button
            onClick={() => openModal('mock_tests_top')}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-105"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>Unlock All Tests (₹599)</span>
          </button>
        )}
      </div>

      {/* ── 🌟 Medium Selector (Primary Tab) ── */}
      <div className="mb-6 rounded-3xl border border-border/80 bg-card/60 p-2 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-2xl border border-border/50">
            <button
              onClick={() => setSelectedMedium('telugu')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedMedium === 'telugu'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-teal-600 dark:hover:text-teal-400 hover:bg-muted'
              }`}
            >
              <Languages className="h-4 w-4" />
              <span>తెలుగు మాధ్యమం (Telugu Medium)</span>
              <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedMedium === 'telugu' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {teluguCount}
              </span>
            </button>

            <button
              onClick={() => setSelectedMedium('english')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedMedium === 'english'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-muted-foreground hover:text-sky-600 dark:hover:text-sky-400 hover:bg-muted'
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>English Medium</span>
              <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedMedium === 'english' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {englishCount}
              </span>
            </button>
          </div>

          <div className="px-3 text-xs text-muted-foreground">
            {selectedMedium === 'telugu' ? (
              <span className="text-teal-600 dark:text-teal-400 font-semibold">
                ✨ 100% తెలుగు మాధ్యమం పేపర్లు (గణితం, సైన్స్, సోషల్, జీకే తెలుగులో)
              </span>
            ) : (
              <span className="text-sky-600 dark:text-sky-400 font-semibold">
                ✨ 100% English Medium Papers (Math, Science, Social, GK in English)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Category Filters & Search Row ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['All', 'Full Grand Mock', 'Previous Year Paper', 'Subject Mock'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                selectedFilter === filter
                  ? 'border-purple-500 bg-purple-500 text-white shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter === 'All' ? `All Tests (${testsInCurrentMedium.length})` : filter}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test name…"
            className="h-9 w-full rounded-xl border border-border/80 bg-card pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* ── Empty state ── */}
      {filteredTests.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <FileCheck2 className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {search ? 'No tests match your search.' : 'No mock tests found in this category/medium.'}
          </p>
          {(search || selectedFilter !== 'All') && (
            <button
              onClick={() => {
                setSearch('')
                setSelectedFilter('All')
              }}
              className="text-xs text-purple-500 hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {/* ── Test Cards Grid ── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTests.map((test) => {
          const isLocked = !test.is_free && !isPremium
          const isSubmitted = test.user_attempt?.status === 'submitted'
          const isInProgress = test.user_attempt?.status === 'in_progress'
          const categoryLabel = getCategoryLabel(test.category)

          return (
            <div
              key={test.id}
              className={`group relative flex flex-col justify-between rounded-3xl border p-5 transition-all duration-200 ${
                isLocked
                  ? 'border-border/70 bg-card/60 hover:border-amber-500/40'
                  : 'border-border/80 bg-card shadow-sm hover:border-purple-500/50 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              <div>
                {/* Top Badges & Access Status */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {categoryLabel}
                    </span>
                    {getMediumBadge(test.medium)}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {getAttemptBadge(test)}
                    {test.is_free ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Free
                      </span>
                    ) : isPremium ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500">
                        <Crown className="h-3 w-3 fill-amber-500" /> Pro Unlocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500">
                        <Lock className="h-3 w-3" /> Pro
                      </span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="mt-3.5 text-sm sm:text-base font-bold text-foreground leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {test.title}
                </h3>

                {test.description && (
                  <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{test.description}</p>
                )}

                {/* Test Meta Specs */}
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

                {/* Submitted result pill */}
                {isSubmitted && test.user_attempt && (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-emerald-500" />
                      Score
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {test.user_attempt.score} / {test.total_marks} ({test.user_attempt.percentage?.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Start / Resume / View Result CTA */}
              <div className="mt-5 border-t border-border/60 pt-3.5">
                <button
                  id={`mock-test-btn-${test.id}`}
                  onClick={() => handleStartTest(test)}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition-all ${
                    isLocked
                      ? 'border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 hover:border-amber-500'
                      : isSubmitted
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
                  ) : isSubmitted ? (
                    <>
                      <Award className="h-3.5 w-3.5" />
                      <span>View Result & Analysis</span>
                    </>
                  ) : isInProgress ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Resume Exam</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Start Mock Test</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

    </main>
  )
}
