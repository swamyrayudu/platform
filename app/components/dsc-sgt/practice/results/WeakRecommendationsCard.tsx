'use client'

// ============================================================
// app/components/dsc-sgt/practice/results/WeakRecommendationsCard.tsx
// ============================================================

import React from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import type { WeakAreaRecommendation } from '@/types/practice'

interface WeakRecommendationsCardProps {
  weakRecommendations: WeakAreaRecommendation[]
  subject: string
  onPracticeTopic: (topic: string, subject: string) => void
}

export default function WeakRecommendationsCard({
  weakRecommendations,
  subject,
  onPracticeTopic,
}: WeakRecommendationsCardProps) {
  if (weakRecommendations.length === 0) return null

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold text-foreground">Recommended Next Focus</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {weakRecommendations.slice(0, 2).map((rec, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-primary/20 bg-primary/5"
          >
            <div>
              <span className="text-xs sm:text-sm font-bold text-foreground block">
                {rec.topic}
              </span>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                {rec.incorrect_count} missed • {rec.accuracy_pct}% accuracy
              </span>
            </div>

            <button
              type="button"
              onClick={() => onPracticeTopic(rec.topic, subject)}
              className="inline-flex items-center gap-1 rounded-xl bg-primary hover:bg-primary/90 px-3.5 py-2 text-xs font-black text-primary-foreground transition cursor-pointer shadow-xs"
            >
              <span>Practice</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
