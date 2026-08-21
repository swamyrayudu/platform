'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileCheck2,
  Lock,
  Play,
  Clock,
  Award,
  Users,
  Sparkles,
  Crown,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'
import { toast } from 'sonner'

interface MockTest {
  id: string
  title: string
  category: 'Full Grand Mock' | 'Subject Mock' | 'Previous Year Paper'
  subject?: string
  totalQuestions: number
  totalMarks: number
  durationMins: number
  attemptsCount: number
  avgScore: number
  difficulty: 'Standard AP DSC' | 'Moderate' | 'Challenging'
  isFree: boolean
  year?: string
  tag: string
}

const MOCK_TESTS: MockTest[] = [
  {
    id: 'dsc-grand-01',
    title: 'AP DSC / SGT Grand Mock Test - 01 (Official Blueprint)',
    category: 'Full Grand Mock',
    totalQuestions: 150,
    totalMarks: 150,
    durationMins: 150,
    attemptsCount: 14280,
    avgScore: 94.5,
    difficulty: 'Standard AP DSC',
    isFree: true,
    tag: 'Free Full Test',
  },
  {
    id: 'dsc-grand-02',
    title: 'AP DSC / SGT Grand Mock Test - 02 (High-Yield Expected)',
    category: 'Full Grand Mock',
    totalQuestions: 150,
    totalMarks: 150,
    durationMins: 150,
    attemptsCount: 9840,
    avgScore: 98.2,
    difficulty: 'Moderate',
    isFree: false,
    tag: 'Pro Grand Test',
  },
  {
    id: 'dsc-grand-03',
    title: 'AP DSC / SGT Grand Mock Test - 03 (Advanced Pedagogy Focus)',
    category: 'Full Grand Mock',
    totalQuestions: 150,
    totalMarks: 150,
    durationMins: 150,
    attemptsCount: 7120,
    avgScore: 89.0,
    difficulty: 'Challenging',
    isFree: false,
    tag: 'Pro Grand Test',
  },
  {
    id: 'prev-paper-2024',
    title: 'AP DSC SGT Official Question Paper (2024 Shift 1 Solved)',
    category: 'Previous Year Paper',
    totalQuestions: 150,
    totalMarks: 150,
    durationMins: 150,
    attemptsCount: 22100,
    avgScore: 102.4,
    difficulty: 'Standard AP DSC',
    isFree: true,
    year: '2024 Official',
    tag: 'Free Paper',
  },
  {
    id: 'prev-paper-2019',
    title: 'AP DSC SGT Official Question Paper (2019 Solved with Key)',
    category: 'Previous Year Paper',
    totalQuestions: 150,
    totalMarks: 150,
    durationMins: 150,
    attemptsCount: 18450,
    avgScore: 97.6,
    difficulty: 'Standard AP DSC',
    isFree: false,
    year: '2019 Official',
    tag: 'Pro PYQ',
  },
  {
    id: 'prev-paper-2018',
    title: 'AP DSC SGT Official Question Paper (2018 Solved with Key)',
    category: 'Previous Year Paper',
    totalQuestions: 150,
    totalMarks: 150,
    durationMins: 150,
    attemptsCount: 15200,
    avgScore: 95.1,
    difficulty: 'Standard AP DSC',
    isFree: false,
    year: '2018 Official',
    tag: 'Pro PYQ',
  },
  {
    id: 'sub-pedagogy-01',
    title: 'Child Development & Classroom Psychology Speed Drill',
    category: 'Subject Mock',
    subject: 'Pedagogy',
    totalQuestions: 30,
    totalMarks: 30,
    durationMins: 30,
    attemptsCount: 8900,
    avgScore: 21.4,
    difficulty: 'Moderate',
    isFree: true,
    tag: 'Free Sectional',
  },
  {
    id: 'sub-telugu-01',
    title: 'Telugu Vyakaranam & Literature Mastery Test',
    category: 'Subject Mock',
    subject: 'Telugu',
    totalQuestions: 30,
    totalMarks: 30,
    durationMins: 30,
    attemptsCount: 7600,
    avgScore: 23.8,
    difficulty: 'Moderate',
    isFree: false,
    tag: 'Pro Sectional',
  },
  {
    id: 'sub-maths-01',
    title: 'Mathematics & Methodology Speed Mock',
    category: 'Subject Mock',
    subject: 'Mathematics',
    totalQuestions: 40,
    totalMarks: 40,
    durationMins: 45,
    attemptsCount: 6540,
    avgScore: 26.2,
    difficulty: 'Challenging',
    isFree: false,
    tag: 'Pro Sectional',
  },
]

