'use client'

// ============================================================
// app/onboarding/page.tsx — Mandatory first-time onboarding
// ============================================================
// 2-step flow:
//   Step 1: Select learning goals (multi-select)
//   Step 2: Select education medium (single-select)
// After completion: Redirects directly to /home
// ============================================================

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  GraduationCap,
  FileCheck2,
  BookOpen,
  Sparkles,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/app/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/loading-screen'
import type { LearningGoal, EducationMedium } from '@/lib/auth/types'

// ---- Learning Goals Data ----------------------------------------

const LEARNING_GOAL_OPTIONS: {
  id: LearningGoal
  label: string
  description: string
  icon: React.ElementType
  color: string
  borderColor: string
  bgColor: string
}[] = [
  {
    id: 'mock_test',
    label: 'Mock Tests',
    description: 'Full-length AP DSC exam simulations with timer, ranking & detailed score reports',
    icon: FileCheck2,
    color: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    id: 'practice',
    label: 'Practice Questions',
    description: 'Chapter-wise MCQs across all syllabus sections with instant explanations',
    icon: BookOpen,
    color: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'ai_support',
    label: 'AI Learning Support',
    description: 'AI-powered doubt resolution, weak area diagnosis & personalized study plans',
    icon: Sparkles,
    color: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Syllabus browsing, previous papers reference, or general exam preparation',
    icon: MessageCircle,
    color: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
]

// ---- Education Medium Data --------------------------------------

const MEDIUM_OPTIONS: {
  id: EducationMedium
  label: string
  sublabel: string
  flag: string
}[] = [
  {
    id: 'english',
    label: 'English Medium',
    sublabel: 'Questions and explanations in English',
    flag: 'EN',
  },
  {
    id: 'telugu',
    label: 'తెలుగు మీడియం',
    sublabel: 'ప్రశ్నలు మరియు వివరణలు తెలుగులో',
    flag: 'తె',
  },
]

// ---- Page Component ---------------------------------------------

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading, completeOnboarding } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [selectedGoals, setSelectedGoals] = useState<LearningGoal[]>([])
  const [selectedMedium, setSelectedMedium] = useState<EducationMedium | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
    }
  }, [user, loading, router])

  // Redirect to /home if already completed onboarding
  useEffect(() => {
    if (!loading && user && user.onboardingCompleted) {
      router.replace('/home')
    }
  }, [user, loading, router])

  if (loading) {
    return <LoadingScreen message="Loading..." />
  }

  if (!user) {
    return <LoadingScreen message="Checking authentication..." />
  }

  if (user.onboardingCompleted) {
    return <LoadingScreen message="Redirecting to dashboard..." />
  }

  // ---- Handlers -------------------------------------------------

  const toggleGoal = (goalId: LearningGoal) => {
    setSelectedGoals((prev) =>
      prev.includes(goalId)
        ? prev.filter((g) => g !== goalId)
        : [...prev, goalId]
    )
  }

  const handleContinue = () => {
    if (selectedGoals.length === 0) return
    setStep(2)
  }

  const handleBack = () => {
    setStep(1)
  }

  const handleSubmit = async () => {
    if (!selectedMedium || selectedGoals.length === 0) return

    setIsSaving(true)
    try {
      const success = await completeOnboarding({
        learningGoals: selectedGoals,
        educationMedium: selectedMedium,
      })

      if (success) {
        toast.success('Welcome to RSD Education!', {
          description: 'Preferences saved. Redirecting to your dashboard...',
          duration: 3000,
        })
        // Navigate directly to /home route
        router.replace('/home')
      } else {
        toast.error('Something went wrong', {
          description: 'Please try again.',
        })
      }
    } catch {
      toast.error('Network error', {
        description: 'Please check your connection and try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const userName = user.name || user.email?.split('@')[0] || 'there'

  // ---- Render ---------------------------------------------------
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Top bar with logo */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-xs">
              R
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              rsd<span className="font-normal text-muted-foreground">education</span>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Welcome heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary mb-3">
            <GraduationCap className="h-3.5 w-3.5" />
            AP DSC / SGT Preparation
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            Welcome, <span className="text-primary">{userName}</span>!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
            Let&apos;s personalize your preparation experience. This takes less than 30 seconds.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className={`text-xs font-bold ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              Step 1 of 2
            </span>
            <div className="h-px w-12 bg-border" />
            <span className={`text-xs font-bold ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              Step 2 of 2
            </span>
          </div>
          <div className="mx-auto max-w-xs">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
          </div>
        </div>

        {/* ── Step 1: Learning Goals ── */}
        {step === 1 && (
          <div className="transition-opacity duration-300">
            <div className="text-center mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                What would you like to use DSC for?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Select all that apply.
              </p>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {LEARNING_GOAL_OPTIONS.map((goal) => {
                const isSelected = selectedGoals.includes(goal.id)
                const Icon = goal.icon
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => toggleGoal(goal.id)}
                    className={`group relative flex items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? `${goal.borderColor} ${goal.bgColor} shadow-md ring-1 ring-offset-1`
                        : 'border-border/80 bg-card hover:border-border hover:bg-muted/30 hover:shadow-xs'
                    }`}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all mt-0.5 ${
                        isSelected
                          ? `${goal.borderColor} bg-primary text-primary-foreground`
                          : 'border-muted-foreground/40 bg-background'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${goal.bgColor} ${goal.color}`}>
                          <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground">
                          {goal.label}
                        </h3>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        {goal.description}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Continue button */}
            <div className="mt-8 flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleContinue}
                disabled={selectedGoals.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
              >
                <span>Continue</span>
                <ChevronRight className="h-4 w-4" />
              </button>

              {selectedGoals.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Please select at least one option to continue
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Education Medium ── */}
        {step === 2 && (
          <div className="transition-opacity duration-300">
            <div className="text-center mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                What is your medium of education?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                We&apos;ll show questions and explanations in your preferred language.
              </p>
            </div>

            <div className="mx-auto max-w-md grid gap-4">
              {MEDIUM_OPTIONS.map((medium) => {
                const isSelected = selectedMedium === medium.id
                return (
                  <button
                    key={medium.id}
                    type="button"
                    onClick={() => setSelectedMedium(medium.id)}
                    className={`group flex items-center gap-5 rounded-2xl border-2 p-6 text-left transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/20 ring-offset-1'
                        : 'border-border/80 bg-card hover:border-border hover:bg-muted/30 hover:shadow-xs'
                    }`}
                  >
                    {/* Radio indicator */}
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        isSelected
                          ? 'border-primary'
                          : 'border-muted-foreground/40'
                      }`}
                    >
                      {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </div>

                    {/* Flag badge */}
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-black transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {medium.flag}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-base font-bold text-foreground">
                        {medium.label}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {medium.sublabel}
                      </p>
                    </div>

                    {isSelected && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Action buttons */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3">
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:bg-accent transition disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedMedium || isSaving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving preferences...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Setup</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>

              {!selectedMedium && (
                <p className="text-xs text-muted-foreground">
                  Please select your education medium to complete setup
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-10 text-center">
          <p className="text-[11px] text-muted-foreground">
            You can change these preferences later from your profile settings.
          </p>
        </div>
      </main>
    </div>
  )
}
