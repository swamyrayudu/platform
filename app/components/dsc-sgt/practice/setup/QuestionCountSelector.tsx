'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/QuestionCountSelector.tsx
// ============================================================

import React from 'react'

interface QuestionCountSelectorProps {
  questionCount: number
  finalQuestionCount: number
  isCustomCount: boolean
  customCountInput: string
  onSetQuestionCount: (count: number) => void
  onSetIsCustomCount: (val: boolean) => void
  onCustomInputChange: (val: string) => void
}

export default function QuestionCountSelector({
  questionCount,
  finalQuestionCount,
  isCustomCount,
  customCountInput,
  onSetQuestionCount,
  onSetIsCustomCount,
  onCustomInputChange,
}: QuestionCountSelectorProps) {
  const PRESETS = [
    { count: 10, label: '10 Qs', desc: 'Quick 5-min' },
    { count: 25, label: '25 Qs', desc: 'Recommended' },
    { count: 50, label: '50 Qs', desc: 'Deep Practice' },
  ]

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
            3
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Number of Questions</h2>
        </div>
        <span className="text-xs font-bold text-muted-foreground">{finalQuestionCount} Qs</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {PRESETS.map((item) => {
          const isSelected = questionCount === item.count && !isCustomCount
          return (
            <button
              key={item.count}
              type="button"
              onClick={() => {
                onSetQuestionCount(item.count)
                onSetIsCustomCount(false)
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 text-center transition cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-border/80 bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="text-xs sm:text-sm font-black">{item.label}</span>
              <span className="text-[10px] opacity-75 mt-0.5">{item.desc}</span>
            </button>
          )
        })}

        {/* Custom Input pill */}
        <button
          type="button"
          onClick={() => onSetIsCustomCount(true)}
          className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 text-center transition cursor-pointer ${
            isCustomCount
              ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
              : 'border-border/80 bg-card text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-xs sm:text-sm font-black">Custom</span>
          <span className="text-[10px] opacity-75 mt-0.5">Enter count</span>
        </button>
      </div>

      {isCustomCount && (
        <div className="mt-3 flex items-center gap-2 pt-2 animate-in fade-in-50">
          <span className="text-xs font-semibold text-muted-foreground">Enter count:</span>
          <input
            type="number"
            min="5"
            max={150}
            placeholder="e.g. 20"
            value={customCountInput}
            onChange={(e) => onCustomInputChange(e.target.value)}
            className="w-24 rounded-xl border border-primary bg-primary/5 px-3 py-1.5 text-xs font-bold text-foreground text-center focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
