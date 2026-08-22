'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/PracticeModeSelector.tsx
// ============================================================

import React from 'react'
import type { PracticeMode } from '@/types/practice'

interface PracticeModeSelectorProps {
  practiceMode: PracticeMode
  instantFeedback: boolean
  onSetPracticeMode: (mode: PracticeMode) => void
  onToggleInstantFeedback: (val: boolean) => void
}

export default function PracticeModeSelector({
  practiceMode,
  instantFeedback,
  onSetPracticeMode,
  onToggleInstantFeedback,
}: PracticeModeSelectorProps) {
  const MODES = [
    {
      id: 'balanced' as const,
      title: '⚡ Smart Balanced',
      desc: 'Mixes topics & difficulty evenly (Best for daily practice)',
    },
    {
      id: 'weak_areas' as const,
      title: '🎯 Weak Areas',
      desc: 'Focuses on your previously missed topics',
    },
    {
      id: 'new_questions' as const,
      title: '🔄 New Questions',
      desc: 'Discovers fresh questions you have not attempted',
    },
  ]

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
            4
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground">
            Practice Mode & Feedback
          </h2>
        </div>
      </div>

      {/* 3 Simple Mode Cards */}
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => {
          const isSelected = practiceMode === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSetPracticeMode(m.id)}
              className={`p-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground font-bold shadow-xs'
                  : 'border-border/80 bg-card text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              <div className="text-xs sm:text-sm font-bold text-foreground">{m.title}</div>
              <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{m.desc}</div>
            </button>
          )
        })}
      </div>

      {/* Instant Feedback Switch */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-muted/20">
        <div>
          <div className="text-xs font-bold text-foreground">Instant Answer & Explanation</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Shows correct answer and detailed explanation right after each question
          </div>
        </div>

        <button
          type="button"
          onClick={() => onToggleInstantFeedback(!instantFeedback)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
            instantFeedback ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
              instantFeedback ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
