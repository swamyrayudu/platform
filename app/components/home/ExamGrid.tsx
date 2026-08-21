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

export default function ExamGrid() {
  const router = useRouter()
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
      router.push('/dsc-sgt')
    }
  }

  return (
    <section className="mb-10">
      {/* Category Header & Controls Row */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        
        {/* Left: Category Title with Primary Accent Bar */}
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1 rounded-full bg-primary" />
          <h2 className="text-lg font-bold text-foreground sm:text-xl">
            All Categories
          </h2>
        </div>

        {/* Right: Search Input + View Toggles */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search exam category..."
              className="h-9.5 w-full rounded-xl border border-border/80 bg-card pl-9 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground shadow-2xs focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>

          {/* Grid / List View Toggle Buttons */}
          <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card p-1 shadow-2xs">
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Grid or List Layout */}
      {filteredExams.length > 0 ? (
        <div
          className={
            viewMode === 'grid'
              ? 'grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3'
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-foreground">No categories found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try searching with a different term like &quot;DSC&quot;, &quot;Railway&quot;, or &quot;APPSC&quot;.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 rounded-xl border border-border bg-card px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
          >
            Clear Search
          </button>
        </div>
      )}
    </section>
  )
}
