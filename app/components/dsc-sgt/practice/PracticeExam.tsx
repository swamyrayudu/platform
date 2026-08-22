'use client'

// ============================================================
// app/components/dsc-sgt/practice/PracticeExam.tsx
// ============================================================
// Mobile-Optimized, High-Clarity DSC Exam & Practice Orchestrator
// ============================================================

import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PracticeSession, UserAnswerRecord } from '@/types/practice'
import {
  ExamHeader,
  ExamProgressBar,
  QuestionCard,
  OptionList,
  ExplanationCard,
  QuestionMatrixNavigator,
  ExamBottomNav,
  SubmitModal,
  ExitModal,
} from './exam'

interface PracticeExamProps {
  session: PracticeSession
  onAnswerQuestion: (
    questionId: string,
    selectedAnswer: 'A' | 'B' | 'C' | 'D' | null,
    timeTakenSeconds: number,
    markedForReview: boolean
  ) => Promise<{ is_correct: boolean; correct_answer: string; explanation: string | null } | void>
  onSubmitSession: (totalTimeSeconds: number) => void
  onExitSession: () => void
  isSubmitting?: boolean
}

export default function PracticeExam({
  session,
  onAnswerQuestion,
  onSubmitSession,
  onExitSession,
  isSubmitting = false,
}: PracticeExamProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswerRecord>>(
    session.user_answers || {}
  )
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set())
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(session.time_spent_seconds || 0)
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false)
  const [showExitModal, setShowExitModal] = useState<boolean>(false)
  const [showMobileNavigator, setShowMobileNavigator] = useState<boolean>(false)

  // Local instant feedback data map
  const [instantFeedbackData, setInstantFeedbackData] = useState<
    Record<string, { is_correct: boolean; correct_answer: string; explanation: string | null }>
  >({})

  const isInstant = session.feedback_mode === 'instant'
  const questions = session.questions || []
  const currentQ = questions[currentIndex] || questions[0]
  const currentQId = currentQ?.question_id || currentQ?.id || `q-${currentIndex}`

  // ── Live Stopwatch / Timer ──────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Reset per-question stopwatch
  useEffect(() => {
    setQuestionStartTime(Date.now())
  }, [currentIndex])

  // ── Handle Option Click ─────────────────────────────────────
  const handleSelectOption = async (optKey: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQ) return

    const timeSpent = Math.max(1, Math.round((Date.now() - questionStartTime) / 1000))
    const isMarked = markedIds.has(currentQId)

    // In Instant Feedback mode, once answered, lock option
    if (isInstant && userAnswers[currentQId]?.selected_answer) {
      return
    }

    const updatedRecord: UserAnswerRecord = {
      question_id: currentQId,
      selected_answer: optKey,
      time_taken_seconds: timeSpent,
      marked_for_review: isMarked,
    }

    setUserAnswers((prev) => ({
      ...prev,
      [currentQId]: updatedRecord,
    }))

    // Server-side validation
    const res = await onAnswerQuestion(currentQId, optKey, timeSpent, isMarked)
    if (res) {
      setInstantFeedbackData((prev) => ({
        ...prev,
        [currentQId]: res,
      }))
    }
  }

  // ── Toggle Flag / Mark For Review ───────────────────────────
  const toggleMarkForReview = () => {
    setMarkedIds((prev) => {
      const next = new Set(prev)
      if (next.has(currentQId)) next.delete(currentQId)
      else next.add(currentQId)
      return next
    })
  }

  const totalQuestions = questions.length
  const answeredCount = Object.values(userAnswers).filter((a) => a.selected_answer).length
  const progressPct = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0

  const currentAnswer = userAnswers[currentQId]?.selected_answer
  const currentFeedback = instantFeedbackData[currentQId] || (
    currentQ.correct_answer ? {
      is_correct: (currentQ.correct_answer || '').toUpperCase() === currentAnswer,
      correct_answer: currentQ.correct_answer,
      explanation: currentQ.explanation || null,
    } : null
  )

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-24 sm:pb-8">
      {/* ── Top Header Navigation Bar ─────────────────────────── */}
      <ExamHeader
        subject={session.subject}
        medium={session.medium}
        currentIndex={currentIndex}
        totalQuestions={totalQuestions}
        elapsedSeconds={elapsedSeconds}
        onShowExitModal={() => setShowExitModal(true)}
        onShowSubmitModal={() => setShowSubmitModal(true)}
      />

      {/* Progress Bar */}
      <ExamProgressBar progressPct={progressPct} />

      {/* ── Main Layout (Question Card + Desktop Navigator) ──── */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left: Question Solver Card */}
        <div className="lg:col-span-3 flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
          <div>
            <QuestionCard
              currentQ={currentQ}
              currentIndex={currentIndex}
              isMarked={markedIds.has(currentQId)}
              onToggleMarkForReview={toggleMarkForReview}
            />

            <OptionList
              currentQ={currentQ}
              currentAnswer={currentAnswer}
              isInstant={isInstant}
              currentFeedback={currentFeedback}
              onSelectOption={handleSelectOption}
            />

            <ExplanationCard
              isInstant={isInstant}
              currentAnswer={currentAnswer}
              currentFeedback={currentFeedback}
            />
          </div>

          {/* Desktop/Tablet Bottom Control Bar */}
          <div className="hidden sm:flex items-center justify-between border-t border-border/60 pt-5 mt-6">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-accent disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>

            <span className="text-xs text-muted-foreground font-semibold">
              Question {currentIndex + 1} of {totalQuestions}
            </span>

            <button
              type="button"
              onClick={() => {
                if (currentIndex < totalQuestions - 1) {
                  setCurrentIndex((i) => i + 1)
                } else {
                  setShowSubmitModal(true)
                }
              }}
              className="inline-flex items-center gap-1 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
            >
              <span>{currentIndex === totalQuestions - 1 ? 'Finish Practice' : 'Next'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right: Question Matrix Navigator (Desktop) */}
        <QuestionMatrixNavigator
          questions={questions}
          currentIndex={currentIndex}
          userAnswers={userAnswers}
          markedIds={markedIds}
          onSelectIndex={setCurrentIndex}
        />
      </div>

      {/* ── Fixed Mobile Bottom Navigation Bar ────────────────── */}
      <ExamBottomNav
        currentIndex={currentIndex}
        totalQuestions={totalQuestions}
        onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() => {
          if (currentIndex < totalQuestions - 1) {
            setCurrentIndex((i) => i + 1)
          } else {
            setShowSubmitModal(true)
          }
        }}
        onOpenMobileNavigator={() => setShowMobileNavigator(true)}
      />

      {/* ── Mobile Question Navigator Bottom Sheet ────────────── */}
      {showMobileNavigator && (
        <QuestionMatrixNavigator
          questions={questions}
          currentIndex={currentIndex}
          userAnswers={userAnswers}
          markedIds={markedIds}
          isMobileModal={true}
          onSelectIndex={setCurrentIndex}
          onCloseMobileModal={() => setShowMobileNavigator(false)}
        />
      )}

      {/* ── Submit Modal ──────────────────────────────────────── */}
      <SubmitModal
        show={showSubmitModal}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        isSubmitting={isSubmitting}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={() => {
          setShowSubmitModal(false)
          onSubmitSession(elapsedSeconds)
        }}
      />

      {/* ── Abandon / Exit Modal ──────────────────────────────── */}
      <ExitModal
        show={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={() => {
          setShowExitModal(false)
          onExitSession()
        }}
      />
    </div>
  )
}
