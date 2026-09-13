// ============================================================
// app/components/home/ExamCard.tsx — Single exam card (grid + list views)
// ============================================================
'use client'

import React from 'react'
import { ArrowRight, Lock } from 'lucide-react'
import type { ExamItem } from './examData'

interface ExamCardProps {
  exam: ExamItem
  onClick: () => void
  viewMode?: 'grid' | 'list'
}

export default function ExamCard({ exam, onClick, viewMode = 'grid' }: ExamCardProps) {
  const Icon = exam.icon
  const isLive = exam.available

  /* ── Status pill, shared by both views ── */
  const statusPill = isLive ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-secondary-foreground">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bloom-violet" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
      <Lock className="h-2.5 w-2.5" />
      Locked
    </span>
  )

  /* ── Circular action affordance ── */
  const action = (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
        isLive
          ? 'bg-primary text-primary-foreground group-hover:scale-110'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {isLive ? <ArrowRight className="h-4 w-4" strokeWidth={1.8} /> : <Lock className="h-3.5 w-3.5" />}
    </div>
  )

  /* ── List view ── */
  if (viewMode === 'list') {
    return (
      <div
        onClick={onClick}
        className={`group flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all duration-200 ${
          isLive
            ? 'border-border bg-card hover:border-ring/50'
            : 'border-border/60 bg-card/60 hover:border-border'
        }`}
      >
        <div className="flex items-center gap-4">
          <Icon
            className={`h-5 w-5 shrink-0 ${isLive ? 'text-primary' : 'text-muted-foreground'}`}
            strokeWidth={1.6}
          />
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[15px] font-medium text-foreground">{exam.label}</h3>
              {statusPill}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{exam.sublabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden text-[11px] text-muted-foreground sm:inline-block">{exam.tag}</span>
          <span className="hidden text-[11px] text-muted-foreground md:inline-block">{exam.meta}</span>
          {action}
        </div>
      </div>
    )
  }

  /* ── Grid view ── */
  return (
    <article
      onClick={onClick}
      className={`group flex cursor-pointer flex-col rounded-2xl border p-5 transition-all duration-200 ${
        isLive
          ? 'border-border bg-card hover:border-ring/50'
          : 'border-border/60 bg-card/60 hover:border-border'
      }`}
    >
      {/* Icon + status */}
      <div className="flex items-start justify-between gap-3">
        <Icon
          className={`h-5 w-5 ${isLive ? 'text-primary' : 'text-muted-foreground'}`}
          strokeWidth={1.6}
        />
        {statusPill}
      </div>

      {/* Title & subtitle */}
      <h3 className="mt-4 text-base font-medium text-foreground">{exam.label}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{exam.sublabel}</p>

      {/* Footer: tag + action */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-6">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">{exam.tag}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{exam.meta}</p>
        </div>
        {action}
      </div>
    </article>
  )
}
