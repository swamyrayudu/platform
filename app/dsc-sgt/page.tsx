'use client'

import React from 'react'
import Link from 'next/link'
import {
  BookOpen,
  FileCheck2,
  Timer,
  BarChart3,
  Sparkles,
  Crown,
  ArrowRight,
  Flame,
  CheckCircle2,
  GraduationCap,
  Award,
  Zap,
  Layers,
  Clock,
  TrendingUp,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'
import { useAuth } from '@/app/contexts/AuthContext'

const SYLLABUS_SECTIONS = [
  {
    name: 'General Knowledge & Current Affairs',
    marks: '10 Marks',
    questions: '20 Qs',
    topics: 'National & AP State Events, Schemes, Awards, History',
    color: 'from-blue-500/20 to-blue-500/5',
    border: 'border-blue-500/30',
    iconColor: 'text-blue-500',
  },
  {
    name: 'Perspectives in Education',
    marks: '10 Marks',
    questions: '20 Qs',
    topics: 'History of Education, RTE 2009, NEP 2020, Teacher Emp.',
    color: 'from-purple-500/20 to-purple-500/5',
    border: 'border-purple-500/30',
    iconColor: 'text-purple-500',
  },
  {
    name: 'Classroom Psychology & Pedagogy',
    marks: '10 Marks',
    questions: '20 Qs',
    topics: 'Child Development, Learning Theories, Guidance & Counseling',
    color: 'from-pink-500/20 to-pink-500/5',
    border: 'border-pink-500/30',
    iconColor: 'text-pink-500',
  },
  {
    name: 'Language I (Telugu)',
    marks: '15 Marks',
    questions: '30 Qs',
    topics: 'Grammar (Vyakaranam), Literature, Padajalam, Methodology',
    color: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-500/30',
    iconColor: 'text-amber-500',
  },
  {
    name: 'Language II (English)',
    marks: '15 Marks',
    questions: '30 Qs',
    topics: 'Vocabulary, Tenses, Prepositions, Reading Comprehension, Methods',
    color: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-500',
  },
  {
    name: 'Mathematics & Methodology',
    marks: '20 Marks',
    questions: '40 Qs',
    topics: 'Number System, Geometry, Algebra, Data Handling, Methods',
    color: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/30',
    iconColor: 'text-cyan-500',
  },
  {
    name: 'Science & Methodology',
    marks: '20 Marks',
    questions: '40 Qs',
    topics: 'Living World, Physics, Chemistry, Health, EVS, Methodology',
    color: 'from-green-500/20 to-green-500/5',
    border: 'border-green-500/30',
    iconColor: 'text-green-500',
  },
  {
    name: 'Social Studies & Methodology',
    marks: '20 Marks',
    questions: '40 Qs',
    topics: 'Geography, History, Civics, AP Geography & Economy, Methods',
    color: 'from-orange-500/20 to-orange-500/5',
    border: 'border-orange-500/30',
    iconColor: 'text-orange-500',
  },
]

export default function DscSgtOverviewPage() {
  const { user } = useAuth()
  const { isPremium, openModal } = usePremium()

  const userName = user?.name || user?.email?.split('@')[0] || 'Candidate'

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* ── Top Hero Card ── */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-6 sm:p-8 md:p-10 shadow-sm">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 bottom-0 h-48 w-48 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                <GraduationCap className="h-3.5 w-3.5" />
                AP DSC 2026 Recruitment
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Syllabus Updated
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Namaste, <span className="text-primary">{userName}</span>! Ready to crack DSC / SGT?
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Master all 8 syllabus sections with chapter-wise practice, timed sectional tests, and full-length 150-mark AP DSC Grand Mock Exams.
            </p>

            {/* Quick Metrics */}
            <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-6 text-xs font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-500 fill-orange-500" />
                <span><strong className="text-foreground">5 Days</strong> Study Streak</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span><strong className="text-foreground">340+</strong> Questions Solved</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" />
                <span><strong className="text-foreground">78.4%</strong> Avg Accuracy</span>
              </div>
            </div>
          </div>

          {/* Quick CTA Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <Link
              href="/dsc-sgt/mock-exam"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 hover:scale-[1.02] active:scale-95"
            >
              <Timer className="h-4 w-4" />
              <span>Start Live Mock Exam (150 M)</span>
            </Link>
            <Link
              href="/dsc-sgt/practice"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card px-6 py-3 text-xs sm:text-sm font-semibold text-foreground hover:bg-accent transition"
            >
              <BookOpen className="h-4 w-4 text-primary" />
              <span>Continue Practice Questions</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4 Main Module Hub Cards ── */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground sm:text-xl">Core Learning Modules</h2>
          <span className="text-xs text-muted-foreground">Select a module to proceed</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Card 1: Practice */}
          <Link
            href="/dsc-sgt/practice"
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-1"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <BookOpen className="h-6 w-6 stroke-[2.2]" />
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                Practice Questions
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                12,000+ chapter-wise MCQs with instant step-by-step solutions and Telugu/English medium toggles.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-semibold text-primary">
              <span>Start Practicing</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Card 2: Mock Tests */}
          <Link
            href="/dsc-sgt/mock-tests"
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-1"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                <FileCheck2 className="h-6 w-6 stroke-[2.2]" />
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                Mock Test Series
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Full-length test series, previous years papers (2018–2024), and subject-wise timed mock tests.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <span>View 45+ Tests</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Card 3: Mock Exam */}
          <Link
            href="/dsc-sgt/mock-exam"
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-1"
          >
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Official UI
              </span>
            </div>
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 group-hover:scale-105 transition-transform">
                <Timer className="h-6 w-6 stroke-[2.2]" />
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                Mock Exam Simulator
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Realistic 150-mark, 150-minute exam interface with question palette, negative marking & ranking.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-semibold text-red-600 dark:text-red-400">
              <span>Launch Simulator</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Card 4: Performance */}
          <Link
            href="/dsc-sgt/performance"
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-1"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <BarChart3 className="h-6 w-6 stroke-[2.2]" />
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                Performance Analytics
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Subject-wise strengths, accuracy rates, weak area diagnosis, and AI-recommended revision topics.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span>View Insights</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>

        </div>
      </section>

      {/* ── Premium Pro Spotlight Banner ── */}
      <section className="mt-8">
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-card to-orange-500/10 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-500">
                <Crown className="h-3.5 w-3.5 fill-amber-500" />
                {isPremium ? 'PRO MEMBER BENEFITS ACTIVE' : 'PRO PASS ADVANTAGE'}
              </div>
              <h2 className="mt-3 text-xl sm:text-2xl font-black text-foreground">
                {isPremium ? 'You have Full Access to all AP DSC / SGT Features!' : 'Accelerate Your Score to 135+ with DSC SGT Pro'}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Unlock all 45+ Full Grand Mocks, 2018-2024 solved previous papers, AI-powered question hints, and offline downloadable PDF high-yield revision cards.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>All 150+ Mocks</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>Previous Papers</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span>State-wide Rank</span>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-start lg:items-end gap-2">
              <button
                onClick={() => openModal('overview_banner')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg transition hover:brightness-105 active:scale-95"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isPremium ? 'Manage Pro Subscription' : 'Upgrade to Pro Pass (₹599)'}</span>
              </button>
              <span className="text-[11px] text-muted-foreground">Instant activation · Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── AP DSC / SGT Syllabus & Marks Distribution ── */}
      <section className="mt-10 mb-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <div>
              <h2 className="text-lg font-bold text-foreground sm:text-xl">Official Exam Pattern & Syllabus Structure</h2>
              <p className="text-xs text-muted-foreground">Total 150 Marks · 150 Questions · 150 Minutes</p>
            </div>
          </div>
          <Link
            href="/dsc-sgt/practice"
            className="text-xs font-semibold text-primary hover:underline hidden sm:block"
          >
            Practice by Subject →
          </Link>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {SYLLABUS_SECTIONS.map((sec, idx) => (
            <div
              key={idx}
              className={`flex flex-col justify-between rounded-2xl border ${sec.border} bg-card p-4.5 transition hover:shadow-xs`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${sec.iconColor}`}>{sec.marks}</span>
                  <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {sec.questions}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-foreground leading-snug">{sec.name}</h3>
                <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{sec.topics}</p>
              </div>

              <Link
                href={`/dsc-sgt/practice?subject=${encodeURIComponent(sec.name)}`}
                className="mt-4 inline-flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-accent transition"
              >
                <span>Practice Section</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </Link>
            </div>
          ))}
        </div>
      </section>

    </main>
  )
}
