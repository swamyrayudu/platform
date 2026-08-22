'use client'

// ============================================================
// app/components/dsc-sgt/practice/history/HistoryEmptyState.tsx
// ============================================================

import React from 'react'
import { History } from 'lucide-react'

interface HistoryEmptyStateProps {
  onBackToSetup: () => void
}

export default function HistoryEmptyState({ onBackToSetup }: HistoryEmptyStateProps) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border border-border bg-card p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
        <History className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-bold text-foreground">No Practice Sessions Yet</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        Launch your first personalized DSC practice test to start tracking performance metrics and weak areas.
      </p>
      <button
        type="button"
        onClick={onBackToSetup}
        className="mt-4 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-xs cursor-pointer"
      >
        Start Practice
      </button>
    </div>
  )
}
