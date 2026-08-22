'use client'

// ============================================================
// app/components/dsc-sgt/practice/exam/OptionList.tsx
// ============================================================

import React from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import type { PracticeQuestion } from '@/types/practice'

interface OptionListProps {
  currentQ: PracticeQuestion
  currentAnswer: 'A' | 'B' | 'C' | 'D' | null | undefined
  isInstant: boolean
  currentFeedback: { is_correct: boolean; correct_answer: string; explanation: string | null } | null
  onSelectOption: (optKey: 'A' | 'B' | 'C' | 'D') => void
}

export default function OptionList({
  currentQ,
  currentAnswer,
  isInstant,
  currentFeedback,
  onSelectOption,
}: OptionListProps) {
  const options = [
    { key: 'A' as const, text: currentQ.option_a },
    { key: 'B' as const, text: currentQ.option_b },
    { key: 'C' as const, text: currentQ.option_c },
    { key: 'D' as const, text: currentQ.option_d },
  ] as const

  return (
    <div className="mt-5 space-y-2.5">
      {options.map((opt) => {
        const isSelected = currentAnswer === opt.key
        const hasFeedback = Boolean(isInstant && currentAnswer && currentFeedback)
        const isCorrectOpt = hasFeedback && currentFeedback?.correct_answer === opt.key
        const isWrongSelection = hasFeedback && isSelected && !currentFeedback?.is_correct

        let style = 'border-border/80 bg-card hover:border-primary/50 hover:bg-muted/20'
        if (isSelected && !hasFeedback) {
          style = 'border-primary bg-primary/10 ring-1 ring-primary font-semibold'
        }
        if (hasFeedback) {
          if (isCorrectOpt) {
            style = 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500 font-bold'
          } else if (isWrongSelection) {
            style = 'border-destructive bg-destructive/10 ring-1 ring-destructive'
          } else {
            style = 'border-border/60 opacity-60'
          }
        }

        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSelectOption(opt.key)}
            disabled={isInstant && Boolean(currentAnswer)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 sm:p-4 text-left transition-all cursor-pointer disabled:cursor-default ${style}`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black mt-0.5 ${
                hasFeedback && isCorrectOpt
                  ? 'bg-emerald-500 text-white'
                  : hasFeedback && isWrongSelection
                  ? 'bg-destructive text-white'
                  : isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-muted/60 text-muted-foreground'
              }`}
            >
              {opt.key}
            </div>

            <div className="flex-1 text-xs sm:text-sm text-foreground pt-0.5 leading-relaxed">
              {opt.text}
            </div>

            {hasFeedback && isCorrectOpt && (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            )}
            {hasFeedback && isWrongSelection && (
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            )}
          </button>
        )
      })}
    </div>
  )
}
