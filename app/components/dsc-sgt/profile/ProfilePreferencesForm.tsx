// ============================================================
// app/components/dsc-sgt/profile/ProfilePreferencesForm.tsx
// ============================================================
'use client'

import React, { useState } from 'react'
import { Check, Loader2, FileCheck2, BookOpen, Bot, Sparkles, Globe, Languages } from 'lucide-react'
import type { PublicUser, LearningGoal, EducationMedium } from '@/lib/auth/types'

const GOALS: { id: LearningGoal; label: string; hint: string; icon: typeof FileCheck2 }[] = [
  { id: 'mock_test', label: 'Mock Tests', hint: 'Full-length timed papers', icon: FileCheck2 },
  { id: 'practice', label: 'Practice Questions', hint: 'Topic-wise drilling', icon: BookOpen },
  { id: 'ai_support', label: 'AI Learning Support', hint: 'Explanations on demand', icon: Bot },
  { id: 'other', label: 'Other', hint: 'Something else', icon: Sparkles },
]

const MEDIUMS: { id: EducationMedium; label: string; sublabel: string; icon: typeof Globe }[] = [
  {
    id: 'english',
    label: 'English Medium',
    sublabel: 'Questions and explanations in English',
    icon: Globe,
  },
  {
    id: 'telugu',
    label: 'తెలుగు మీడియం',
    sublabel: 'ప్రశ్నలు మరియు వివరణలు తెలుగులో',
    icon: Languages,
  },
]

interface ProfilePreferencesFormProps {
  user: PublicUser
  onSave: (patch: {
    educationMedium: EducationMedium
    learningGoals: LearningGoal[]
  }) => Promise<boolean>
}

/** Order-insensitive comparison — reordering goals is not a change. */
function sameGoals(a: LearningGoal[], b: LearningGoal[]) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((g) => set.has(g))
}

export default function ProfilePreferencesForm({ user, onSave }: ProfilePreferencesFormProps) {
  const savedMedium = user.educationMedium ?? 'telugu'
  const savedGoals = user.learningGoals ?? []

  const [medium, setMedium] = useState<EducationMedium>(savedMedium)
  const [goals, setGoals] = useState<LearningGoal[]>(savedGoals)
  const [saving, setSaving] = useState(false)

  const dirty = medium !== savedMedium || !sameGoals(goals, savedGoals)
  const canSave = dirty && goals.length > 0 && !saving

  const toggleGoal = (id: LearningGoal) =>
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))

  const reset = () => {
    setMedium(savedMedium)
    setGoals(savedGoals)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    await onSave({ educationMedium: medium, learningGoals: goals })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border/70 bg-card p-6">
      <p className="bloom-eyebrow">Study preferences</p>
      <h3 className="mt-1.5 text-lg font-medium text-foreground">How you want to prepare</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Your medium decides the language questions are served in. Goals shape what
        the platform puts in front of you first.
      </p>

      {/* ── Medium ── */}
      <fieldset className="mt-6">
        <legend className="text-xs font-medium text-foreground">Exam medium</legend>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          {MEDIUMS.map((m) => {
            const Icon = m.icon
            const active = medium === m.id
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => setMedium(m.id)}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? 'border-primary/50 bg-secondary'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                  strokeWidth={1.7}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">{m.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {m.sublabel}
                  </span>
                </span>
                {active && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* ── Goals ── */}
      <fieldset className="mt-6">
        <legend className="text-xs font-medium text-foreground">
          What you are here for{' '}
          <span className="font-normal text-muted-foreground">(pick at least one)</span>
        </legend>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          {GOALS.map((g) => {
            const Icon = g.icon
            const active = goals.includes(g.id)
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleGoal(g.id)}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? 'border-primary/50 bg-secondary'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                  strokeWidth={1.7}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">{g.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{g.hint}</span>
                </span>
                {active && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
        {goals.length === 0 && (
          <p className="mt-2 text-[11px] text-destructive">Pick at least one goal to save.</p>
        )}
      </fieldset>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-5">
        {dirty && !saving && (
          <button
            type="button"
            onClick={reset}
            className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Discard
          </button>
        )}
        <button
          type="submit"
          disabled={!canSave}
          className="bloom-pill bloom-pill-dark px-5 py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>{saving ? 'Saving…' : 'Save preferences'}</span>
        </button>
      </div>
    </form>
  )
}
