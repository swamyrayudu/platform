'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/TopicSelector.tsx
// ============================================================

import React from 'react'
import { Check, Crown, Lock } from 'lucide-react'
import { toast } from 'sonner'
import type { DynamicFilterOptions } from '@/types/practice'

interface TopicSelectorProps {
  subject: string
  topicMode: 'all' | 'custom'
  selectedTopics: string[]
  dynamicOptions: DynamicFilterOptions | null
  isPremium?: boolean
  onSetTopicMode: (mode: 'all' | 'custom') => void
  onToggleTopic: (topicName: string) => void
  onOpenUpgradeModal?: () => void
}

export default function TopicSelector({
  subject,
  topicMode,
  selectedTopics,
  dynamicOptions,
  isPremium = false,
  onSetTopicMode,
  onToggleTopic,
  onOpenUpgradeModal,
}: TopicSelectorProps) {
  const topicsList = dynamicOptions?.available_topics || []

  const handleSelectTopicsClick = () => {
    if (!isPremium) {
      toast.info('👑 DSC Pro Feature', {
        description: 'Topic-wise practice requires a Pro subscription. Upgrade to choose specific chapters and topics!',
      })
      onOpenUpgradeModal?.()
      return
    }
    onSetTopicMode('custom')
  }

  const handleTopicPillClick = (topicName: string) => {
    if (!isPremium) {
      toast.info('👑 DSC Pro Feature', {
        description: 'Topic-wise selection is a Pro feature. Upgrade to unlock chapter drills!',
      })
      onOpenUpgradeModal?.()
      return
    }
    onToggleTopic(topicName)
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            2
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Choose Topics</h2>
        </div>

        {/* Right badge: show topic count for premium, lock badge for free */}
        {isPremium ? (
          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
            ({topicMode === 'all' ? 'All' : selectedTopics.length} / {topicsList.length} Topics)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <Crown className="h-3 w-3 fill-amber-500 text-amber-500" />
            Topic-Wise is Pro
          </span>
        )}
      </div>

      {/* ── Mode selector buttons ── */}
      <div className="grid grid-cols-2 gap-2.5 mb-2">
        {/* All Topics — always available */}
        <button
          type="button"
          onClick={() => onSetTopicMode('all')}
          className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 text-center transition cursor-pointer ${
            topicMode === 'all'
              ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
              : 'border-border/80 bg-muted/30 text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-xs sm:text-sm font-semibold">🎯 All Topics</span>
          <span className="text-[11px] opacity-75 mt-0.5">Full {subject} Syllabus</span>
        </button>

        {/* Select Topics — clean for premium, locked for free */}
        <button
          type="button"
          onClick={handleSelectTopicsClick}
          className={`relative flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 text-center transition cursor-pointer ${
            isPremium
              ? topicMode === 'custom'
                ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                : 'border-border/80 bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground'
              : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-amber-500/40 hover:bg-amber-500/5'
          }`}
        >
          {/* Lock badge — only for non-premium */}
          {!isPremium && (
            <span className="absolute -top-2.5 -right-1.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              <Crown className="h-2.5 w-2.5 fill-white" />
              PRO
            </span>
          )}

          <span className="text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5">
            📑 Select Topics
            {!isPremium && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          </span>
          <span className="text-[11px] mt-0.5 text-muted-foreground">
            {isPremium ? 'Pick specific chapters' : 'Pro only • Pick chapters'}
          </span>
        </button>
      </div>

      {/* ── Non-Premium upgrade banner ── */}
      {!isPremium && (
        <div className="mt-3.5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/8 to-transparent p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">Chapter &amp; Topic Selection</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Upgrade to Pro to drill into specific {subject} topics and chapters.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenUpgradeModal}
            className="inline-flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-3.5 text-xs font-semibold text-white transition hover:brightness-105 active:scale-98 sm:min-h-0 sm:w-auto sm:py-2"
          >
            <Crown className="h-3.5 w-3.5 fill-white" />
            <span>Unlock with Pro</span>
          </button>
        </div>
      )}

      {/* ── Topic pills — shown for premium in custom mode ── */}
      {isPremium && topicMode === 'custom' && (
        <div className="pt-3 animate-in fade-in-50">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-semibold text-muted-foreground">
              Tap topics to include in your practice:
            </p>
            {selectedTopics.length > 0 && (
              <button
                type="button"
                onClick={() => onSetTopicMode('all')}
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
              >
                Reset to All
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {topicsList.map((t) => {
              const isSelected = selectedTopics.includes(t.name)
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => handleTopicPillClick(t.name)}
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
          {selectedTopics.length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              💡 Tap one or more topics to target your session — or leave all unselected to practice the full syllabus.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
