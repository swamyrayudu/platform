'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/QuestionCountSelector.tsx
// ============================================================

import React from 'react'
import { Crown, Lock } from 'lucide-react'
import { toast } from 'sonner'

interface QuestionCountSelectorProps {
  questionCount: number
  finalQuestionCount: number
  isCustomCount: boolean
  customCountInput: string
  isPremium?: boolean
  onSetQuestionCount: (count: number) => void
  onSetIsCustomCount: (val: boolean) => void
  onCustomInputChange: (val: string) => void
  onOpenUpgradeModal?: () => void
}

export default function QuestionCountSelector({
  questionCount,
  finalQuestionCount,
  isCustomCount,
  customCountInput,
  isPremium = false,
  onSetQuestionCount,
  onSetIsCustomCount,
  onCustomInputChange,
  onOpenUpgradeModal,
}: QuestionCountSelectorProps) {
  const PRESETS = [
    { count: 10, label: '10 Qs', desc: 'Quick 5-min', proOnly: false },
    { count: 25, label: '25 Qs', desc: isPremium ? 'Recommended' : 'Free Max Limit', proOnly: false },
    { count: 50, label: '50 Qs', desc: 'Deep Practice', proOnly: true },
  ]

  const handleSelectPreset = (item: (typeof PRESETS)[number]) => {
    if (item.proOnly && !isPremium) {
      toast.info('👑 DSC Pro Feature', {
        description: 'Deep practice sessions (50+ questions) require a Pro subscription.',
      })
      if (onOpenUpgradeModal) onOpenUpgradeModal()
      return
    }
    onSetQuestionCount(item.count)
    onSetIsCustomCount(false)
  }

  const handleCustomChange = (val: string) => {
    onCustomInputChange(val)
    const n = parseInt(val, 10)
    if (!isNaN(n) && n > 0) {
      if (!isPremium && n > 25) {
        toast.warning('Free Tier Limit: Max 25 questions', {
          description: 'Capped at 25 questions. Upgrade to Pro for up to 150 questions!',
        })
        onSetQuestionCount(25)
      } else {
        onSetQuestionCount(Math.min(n, isPremium ? 150 : 25))
      }
    }
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            3
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Number of Questions</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isPremium && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Free: Max 25 Qs
            </span>
          )}
          <span className="text-xs font-bold text-muted-foreground">{finalQuestionCount} Qs</span>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {PRESETS.map((item) => {
          const isSelected = questionCount === item.count && !isCustomCount
          const isLocked = item.proOnly && !isPremium

          return (
            <button
              key={item.count}
              type="button"
              onClick={() => handleSelectPreset(item)}
              className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 text-center transition cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : isLocked
                  ? 'border-border/60 bg-muted/30 text-muted-foreground hover:border-amber-500/50'
                  : 'border-border/80 bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {isLocked && (
                <span className="absolute -top-2 -right-1 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-xs">
                  <Crown className="h-2.5 w-2.5" /> PRO
                </span>
              )}
              <span className="text-xs sm:text-sm font-semibold flex items-center gap-1">
                {item.label}
                {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </span>
              <span className="text-[11px] opacity-75 mt-0.5">{item.desc}</span>
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
          <span className="text-xs sm:text-sm font-semibold">Custom</span>
          <span className="text-[11px] opacity-75 mt-0.5">
            {isPremium ? 'Up to 150' : 'Max 25'}
          </span>
        </button>
      </div>

      {isCustomCount && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 pt-2 animate-in fade-in-50 border-t border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Enter count:</span>
            <input
              type="number"
              min="5"
              max={isPremium ? 150 : 25}
              placeholder={isPremium ? 'e.g. 30' : 'Max 25'}
              value={customCountInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-24 rounded-xl border border-primary bg-primary/5 px-3 py-1.5 text-xs font-bold text-foreground text-center focus:outline-none"
            />
          </div>
          <span className="text-[11px] text-muted-foreground">
            {!isPremium ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Free plan allows up to 25 questions. Upgrade to Pro for up to 150 questions.
              </span>
            ) : (
              <span>Pro member: choose up to 150 questions per session.</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}
