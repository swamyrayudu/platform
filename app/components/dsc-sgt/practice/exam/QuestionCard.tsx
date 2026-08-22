'use client'

// ============================================================
// app/components/dsc-sgt/practice/exam/QuestionCard.tsx
// ============================================================

import React from 'react'
import { Flag } from 'lucide-react'
import type { PracticeQuestion } from '@/types/practice'

interface QuestionCardProps {
  currentQ: PracticeQuestion
  currentIndex: number
  isMarked: boolean
  onToggleMarkForReview: () => void
}

export default function QuestionCard({
  currentQ,
  currentIndex,
  isMarked,
  onToggleMarkForReview,
}: QuestionCardProps) {
  return (
    <div>
      {/* Header badges */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded-lg bg-primary/10 px-2.5 py-0.5 text-xs font-black text-primary">
            Q {currentIndex + 1}
          </span>

          <span className="text-xs text-muted-foreground font-semibold">
            {currentQ.topic}
          </span>
        </div>

        {/* Mark for review button */}
        <button
          type="button"
          onClick={onToggleMarkForReview}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
            isMarked
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Flag className={`h-3 w-3 ${isMarked ? 'fill-amber-500' : ''}`} />
          <span>{isMarked ? 'Marked' : 'Mark'}</span>
        </button>
      </div>

      {/* Question Text */}
      <div className="mt-4">
        <p className="text-base sm:text-lg font-bold text-foreground leading-relaxed">
          {currentQ.question}
        </p>
      </div>
    </div>
  )
}
