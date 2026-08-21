'use client'

import React from 'react'
import Link from 'next/link'
import {
  BarChart3,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Sparkles,
  Crown,
  ArrowRight,
  BookOpen,
  Calendar,
  Layers,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'

const SUBJECT_PERFORMANCE = [
  {
    subject: 'Child Development & Pedagogy',
    score: '92%',
    questions: '120 Solved',
    status: 'Strong',
    color: 'bg-emerald-500',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    subject: 'Language I (Telugu)',
    score: '88%',
    questions: '180 Solved',
    status: 'Strong',
    color: 'bg-emerald-500',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    subject: 'Mathematics & Methodology',
    score: '82%',
    questions: '160 Solved',
    status: 'Good',
    color: 'bg-primary',
    badgeClass: 'border-primary/30 bg-primary/10 text-primary',
  },
  {
    subject: 'Social Studies & Methodology',
    score: '79%',
    questions: '140 Solved',
    status: 'Moderate',
    color: 'bg-cyan-500',
    badgeClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
  {
    subject: 'Language II (English)',
    score: '74%',
    questions: '110 Solved',
    status: 'Needs Practice',
    color: 'bg-amber-500',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    subject: 'General Knowledge & CA',
    score: '71%',
    questions: '95 Solved',
    status: 'Needs Practice',
    color: 'bg-amber-500',
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    subject: 'General Science & Methodology',
    score: '65%',
    questions: '130 Solved',
    status: 'Weak Area',
    color: 'bg-red-500',
    badgeClass: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  },
  {
    subject: 'Perspectives in Education',
    score: '60%',
    questions: '85 Solved',
    status: 'Weak Area',
    color: 'bg-red-500',
    badgeClass: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  },
]

const TEST_HISTORY = [
  {
    name: 'AP DSC / SGT Grand Mock Test - 01',
    date: 'Yesterday, 4:30 PM',
    score: '118 / 150',
    accuracy: '78.6%',
    rank: '#42 / 14.2k',
    percentile: '97.2%',
  },
  {
    name: 'Child Development Speed Drill',
    date: '2 days ago',
    score: '27 / 30',
    accuracy: '90.0%',
    rank: '#18 / 8.9k',
    percentile: '98.5%',
  },
  {
    name: 'AP DSC 2024 Shift 1 Official Paper',
    date: '4 days ago',
    score: '109 / 150',
    accuracy: '72.6%',
    rank: '#112 / 22.1k',
    percentile: '94.8%',
  },
]

export default function PerformancePage() {
  const { isPremium, openModal } = usePremium()

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-emerald-500" />
            <h1 className="text-xl font-black text-foreground sm:text-2xl">
              DSC / SGT Performance Analytics
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            In-depth analysis of accuracy, subject strengths, time spent, and state-level rank ranking
          </p>
        </div>

        {!isPremium && (
          <button
            onClick={() => openModal('performance_top')}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-105"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>Unlock AI Diagnostic Reports</span>
          </button>
        )}
      </div>

      {/* ── Top Metric Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Overall Accuracy</span>
            <Target className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground">78.4%</p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-500">↑ +4.2% from last week</p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Avg. Mock Score</span>
            <Award className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground">
            118 <span className="text-sm font-normal text-muted-foreground">/ 150 M</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">Target cut-off: 110 M</p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Est. State Rank</span>
            <Crown className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-amber-500">
            Top 2.8%
          </p>
          <p className="mt-1 text-[11px] font-semibold text-foreground">Rank ~#42 in AP</p>
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Questions Attempted</span>
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black text-foreground">1,020</p>
          <p className="mt-1 text-[11px] text-muted-foreground font-medium">Across 8 subjects</p>
        </div>
      </div>

      {/* ── AI Diagnostic Action Box for Weak Areas ── */}
      <div className="mb-8 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-orange-500/10 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                AI Weak Area Alert: Science & Perspectives in Education
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Your accuracy in <em>Science (65%)</em> and <em>Perspectives in Education (60%)</em> is lower than your average. Solving 50 targeted topic MCQs can boost your expected score by +12 marks.
              </p>
            </div>
          </div>

          <Link
            href="/dsc-sgt/practice?subject=General+Science"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
          >
            <span>Practice Science Drills</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* ── 2 Column Grid: Subject Breakdown & Recent Test History ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* Left: Subject Breakdown */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-foreground">Subject Proficiency Breakdown</h3>
            <span className="text-xs text-muted-foreground">8 Sections</span>
          </div>

          <div className="space-y-4">
            {SUBJECT_PERFORMANCE.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-foreground">{item.subject}</span>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md border px-1.5 py-0.2 text-[10px] font-bold ${item.badgeClass}`}>
                      {item.status}
                    </span>
                    <span className="text-foreground font-bold">{item.score}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                    style={{ width: item.score }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Mock Test Attempt History */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-foreground">Recent Mock Test Attempts</h3>
              <Link href="/dsc-sgt/mock-tests" className="text-xs font-semibold text-primary hover:underline">
                All Tests →
              </Link>
            </div>

            <div className="space-y-3.5">
              {TEST_HISTORY.map((test, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 transition hover:bg-muted/40"
                >
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">{test.name}</h4>
                    <span className="text-[11px] text-muted-foreground">{test.date}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div className="text-right">
                      <p className="font-extrabold text-foreground">{test.score}</p>
                      <p className="text-[10px] text-emerald-500 font-bold">{test.accuracy} Acc.</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-2.5 py-1 text-center text-[10px]">
                      <span className="text-muted-foreground">Rank</span>
                      <p className="font-bold text-primary">{test.rank}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <Link
              href="/dsc-sgt/mock-exam"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
            >
              <span>Take a new Full Mock Exam to improve your Rank</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

      </div>

    </main>
  )
}
