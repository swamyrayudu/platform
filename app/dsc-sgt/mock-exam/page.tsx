'use client'

import React, { useState, useEffect, useCallback, useRef, Suspense, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  PauseCircle,
  Play,
  Maximize,
  Minimize,
  Timer,
  CheckCircle2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Send,
  RotateCcw,
  AlertCircle,
  Loader2,
  HelpCircle,
  X,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import QuestionFeedbackButton from '@/app/components/dsc-sgt/QuestionFeedbackButton'
import type { ClientSafeMockQuestion, SelectedOption } from '@/types/mock-tests'

// ── Constants ─────────────────────────────────────────────────────

// Autosave answer every N seconds after change
const AUTOSAVE_DEBOUNCE_MS = 1500

// Questions are delivered in chunks: the first chunk renders immediately and
// the rest stream in behind it, so the candidate can start on Q1 without
// waiting for all 160. Each chunk is ONE request served from a single Redis
// read — never one request per question.
const QUESTIONS_CHUNK_SIZE = 50

// ── Timer Component ──────────────────────────────────────────────

function CountdownTimer({
  totalSeconds,
  timeSpentSeconds,
  onExpire,
}: {
  totalSeconds: number
  timeSpentSeconds: number
  onExpire: () => void
}) {
  const [remaining, setRemaining] = useState(totalSeconds - timeSpentSeconds)
  const hasExpiredRef = useRef(false)

  useEffect(() => {
    if (remaining <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true
      onExpire()
      return
    }
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval)
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true
            onExpire()
          }
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const hours = Math.floor(remaining / 3600)
  const mins = Math.floor((remaining % 3600) / 60)
  const secs = remaining % 60
  const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

  const isUrgent = remaining < 600  // < 10 minutes

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-mono font-bold tabular-nums ${
        isUrgent
          ? 'border-red-500/40 bg-red-500/10 text-red-500 animate-pulse'
          : 'border-border bg-muted/40 text-foreground'
      }`}
    >
      <Timer className="h-3.5 w-3.5 shrink-0" />
      {timeStr}
    </div>
  )
}

// ── Section Navigator ─────────────────────────────────────────────

interface SectionNav {
  id: string
  name: string
  start: number  // question_number start (1-indexed)
  count: number
}

function buildSectionNav(questions: ClientSafeMockQuestion[]): SectionNav[] {
  const sections: SectionNav[] = []
  const seen = new Map<string, SectionNav>()
  for (const q of [...questions].sort((a, b) => a.question_number - b.question_number)) {
    if (!seen.has(q.section_id)) {
      const nav: SectionNav = { id: q.section_id, name: q.section_name, start: q.question_number, count: 0 }
      seen.set(q.section_id, nav)
      sections.push(nav)
    }
    seen.get(q.section_id)!.count++
  }
  return sections
}

// ── Confirmation Modal ────────────────────────────────────────────

function SubmitConfirmModal({
  totalQuestions,
  answered,
  markedCount,
  unanswered,
  onConfirm,
  onCancel,
  submitting,
}: {
  totalQuestions: number
  answered: number
  markedCount: number
  unanswered: number
  onConfirm: () => void
  onCancel: () => void
  submitting: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10">
            <AlertCircle className="h-5 w-5 text-amber-500" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Submit Exam?</h3>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          You are about to submit your exam. This action cannot be undone.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-border/60 bg-muted/30 p-3 text-center text-xs">
          <div>
            <p className="font-bold text-emerald-500">{answered}</p>
            <p className="text-muted-foreground">Answered</p>
          </div>
          <div className="border-x border-border/60">
            <p className="font-bold text-amber-500">{markedCount}</p>
            <p className="text-muted-foreground">Marked</p>
          </div>
          <div>
            <p className="font-bold text-red-500">{unanswered}</p>
            <p className="text-muted-foreground">Unanswered</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Continue Exam
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-70 flex items-center justify-center gap-1.5"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {submitting ? 'Submitting…' : 'Submit Now'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** "1 hour 12 minutes" — the number a candidate cares about when pausing. */
function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (hours === 0) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  if (minutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`
}

// ── Leave-exam dialog ─────────────────────────────────────────────
// Two choices, because there are only two things a candidate means by Back
// mid-paper: "I need to stop for now" and "I mis-tapped".
//
// Submitting is deliberately NOT one of them. Finishing a paper is a decision
// worth making on purpose, and it already has its own button and its own
// confirmation with the answered/marked/unanswered counts. Offering it here,
// one tap from a mis-hit Back, is how somebody ends a 150-minute exam by
// accident.

function LeaveExamModal({
  answered,
  unanswered,
  remainingLabel,
  onPause,
  onCancel,
  busy,
}: {
  answered: number
  unanswered: number
  remainingLabel: string
  onPause: () => void
  onCancel: () => void
  busy: boolean
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-3xl border border-border bg-card p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10">
            <PauseCircle className="h-5 w-5 text-amber-500" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Pause the exam?</h3>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          You have answered <strong className="text-foreground">{answered}</strong> question
          {answered === 1 ? '' : 's'}, with {unanswered} left. The timer stops here and{' '}
          <strong className="text-foreground">{remainingLabel}</strong> will be waiting when you
          come back.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onPause}
            disabled={busy}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PauseCircle className="h-3.5 w-3.5" />
            )}
            Stop the timer and go back
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold text-foreground transition hover:bg-accent disabled:opacity-60"
          >
            <Play className="h-3.5 w-3.5" />
            Resume exam
          </button>
        </div>
      </div>
    </div>
  )
}

