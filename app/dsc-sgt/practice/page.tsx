'use client'

// ============================================================
// app/dsc-sgt/practice/page.tsx — Complete DSC Practice Section
// ============================================================
// State-aware multi-view Practice Hub:
//   - 'setup': Progressive filtering & mode configuration
//   - 'exam': Active practice session solver & live navigator
//   - 'results': Detailed performance analytics & weak area launchpad
//   - 'history': Student's past practice archive & retries
// ============================================================

import React, { useState } from 'react'
import { toast } from 'sonner'
import PracticeSetup from '@/app/components/dsc-sgt/practice/PracticeSetup'
import PracticeExam from '@/app/components/dsc-sgt/practice/PracticeExam'
import PracticeResults from '@/app/components/dsc-sgt/practice/PracticeResults'
import PracticeHistory from '@/app/components/dsc-sgt/practice/PracticeHistory'
import type {
  PracticeFilterState,
  PracticeSession,
  PracticeResultSummary,
} from '@/types/practice'

type ViewMode = 'setup' | 'exam' | 'results' | 'history'

export default function PracticePage() {
  const [view, setView] = useState<ViewMode>('setup')
  const [currentSession, setCurrentSession] = useState<PracticeSession | null>(null)
  const [sessionResults, setSessionResults] = useState<PracticeResultSummary | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // ── 1. Start a New Practice Session ────────────────────────
  const handleStartSession = async (filter: PracticeFilterState) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/dsc-sgt/practice/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filter),
      })
      const data = await res.json()

      if (res.ok && data.success && data.session) {
        setCurrentSession(data.session)
        setView('exam')
        toast.success(`Practice session created (${data.session.questions?.length || 0} questions)`)
      } else {
        toast.error(data.error || 'Failed to start practice session')
      }
    } catch (err) {
      console.error('Error starting session:', err)
      toast.error('Network error starting practice session')
    } finally {
      setIsLoading(false)
    }
  }

  // ── 2. Answer a Question in Active Exam ─────────────────────
  const handleAnswerQuestion = async (
    questionId: string,
    selectedAnswer: 'A' | 'B' | 'C' | 'D' | null,
    timeTakenSeconds: number,
    markedForReview: boolean
  ) => {
    if (!currentSession) return

    try {
      const res = await fetch(`/api/dsc-sgt/practice/sessions/${currentSession.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          selectedAnswer,
          timeTakenSeconds,
          markedForReview,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        return {
          is_correct: data.is_correct,
          correct_answer: data.correct_answer,
          explanation: data.explanation,
        }
      }
    } catch (err) {
      console.error('Failed to submit answer to server:', err)
    }
  }

  // ── 3. Submit Completed Session ────────────────────────────
  const handleSubmitSession = async (totalTimeSeconds: number) => {
    if (!currentSession) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/dsc-sgt/practice/sessions/${currentSession.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalTimeSpentSeconds: totalTimeSeconds }),
      })
      const data = await res.json()

      if (res.ok && data.success && data.results) {
        setSessionResults(data.results)
        setView('results')
        toast.success('Practice session submitted!')
      } else {
        toast.error(data.error || 'Failed to submit practice session')
      }
    } catch (err) {
      console.error('Error submitting session:', err)
      toast.error('Network error submitting practice session')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── 4. Quick Practice on Weak Topic ────────────────────────
  const handlePracticeTopic = async (topic: string, subject: string) => {
    const filter: PracticeFilterState = {
      medium: 'english',
      subject: subject || 'English',
      class_levels: [],
      topics: [topic],
      subtopics: [],
      difficulty: [],
      question_count: 20,
      mode: 'weak_areas',
      feedback_mode: 'instant',
      has_timer: false,
      duration_minutes: 20,
    }
    await handleStartSession(filter)
  }

  // ── 5. Quick Retry Missed Questions ────────────────────────
  const handleRetryIncorrect = async (topic?: string, fromSessionId?: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/dsc-sgt/practice/retry-incorrect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          fromSessionId: fromSessionId || currentSession?.id,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.session) {
        setCurrentSession(data.session)
        setView('exam')
        toast.success('Retrying incorrect questions session launched!')
      } else {
        toast.error(data.error || 'No missed questions found to retry')
      }
    } catch (err) {
      console.error('Error launching retry session:', err)
      toast.error('Network error launching retry session')
    } finally {
      setIsLoading(false)
    }
  }

  // ── 6. Review Past Session from History ────────────────────
  const handleReviewSession = async (sessionId: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/dsc-sgt/practice/sessions/${sessionId}/results`)
      const data = await res.json()
      if (res.ok && data.success && data.results) {
        setSessionResults(data.results)
        setView('results')
      } else {
        toast.error(data.error || 'Failed to load past session results')
      }
    } catch (err) {
      console.error('Error reviewing session:', err)
      toast.error('Failed to load past session')
    } finally {
      setIsLoading(false)
    }
  }

  // ── 7. Exit / Abandon Session Without Saving ──────────────
  const handleExitSession = async () => {
    if (currentSession?.id) {
      fetch(`/api/dsc-sgt/practice/sessions/${currentSession.id}/abandon`, {
        method: 'POST',
      }).catch(() => {})
    }
    setCurrentSession(null)
    setSessionResults(null)
    setView('setup')
    toast.info('Practice session exited without saving')
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {view === 'setup' && (
        <PracticeSetup
          onStartSession={handleStartSession}
          onQuickRetry={(topic, subject) => handlePracticeTopic(topic || 'Tenses', subject || 'English')}
          onViewHistory={() => setView('history')}
          isLoading={isLoading}
        />
      )}

      {view === 'exam' && currentSession && (
        <PracticeExam
          session={currentSession}
          onAnswerQuestion={handleAnswerQuestion}
          onSubmitSession={handleSubmitSession}
          onExitSession={handleExitSession}
          isSubmitting={isSubmitting}
        />
      )}

      {view === 'results' && sessionResults && (
        <PracticeResults
          results={sessionResults}
          onPracticeTopic={handlePracticeTopic}
          onRetryIncorrect={(topic) => handleRetryIncorrect(topic, sessionResults.session_id)}
          onStartNewPractice={() => setView('setup')}
        />
      )}

      {view === 'history' && (
        <PracticeHistory
          onBackToSetup={() => setView('setup')}
          onReviewSession={handleReviewSession}
          onRetryIncorrect={(sessionId) => handleRetryIncorrect(undefined, sessionId)}
        />
      )}
    </main>
  )
}
