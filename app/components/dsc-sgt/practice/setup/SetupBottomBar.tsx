'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/SetupBottomBar.tsx
// ============================================================

import { BOTTOM_NAV_OFFSET } from '@/app/components/dsc-sgt/DscBottomNav'
import React from 'react'
import { Play, Crown, Lock } from 'lucide-react'

interface SetupBottomBarProps {
  subject: string
  finalQuestionCount: number
  instantFeedback: boolean
  totalAvailable: number
  isLoading: boolean
  canPractice?: boolean
  isPremium?: boolean
  onStart: () => void
  onOpenUpgradeModal?: () => void
}

export default function SetupBottomBar({
  subject,
  finalQuestionCount,
  instantFeedback,
  totalAvailable,
  isLoading,
  canPractice = true,
  isPremium = false,
  onStart,
  onOpenUpgradeModal,
}: SetupBottomBarProps) {
  // Free trial exhausted: show the same practice button but with a lock
  // Clicking it opens the premium modal — the session never starts
  const trialExhausted = !canPractice && !isPremium

  return (
    // bottom is the height of the app's tab bar, not 0: this sits directly on
    // top of it otherwise, and the Start button becomes unreachable. Above sm
    // the bar is in normal flow and the offset does not apply.
    <div
      className="fixed left-0 right-0 z-30 p-3 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl sm:static sm:p-0 sm:bg-transparent sm:border-0 sm:shadow-none"
      style={{ bottom: BOTTOM_NAV_OFFSET }}
    >
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <div className="hidden sm:block text-xs">
          <span className="font-semibold text-foreground">{subject} Practice</span>
          <p className="text-[11px] text-muted-foreground">
            {finalQuestionCount} Questions • {instantFeedback ? 'Instant Feedback' : 'Results at End'}
            {trialExhausted && (
              <span className="ml-2 text-amber-500 font-semibold">· Pro required</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={trialExhausted ? onOpenUpgradeModal : onStart}
          disabled={isLoading || totalAvailable === 0}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl px-8 py-3.5 text-sm font-semibold shadow-lg active:scale-98 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            trialExhausted
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-primary text-white hover:brightness-105 shadow-amber-500/20'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/20'
          }`}
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : totalAvailable === 0 ? (
            <span className="opacity-75">No Questions Available Currently</span>
          ) : trialExhausted ? (
            <>
              <Lock className="h-4 w-4" />
              <span>Start Practice ({finalQuestionCount} Qs)</span>
              <Crown className="h-3.5 w-3.5 fill-white opacity-80" />
            </>
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