export default function MockTestsPage() {
  const router = useRouter()
  const { isPremium, openModal } = usePremium()
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'Full Grand Mock' | 'Subject Mock' | 'Previous Year Paper'>('All')
  const [search, setSearch] = useState('')

  const filteredTests = MOCK_TESTS.filter((t) => {
    const matchesFilter = selectedFilter === 'All' || t.category === selectedFilter
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || (t.subject && t.subject.toLowerCase().includes(search.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  const handleStartTest = (test: MockTest) => {
    if (!test.isFree && !isPremium) {
      openModal(`mock_test_${test.id}`)
      return
    }
    toast.success(`Starting ${test.title}`, {
      description: 'Launching Exam Environment...',
    })
    router.push(`/dsc-sgt/mock-exam?testId=${test.id}`)
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-purple-500" />
            <h1 className="text-xl font-black text-foreground sm:text-2xl">
              AP DSC / SGT Mock Test Series
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Full 150-mark Grand Mocks, Previous Solved Papers & Sectional Speed Tests
          </p>
        </div>

        {/* Pro Banner pill */}
        {!isPremium && (
          <button
            onClick={() => openModal('mock_tests_top')}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-105"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>Unlock All 45+ Tests (₹599)</span>
          </button>
        )}
      </div>

      {/* ── Filters & Search Row ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['All', 'Full Grand Mock', 'Previous Year Paper', 'Subject Mock'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                selectedFilter === filter
                  ? 'border-purple-500 bg-purple-500 text-white shadow-xs'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter === 'All' ? 'All Tests (9)' : filter}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test name..."
            className="h-9 w-full rounded-xl border border-border/80 bg-card pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* ── Test Cards Grid ── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTests.map((test) => {
          const isLocked = !test.isFree && !isPremium

          return (
            <div
              key={test.id}
              className={`group relative flex flex-col justify-between rounded-3xl border p-5.5 transition-all duration-200 ${
                isLocked
                  ? 'border-border/70 bg-card/60 hover:border-amber-500/40'
                  : 'border-border/80 bg-card shadow-xs hover:border-purple-500/50 hover:shadow-md hover:-translate-y-0.5'
              }`}
            >
              <div>
                {/* Top Badge & Access Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {test.category}
                  </span>

                  {test.isFree ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Free Access
                    </span>
                  ) : isPremium ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500">
                      <Crown className="h-3 w-3 fill-amber-500" /> Pro Unlocked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-500">
                      <Lock className="h-3 w-3" /> Pro Test
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="mt-3.5 text-sm sm:text-base font-bold text-foreground leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {test.title}
                </h3>

                {/* Test Meta Specs */}
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-border/60 bg-muted/30 p-2.5 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground">Questions</span>
                    <p className="font-bold text-foreground">{test.totalQuestions}</p>
                  </div>
                  <div className="border-x border-border/60">
                    <span className="text-[10px] text-muted-foreground">Marks</span>
                    <p className="font-bold text-foreground">{test.totalMarks} M</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground">Duration</span>
                    <p className="font-bold text-foreground">{test.durationMins} Mins</p>
                  </div>
                </div>

                {/* Social Proof */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{test.attemptsCount.toLocaleString()} Candidates</span>
                  </div>
                  <div className="flex items-center gap-1 font-medium">
                    <Award className="h-3.5 w-3.5 text-primary" />
                    <span>Avg: {test.avgScore}/{test.totalMarks}</span>
                  </div>
                </div>
              </div>

              {/* Start Test CTA */}
              <div className="mt-5 border-t border-border/60 pt-3.5">
                <button
                  onClick={() => handleStartTest(test)}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition-all ${
                    isLocked
                      ? 'border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 hover:border-amber-500'
                      : 'bg-purple-600 text-white shadow-xs hover:bg-purple-700 hover:shadow-md active:scale-[0.99]'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      <span>Unlock with Pro</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Start Mock Test</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

    </main>
  )
}
