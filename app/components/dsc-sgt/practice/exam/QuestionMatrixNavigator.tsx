'use client'

// ============================================================
// app/components/dsc-sgt/practice/exam/QuestionMatrixNavigator.tsx
// ============================================================

import React from 'react'
import { X } from 'lucide-react'
import type { PracticeQuestion, UserAnswerRecord } from '@/types/practice'

interface QuestionMatrixNavigatorProps {
  questions: PracticeQuestion[]
  currentIndex: number
  userAnswers: Record<string, UserAnswerRecord>
  markedIds: Set<string>
  isMobileModal?: boolean
  onSelectIndex: (index: number) => void
  onCloseMobileModal?: () => void
}

export default function QuestionMatrixNavigator({
  questions,
  currentIndex,
  userAnswers,
  markedIds,
  isMobileModal = false,
  onSelectIndex,
  onCloseMobileModal,
}: QuestionMatrixNavigatorProps) {
  const totalQuestions = questions.length
  const answeredCount = Object.values(userAnswers).filter((a) => a.selected_answer).length

  if (isMobileModal) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs p-3 animate-in fade-in-50 sm:hidden">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xl max-h-[70vh] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Question Navigator</h3>
            <button
              type="button"
              onClick={onCloseMobileModal}
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto py-4 grid grid-cols-5 gap-2 flex-1">
            {questions.map((q, idx) => {
              const qId = q.question_id || q.id || `q-${idx}`
              const isCurrent = idx === currentIndex
              const isAns = Boolean(userAnswers[qId]?.selected_answer)
              const isMarked = markedIds.has(qId)

              let boxClass = 'border-border/80 bg-muted/40 text-muted-foreground'
              if (isAns) boxClass = 'border-primary bg-primary/15 text-primary font-bold'
              if (isMarked)
                boxClass = 'border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
              if (isCurrent) boxClass += ' ring-2 ring-primary ring-offset-1 font-black text-foreground'

              return (
                <button
                  key={qId}
                  type="button"
                  onClick={() => {
                    onSelectIndex(idx)
                    if (onCloseMobileModal) onCloseMobileModal()
                  }}
                  className={`relative flex h-10 items-center justify-center rounded-xl border text-xs transition cursor-pointer ${boxClass}`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hidden lg:block">
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-foreground">Questions</h3>
          <span className="text-[11px] text-muted-foreground font-semibold">
            {answeredCount}/{totalQuestions} done
          </span>
        </div>

        <div className="max-h-60 overflow-y-auto pr-1 grid grid-cols-5 gap-1.5 scrollbar-thin">
          {questions.map((q, idx) => {
            const qId = q.question_id || q.id || `q-${idx}`
            const isCurrent = idx === currentIndex
            const isAns = Boolean(userAnswers[qId]?.selected_answer)
            const isMarked = markedIds.has(qId)

            let boxClass = 'border-border/80 bg-muted/40 text-muted-foreground'
            if (isAns) boxClass = 'border-primary bg-primary/15 text-primary font-bold'
            if (isMarked)
              boxClass = 'border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
            if (isCurrent) boxClass += ' ring-2 ring-primary ring-offset-1 font-black text-foreground'

            return (
              <button
                key={qId}
                type="button"
                onClick={() => onSelectIndex(idx)}
                className={`relative flex h-8 items-center justify-center rounded-lg border text-[11px] transition cursor-pointer ${boxClass}`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
