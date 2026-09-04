import React from 'react'
import { RotateCcw, Zap, Sparkles, Crown } from 'lucide-react'
import type { TopicPerformance } from '@/types/practice'

interface ResultsActionButtonsProps {
  hasIncorrect: boolean
  weakestTopic: TopicPerformance | null
  subject: string
  isPremium?: boolean
  onRetryIncorrect: () => void
  onPracticeTopic: (topic: string, subject: string) => void
  onStartNewPractice: () => void
  onOpenUpgradeModal?: () => void
}

export default function ResultsActionButtons({
  hasIncorrect,
  weakestTopic,
  subject,
  isPremium = false,
  onRetryIncorrect,
  onPracticeTopic,
  onStartNewPractice,
  onOpenUpgradeModal,
}: ResultsActionButtonsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
      {hasIncorrect && (
        <button
          type="button"
          onClick={() => {
            if (!isPremium) onOpenUpgradeModal?.()
            else onRetryIncorrect()
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 px-6 py-3.5 text-xs sm:text-sm font-bold text-destructive transition cursor-pointer shadow-xs"
        >
          {isPremium ? <RotateCcw className="h-4 w-4" /> : <Crown className="h-4 w-4 text-amber-500" />}
          <span>{isPremium ? 'Retry Missed Questions' : 'Retry Missed (Pro Only)'}</span>
        </button>
      )}

      {weakestTopic && (
        <button
          type="button"
          onClick={() => {
            if (!isPremium) onOpenUpgradeModal?.()
            else onPracticeTopic(weakestTopic.topic, subject)
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-6 py-3.5 text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 transition cursor-pointer shadow-xs"
        >
          {isPremium ? <Zap className="h-4 w-4" /> : <Crown className="h-4 w-4 text-amber-500" />}
          <span>
            {isPremium
              ? `Practice Weak Topic (${weakestTopic.topic})`
              : `Practice Weak Topic (Pro Only)`}
          </span>
        </button>
      )}

      {!isPremium ? (
        <button
          type="button"
          onClick={onOpenUpgradeModal}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary hover:brightness-105 px-8 py-3.5 text-xs sm:text-sm font-black text-white transition cursor-pointer shadow-md shadow-amber-500/20"
        >
          <Crown className="h-4 w-4 fill-white" />
          <span>Unlock More Practice with Pro</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onStartNewPractice}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary/90 px-8 py-3.5 text-xs sm:text-sm font-black text-primary-foreground transition cursor-pointer shadow-xs"
        >
          <Sparkles className="h-4 w-4" />
          <span>New Practice Session</span>
        </button>
      )}
    </div>
  )
}
