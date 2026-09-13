'use client'

// ============================================================
// app/components/dsc-sgt/practice/PracticeSetup.tsx
// ============================================================
// Ultra-Friendly, Mobile-First DSC Practice Setup Orchestrator
// Modularly composed with specialized subcomponents.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import { GraduationCap, History, Crown, Lock, Sparkles } from 'lucide-react'
import { useAuth } from '@/app/contexts/AuthContext'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'
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
  const { user } = useAuth()
  const { isPremium, openModal } = usePremium()

  // ── Practice Quota State ────────────────────────────────────
  const [quota, setQuota] = useState<{
    loading: boolean
    canPractice: boolean
    completedSessions: number
    allowedSessions: number | string
    maxQuestions: number
    reason: string | null
  }>({
    loading: true,
    canPractice: true,
    completedSessions: 0,
    allowedSessions: 1,
    maxQuestions: 25,
    reason: null,
  })

  const fetchQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/dsc-sgt/practice/quota')
      const data = await res.json()
      if (data.success) {
        setQuota({
          loading: false,
          canPractice: data.canPractice,
          completedSessions: data.completedSessions,
          allowedSessions: data.allowedSessions,
          maxQuestions: data.maxQuestions,
          reason: data.reason,
        })
      }
    } catch {
      setQuota((prev) => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    fetchQuota()
  }, [fetchQuota])

  // ── Core State ──────────────────────────────────────────────
  const [medium, setMedium] = useState<PracticeMedium>('english')
  const [subject, setSubject] = useState<string>('English')
  const [hasUserSelectedMedium, setHasUserSelectedMedium] = useState<boolean>(false)
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

  // ── Automatically open collected Medium Tab (from user profile or localStorage) ──
  useEffect(() => {
    if (hasUserSelectedMedium) return

    let targetMedium: PracticeMedium | null = null

    // 1. Check user profile collected during onboarding
    if (user?.educationMedium === 'telugu' || user?.educationMedium === 'english') {
      targetMedium = user.educationMedium
    } else {
      // 2. Check localStorage for previously remembered preference
      try {
        const stored = localStorage.getItem('preferred_practice_medium')
        if (stored === 'telugu' || stored === 'english') {
          targetMedium = stored as PracticeMedium
        }
      } catch {}
    }

    if (targetMedium && targetMedium !== medium) {
      setMedium(targetMedium)
      setSubject(targetMedium === 'english' ? 'English' : 'Telugu')
      setSelectedTopics([])
      setTopicMode('all')
    }
  }, [user?.educationMedium, hasUserSelectedMedium, medium])

  const handleSelectMedium = (m: PracticeMedium) => {
    setHasUserSelectedMedium(true)
    setMedium(m)
    setSubject(m === 'english' ? 'English' : 'Telugu')
    setSelectedTopics([])
    setTopicMode('all')
    try {
      localStorage.setItem('preferred_practice_medium', m)
    } catch {}
  }

  // Ensure free users stay in All Topics mode
  useEffect(() => {
    if (!isPremium && topicMode === 'custom') {
      setTopicMode('all')
      setSelectedTopics([])
    }
  }, [isPremium, topicMode])

  // Toggle specific topic
  const toggleTopic = (topicName: string) => {
    if (!isPremium) {
      openModal('practice_topic_selection')
      return
    }
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
  const rawQuestionCount = Math.min(
    questionCount,
    totalAvailable > 0 ? totalAvailable : questionCount
  )
  const finalQuestionCount = !isPremium ? Math.min(25, rawQuestionCount) : rawQuestionCount

  // Start practice handler
  const handleStart = () => {
    if (!quota.canPractice && !isPremium) {
      openModal('practice_limit_start_blocked')
      return
    }

    if (!isPremium && topicMode === 'custom') {
      openModal('practice_topic_selection')
      return
    }

    const filterState: PracticeFilterState = {
      medium,
      subject,
      class_levels: selectedClasses,
      topics: !isPremium || topicMode === 'all' || selectedTopics.length === 0 ? ['All'] : selectedTopics,
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
      <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground">DSC Practice Zone</h1>
                {isPremium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    <Crown className="h-3 w-3 text-amber-500" /> PRO
                  </span>
                )}
              </div>
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

        {/* Pro vs Free Status Notice */}
        {!isPremium && !quota.loading && (
          <>
            {!quota.canPractice ? (
              <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-background p-4 sm:p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-foreground">
                          Free Practice Limit Reached
                        </h2>
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                          1 of 1 Used
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        Free accounts can practice <strong>1 session (max 25 questions)</strong>. You have used your 1 free practice session. Upgrade to Pro for unlimited practice sessions across all subjects!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('practice_limit_card')}
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary hover:brightness-105 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
                  >
                    <Crown className="h-3.5 w-3.5 fill-white" />
                    <span>Upgrade to Pro</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-foreground">
                    Free Tier: <strong>1 Practice Session Allowed (Max 25 Questions)</strong> • Choose 1 subject to practice.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openModal('practice_setup_upgrade_notice')}
                  className="font-bold text-primary hover:underline shrink-0"
                >
                  Unlock Unlimited with Pro →
                </button>
              </div>
            )}
          </>
        )}

        {/* Medium Selector */}
        <MediumSelector
          medium={medium}
          onSelectMedium={handleSelectMedium}
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
        isPremium={isPremium}
        onSetTopicMode={(mode) => {
          if (mode === 'custom' && !isPremium) {
            openModal('practice_topic_selection')
            return
          }
          setTopicMode(mode)
          if (mode === 'all') setSelectedTopics([])
        }}
        onToggleTopic={toggleTopic}
        onOpenUpgradeModal={() => openModal('practice_topic_selection')}
      />

      {/* ── Step 3: Question Count ─────────────────────────────── */}
      <QuestionCountSelector
        questionCount={questionCount}
        finalQuestionCount={finalQuestionCount}
        isCustomCount={isCustomCount}
        customCountInput={customCountInput}
        isPremium={isPremium}
        onSetQuestionCount={setQuestionCount}
        onSetIsCustomCount={setIsCustomCount}
        onCustomInputChange={(val) => {
          setCustomCountInput(val)
          const n = parseInt(val, 10)
          if (!isNaN(n) && n > 0) setQuestionCount(n)
        }}
        onOpenUpgradeModal={() => openModal('practice_question_count_preset')}
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
        canPractice={quota.canPractice}
        isPremium={isPremium}
        onStart={handleStart}
        onOpenUpgradeModal={() => openModal('practice_bottom_bar')}
      />
    </div>
  )
}
