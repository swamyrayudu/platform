'use client'

// ============================================================
// app/components/dsc-sgt/practice/PracticeHistory.tsx
// ============================================================
// Student Practice History & Past Performance Archive Orchestrator
// ============================================================

import React, { useState, useEffect } from 'react'
import { History, ArrowLeft } from 'lucide-react'
import type { PracticeHistoryItem } from '@/types/practice'
import { HistorySessionCard, HistoryEmptyState } from './history'

interface PracticeHistoryProps {
  onBackToSetup: () => void
  onReviewSession: (sessionId: string) => void
  onRetryIncorrect: (sessionId: string) => void
}

export default function PracticeHistory({
  onBackToSetup,
  onReviewSession,
  onRetryIncorrect,
}: PracticeHistoryProps) {
  const [history, setHistory] = useState<PracticeHistoryItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetch('/api/dsc-sgt/practice/history')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.history) {
          setHistory(data.history)
        }
      })
      .catch((err) => console.error('Failed to load history:', err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToSetup}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-accent transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Practice Setup</span>
        </button>

        <h1 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Practice History
        </h1>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-border bg-card p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
          <p className="text-xs text-muted-foreground font-semibold">Loading practice history...</p>
        </div>
      ) : history.length === 0 ? (
        <HistoryEmptyState onBackToSetup={onBackToSetup} />
      ) : (
        <div className="grid gap-3.5">
          {history.map((item) => (
            <HistorySessionCard
              key={item.id}
              item={item}
              onReviewSession={onReviewSession}
              onRetryIncorrect={onRetryIncorrect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
