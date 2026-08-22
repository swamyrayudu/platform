'use client'

// ============================================================
// app/components/dsc-sgt/practice/PracticeSetup.tsx
// ============================================================
// Ultra-Friendly, Mobile-First DSC Practice Setup Orchestrator
// Modularly composed with specialized subcomponents.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import { GraduationCap, History } from 'lucide-react'
import type {
  PracticeMedium,
  PracticeMode,
  PracticeFilterState,
  DynamicFilterOptions,
  WeakAreaRecommendation,
} from '@/types/practice'
import {
  MediumSelector,
  SubjectSelector,
  TopicSelector,
  QuestionCountSelector,
  PracticeModeSelector,
  AdvancedFilters,
  WeakAreaBanner,
  SetupBottomBar,
} from './setup'

interface PracticeSetupProps {
  onStartSession: (filter: PracticeFilterState) => void
  onQuickRetry: (topic?: string, subject?: string) => void
  onViewHistory: () => void
  isLoading?: boolean
}

export default function PracticeSetup({
  onStartSession,
  onQuickRetry,
  onViewHistory,
  isLoading = false,
}: PracticeSetupProps) {
  // ── Core State ──────────────────────────────────────────────
  const [medium, setMedium] = useState<PracticeMedium>('english')
  const [subject, setSubject] = useState<string>('English')
  const [topicMode, setTopicMode] = useState<'all' | 'custom'>('all')
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState<number>(25)
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('balanced')
  const [instantFeedback, setInstantFeedback] = useState<boolean>(true)

  // ── Advanced Optional Filters ───────────────────────────────
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false)
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['All'])
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>(['All'])
  const [hasTimer, setHasTimer] = useState<boolean>(false)
  const [timerMinutes, setTimerMinutes] = useState<number>(25)
  const [customCountInput, setCustomCountInput] = useState<string>('')
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false)

  // ── Dynamic Metadata from Server ────────────────────────────
  const [dynamicOptions, setDynamicOptions] = useState<DynamicFilterOptions | null>(null)
  const [weakRecommendations, setWeakRecommendations] = useState<WeakAreaRecommendation[]>([])

  // Fetch dynamic filters from backend
  const fetchFilterMetadata = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        medium,
        subject,
      })
      if (topicMode === 'custom' && selectedTopics.length > 0) {
        params.set('topics', selectedTopics.join(','))
      }
      if (!selectedClasses.includes('All') && selectedClasses.length > 0) {
        params.set('class_levels', selectedClasses.join(','))
      }
      if (!selectedDifficulties.includes('All') && selectedDifficulties.length > 0) {
        params.set('difficulty', selectedDifficulties.join(','))
      }

      const res = await fetch(`/api/dsc-sgt/practice/filters?${params.toString()}`)
      const json = await res.json()
      if (json.success && json.data) {
        setDynamicOptions(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch dynamic filters:', err)
    }
  }, [medium, subject, topicMode, selectedTopics, selectedClasses, selectedDifficulties])

  // Fetch weak recommendations on mount
  useEffect(() => {
    fetch('/api/dsc-sgt/practice/weak-topics')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.recommendations) {
          setWeakRecommendations(data.recommendations)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchFilterMetadata()
  }, [fetchFilterMetadata])

  // Toggle specific topic
  const toggleTopic = (topicName: string) => {
    setSelectedTopics((prev) => {
      if (prev.includes(topicName)) {
        const next = prev.filter((t) => t !== topicName)
        if (next.length === 0) setTopicMode('all')
        return next
      } else {
        return [...prev, topicName]
      }
    })
  }

  // Matching questions available
  const totalAvailable = dynamicOptions?.total_matching_questions ?? 25
  const finalQuestionCount = Math.min(
    questionCount,
    totalAvailable > 0 ? totalAvailable : questionCount
  )

  // Start practice handler
  const handleStart = () => {
    const filterState: PracticeFilterState = {
      medium,
      subject,
      class_levels: selectedClasses,
      topics: topicMode === 'all' || selectedTopics.length === 0 ? ['All'] : selectedTopics,
      subtopics: selectedSubtopics.length > 0 ? selectedSubtopics : ['All'],
      difficulty: selectedDifficulties,
      question_count: Math.max(5, finalQuestionCount),
      mode: practiceMode,
      feedback_mode: instantFeedback ? 'instant' : 'end',
      has_timer: hasTimer,
      duration_minutes: hasTimer ? timerMinutes : 0,
    }
    onStartSession(filterState)
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 sm:pb-8">
      {/* ── Header & Medium Toggle ───────────────────────────── */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-foreground">DSC Practice Zone</h1>
              <p className="text-xs text-muted-foreground">AP DSC / SGT • Smart Practice Engine</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewHistory}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card hover:bg-accent px-3 py-2 text-xs font-bold text-foreground transition cursor-pointer shadow-xs"
          >
            <History className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">History</span>
          </button>
        </div>

        {/* Medium Selector */}
        <MediumSelector
          medium={medium}
          onSelectMedium={(m) => {
            setMedium(m)
            setSubject(m === 'english' ? 'English' : 'Telugu')
            setSelectedTopics([])
            setTopicMode('all')
          }}
        />

        {/* Weak topic alert banner */}
        <WeakAreaBanner
          weakRecommendations={weakRecommendations}
          onQuickRetry={onQuickRetry}
        />
      </div>

      {/* ── Step 1: Choose Subject ─────────────────────────────── */}
      <SubjectSelector
        selectedSubject={subject}
        onSelectSubject={(subName) => {
          setSubject(subName)
          setSelectedTopics([])
          setTopicMode('all')
        }}
        dynamicOptions={dynamicOptions}
        totalAvailable={totalAvailable}
      />

      {/* ── Step 2: Choose Topics ──────────────────────────────── */}
      <TopicSelector
        subject={subject}
        topicMode={topicMode}
        selectedTopics={selectedTopics}
        dynamicOptions={dynamicOptions}
        onSetTopicMode={(mode) => {
          setTopicMode(mode)
          if (mode === 'all') setSelectedTopics([])
        }}
        onToggleTopic={toggleTopic}
      />

      {/* ── Step 3: Question Count ─────────────────────────────── */}
      <QuestionCountSelector
        questionCount={questionCount}
        finalQuestionCount={finalQuestionCount}
        isCustomCount={isCustomCount}
        customCountInput={customCountInput}
        onSetQuestionCount={setQuestionCount}
        onSetIsCustomCount={setIsCustomCount}
        onCustomInputChange={(val) => {
          setCustomCountInput(val)
          const n = parseInt(val, 10)
          if (!isNaN(n) && n > 0) setQuestionCount(n)
        }}
      />

      {/* ── Step 4: Practice Mode & Feedback ───────────────────── */}
      <PracticeModeSelector
        practiceMode={practiceMode}
        instantFeedback={instantFeedback}
        onSetPracticeMode={setPracticeMode}
        onToggleInstantFeedback={setInstantFeedback}
      />

      {/* ── Optional Advanced Filters ─────────────────────────── */}
      <AdvancedFilters
        showAdvanced={showAdvanced}
        selectedClasses={selectedClasses}
        selectedDifficulties={selectedDifficulties}
        hasTimer={hasTimer}
        onToggleShowAdvanced={() => setShowAdvanced(!showAdvanced)}
        onSelectClass={(cls) => setSelectedClasses([cls])}
        onSelectDifficulty={(diff) => setSelectedDifficulties([diff])}
        onToggleTimer={setHasTimer}
      />

      {/* ── Floating Mobile Bottom Bar ────────────────────────── */}
      <SetupBottomBar
        subject={subject}
        finalQuestionCount={finalQuestionCount}
        instantFeedback={instantFeedback}
        totalAvailable={totalAvailable}
        isLoading={isLoading}
        onStart={handleStart}
      />
    </div>
  )
}
