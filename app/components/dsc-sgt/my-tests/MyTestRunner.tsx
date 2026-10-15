'use client'

// ============================================================
// app/components/dsc-sgt/my-tests/MyTestRunner.tsx
// ============================================================
// Start screen → timed test → results with a full answer review.
// The user wrote this answer key, so the whole test is loaded once and
// graded in the browser; the server grades it again when it is saved.
// The exam view reuses the practice exam components.
// ============================================================

import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Clock, ListChecks, Loader2, Play, RotateCcw, XCircle } from 'lucide-react'
import { useHideBottomNav } from '@/app/components/dsc-sgt/DscBottomNav'
import { QuestionCard, OptionList, QuestionMatrixNavigator, ExamBottomNav, SubmitModal } from '@/app/components/dsc-sgt/practice/exam'
import { gradeAttempt, type AnswerLetter, type MyTestQuestion } from '@/lib/my-tests/format'
import type { PracticeQuestion, UserAnswerRecord } from '@/types/practice'

interface LoadedTest {
  id: string
  title: string
  medium: 'english' | 'telugu'
  subject: string
  question_count: number
  duration_minutes: number
  questions: MyTestQuestion[]
}

interface Attempt {
  id: string
  answers: string
  correct_count: number
  total_questions: number
  time_spent_seconds: number
  submitted_at: string
}

