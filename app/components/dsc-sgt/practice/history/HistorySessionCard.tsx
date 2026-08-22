'use client'

// ============================================================
// app/components/dsc-sgt/practice/history/HistorySessionCard.tsx
// ============================================================

import React from 'react'
import { RotateCcw } from 'lucide-react'
import type { PracticeHistoryItem } from '@/types/practice'

interface HistorySessionCardProps {
  item: PracticeHistoryItem
  onReviewSession: (sessionId: string) => void
  onRetryIncorrect: (sessionId: string) => void
}

export default function HistorySessionCard({
  item,
  onReviewSession,
  onRetryIncorrect,
}: HistorySessionCardProps) {
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return 'Recent'
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:border-primary/40 transition">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{item.subject}</span>
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary capitalize">
            {item.mode.replace('_', ' ')}
          </span>
          <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground uppercase">
            {item.medium}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{item.question_count} Questions</span>
          <span>•</span>
          <span>
            Score:{' '}
            <strong className="text-foreground">
              {item.score} / {item.question_count} ({item.accuracy_pct}%)
            </strong>
          </span>
          <span>•</span>
          <span>{formatDate(item.started_at)}</span>
        </div>

        {item.topics && item.topics.length > 0 && !item.topics.includes('All') && (
          <div className="flex flex-wrap gap-1 pt-1">
            {item.topics.map((t, i) => (
              <span
                key={i}
                className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          type="button"
          onClick={() => onReviewSession(item.id)}
          className="rounded-xl border border-border bg-card hover:bg-accent px-3.5 py-2 text-xs font-bold text-foreground transition cursor-pointer"
        >
          Review Session
        </button>

        {item.accuracy_pct < 100 && (
          <button
            type="button"
            onClick={() => onRetryIncorrect(item.id)}
            className="inline-flex items-center gap-1 rounded-xl bg-primary hover:bg-primary/90 px-3.5 py-2 text-xs font-bold text-primary-foreground transition cursor-pointer shadow-xs"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Retry Missed</span>
          </button>
        )}
      </div>
    </div>
  )
}
