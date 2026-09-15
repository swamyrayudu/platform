'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/QuestionCountSelector.tsx
// ============================================================

import React from 'react'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'

interface QuestionCountSelectorProps {
  questionCount: number
  isPremium?: boolean
  onSetQuestionCount: (count: number) => void
  onOpenUpgradeModal?: () => void
}

export default function QuestionCountSelector({
  questionCount,
  isPremium = false,
  onSetQuestionCount,
  onOpenUpgradeModal,
}: QuestionCountSelectorProps) {
  // Three clear choices. "Custom" and its number box were removed: a free
  // candidate could only ever pick 25 anyway, and typing a number is a
  // decision nobody needs to make before practising.
  const PRESETS = [
    { count: 10, proOnly: false },
    { count: 25, proOnly: false },
    { count: 50, proOnly: true },
  ]

  const handleSelectPreset = (item: (typeof PRESETS)[number]) => {
    if (item.proOnly && !isPremium) {
      toast.info('50 questions is a Pro feature', {
        description: 'Upgrade to practise longer sessions.',
      })
      if (onOpenUpgradeModal) onOpenUpgradeModal()
      return
    }
    onSetQuestionCount(item.count)
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
      {/* The title and the note sit on one line only when there is room for
          one. Forcing them together on a phone squeezed the heading onto two
          lines and pushed the note into the gap. */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            3
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Number of Questions</h2>
        </div>
        {!isPremium && (
          <p className="mt-1.5 pl-8 text-[11px] text-muted-foreground">
            Free plan: up to 25 questions in one session.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {PRESETS.map((item) => {
          const isSelected = questionCount === item.count
          const isLocked = item.proOnly && !isPremium

          return (
            <button
              key={item.count}
              type="button"
              onClick={() => handleSelectPreset(item)}
              aria-pressed={isSelected}
              className={`relative flex min-h-20 flex-col items-center justify-center rounded-2xl border p-3 transition ${
                isSelected
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-card text-foreground hover:bg-accent/40'
              } ${isLocked ? 'opacity-70' : ''}`}
            >
              {isLocked && (
                <Lock className="absolute right-2 top-2 h-3 w-3 text-muted-foreground" aria-hidden />
              )}
              <span className="text-xl font-bold leading-none">{item.count}</span>
              <span className="mt-1 text-[11px] text-muted-foreground">questions</span>
            </button>
          )
        })}
      </div>

    </div>
  )
}