interface Finished {
  answers: string
  seconds: number
  correct: number
  saved: 'saving' | 'saved' | 'failed'
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

const dateOf = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export default function MyTestRunner({ testId }: { testId: string }) {
  const [test, setTest] = useState<LoadedTest | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'intro' | 'exam' | 'results'>('intro')
  const [finished, setFinished] = useState<Finished | null>(null)
  const [round, setRound] = useState(0)

  useHideBottomNav(phase === 'exam')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/dsc-sgt/my-tests/${testId}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || 'Could not load this test.')
        if (!cancelled) {
          setTest(json.test)
          setAttempts(json.attempts)
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load this test.'))
    return () => {
      cancelled = true
    }
  }, [testId])

  const save = async (answers: string, seconds: number) => {
    setFinished((f) => (f ? { ...f, saved: 'saving' } : f))
    try {
      const res = await fetch(`/api/dsc-sgt/my-tests/${testId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, time_spent_seconds: seconds }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not save your result.')
      setAttempts((prev) => [json.attempt, ...prev])
      setFinished((f) => (f ? { ...f, correct: json.attempt.correct_count, saved: 'saved' } : f))
    } catch (err) {
      setFinished((f) => (f ? { ...f, saved: 'failed' } : f))
      toast.error(err instanceof Error ? err.message : 'Could not save your result.')
    }
  }

  const submit = (answers: string, seconds: number) => {
    if (!test) return
    setFinished({ answers, seconds, correct: gradeAttempt(answers, test.questions), saved: 'saving' })
    setPhase('results')
    void save(answers, seconds)
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-sm">
        <p className="text-destructive">{error}</p>
        <Link href="/dsc-sgt/my-tests" className="mt-3 inline-block font-semibold text-primary hover:underline">Back to My Tests</Link>
      </div>
    )
  }
  if (!test) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading test…</p>
  }

  if (phase === 'exam') {
    return <ExamView key={round} test={test} onSubmit={submit} onExit={() => setPhase('intro')} />
  }

  if (phase === 'results' && finished) {
    return (
      <ResultsView
        test={test}
        finished={finished}
        onRetrySave={() => save(finished.answers, finished.seconds)}
        onRetake={() => { setRound((r) => r + 1); setPhase('exam') }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <Link href="/dsc-sgt/my-tests" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> My Tests
      </Link>
      <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs">
        <h1 className="text-xl font-black text-foreground">{test.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {test.subject} · {test.medium === 'telugu' ? 'Telugu medium' : 'English medium'}
        </p>
        <p className="mt-3 flex items-center gap-4 text-sm text-foreground">
          <span className="inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" />{test.questions.length} questions</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" />{test.duration_minutes} minutes</span>
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          The test submits itself when the time is up. You can move between questions and mark them for review.
        </p>
        <button
          type="button"
          onClick={() => { setRound((r) => r + 1); setPhase('exam') }}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
        >
          <Play className="h-4 w-4" /> Start test
        </button>
      </section>

      {attempts.length > 0 && (
        <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs">
          <h2 className="text-sm font-bold text-foreground">Your attempts</h2>
          <ul className="mt-3 divide-y divide-border/60 text-sm">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">{dateOf(a.submitted_at)}</span>
                <span className="font-semibold text-foreground">
                  {a.correct_count} / {a.total_questions}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{formatClock(a.time_spent_seconds)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function ExamView({ test, onSubmit, onExit }: {
  test: LoadedTest
  onSubmit: (answers: string, seconds: number) => void
  onExit: () => void
}) {
  const total = test.questions.length
  const limitSeconds = test.duration_minutes * 60
  const [answers, setAnswers] = useState<(AnswerLetter | null)[]>(() => Array(total).fill(null))
  const [current, setCurrent] = useState(0)
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [remaining, setRemaining] = useState(limitSeconds)
  const [showSubmit, setShowSubmit] = useState(false)
  const [showNavigator, setShowNavigator] = useState(false)
  const startedAt = useRef(0)
  const done = useRef(false)

  // The question shape the practice exam components render. The answer key is left out.
  const questions: PracticeQuestion[] = useMemo(() => test.questions.map((q, i) => ({
    id: `q${i + 1}`,
    question_id: `q${i + 1}`,
    medium: test.medium,
    subject: test.subject,
    class_level: '',
    chapter: null,
    topic: q.topic || test.subject,
    subtopic: null,
    difficulty: q.difficulty || 'Medium',
    question_type: 'MCQ',
    question: q.question,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    language: test.medium,
  })), [test])

  const finish = () => {
    if (done.current) return
    done.current = true
    const seconds = Math.min(limitSeconds, Math.round((Date.now() - startedAt.current) / 1000))
    onSubmit(answers.map((a) => a ?? '-').join(''), seconds)
  }
  // Called from the timer, but sees the latest answers.
  const onTimeUp = useEffectEvent(finish)

  useEffect(() => {
    startedAt.current = Date.now()
    const timer = setInterval(() => {
      const left = limitSeconds - Math.floor((Date.now() - startedAt.current) / 1000)
      setRemaining(left)
      if (left <= 0) {
        clearInterval(timer)
        onTimeUp()
      }
    }, 1000)
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => {
      clearInterval(timer)
      window.removeEventListener('beforeunload', warn)
    }
  }, [limitSeconds])

  const choose = (letter: AnswerLetter) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[current] = next[current] === letter ? null : letter
      return next
    })
  }

  const q = questions[current]
  const userAnswers: Record<string, UserAnswerRecord> = Object.fromEntries(
    answers.flatMap((a, i) => (a ? [[`q${i + 1}`, { question_id: `q${i + 1}`, selected_answer: a }]] : []))
  )
  const answered = answers.filter(Boolean).length
  const next = () => (current < total - 1 ? setCurrent((i) => i + 1) : setShowSubmit(true))

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24 sm:pb-8">
      <div className="flex items-center justify-between gap-2 rounded-3xl border border-border/80 bg-card p-3.5 shadow-xs sm:p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => { if (window.confirm('Leave this test? Your answers will not be saved.')) onExit() }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-accent cursor-pointer"
            aria-label="Leave test"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xs font-semibold text-foreground sm:text-sm">{test.title}</h1>
            <p className="text-[11px] text-muted-foreground">Q {current + 1} of {total} · {answered} answered</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold ${
              remaining <= 60 ? 'border-destructive/50 text-destructive' : 'border-border bg-muted/40 text-foreground'
            }`}
            aria-label="Time left"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>{formatClock(remaining)}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSubmit(true)}
            className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            Finish
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:p-7 lg:col-span-3">
          <div>
            <QuestionCard
              currentQ={q}
              currentIndex={current}
              isMarked={marked.has(q.id)}
              onToggleMarkForReview={() => setMarked((prev) => {
                const s = new Set(prev)
                if (s.has(q.id)) s.delete(q.id)
                else s.add(q.id)
                return s
              })}
            />
            <OptionList currentQ={q} currentAnswer={answers[current]} isInstant={false} currentFeedback={null} onSelectOption={choose} />
          </div>
          <div className="mt-6 hidden items-center justify-between border-t border-border/60 pt-5 sm:flex">
            <button
              type="button"
              onClick={() => setCurrent((i) => Math.max(0, i - 1))}
              disabled={current === 0}
              className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-accent disabled:opacity-30 cursor-pointer"
            >
              Previous
            </button>
            <button type="button" onClick={next} className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer">
              {current === total - 1 ? 'Finish test' : 'Next'}
            </button>
          </div>
        </div>
        <QuestionMatrixNavigator questions={questions} currentIndex={current} userAnswers={userAnswers} markedIds={marked} onSelectIndex={setCurrent} />
      </div>

      <ExamBottomNav
        currentIndex={current}
        totalQuestions={total}
        onPrev={() => setCurrent((i) => Math.max(0, i - 1))}
        onNext={next}
        onOpenMobileNavigator={() => setShowNavigator(true)}
      />
      {showNavigator && (
        <QuestionMatrixNavigator
          questions={questions}
          currentIndex={current}
          userAnswers={userAnswers}
          markedIds={marked}
          isMobileModal
          onSelectIndex={setCurrent}
          onCloseMobileModal={() => setShowNavigator(false)}
        />
      )}
      <SubmitModal
        show={showSubmit}
        title="Submit this test?"
        answeredCount={answered}
        totalQuestions={total}
        isSubmitting={false}
        onClose={() => setShowSubmit(false)}
        onConfirm={() => { setShowSubmit(false); finish() }}
      />
    </div>
  )
}