// ── First-run hint for the question palette ───────────────────────
// On a phone the palette lives behind one small button, and nothing about a
// number in a box says "all 160 questions are in here". Desktop needs none of
// this — the palette is a permanent sidebar from sm up.
//
// Read through useSyncExternalStore rather than an effect so the server
// renders the "already seen" answer and the client renders the real one, with
// no hydration mismatch and no flash of a hint that is about to disappear.

const PALETTE_HINT_KEY = 'mock_exam_palette_hint_seen'
const hintListeners = new Set<() => void>()

function subscribeHint(onChange: () => void): () => void {
  hintListeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    hintListeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function hintSnapshot(): string {
  try {
    return window.localStorage.getItem(PALETTE_HINT_KEY) ?? ''
  } catch {
    // Storage blocked — treat it as seen rather than showing the hint every
    // single time the exam is opened.
    return 'seen'
  }
}

function dismissHint(): void {
  try {
    window.localStorage.setItem(PALETTE_HINT_KEY, 'seen')
  } catch {
    // Nothing to do; the hint simply reappears next time.
  }
  for (const listener of hintListeners) listener()
}

// ── Question Grid ─────────────────────────────────────────────────

function QuestionGrid({
  questions,
  currentQNumber,
  answers,
  visited,
  marked,
  onJump,
}: {
  questions: ClientSafeMockQuestion[]
  currentQNumber: number
  answers: Record<string, SelectedOption>
  visited: Set<number>
  marked: Set<number>
  onJump: (qNumber: number) => void
}) {
  const sorted = [...questions].sort((a, b) => a.question_number - b.question_number)
  const sections = buildSectionNav(sorted)

  // A wall of 160 numbered tiles is not something anyone reads mid-exam. The
  // real questions are "what have I not done yet" and "what did I flag", so
  // those are one tap, and the full grid stays for the rare jump to a number.
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'marked' | 'answered'>('all')

  const counts = {
    all: sorted.length,
    unanswered: sorted.filter((q) => !answers[q.question_uid]).length,
    marked: sorted.filter((q) => marked.has(q.question_number)).length,
    answered: sorted.filter((q) => answers[q.question_uid]).length,
  }

  const matchesFilter = (q: ClientSafeMockQuestion) => {
    if (filter === 'unanswered') return !answers[q.question_uid]
    if (filter === 'answered') return Boolean(answers[q.question_uid])
    if (filter === 'marked') return marked.has(q.question_number)
    return true
  }

  const FILTERS = [
    { id: 'all' as const, label: 'All' },
    { id: 'unanswered' as const, label: 'Not done' },
    { id: 'marked' as const, label: 'Flagged' },
    { id: 'answered' as const, label: 'Done' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
              filter === f.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label} {counts[f.id]}
          </button>
        ))}
      </div>

      {/* Questions grouped by section */}
      {sections.map((section) => {
        const sectionQs = sorted.filter((q) => q.section_id === section.id && matchesFilter(q))
        if (sectionQs.length === 0) return null
        return (
          <div key={section.id}>
            <p className="mb-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wide truncate">
              {section.name} ({sectionQs.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sectionQs.map((q) => {
                const isCurrent = q.question_number === currentQNumber
                const hasAnswer = !!answers[q.question_uid]
                const isMarked = marked.has(q.question_number)
                const isVisited = visited.has(q.question_number)

                let cls = 'bg-muted/60 border border-border text-muted-foreground'
                if (isCurrent) cls = 'bg-primary text-primary-foreground shadow-md scale-110'
                else if (isMarked && hasAnswer) cls = 'bg-amber-500 text-white'
                else if (isMarked) cls = 'bg-amber-500/70 text-white'
                else if (hasAnswer) cls = 'bg-emerald-600 text-white'
                else if (isVisited) cls = 'bg-muted-foreground/30 text-foreground'

                return (
                  <button
                    key={q.question_number}
                    onClick={() => onJump(q.question_number)}
                    className={`h-7 w-7 rounded-md text-[11px] font-bold transition-all ${cls}`}
                    title={`Q${q.question_number}`}
                  >
                    {q.question_number}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Exam Component ───────────────────────────────────────────

function MockExamContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const testId = searchParams.get('testId')
  const attemptId = searchParams.get('attemptId')

  // ── State ─────────────────────────────────────────────────────

  const [questions, setQuestions] = useState<ClientSafeMockQuestion[]>([])
  const [loadingQ, setLoadingQ] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentQNumber, setCurrentQNumber] = useState(1)
  const [answers, setAnswers] = useState<Record<string, SelectedOption>>({})
  const [marked, setMarked] = useState<Set<number>>(new Set())
  const [visited, setVisited] = useState<Set<number>>(new Set([1]))
  const [showSidebar, setShowSidebar] = useState(false)
  const [testMeta, setTestMeta] = useState<{
    duration_seconds: number
    time_spent_seconds: number
    title: string
    medium?: string
  } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  // Captured when the dialog opens rather than read during render:
  // getTotalTimeSpent() reads a ref, and a ref must not be touched while
  // rendering. It is a frozen figure anyway — the clock the candidate is
  // being shown is the one at the moment they asked to leave.
  const [leaveRemaining, setLeaveRemaining] = useState(0)
  const [leaving, setLeaving] = useState(false)

  // Total questions in the module, from the API — used to show chunk progress
  // while the later chunks are still streaming in.
  const [totalQuestions, setTotalQuestions] = useState(0)

  // Saved answers from a resumed attempt, keyed by question_uid. Kept in a ref
  // so background chunks can apply the ones that belong to them.
  const savedAnswersRef = useRef<Record<string, { selected_option: SelectedOption; marked_for_review: boolean }>>({})

  // Track per-question time (for analytics, not for scoring)
  const questionStartRef = useRef<number>(Date.now())
  const questionTimes = useRef<Record<string, number>>({})
  const pendingSavesRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Question Navigation ───────────────────────────────────────

  const sorted = [...questions].sort((a, b) => a.question_number - b.question_number)
  const currentQ = sorted.find((q) => q.question_number === currentQNumber) || sorted[0]
  const currentIdx = sorted.findIndex((q) => q.question_number === currentQNumber)

  // ── Load Questions + Attempt State ───────────────────────────

  useEffect(() => {
    if (!testId || !attemptId) {
      setLoadError('Missing test or attempt ID. Please start the test from the Mock Tests page.')
      setLoadingQ(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoadingQ(true)
      setLoadError(null)
      try {
        // First chunk + attempt state + test info in parallel.
        const [qRes, attemptRes, testRes] = await Promise.all([
          fetch(`/api/dsc-sgt/mock-tests/${testId}/questions?start=1&limit=${QUESTIONS_CHUNK_SIZE}`),
          fetch(`/api/dsc-sgt/mock-tests/attempts/${attemptId}`),
          fetch(`/api/dsc-sgt/mock-tests/${testId}`),
        ])

        const [qData, attemptData, testData] = await Promise.all([
          qRes.json(),
          attemptRes.json(),
          testRes.json(),
        ])

        if (!qData.success || !qData.questions?.length) {
          setLoadError(qData.error || 'Questions not available. Contact support.')
          return
        }

        if (!attemptData.success) {
          setLoadError(attemptData.error || 'Could not load attempt. Please restart.')
          return
        }

        setQuestions(qData.questions)
        setTotalQuestions(qData.total ?? qData.questions.length)

        const attempt = attemptData.attempt
        const testInfo = testData?.test
        setTestMeta({
          duration_seconds: attempt.duration_seconds,
          time_spent_seconds: attempt.time_spent_seconds,
          title: testInfo?.title || 'AP DSC SGT Mock Test',
          medium: testInfo?.medium || 'telugu',
        })

        // Restore saved answers
        const savedAnswers: Record<string, SelectedOption> = {}
        const savedMarked = new Set<number>()
        const savedVisited = new Set<number>([1])

        const existingAnswers = attempt.existing_answers as Record<
          string,
          { selected_option: SelectedOption; marked_for_review: boolean }
        >
        savedAnswersRef.current = existingAnswers ?? {}

        const allQs: ClientSafeMockQuestion[] = qData.questions
        if (existingAnswers) {
          for (const q of allQs) {
            const saved = existingAnswers[q.question_uid]
            if (saved) {
              if (saved.selected_option) savedAnswers[q.question_uid] = saved.selected_option
              if (saved.marked_for_review) savedMarked.add(q.question_number)
              savedVisited.add(q.question_number)
            }
          }
        }

        setAnswers(savedAnswers)
        setMarked(savedMarked)
        setVisited(savedVisited)

        // The exam is usable now. Stream the remaining chunks in the
        // background and merge them as they arrive.
        setLoadingQ(false)
        void loadRemainingChunks(qData.next_start as number | null, qData.has_more as boolean)
      } catch {
        setLoadError('Failed to load exam. Please check your connection and try again.')
        setLoadingQ(false)
      }
    }

    /**
     * Fetch chunks 2..N sequentially (Q51-100, Q101-160, ...).
     * Sequential rather than parallel so a slow connection is not hit with
     * several simultaneous requests while the candidate is already answering.
     */
    const loadRemainingChunks = async (nextStart: number | null, hasMore: boolean) => {
      let start = nextStart
      let more = hasMore

      while (more && start != null && !cancelled) {
        try {
          const res = await fetch(
            `/api/dsc-sgt/mock-tests/${testId}/questions?start=${start}&limit=${QUESTIONS_CHUNK_SIZE}`
          )
          const data = await res.json()
          if (!data.success || !data.questions?.length) break
          if (cancelled) return

          const incoming = data.questions as ClientSafeMockQuestion[]

          setQuestions((prev) => {
            const byUid = new Map(prev.map((q) => [q.question_uid, q]))
            for (const q of incoming) byUid.set(q.question_uid, q)
            return [...byUid.values()].sort((a, b) => a.question_number - b.question_number)
          })

          // Apply any saved answers belonging to this chunk.
          const saved = savedAnswersRef.current
          if (saved) {
            const newAnswers: Record<string, SelectedOption> = {}
            const newMarked: number[] = []
            for (const q of incoming) {
              const entry = saved[q.question_uid]
              if (!entry) continue
              if (entry.selected_option) newAnswers[q.question_uid] = entry.selected_option
              if (entry.marked_for_review) newMarked.push(q.question_number)
            }
            if (Object.keys(newAnswers).length > 0) {
              setAnswers((prev) => ({ ...prev, ...newAnswers }))
            }
            if (newMarked.length > 0) {
              setMarked((prev) => new Set([...prev, ...newMarked]))
            }
          }

          start = data.next_start as number | null
          more = Boolean(data.has_more)
        } catch {
          // A failed background chunk is not fatal: the candidate keeps the
          // questions already loaded, and navigating re-renders what exists.
          break
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [testId, attemptId])

  // ── Answer Persistence (Debounced) ───────────────────────────

  const persistAnswer = useCallback((
    qId: string,
    qNumber: number,
    option: SelectedOption,
    isMarked: boolean
  ) => {
    if (!attemptId) return

    // Clear pending save for this question
    if (pendingSavesRef.current[qId]) {
      clearTimeout(pendingSavesRef.current[qId])
    }

    pendingSavesRef.current[qId] = setTimeout(async () => {
      try {
        await fetch(`/api/dsc-sgt/mock-tests/attempts/${attemptId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: qId,
            questionNumber: qNumber,
            selectedOption: option,
            markedForReview: isMarked,
            timeTakenSeconds: Math.round((questionTimes.current[qId] || 0) / 1000),
          }),
        })
      } catch {
        // Silently fail — answer saved locally already
      }
    }, AUTOSAVE_DEBOUNCE_MS)
  }, [attemptId])

  // ── Navigation Handlers ───────────────────────────────────────

  const markVisited = useCallback((qNumber: number) => {
    setVisited((prev) => {
      if (prev.has(qNumber)) return prev
      const next = new Set(prev)
      next.add(qNumber)
      return next
    })
  }, [])

  const handleQuestionTransition = useCallback((nextQNumber: number) => {
    if (!currentQ) return
    // Record time spent on current question
    const elapsed = Date.now() - questionStartRef.current
    questionTimes.current[currentQ.question_uid] =
      (questionTimes.current[currentQ.question_uid] || 0) + elapsed
    questionStartRef.current = Date.now()
    setCurrentQNumber(nextQNumber)
    markVisited(nextQNumber)
  }, [currentQ, markVisited])

  const handleSelectOption = useCallback((key: SelectedOption) => {
    if (!currentQ) return
    setAnswers((prev) => {
      const next = { ...prev, [currentQ.question_uid]: key }
      persistAnswer(currentQ.question_uid, currentQ.question_number, key, marked.has(currentQ.question_number))
      return next
    })
  }, [currentQ, marked, persistAnswer])

  const handleClearResponse = useCallback(() => {
    if (!currentQ) return
    setAnswers((prev) => {
      const next = { ...prev }
      delete next[currentQ.question_uid]
      persistAnswer(currentQ.question_uid, currentQ.question_number, null, marked.has(currentQ.question_number))
      return next
    })
  }, [currentQ, marked, persistAnswer])

  const handleMarkReview = useCallback(() => {
    if (!currentQ) return
    const isNowMarked = !marked.has(currentQ.question_number)
    setMarked((prev) => {
      const next = new Set(prev)
      isNowMarked ? next.add(currentQ.question_number) : next.delete(currentQ.question_number)
      return next
    })
    persistAnswer(currentQ.question_uid, currentQ.question_number, answers[currentQ.question_uid] || null, isNowMarked)

    // Navigate to next question
    if (currentIdx < sorted.length - 1) {
      handleQuestionTransition(sorted[currentIdx + 1].question_number)
    }
  }, [currentQ, currentIdx, sorted, marked, answers, persistAnswer, handleQuestionTransition])

  const handleNext = useCallback(() => {
    if (currentIdx < sorted.length - 1) {
      handleQuestionTransition(sorted[currentIdx + 1].question_number)
    }
  }, [currentIdx, sorted, handleQuestionTransition])

  const handlePrev = useCallback(() => {
    if (currentIdx > 0) {
      handleQuestionTransition(sorted[currentIdx - 1].question_number)
    }
  }, [currentIdx, sorted, handleQuestionTransition])

  const handleJump = useCallback((qNumber: number) => {
    handleQuestionTransition(qNumber)
    setShowSidebar(false)
  }, [handleQuestionTransition])

  // ── Timer expiry ──────────────────────────────────────────────

  const handleTimerExpire = useCallback(() => {
    toast.error('⏰ Time is up! Submitting your exam automatically.', { duration: 5000 })
    setTimeout(() => handleSubmit(true), 1500)
  }, [])

  // ── Submission ────────────────────────────────────────────────

  const getTotalTimeSpent = useCallback(() => {
    if (!testMeta) return 0
    return Math.min(
      testMeta.duration_seconds,
      testMeta.time_spent_seconds + Math.round((Date.now() - questionStartRef.current) / 1000)
    )
  }, [testMeta])

  const handleSubmit = useCallback(async (auto = false) => {
    if (submitting) return
    setSubmitting(true)

    const toastId = 'exam-submit'
    toast.loading('Submitting and scoring your exam…', { id: toastId })

    try {
      const res = await fetch(`/api/dsc-sgt/mock-tests/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalTimeSpentSeconds: getTotalTimeSpent() }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (res.status === 409) {
          toast.success('Redirecting to your result…', { id: toastId })
          router.replace(`/dsc-sgt/mock-result?attemptId=${attemptId}`)
          return
        }
        throw new Error(data.error || 'Submission failed')
      }

      toast.success('Exam submitted! Loading your result…', { id: toastId })
      router.replace(`/dsc-sgt/mock-result?attemptId=${attemptId}`)
    } catch (err: any) {
      toast.error(err.message || 'Submission failed. Please try again.', { id: toastId })
      setSubmitting(false)
    }
  }, [attemptId, submitting, getTotalTimeSpent, router])

  const openLeaveDialog = useCallback(() => {
    setLeaveRemaining(Math.max(0, (testMeta?.duration_seconds ?? 0) - getTotalTimeSpent()))
    setShowLeave(true)
  }, [testMeta, getTotalTimeSpent])


  // ── Leaving the exam ────────────────────────────────────────────
  // Back is intercepted rather than blocked. A sentinel entry is pushed on
  // top of the exam so the first Back pops that instead of the route, which
  // gives us somewhere to ask the question; the entry is pushed again if the
  // candidate decides to stay, so a second Back asks again rather than
  // escaping.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.history.pushState({ examGuard: true }, '')

    const onPopState = () => {
      openLeaveDialog()
      window.history.pushState({ examGuard: true }, '')
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [openLeaveDialog])

  // A tab close or reload cannot be intercepted, only warned about.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // ── Fullscreen ──────────────────────────────────────────────────
  // Worth having for a 150-minute paper: it removes the browser chrome, and
  // on a phone that is a third of the screen back. Tracked from the
  // fullscreenchange event rather than from the click, because Escape and the
  // system gesture also leave it and the button must not lie about the state.
  const [isFullscreen, setIsFullscreen] = useState(false)

  const hintSeen = useSyncExternalStore(subscribeHint, hintSnapshot, () => 'seen')
  const showPaletteHint = hintSeen === ''

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      // iOS Safari refuses this outside a video element. Nothing to do but
      // leave the button inert rather than show an error mid-exam.
    }
  }, [])

  const handlePause = useCallback(async () => {
    if (leaving) return
    setLeaving(true)
    try {
      // The elapsed figure only exists in this page — the server runs no clock
      // for an attempt — so it is sent here and clamped there.
      await fetch(`/api/dsc-sgt/mock-tests/attempts/${attemptId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totalTimeSpentSeconds: getTotalTimeSpent() }),
      })
    } catch {
      // Going back matters more than the last few seconds of bookkeeping; the
      // attempt stays in_progress either way and is picked up on return.
    } finally {
      setLeaving(false)
      setShowLeave(false)
      router.replace('/dsc-sgt/mock-tests')
    }
  }, [attemptId, leaving, router, getTotalTimeSpent])

  // ── Derived stats ─────────────────────────────────────────────

  const answeredCount = Object.keys(answers).length
  const markedCount = marked.size
  const unansweredCount = questions.length - answeredCount

  const sections = buildSectionNav(sorted)
  const currentSectionName = currentQ?.section_name || ''

  // ── Loading & Error States ────────────────────────────────────

  if (loadingQ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading exam questions…</p>
          <p className="text-[11px] text-muted-foreground/60">Fetching from cache — this is fast.</p>
        </div>
      </div>
    )
  }

  if (loadError || !questions.length || !currentQ) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm font-bold text-foreground">Could not load exam</p>
          <p className="text-xs text-muted-foreground">{loadError}</p>
          <button
            onClick={() => router.push('/dsc-sgt/mock-tests')}
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent"
          >
            <RefreshCw className="h-4 w-4" /> Back to Mock Tests
          </button>
        </div>
      </div>
    )
  }

  const currentAnswer = answers[currentQ.question_uid]
  const isMarked = marked.has(currentQ.question_number)

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">

      {/* ══ Topbar ══ */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-3 sm:px-6 gap-3 z-20">
        <div className="flex min-w-0 items-center gap-2">
          {/* The visible counterpart of Back, so leaving is not a gesture the
              candidate has to guess at. */}
          <button
            onClick={openLeaveDialog}
            aria-label="Pause exam"
            className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          {/* The module title used to sit here and was the widest thing in the
              bar — on a phone it truncated to "గ్రాండ్ మాక్ టెస్ట్ — మా…",
              which identifies nothing. A candidate already knows which test
              they opened; what they need from this bar is the time left. */}
          <div className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
          <span className="shrink-0 text-xs font-bold text-muted-foreground">
            Q{currentQ.question_number}
            <span className="text-muted-foreground/60"> / {questions.length}</span>
          </span>
        </div>

        {/* Status chips — desktop only */}
        <div className="hidden sm:flex items-center gap-2 text-[11px]">
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-600 dark:text-emerald-400">
            ✓ {answeredCount}
          </span>
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-500">
            ⚑ {markedCount}
          </span>
          <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-bold text-red-500">
            ✗ {unansweredCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {testMeta && (
            <CountdownTimer
              totalSeconds={testMeta.duration_seconds}
              timeSpentSeconds={testMeta.time_spent_seconds}
              onExpire={handleTimerExpire}
            />
          )}
          {/* Hidden where the API is unavailable rather than shown broken. */}
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            className="hidden h-8 w-8 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground transition hover:text-foreground [@supports(display:flex)]:inline-flex"
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
          <button
            id="mock-exam-submit-btn"
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
            <span className="hidden sm:inline">Submit</span>
          </button>
          {/* Mobile sidebar toggle */}
          <div className="relative sm:hidden">
            <button
              onClick={() => {
                setShowSidebar(true)
                dismissHint()
              }}
              aria-label={`Question ${currentQNumber} of ${questions.length} — open the question list`}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-muted/60 ${
                showPaletteHint ? 'border-primary ring-2 ring-primary/30' : 'border-border'
              }`}
            >
              <span className="text-[11px] font-black">{currentQNumber}</span>
            </button>

            {showPaletteHint && (
              <div
                role="status"
                className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-border bg-popover p-3 text-left shadow-xl animate-in fade-in-50 slide-in-from-top-1"
              >
                {/* Arrow, pointing back at the button. */}
                <span className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t border-border bg-popover" />
                <p className="relative text-[11px] font-semibold text-foreground">
                  All {questions.length} questions are here
                </p>
                <p className="relative mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Tap this to jump to any question, or to see what you have not
                  answered yet.
                </p>
                <button
                  onClick={dismissHint}
                  className="relative mt-2 w-full rounded-xl bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══ Main Body: Question + Sidebar ══ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Question Area ── */}
        <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 gap-4">

          {/* Question header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                {currentSectionName}
              </span>
              <span className="text-xs font-black text-foreground">Q {currentQ.question_number}</span>
              <span className="text-[11px] text-muted-foreground">
                / {totalQuestions || questions.length}
              </span>
              {totalQuestions > 0 && questions.length < totalQuestions && (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                  title="Later questions are still loading in the background"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {questions.length}/{totalQuestions} loaded
                </span>
              )}
              {currentQ.difficulty && (
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                  currentQ.difficulty.toLowerCase() === 'easy' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  currentQ.difficulty.toLowerCase() === 'hard' ? 'bg-red-500/10 text-red-500' :
                  'bg-secondary text-primary'
                }`}>
                  {currentQ.difficulty}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-muted-foreground font-medium">
                {currentQ.marks} mark{currentQ.marks !== 1 ? 's' : ''}
              </span>

              {/* Report a problem with this question */}
              <QuestionFeedbackButton
                questionUid={currentQ.question_uid}
                source="mock_exam"
                mockTestId={testId}
                questionText={currentQ.question}
              />
            </div>
          </div>

          {/* Question text */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm">
            <p className="text-sm sm:text-[15px] font-semibold leading-relaxed text-foreground whitespace-pre-wrap">
              {currentQ.question}
            </p>
          </div>

          {/* Options */}
          <div className="grid gap-3">
            {(['A', 'B', 'C', 'D'] as const).map((key) => {
              const optionText = currentQ[`option_${key.toLowerCase()}` as keyof ClientSafeMockQuestion] as string
              const isSelected = currentAnswer === key

              return (
                <button
                  key={key}
                  id={`mock-option-${key}`}
                  onClick={() => handleSelectOption(key)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left text-xs transition-all ${
                    isSelected
                      ? 'border-primary/70 bg-primary/10 ring-1 ring-primary/30'
                      : 'border-border/70 bg-card hover:border-primary/40 hover:bg-accent/50'
                  }`}
                >
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black transition ${
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {key}
                  </span>
                  <span className="flex-1 font-medium text-foreground leading-snug">
                    {optionText}
                  </span>
                  {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />}
                </button>
              )
            })}
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkReview}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  isMarked
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-500'
                    : 'border-border text-muted-foreground hover:border-amber-400 hover:text-amber-500'
                }`}
              >
                <Bookmark className={`h-3.5 w-3.5 ${isMarked ? 'fill-amber-500' : ''}`} />
                {isMarked ? 'Marked' : 'Mark & Next'}
              </button>
              {currentAnswer && (
                <button
                  onClick={handleClearResponse}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIdx === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              {currentIdx < sorted.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90"
                >
                  Submit <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Sidebar: Question Grid ── */}
        <>
          {/* Desktop sidebar */}
          <aside className="hidden sm:flex w-64 shrink-0 flex-col border-l border-border bg-card/80 overflow-y-auto p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                Question Palette
              </span>
            </div>
            <QuestionGrid
              questions={sorted}
              currentQNumber={currentQNumber}
              answers={answers}
              visited={visited}
              marked={marked}
              onJump={handleJump}
            />
          </aside>

          {/* Mobile sidebar overlay */}
          {showSidebar && (
            <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowSidebar(false)}>
              <div
                className="absolute right-0 top-0 flex h-full w-72 flex-col border-l border-border bg-card overflow-y-auto p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Question Palette</span>
                  <button onClick={() => setShowSidebar(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <QuestionGrid
                  questions={sorted}
                  currentQNumber={currentQNumber}
                  answers={answers}
                  visited={visited}
                  marked={marked}
                  onJump={handleJump}
                />
              </div>
            </div>
          )}
        </>
      </div>

      {/* ══ Leave Modal ══ */}
      {showLeave && (
        <LeaveExamModal
          answered={answeredCount}
          unanswered={unansweredCount}
          remainingLabel={formatRemaining(leaveRemaining)}
          onPause={handlePause}
          onCancel={() => setShowLeave(false)}
          busy={leaving}
        />
      )}

      {/* ══ Confirmation Modal ══ */}
      {showConfirm && (
        <SubmitConfirmModal
          totalQuestions={questions.length}
          answered={answeredCount}
          markedCount={markedCount}
          unanswered={unansweredCount}
          onConfirm={() => handleSubmit(false)}
          onCancel={() => setShowConfirm(false)}
          submitting={submitting}
        />
      )}
    </div>
  )
}

export default function MockExamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <MockExamContent />
    </Suspense>
  )
}
