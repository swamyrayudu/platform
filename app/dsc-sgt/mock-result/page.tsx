'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Trophy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Award,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  RotateCcw,
  Target,
  ArrowRight,
} from 'lucide-react'
import { COPY_GUARD_CLASS, copyGuardProps } from '@/app/components/dsc-sgt/CopyGuard'
import QuestionFeedbackButton from '@/app/components/dsc-sgt/QuestionFeedbackButton'
import type { MockTestResultSummary, SectionScore, QuestionReviewItem } from '@/types/mock-tests'

function ScoreGauge({ percentage }: { percentage: number }) {
  const clr =
    percentage >= 70 ? 'text-emerald-500' :
    percentage >= 50 ? 'text-amber-500' :
    'text-red-500'
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx="40" cy="40" r="34" fill="none" strokeWidth="6"
          strokeDasharray={`${(percentage / 100) * 213.6} 213.6`}
          strokeLinecap="round"
          className={clr}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-black ${clr}`}>{percentage.toFixed(1)}%</span>
        <span className="text-[10px] text-muted-foreground font-medium">Score</span>
      </div>
    </div>
  )
}

function QuestionReviewCard({
  item,
  mockTestId,
}: {
  item: QuestionReviewItem
  mockTestId: string | null
}) {
  const [open, setOpen] = useState(false)

  const statusIcon = item.is_skipped
    ? <HelpCircle className="h-4 w-4 text-muted-foreground" />
    : item.is_correct
    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    : <XCircle className="h-4 w-4 text-red-500" />

  const borderColor = item.is_skipped
    ? 'border-border'
    : item.is_correct
    ? 'border-emerald-500/30'
    : 'border-red-500/30'

  return (
    <div className={`rounded-2xl border bg-card ${borderColor}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-3.5 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {statusIcon}
          <span className="text-[11px] font-bold text-muted-foreground shrink-0">Q{item.question_number}</span>
          <span className="text-xs text-foreground line-clamp-1 font-medium">{item.question}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!item.is_skipped && (
            <span className={`text-[10px] font-bold ${item.is_correct ? 'text-emerald-500' : 'text-red-500'}`}>
              {item.is_correct ? `+${item.marks}` : '0'}
            </span>
          )}
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 px-4 py-3.5 text-xs space-y-3">
          <p className="font-semibold text-foreground leading-relaxed">{item.question}</p>
          <div className="grid gap-1.5">
            {(['A', 'B', 'C', 'D'] as const).map((key) => {
              const optionText = item[`option_${key.toLowerCase()}` as keyof QuestionReviewItem] as string
              const isUser = item.user_answer === key
              const isCorrect = item.correct_answer === key

              return (
                <div
                  key={key}
                  className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${
                    isCorrect
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : isUser && !isCorrect
                      ? 'bg-red-500/10 border border-red-500/30'
                      : 'border border-transparent'
                  }`}
                >
                  <span className={`mt-0.5 h-5 w-5 shrink-0 flex items-center justify-center rounded-md text-[10px] font-black ${
                    isCorrect ? 'bg-emerald-500 text-white' :
                    isUser && !isCorrect ? 'bg-red-500 text-white' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {key}
                  </span>
                  <span className="text-foreground leading-snug">{optionText}</span>
                  {isCorrect && <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                  {isUser && !isCorrect && <XCircle className="ml-auto h-3.5 w-3.5 shrink-0 text-red-500" />}
                </div>
              )
            })}
          </div>

          {item.explanation && (
            <div className="rounded-xl border border-primary/20 bg-secondary p-3">
              <p className="font-bold text-primary mb-1 text-[10px] uppercase tracking-wide">Explanation</p>
              <p className="text-foreground leading-relaxed">{item.explanation}</p>
            </div>
          )}

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>{item.section_name}</span>
            {item.topic && <><span>·</span><span>{item.topic}</span></>}
            {item.difficulty && <><span>·</span><span>{item.difficulty}</span></>}
            <span>·</span>
            <span>{item.time_taken_seconds}s</span>

            {/* Spotted a problem with this question? */}
            <QuestionFeedbackButton
              className="ml-auto"
              questionUid={item.question_uid}
              source="mock_result"
              mockTestId={mockTestId}
              questionText={item.question}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function MockResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const attemptId = searchParams.get('attemptId')

  const [result, setResult] = useState<MockTestResultSummary | null>(null)
  const [nextModule, setNextModule] = useState<{
    id: string
    slug: string
    title: string
    module_number: number
    progress_status?: string
  } | null>(null)
  const [startingNext, setStartingNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all')
  const [reviewSection, setReviewSection] = useState<string>('all')

  useEffect(() => {
    if (!attemptId) {
      setError('No attempt ID provided.')
      setLoading(false)
      return
    }


    const load = async () => {
      try {
        const res = await fetch(`/api/dsc-sgt/mock-tests/attempts/${attemptId}/result`)
        const data = await res.json()
        if (!res.ok || !data.success) {
          setError(data.error || 'Could not load result.')
          return
        }
        setResult(data.result)

        // Resolve the next module in this series so the completion screen can
        // offer [ Next Module ] directly.
        if (data.result?.mock_test_id) {
          try {
            const nextRes = await fetch(`/api/dsc-sgt/mock-tests/${data.result.mock_test_id}/next`)
            const nextData = await nextRes.json()
            if (nextData.success) setNextModule(nextData.next_module ?? null)
          } catch {
            // Non-fatal: the result still renders without the next-module CTA.
          }
        }
      } catch {
        setError('Network error — please refresh and try again.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [attemptId])

  /**
   * Start the next module in the series.
   *
   * Premium gating is enforced server-side by the start endpoint, so a locked
   * module simply sends the user back to the module list where the upgrade
   * prompt lives.
   */
  const startNextModule = async () => {
    if (!nextModule || startingNext) return
    setStartingNext(true)
    try {
      const res = await fetch(`/api/dsc-sgt/mock-tests/${nextModule.id}/start`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok || !data.success) {
        router.push('/dsc-sgt/mock-tests')
        return
      }

      router.push(`/dsc-sgt/mock-exam?testId=${nextModule.id}&attemptId=${data.attempt_id}`)
    } catch {
      router.push('/dsc-sgt/mock-tests')
    } finally {
      setStartingNext(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading your result…</p>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm font-bold">Result unavailable</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <button onClick={() => router.push('/dsc-sgt/mock-tests')} className="text-xs text-primary hover:underline">
            ← Back to Mock Tests
          </button>
        </div>
      </div>
    )
  }

  const totalSections = result.section_scores || []

  const filteredReview = (result.questions_review || []).filter((q) => {
    const matchSection = reviewSection === 'all' || q.section_id === reviewSection
    const matchFilter =
      reviewFilter === 'all' ? true :
      reviewFilter === 'correct' ? q.is_correct :
      reviewFilter === 'incorrect' ? (!q.is_correct && !q.is_skipped) :
      q.is_skipped
    return matchSection && matchFilter
  })

  const uniqueSections = [...new Set((result.questions_review || []).map((q) => q.section_id))]

  const hrs = Math.floor(result.total_time_seconds / 3600)
  const mins = Math.floor((result.total_time_seconds % 3600) / 60)
  const secs = result.total_time_seconds % 60
  const timeStr = hrs > 0
    ? `${hrs}h ${mins}m ${secs}s`
    : `${mins}m ${secs}s`

  return (
    <main
      className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 ${COPY_GUARD_CLASS}`}
      {...copyGuardProps}
    >

      {/* ── Module completion state ── */}
      <div className="flex items-center justify-center gap-2 rounded-3xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-center">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        <span className="text-sm font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Module Completed
        </span>
      </div>

      {/* ── Result Header ── */}
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm text-center">
        <div className="flex justify-center">
          <ScoreGauge percentage={result.percentage} />
        </div>

        <h1 className="mt-4 text-xl sm:text-2xl font-black text-foreground">
          Exam Result — {result.test_title}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">AP DSC SGT Grand Mock · Server-Scored Result</p>

        {/* Core Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Score</p>
            <p className="text-2xl font-black text-foreground">{result.score}</p>
            <p className="text-[10px] text-muted-foreground">/ {result.total_marks} Marks</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Correct</p>
            <p className="text-2xl font-black text-emerald-500">{result.correct_count}</p>
            <p className="text-[10px] text-muted-foreground">of {result.total_questions}</p>
          </div>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Incorrect</p>
            <p className="text-2xl font-black text-red-500">{result.incorrect_count}</p>
            <p className="text-[10px] text-muted-foreground">Attempted wrong</p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">Unattempted</p>
            <p className="text-2xl font-black text-amber-500">{result.unanswered_count}</p>
            <p className="text-[10px] text-muted-foreground">Skipped</p>
          </div>
        </div>

        {/* Rank & Time */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Time: {timeStr}
          </span>
          <span className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> Avg/Q: {result.avg_time_per_question_seconds}s
          </span>
          {result.rank && (
            <span className="flex items-center gap-1.5 font-bold text-amber-500">
              <Trophy className="h-3.5 w-3.5" /> Rank #{result.rank}
              {result.percentile && <span className="text-muted-foreground font-normal">({result.percentile}%ile)</span>}
            </span>
          )}
        </div>

        {/* CTA buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {nextModule ? (
            <button
              onClick={() => void startNextModule()}
              disabled={startingNext}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary disabled:opacity-60"
            >
              {startingNext ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Next Module — Module {String(nextModule.module_number).padStart(2, '0')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          ) : null}
          <button
            onClick={() => router.push('/dsc-sgt/mock-tests')}
            className="inline-flex items-center gap-2 rounded-2xl border border-border px-5 py-2.5 text-xs font-bold text-foreground hover:bg-accent"
          >
            <RotateCcw className="h-3.5 w-3.5" /> All Modules
          </button>
          <button
            onClick={() => router.push(`/dsc-sgt/mock-tests/${result.mock_test_id}/leaderboard`)}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:border-amber-500"
          >
            <Award className="h-3.5 w-3.5" /> View Leaderboard
          </button>
        </div>
      </div>

      {/* ── Section-wise Analysis ── */}
      {totalSections.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-black text-foreground">Section-wise Performance</h2>
          </div>
          <div className="space-y-3">
            {totalSections.map((s: SectionScore) => {
              const sectionPct = s.total_marks > 0 ? (s.score / s.total_marks) * 100 : 0
              return (
                <div key={s.section_id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-foreground">{s.section_name}</span>
                    <span className="font-bold text-muted-foreground">
                      {s.score} / {s.total_marks} ({sectionPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        sectionPct >= 70 ? 'bg-emerald-500' :
                        sectionPct >= 50 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${sectionPct}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span className="text-emerald-500">✓ {s.correct}</span>
                    <span className="text-red-500">✗ {s.incorrect}</span>
                    <span>{s.total - s.correct - s.incorrect} skipped</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Question Review ── */}
      {result.questions_review && result.questions_review.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-black text-foreground">Detailed Question Review</h2>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {([
                { value: 'all', label: `All (${result.questions_review.length})` },
                { value: 'correct', label: `Correct (${result.correct_count})` },
                { value: 'incorrect', label: `Wrong (${result.incorrect_count})` },
                { value: 'skipped', label: `Skipped (${result.unanswered_count})` },
              ] as const).map((f) => (
                <button
                  key={f.value}
                  onClick={() => setReviewFilter(f.value)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold transition ${
                    reviewFilter === f.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <select
              value={reviewSection}
              onChange={(e) => setReviewSection(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">All Sections</option>
              {uniqueSections.map((sid) => {
                const first = result.questions_review.find((q) => q.section_id === sid)
                return (
                  <option key={sid} value={sid}>{first?.section_name || sid}</option>
                )
              })}
            </select>
          </div>

          {/* Question list */}
          <div className="space-y-2">
            {filteredReview.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No questions match this filter.</p>
            ) : (
              filteredReview.map((item) => (
                <QuestionReviewCard
                  key={item.question_uid}
                  item={item}
                  mockTestId={result.mock_test_id ?? null}
                />
              ))
            )}
          </div>
        </div>
      )}

    </main>
  )
}

export default function MockResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <MockResultContent />
    </Suspense>
  )
}
