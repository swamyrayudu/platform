'use client'

// ============================================================
// app/components/dsc-sgt/practice/exam/ExamBottomNav.tsx
// ============================================================

import React from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react'

interface ExamBottomNavProps {
  currentIndex: number
  totalQuestions: number
  onPrev: () => void
  onNext: () => void
  onOpenMobileNavigator: () => void
}

export default function ExamBottomNav({
  currentIndex,
  totalQuestions,
  onPrev,
  onNext,
  onOpenMobileNavigator,
}: ExamBottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 p-2.5 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl sm:hidden">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-foreground disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Prev</span>
        </button>

        <button
          type="button"
          onClick={onOpenMobileNavigator}
          className="inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-xs font-bold text-foreground cursor-pointer"
        >
          <LayoutGrid className="h-4 w-4 text-primary" />
          <span>
            {currentIndex + 1}/{totalQuestions}
          </span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground cursor-pointer shadow-xs"
        >
          <span>{currentIndex === totalQuestions - 1 ? 'Finish' : 'Next'}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
