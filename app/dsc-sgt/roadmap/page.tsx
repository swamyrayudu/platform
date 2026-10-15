'use client'

// ============================================================
// app/dsc-sgt/roadmap/page.tsx — Exam roadmap
// ============================================================
// Two tabs:
//   Study plan               app/components/dsc-sgt/roadmap/StudyPlan.tsx,
//                            with a medium picker; the Telugu-medium plan
//                            has its topics in Telugu
//   Exam pattern & syllabus  app/components/dsc-sgt/roadmap/ExamOverview.tsx,
//                            the full syllabus in the chosen medium
// The medium opens on the one the candidate registered with, as Practice does.
// ============================================================

import React, { useState } from 'react'
import { useAuth } from '@/app/contexts/AuthContext'
import { resolvePreferredMedium, storeMedium } from '@/lib/medium-preference'
import type { PlanMedium } from '@/lib/study-plan'
import StudyPlan from '@/app/components/dsc-sgt/roadmap/StudyPlan'
import ExamOverview from '@/app/components/dsc-sgt/roadmap/ExamOverview'

type Tab = 'plan' | 'overview'
const TABS: [Tab, string][] = [['plan', 'Study plan'], ['overview', 'Exam pattern & syllabus']]

export default function RoadmapPage() {
  const { user } = useAuth()
  // The dsc-sgt layout renders pages once the profile has loaded, so this sees it.
  const [medium, setMedium] = useState<PlanMedium>(() => resolvePreferredMedium(user?.educationMedium) ?? 'english')
  // A link can open a tab directly: /dsc-sgt/roadmap#overview
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== 'undefined' && window.location.hash === '#overview' ? 'overview' : 'plan')

  const chooseMedium = (next: PlanMedium) => {
    setMedium(next)
    storeMedium(next)
  }
  const chooseTab = (next: Tab) => {
    setTab(next)
    window.history.replaceState(null, '', next === 'plan' ? window.location.pathname : '#overview')
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:max-w-5xl lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <h1 className="text-xl font-black text-foreground sm:text-2xl">Exam roadmap</h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">AP DSC 2026 · SGT</p>
        </div>
        {/* The medium sets the plan's topics and the syllabus language, on both tabs. */}
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Medium
          <select
            value={medium}
            onChange={(e) => chooseMedium(e.target.value as PlanMedium)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground cursor-pointer"
          >
            <option value="telugu">Telugu</option>
            <option value="english">English</option>
          </select>
        </label>
      </header>

      <div role="tablist" aria-label="Exam roadmap" className="mb-6 mt-5 flex gap-6 border-b border-border">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => chooseTab(value)}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-semibold transition cursor-pointer ${
              tab === value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'plan' ? <StudyPlan key={medium} medium={medium} /> : <ExamOverview medium={medium} />}
    </main>
  )
}
