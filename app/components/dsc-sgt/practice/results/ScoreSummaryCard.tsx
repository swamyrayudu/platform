'use client'

// ============================================================
// app/components/dsc-sgt/practice/results/ScoreSummaryCard.tsx
// ============================================================

import React from 'react'
import { Trophy } from 'lucide-react'
import type { PracticeResultSummary } from '@/types/practice'

interface ScoreSummaryCardProps {
  results: PracticeResultSummary
}

export default function ScoreSummaryCard({ results }: ScoreSummaryCardProps) {
  return (
    <div className="rounded-3xl border border-border/80 bg-gradient-to-b from-card to-card/60 p-6 sm:p-8 shadow-xs text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
        <Trophy className="h-8 w-8" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-foreground">Practice Complete 🎉</h1>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1">
        {results.subject} ({results.medium.toUpperCase()} Medium) • {results.mode.replace('_', ' ').toUpperCase()}
      </p>

      {/* Score */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
        <div className="flex flex-col items-center">
          <span className="text-4xl sm:text-5xl font-black text-foreground">
            {results.score} / {results.total_questions}
          </span>
          <span className="text-xs font-bold text-muted-foreground mt-1">
            Score ({results.accuracy_pct}%)
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-xs">
        <div className="rounded-2xl border border-border bg-emerald-500/5 p-3.5">
          <span className="text-muted-foreground block">Correct</span>
          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {results.correct_count}
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-destructive/5 p-3.5">
          <span className="text-muted-foreground block">Incorrect</span>
          <span className="text-lg font-black text-destructive mt-0.5 block">
            {results.incorrect_count}
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-muted/40 p-3.5">
          <span className="text-muted-foreground block">Skipped</span>
          <span className="text-lg font-black text-muted-foreground mt-0.5 block">
            {results.skipped_count}
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-primary/5 p-3.5">
          <span className="text-muted-foreground block">Avg Time / Q</span>
          <span className="text-lg font-black text-primary mt-0.5 block">
            {results.avg_time_per_question_seconds}s
          </span>
        </div>
      </div>
    </div>
  )
}
