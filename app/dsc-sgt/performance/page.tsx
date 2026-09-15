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

/** Accuracy as a ring rather than a bar.
 *
 * A row of horizontal bars all start at the same left edge, so telling 33%
 * from 45% means reading the numbers anyway. Rings of different fill are
 * distinguishable at a glance and survive being two-across on a phone, which
 * is where this page is actually read. */
function SubjectRing({
  subject,
  accuracy,
  correct,
  attempted,
  status,
}: {
  subject: string
  accuracy: number
  correct: number
  attempted: number
  status: string
}) {
  const RADIUS = 30
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const filled = Math.max(0, Math.min(100, accuracy))
  const stroke =
    status === 'Strong'
      ? 'stroke-emerald-500'
      : status === 'Weak Area'
        ? 'stroke-red-500'
        : 'stroke-amber-500'
  const text =
    status === 'Strong'
      ? 'text-emerald-600 dark:text-emerald-400'
      : status === 'Weak Area'
        ? 'text-red-600 dark:text-red-400'
        : 'text-amber-600 dark:text-amber-400'

  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-3 text-center">
      <div className="relative h-[76px] w-[76px]">
        <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" aria-hidden>
          <circle
            cx="38" cy="38" r={RADIUS}
            className="fill-none stroke-muted"
            strokeWidth="7"
          />
          <circle
            cx="38" cy="38" r={RADIUS}
            className={`fill-none ${stroke} transition-[stroke-dashoffset] duration-700`}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - filled / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className={`text-base font-bold ${text}`}>{Math.round(accuracy)}%</span>
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-snug text-foreground">
        {subject}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {correct}/{attempted} correct
      </p>
    </div>
  )
}


/** One colour scale for accuracy across the whole page: the rings, the plan
 * and the mock attempt list all read the same way. Below 45% is work to do,
 * 65% and up is holding. */
function accuracyTone(pct: number): string {
  if (pct >= 65) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 45) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
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
            Your accuracy by subject, what to work on next, and how your mock papers went
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
            {/* Was "Est. State Rank" showing "Top 0.0%". The rank is real —
                it is a position among the people who sat that same paper —
                but calling it a state rank implies a field of lakhs, and a
                percentile computed over a handful of attempts renders as
                "Top 0.0%", which reads as a boast and is not one. The honest
                version is the position itself and what it is out of. */}
            <span className="text-xs text-muted-foreground font-medium">Best rank</span>
            <Crown className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-amber-500">
            {data.best_rank !== null ? `#${data.best_rank}` : '—'}
          </p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
            {data.best_rank !== null
              ? 'Among everyone who sat that paper'
              : 'Appears after your first mock'}
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

      {/* ── Your plan ──
          The old block was an amber "Weak Area Alert" that named the weak
          subjects and linked to one of them. Naming a problem is not a plan:
          it left the candidate to work out what to do, in what order. This
          lists the subjects worst-first, in the order worth working through,
          each one a link straight into practice for it. */}
      {topWeak.length > 0 && (
        <section className="mb-8 rounded-3xl border border-border bg-card p-5 sm:p-6">
          <h3 className="text-base font-bold text-foreground">What to work on next</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            These are below your overall {data.overall_accuracy_pct}%. Worst first — that is
            where marks come back quickest.
          </p>

          <ol className="mt-4 space-y-2.5">
            {topWeak.map((w, i) => (
              <li key={w.subject}>
                <Link
                  href={`/dsc-sgt/practice?subject=${encodeURIComponent(w.subject)}`}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-background p-3 transition hover:border-primary/50 hover:bg-accent/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold leading-snug text-foreground">
                      {w.subject}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {w.accuracy_pct}% accurate · {w.correct} of {w.attempted} correct
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Practise a subject, then sit the next mock to see whether the ring moved.
          </p>
        </section>
      )}


      {/* ── 2 Column Grid: Subject Breakdown & Recent Test History ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Left: Subject Breakdown */}
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-foreground">Where you stand</h3>
            <span className="text-[11px] text-muted-foreground">
              {data.subject_breakdown.length} subject
              {data.subject_breakdown.length === 1 ? '' : 's'}
            </span>
          </div>

          {data.subject_breakdown.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Answer some practice questions or sit a mock test and your subjects appear here.
            </p>
          ) : (
            <>
              {/* Two across on a phone, three once there is room. */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {data.subject_breakdown.map((item) => (
                  <SubjectRing
                    key={item.subject}
                    subject={item.subject}
                    accuracy={item.accuracy_pct}
                    correct={item.correct}
                    attempted={item.attempted}
                    status={item.status}
                  />
                ))}
              </div>

              {/* What the colours mean, said once, instead of a badge on every
                  card repeating it. */}
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Strong
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Getting there
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> Needs work
                </span>
              </div>
            </>
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
                    <div className="min-w-0">
                      <h4 className="text-[13px] font-bold text-foreground sm:text-sm">
                        {test.title}
                        {test.module_number !== null && (
                          <span className="font-semibold text-muted-foreground">
                            {' '}
                            · Module {test.module_number}
                          </span>
                        )}
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {formatWhen(test.submitted_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="text-right">
                        <p className="whitespace-nowrap font-extrabold text-foreground">
                          {test.score} / {test.total_marks}
                        </p>
                        {/* The accuracy used to be printed in green whatever it
                            was, so 16% read as a pass. Same three bands as the
                            rings above, so one colour means one thing here. */}
                        <p
                          className={`whitespace-nowrap text-[11px] font-bold ${accuracyTone(test.accuracy_pct)}`}
                        >
                          {test.accuracy_pct}% correct
                        </p>
                      </div>
                      {test.rank !== null && (
                        <div className="rounded-xl border border-border bg-card px-2.5 py-1 text-center text-[11px]">
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
