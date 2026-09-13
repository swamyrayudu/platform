'use client'

// ============================================================
// app/components/dsc-sgt/practice/PracticeResults.tsx
// ============================================================
// Detailed Results, Topic Analytics, Weak Topic Recommendations,
// and Comprehensive Question Review Orchestrator
// ============================================================

import React from 'react'
import type { PracticeResultSummary } from '@/types/practice'
import { COPY_GUARD_CLASS, copyGuardProps } from '@/app/components/dsc-sgt/CopyGuard'
import {
  ScoreSummaryCard,
  TopicPerformanceList,
  WeakRecommendationsCard,
  QuestionReviewList,
  ResultsActionButtons,
} from './results'

interface PracticeResultsProps {
  results: PracticeResultSummary
  isPremium?: boolean
  onPracticeTopic: (topic: string, subject: string) => void
  onRetryIncorrect: (topic?: string) => void
  onStartNewPractice: () => void
  onOpenUpgradeModal?: () => void
}

export default function PracticeResults({
  results,
  isPremium = false,
  onPracticeTopic,
  onRetryIncorrect,
  onStartNewPractice,
  onOpenUpgradeModal,
}: PracticeResultsProps) {
  // Weakest topic determination
  const weakTopics = results.topic_breakdown.filter((t) => t.is_weak || t.accuracy_pct < 65)
  const weakestTopic = weakTopics.length > 0 ? weakTopics[0] : null
  const hasIncorrect = results.incorrect_count > 0

  return (
    <div
      className={`space-y-8 max-w-5xl mx-auto ${COPY_GUARD_CLASS}`}
      {...copyGuardProps}
    >
      {/* ── Top Score & Celebration Card ─────────────────────── */}
      <ScoreSummaryCard results={results} />

      {/* ── Topic Performance Breakdown ──────────────────────── */}
      <TopicPerformanceList topicBreakdown={results.topic_breakdown} />

      {/* ── Actionable Weak Topic Recommendations ────────────── */}
      <WeakRecommendationsCard
        weakRecommendations={results.weak_recommendations}
        subject={results.subject}
        isPremium={isPremium}
        onPracticeTopic={onPracticeTopic}
        onOpenUpgradeModal={onOpenUpgradeModal}
      />

      {/* ── Comprehensive Question Review ────────────────────── */}
      <QuestionReviewList questionsReview={results.questions_review} />

      {/* ── Bottom Action Controls ───────────────────────────── */}
      <ResultsActionButtons
        hasIncorrect={hasIncorrect}
        weakestTopic={weakestTopic}
        subject={results.subject}
        isPremium={isPremium}
        onRetryIncorrect={() => onRetryIncorrect(weakestTopic?.topic)}
        onPracticeTopic={onPracticeTopic}
        onStartNewPractice={onStartNewPractice}
        onOpenUpgradeModal={onOpenUpgradeModal}
      />
    </div>
  )
}
