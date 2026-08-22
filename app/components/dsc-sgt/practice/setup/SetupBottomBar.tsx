'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/SetupBottomBar.tsx
// ============================================================

import React from 'react'
import { Play } from 'lucide-react'

interface SetupBottomBarProps {
  subject: string
  finalQuestionCount: number
  instantFeedback: boolean
  totalAvailable: number
  isLoading: boolean
  onStart: () => void
}

export default function SetupBottomBar({
  subject,
  finalQuestionCount,
  instantFeedback,
  totalAvailable,
  isLoading,
  onStart,
}: SetupBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl sm:static sm:p-0 sm:bg-transparent sm:border-0 sm:shadow-none">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <div className="hidden sm:block text-xs">
          <span className="font-black text-foreground">{subject} Practice</span>
          <p className="text-[11px] text-muted-foreground">
            {finalQuestionCount} Questions • {instantFeedback ? 'Instant Feedback' : 'Results at End'}
          </p>
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={isLoading || totalAvailable === 0}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary/90 px-8 py-3.5 text-sm font-black text-primary-foreground shadow-lg hover:shadow-primary/20 active:scale-98 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : totalAvailable === 0 ? (
            <span className="opacity-75">No Questions Available Currently</span>
          ) : (
            <>
              <Play className="h-4 w-4 fill-primary-foreground" />
              <span>Start Practice ({finalQuestionCount} Qs)</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
