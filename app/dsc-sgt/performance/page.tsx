'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Award,
  AlertTriangle,
  CheckCircle2,
  Target,
  Crown,
  ArrowRight,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'

interface SubjectProficiency {
  subject: string
  accuracy_pct: number
  attempted: number
  correct: number
  status: string
}

interface RecentAttempt {
  attempt_id: string
  mock_test_id: string
  title: string
  module_number: number | null
  submitted_at: string | null
  score: number
  total_marks: number
  accuracy_pct: number
  correct_count: number
  total_questions: number
  rank: number | null
  percentile: number | null
}

interface PerformanceData {
  has_data: boolean
  overall_accuracy_pct: number
  accuracy_delta_pct: number | null
  mocks_completed: number
  avg_mock_score: number
  mock_total_marks: number
  best_rank: number | null
  best_percentile: number | null
  questions_attempted: number
  subjects_covered: number
  subject_breakdown: SubjectProficiency[]
  recent_attempts: RecentAttempt[]
  weak_areas: SubjectProficiency[]
}

/** Colour/badge styling derived from the status the server computed. */
const STATUS_STYLE: Record<string, { bar: string; badge: string }> = {
  Strong: {
    bar: 'bg-emerald-500',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  Good: { bar: 'bg-primary', badge: 'border-primary/30 bg-primary/10 text-primary' },
  Moderate: {
    bar: 'bg-primary',
    badge: 'border-primary/30 bg-secondary text-primary',
  },
  'Needs Practice': {
    bar: 'bg-amber-500',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  'Weak Area': {
    bar: 'bg-red-500',
    badge: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  },
  'Not Started': {
    bar: 'bg-muted-foreground/40',
    badge: 'border-border bg-muted/60 text-muted-foreground',
  },
}

function styleFor(status: string) {
  return STATUS_STYLE[status] ?? STATUS_STYLE['Not Started']
}

/** "Yesterday, 4:30 PM" style relative date. */
function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days <= 0) return `Today, ${time}`
  if (days === 1) return `Yesterday, ${time}`
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PerformancePage() {
  const { isPremium, openModal } = usePremium()
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/dsc-sgt/performance')
        const json = await res.json()
        if (cancelled) return
        if (json.success) setData(json)
        else setError(json.error || 'Could not load your performance data')
      } catch {
        if (!cancelled) setError('Network error — please try again')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground">Analysing your performance…</p>
        </div>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-destructive">{error ?? 'No data available'}</p>
        </div>
      </main>
    )
  }

  const topWeak = data.weak_areas

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-emerald-500" />
            <h1 className="text-xl font-black text-foreground sm:text-2xl">
              DSC / SGT Performance Analytics
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            In-depth analysis of accuracy, subject strengths, time spent, and state-level rank ranking
          </p>
        </div>

        {!isPremium && (
          <button
            onClick={() => openModal('performance_top')}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-105"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>Unlock AI Diagnostic Reports</span>
          </button>
        )}
      </div>

      {/* ── Top Metric Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Overall Accuracy</span>
            <Target className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground">
            {data.overall_accuracy_pct}%
          </p>
          {data.accuracy_delta_pct === null ? (
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              Not enough history yet
            </p>
          ) : (
            <p
              className={`mt-1 text-[11px] font-semibold ${
                data.accuracy_delta_pct >= 0 ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {data.accuracy_delta_pct >= 0 ? '↑ +' : '↓ '}
              {Math.abs(data.accuracy_delta_pct)}% vs earlier attempts
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Avg. Mock Score</span>
            <Award className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground">
            {data.mocks_completed > 0 ? data.avg_mock_score : '—'}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              / {data.mock_total_marks} M
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            {data.mocks_completed > 0
              ? `Across ${data.mocks_completed} completed mock${data.mocks_completed === 1 ? '' : 's'}`
              : 'Complete a mock to see your average'}
          </p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Est. State Rank</span>
            <Crown className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-amber-500">
            {data.best_percentile !== null ? `Top ${(100 - data.best_percentile).toFixed(1)}%` : '—'}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-foreground">
            {data.best_rank !== null
              ? `Best rank #${data.best_rank}`
              : 'Rank appears after your first mock'}
          </p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Questions Attempted</span>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground">
            {data.questions_attempted.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">
            Across {data.subjects_covered} subject{data.subjects_covered === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* ── Weak Area Alert (only when the data shows one) ── */}
      {topWeak.length > 0 && (
      <div className="mb-8 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-orange-500/10 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Weak Area Alert: {topWeak.map((w) => w.subject).join(' & ')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Your accuracy in{' '}
                {topWeak.map((w, i) => (
                  <span key={w.subject}>
                    {i > 0 && ' and '}
                    <em>
                      {w.subject} ({w.accuracy_pct}%)
                    </em>
                  </span>
                ))}{' '}
                is below your overall {data.overall_accuracy_pct}%. Targeted practice on{' '}
                {topWeak[0].subject} is the fastest way to raise your expected score.
              </p>
            </div>
          </div>

          <Link
            href={`/dsc-sgt/practice?subject=${encodeURIComponent(topWeak[0].subject)}`}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
          >
            <span>Practice {topWeak[0].subject}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      )}

      {/* ── 2 Column Grid: Subject Breakdown & Recent Test History ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Left: Subject Breakdown */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-foreground">Subject Proficiency Breakdown</h3>
            <span className="text-xs text-muted-foreground">
              {data.subject_breakdown.length} Section
              {data.subject_breakdown.length === 1 ? '' : 's'}
            </span>
          </div>

          {data.subject_breakdown.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Answer some practice questions or complete a mock test to see your subject
              breakdown.
            </p>
          ) : (
            <div className="space-y-4">
              {data.subject_breakdown.map((item) => {
                const style = styleFor(item.status)
                return (
                  <div key={item.subject} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-foreground">{item.subject}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md border px-1.5 py-0.2 text-[10px] font-bold ${style.badge}`}
                        >
                          {item.status}
                        </span>
                        <span className="font-bold text-foreground">{item.accuracy_pct}%</span>
                      </div>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                        style={{ width: `${Math.min(100, item.accuracy_pct)}%` }}
                      />
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      {item.correct}/{item.attempted} correct
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Mock Test Attempt History */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-foreground">Recent Mock Test Attempts</h3>
              <Link href="/dsc-sgt/mock-tests" className="text-xs font-semibold text-primary hover:underline">
                All Tests →
              </Link>
            </div>

            {data.recent_attempts.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No completed mock tests yet. Finish a module to see your score and rank here.
              </p>
            ) : (
              <div className="space-y-3.5">
                {data.recent_attempts.map((test) => (
                  <Link
                    key={test.attempt_id}
                    href={`/dsc-sgt/mock-result?attemptId=${test.attempt_id}`}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 transition hover:bg-muted/40 sm:flex-row sm:items-center"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-foreground sm:text-sm">{test.title}</h4>
                      <span className="text-[11px] text-muted-foreground">
                        {formatWhen(test.submitted_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="text-right">
                        <p className="font-extrabold text-foreground">
                          {test.score} / {test.total_marks}
                        </p>
                        <p className="text-[10px] font-bold text-emerald-500">
                          {test.accuracy_pct}% Acc.
                        </p>
                      </div>
                      {test.rank !== null && (
                        <div className="rounded-xl border border-border bg-card px-2.5 py-1 text-center text-[10px]">
                          <span className="text-muted-foreground">Rank</span>
                          <p className="font-bold text-primary">#{test.rank}</p>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <Link
              href="/dsc-sgt/mock-exam"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
            >
              <span>Take a new Full Mock Exam to improve your Rank</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

      </div>

    </main>
  )
}
