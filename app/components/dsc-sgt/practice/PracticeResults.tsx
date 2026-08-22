'use client'

// ============================================================
// app/components/dsc-sgt/practice/PracticeResults.tsx
// ============================================================
// Detailed Results, Topic Analytics, Weak Topic Recommendations,
// and Comprehensive Question Review Orchestrator
// ============================================================

import React from 'react'
import type { PracticeResultSummary } from '@/types/practice'
import {
  ScoreSummaryCard,
  TopicPerformanceList,
  WeakRecommendationsCard,
  QuestionReviewList,
  ResultsActionButtons,
} from './results'

interface PracticeResultsProps {
  results: PracticeResultSummary
  onPracticeTopic: (topic: string, subject: string) => void
  onRetryIncorrect: (topic?: string) => void
  onStartNewPractice: () => void
}

export default function PracticeResults({
  results,
  onPracticeTopic,
  onRetryIncorrect,
  onStartNewPractice,
}: PracticeResultsProps) {
  // Weakest topic determination
  const weakTopics = results.topic_breakdown.filter((t) => t.is_weak || t.accuracy_pct < 65)
  const weakestTopic = weakTopics.length > 0 ? weakTopics[0] : null
  const hasIncorrect = results.incorrect_count > 0

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* ── Top Score & Celebration Card ─────────────────────── */}
      <ScoreSummaryCard results={results} />

      {/* ── Topic Performance Breakdown ──────────────────────── */}
      <TopicPerformanceList topicBreakdown={results.topic_breakdown} />

      {/* ── Actionable Weak Topic Recommendations ────────────── */}
      <WeakRecommendationsCard
        weakRecommendations={results.weak_recommendations}
        subject={results.subject}
        onPracticeTopic={onPracticeTopic}
      />

      {/* ── Comprehensive Question Review ────────────────────── */}
      <QuestionReviewList questionsReview={results.questions_review} />

      {/* ── Bottom Action Controls ───────────────────────────── */}
      <ResultsActionButtons
        hasIncorrect={hasIncorrect}
        weakestTopic={weakestTopic}
        subject={results.subject}
        onRetryIncorrect={() => onRetryIncorrect(weakestTopic?.topic)}
        onPracticeTopic={onPracticeTopic}
        onStartNewPractice={onStartNewPractice}
      />
    </div>
  )
}