function ResultsView({ test, finished, onRetrySave, onRetake }: {
  test: LoadedTest
  finished: Finished
  onRetrySave: () => void
  onRetake: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'wrong' | 'unanswered' | 'correct'>('all')
  const total = test.questions.length
  const unanswered = [...finished.answers].filter((a) => a === '-').length
  const wrong = total - finished.correct - unanswered
  const percent = Math.round((finished.correct / total) * 100)

  const rows = test.questions.map((q, i) => {
    const chosen = finished.answers[i]
    const status = chosen === '-' ? 'unanswered' : chosen === q.correct_answer ? 'correct' : 'wrong'
    return { q, i, chosen, status }
  }).filter((r) => filter === 'all' || r.status === filter)

  return (
    <div className="space-y-5">
      <Link href="/dsc-sgt/my-tests" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> My Tests
      </Link>
      <section className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs">
        <h1 className="text-lg font-black text-foreground">{test.title}</h1>
        <p className="mt-3 text-4xl font-black text-foreground">
          {finished.correct}<span className="text-xl text-muted-foreground"> / {total}</span>
          <span className="ml-3 text-base font-bold text-primary">{percent}%</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {finished.correct} correct · {wrong} wrong · {unanswered} unanswered · {formatClock(finished.seconds)} taken
        </p>
        <p className="mt-2 text-xs">
          {finished.saved === 'saving' && <span className="text-muted-foreground">Saving your result…</span>}
          {finished.saved === 'saved' && <span className="text-emerald-600">Result saved.</span>}
          {finished.saved === 'failed' && (
            <span className="text-destructive">
              Not saved.{' '}
              <button type="button" onClick={onRetrySave} className="font-semibold underline cursor-pointer">Try again</button>
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onRetake}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold text-foreground hover:bg-accent cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Take it again
        </button>
      </section>

      <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap gap-2">
          {([['all', `All ${total}`], ['wrong', `Wrong ${wrong}`], ['unanswered', `Unanswered ${unanswered}`], ['correct', `Correct ${finished.correct}`]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer ${filter === value ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <ol className="mt-4 space-y-4">
          {rows.map(({ q, i, chosen, status }) => (
            <li key={i} className="rounded-2xl border border-border/70 p-4">
              <p className="text-sm font-semibold text-foreground">
                <span className="mr-1 text-muted-foreground">{i + 1}.</span> {q.question}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                  const text = q[`option_${letter.toLowerCase()}` as 'option_a']
                  const isCorrect = letter === q.correct_answer
                  const isChosen = letter === chosen
                  return (
                    <li
                      key={letter}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1 ${
                        isCorrect ? 'bg-emerald-500/10 text-foreground' : isChosen ? 'bg-destructive/10 text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <span className="font-semibold">{letter}.</span>
                      <span className="flex-1">{text}</span>
                      {isCorrect && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                      {isChosen && !isCorrect && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                    </li>
                  )
                })}
              </ul>
              {status === 'unanswered' && <p className="mt-2 text-xs text-muted-foreground">Not answered.</p>}
              {q.explanation && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{q.explanation}</p>}
            </li>
          ))}
        </ol>
        {rows.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Nothing here.</p>}
      </section>
    </div>
  )
}
