'use client'

// ============================================================
// app/components/dsc-sgt/practice/results/ResultsActionButtons.tsx
// ============================================================

import React from 'react'
import { RotateCcw, Zap, Sparkles } from 'lucide-react'
import type { TopicPerformance } from '@/types/practice'

interface ResultsActionButtonsProps {
  hasIncorrect: boolean
  weakestTopic: TopicPerformance | null
  subject: string
  onRetryIncorrect: () => void
  onPracticeTopic: (topic: string, subject: string) => void
  onStartNewPractice: () => void
}

export default function ResultsActionButtons({
  hasIncorrect,
  weakestTopic,
  subject,
  onRetryIncorrect,
  onPracticeTopic,
  onStartNewPractice,
}: ResultsActionButtonsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
      {hasIncorrect && (
        <button
          type="button"
          onClick={onRetryIncorrect}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 px-6 py-3.5 text-xs sm:text-sm font-bold text-destructive transition cursor-pointer shadow-xs"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Retry Missed Questions</span>
        </button>
      )}

      {weakestTopic && (
        <button
          type="button"
          onClick={() => onPracticeTopic(weakestTopic.topic, subject)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-6 py-3.5 text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 transition cursor-pointer shadow-xs"
        >
          <Zap className="h-4 w-4" />
          <span>Practice Weak Topic ({weakestTopic.topic})</span>
        </button>
      )}

      <button
        type="button"
        onClick={onStartNewPractice}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary/90 px-8 py-3.5 text-xs sm:text-sm font-black text-primary-foreground transition cursor-pointer shadow-xs"
      >
        <Sparkles className="h-4 w-4" />
        <span>New Practice Session</span>
      </button>
    </div>
  )
}
