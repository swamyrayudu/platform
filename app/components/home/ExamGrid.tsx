// ============================================================
// app/components/home/ExamGrid.tsx — Exam selection grid + controls
// ============================================================
'use client'

import React, { useState, useMemo } from 'react'
import { Search, LayoutGrid, List } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import ExamCard from './ExamCard'
import { EXAMS, type ExamItem } from './examData'
import { useAuth } from '@/app/contexts/AuthContext'
import { setActiveExam } from '@/lib/active-exam'

export default function ExamGrid() {
  const router = useRouter()
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filteredExams = useMemo(() => {
    if (!searchQuery.trim()) return EXAMS
    const q = searchQuery.toLowerCase().trim()
    return EXAMS.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.sublabel.toLowerCase().includes(q) ||
        e.tag.toLowerCase().includes(q) ||
        e.meta.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const handleExamClick = (exam: ExamItem) => {
    if (!exam.available) {
      toast.info(`${exam.label} · Locked`, {
        description: `${exam.sublabel} (${exam.tag}) is currently locked. We will unlock it soon!`,
        duration: 4000,
      })
    } else {
      toast.success(`${exam.label} Selected`, {
        description: `Entering ${exam.sublabel} Preparation Hub...`,
        duration: 2000,
      })
      // Lock the candidate into this hub. They stay here until they sign out.
      setActiveExam(user?.id, 'dsc-sgt')
      router.replace('/dsc-sgt')
    }
  }

  return (
    <section className="mt-14 lg:mt-20">
      {/* Header & controls — the landing page's editorial section rhythm */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <p className="bloom-eyebrow">Choose a category</p>
          <h2 className="mt-2 text-3xl font-medium text-foreground sm:text-[2.5rem]">
            All exams
          </h2>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Each category opens its own hub — syllabus-mapped practice,
            full-length mock tests and solved previous papers.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search
              className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.6}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exam category..."
              className="h-10 w-full rounded-full border border-border bg-card pl-11 pr-4 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={1.6} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>

      </div>

      {/* Grid or list */}
      {filteredExams.length > 0 ? (
        <div
          className={
            viewMode === 'grid'
              ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'flex flex-col gap-3'
          }
        >
          {filteredExams.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              viewMode={viewMode}
              onClick={() => handleExamClick(exam)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-14 text-center">
          <Search className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
          <p className="mt-4 text-sm font-medium text-foreground">No categories found</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Try a different term like &quot;DSC&quot;, &quot;Railway&quot; or &quot;APPSC&quot;.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="bloom-pill bloom-pill-dark mt-5 px-4 py-2 text-[13px]"
          >
            Clear search
          </button>
        </div>
      )}
    </section>
  )
}
