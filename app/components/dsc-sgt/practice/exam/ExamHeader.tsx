'use client'

// ============================================================
// app/components/dsc-sgt/practice/exam/ExamHeader.tsx
// ============================================================

import React from 'react'
import { ArrowLeft, Clock } from 'lucide-react'

interface ExamHeaderProps {
  subject: string
  medium: string
  currentIndex: number
  totalQuestions: number
  elapsedSeconds: number
  onShowExitModal: () => void
  onShowSubmitModal: () => void
}

export default function ExamHeader({
  subject,
  medium,
  currentIndex,
  totalQuestions,
  elapsedSeconds,
  onShowExitModal,
  onShowSubmitModal,
}: ExamHeaderProps) {
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-3xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onShowExitModal}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
          title="Exit Practice"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <h1 className="text-xs sm:text-sm font-black text-foreground truncate">
            {subject} Practice
          </h1>
          <p className="text-[11px] text-muted-foreground truncate">
            Q {currentIndex + 1} of {totalQuestions} • {medium.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Stopwatch & Submit Button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-bold text-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>{formatTime(elapsedSeconds)}</span>
        </div>

        <button
          type="button"
          onClick={onShowSubmitModal}
          className="inline-flex items-center gap-1 rounded-xl bg-primary hover:bg-primary/90 px-3.5 py-1.5 text-xs font-black text-primary-foreground shadow-xs transition cursor-pointer"
        >
          <span>Finish</span>
        </button>
      </div>
    </div>
  )
}
