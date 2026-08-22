'use client'

// ============================================================
// app/components/dsc-sgt/practice/exam/ExplanationCard.tsx
// ============================================================

import React from 'react'
import { Lightbulb } from 'lucide-react'

interface ExplanationCardProps {
  isInstant: boolean
  currentAnswer: 'A' | 'B' | 'C' | 'D' | null | undefined
  currentFeedback: { is_correct: boolean; correct_answer: string; explanation: string | null } | null
}

export default function ExplanationCard({
  isInstant,
  currentAnswer,
  currentFeedback,
}: ExplanationCardProps) {
  if (!isInstant || !currentAnswer || !currentFeedback) return null

  return (
    <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 animate-in fade-in-50">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
        <Lightbulb className="h-4 w-4" />
        <span>
          {currentFeedback.is_correct ? '✓ Correct Answer!' : '❌ Concept Explanation:'}
        </span>
      </div>
      <div className="mt-1 text-xs font-bold text-foreground">
        Correct Choice: Option {currentFeedback.correct_answer}
      </div>
      <p className="mt-1.5 text-xs sm:text-sm text-foreground whitespace-pre-line leading-relaxed">
        {currentFeedback.explanation || 'Official SCERT verified key.'}
      </p>
    </div>
  )
}
