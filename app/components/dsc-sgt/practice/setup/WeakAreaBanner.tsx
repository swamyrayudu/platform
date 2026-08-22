'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/WeakAreaBanner.tsx
// ============================================================

import React from 'react'
import { Flame } from 'lucide-react'
import type { WeakAreaRecommendation } from '@/types/practice'

interface WeakAreaBannerProps {
  weakRecommendations: WeakAreaRecommendation[]
  onQuickRetry: (topic?: string, subject?: string) => void
}

export default function WeakAreaBanner({
  weakRecommendations,
  onQuickRetry,
}: WeakAreaBannerProps) {
  if (weakRecommendations.length === 0) return null

  const topWeak = weakRecommendations[0]

  return (
    <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <Flame className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="truncate text-foreground font-semibold">
          Weak Area: <strong>{topWeak.topic}</strong> ({topWeak.accuracy_pct}%)
        </span>
      </div>
      <button
        type="button"
        onClick={() => onQuickRetry(topWeak.topic, topWeak.subject)}
        className="rounded-lg bg-amber-500 hover:bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white shrink-0 cursor-pointer shadow-xs"
      >
        Practice
      </button>
    </div>
  )
}
