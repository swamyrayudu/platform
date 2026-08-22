'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/TopicSelector.tsx
// ============================================================

import React from 'react'
import { Check } from 'lucide-react'
import type { DynamicFilterOptions } from '@/types/practice'

interface TopicSelectorProps {
  subject: string
  topicMode: 'all' | 'custom'
  selectedTopics: string[]
  dynamicOptions: DynamicFilterOptions | null
  onSetTopicMode: (mode: 'all' | 'custom') => void
  onToggleTopic: (topicName: string) => void
}

export default function TopicSelector({
  subject,
  topicMode,
  selectedTopics,
  dynamicOptions,
  onSetTopicMode,
  onToggleTopic,
}: TopicSelectorProps) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
            2
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Choose Topics</h2>
        </div>
      </div>

      {/* 2 Main Choices: Full Subject or Specific */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <button
          type="button"
          onClick={() => onSetTopicMode('all')}
          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 text-center transition cursor-pointer ${
            topicMode === 'all'
              ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
              : 'border-border/80 bg-muted/30 text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-xs sm:text-sm font-black">🎯 All Topics</span>
          <span className="text-[10px] opacity-75 mt-0.5">Full {subject} Syllabus</span>
        </button>

        <button
          type="button"
          onClick={() => onSetTopicMode('custom')}
          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 text-center transition cursor-pointer ${
            topicMode === 'custom'
              ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
              : 'border-border/80 bg-muted/30 text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-xs sm:text-sm font-black">📑 Select Topics</span>
          <span className="text-[10px] opacity-75 mt-0.5">Pick specific chapters</span>
        </button>
      </div>

      {/* Dynamic Topic Pills */}
      {topicMode === 'custom' && (
        <div className="pt-2 animate-in fade-in-50">
          <p className="text-xs font-semibold text-muted-foreground mb-2.5">
            Tap topics to include in your practice:
          </p>
          <div className="flex flex-wrap gap-2">
            {(dynamicOptions?.available_topics || []).map((t) => {
              const isSelected = selectedTopics.includes(t.name)
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => onToggleTopic(t.name)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  <span>{t.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
