'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/AdvancedFilters.tsx
// ============================================================

import React from 'react'
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'

interface AdvancedFiltersProps {
  showAdvanced: boolean
  selectedClasses: string[]
  selectedDifficulties: string[]
  hasTimer: boolean
  onToggleShowAdvanced: () => void
  onSelectClass: (cls: string) => void
  onSelectDifficulty: (diff: string) => void
  onToggleTimer: (val: boolean) => void
}

export default function AdvancedFilters({
  showAdvanced,
  selectedClasses,
  selectedDifficulties,
  hasTimer,
  onToggleShowAdvanced,
  onSelectClass,
  onSelectDifficulty,
  onToggleTimer,
}: AdvancedFiltersProps) {
  const CLASSES = ['All', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT']
  const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard']

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
      <button
        type="button"
        onClick={onToggleShowAdvanced}
        className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <span>More Options (Class Level, Difficulty, Timer)</span>
        </span>
        {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-border/60 space-y-4 animate-in fade-in-50 text-xs">
          {/* Class Level */}
          <div>
            <span className="font-bold text-foreground block mb-2">Class Level:</span>
            <div className="flex flex-wrap gap-1.5">
              {CLASSES.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => onSelectClass(cls)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    selectedClasses.includes(cls)
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <span className="font-bold text-foreground block mb-2">Difficulty:</span>
            <div className="flex gap-2">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => onSelectDifficulty(diff)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    selectedDifficulties.includes(diff)
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Timer Toggle */}
          <div className="flex items-center justify-between pt-2">
            <span className="font-bold text-foreground">Practice Timer (Countdown):</span>
            <button
              type="button"
              onClick={() => onToggleTimer(!hasTimer)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                hasTimer ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                  hasTimer ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
