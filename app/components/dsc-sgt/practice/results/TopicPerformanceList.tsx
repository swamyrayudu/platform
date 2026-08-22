'use client'

// ============================================================
// app/components/dsc-sgt/practice/results/TopicPerformanceList.tsx
// ============================================================

import React from 'react'
import { Check, AlertTriangle } from 'lucide-react'
import type { TopicPerformance } from '@/types/practice'

interface TopicPerformanceListProps {
  topicBreakdown: TopicPerformance[]
}

export default function TopicPerformanceList({ topicBreakdown }: TopicPerformanceListProps) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
      <h2 className="text-base font-bold text-foreground mb-4">Topic-Wise Performance</h2>

      <div className="space-y-4">
        {topicBreakdown.map((topic, i) => (
          <div key={i} className="rounded-2xl border border-border/60 p-4 bg-muted/10">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-foreground">{topic.topic}</span>
                {topic.is_weak && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> Needs Practice
                  </span>
                )}
                {topic.is_mastered && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Mastered
                  </span>
                )}
              </div>

              <div className="text-xs font-bold text-foreground">
                {topic.correct} / {topic.total_questions} ({topic.accuracy_pct}%)
              </div>
            </div>

            {/* Accuracy progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  topic.accuracy_pct >= 80
                    ? 'bg-emerald-500'
                    : topic.accuracy_pct >= 50
                    ? 'bg-amber-500'
                    : 'bg-destructive'
                }`}
                style={{ width: `${topic.accuracy_pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
