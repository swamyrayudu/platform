// ============================================================
// app/components/home/ExamCard.tsx — Single exam card (Highlighted Active + Locked)
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

  if (viewMode === 'list') {
    return (
      <div
        onClick={onClick}
        className={`group flex items-center justify-between rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
          isLive
            ? 'border-primary/50 bg-card shadow-xs ring-1 ring-primary/20 hover:border-primary hover:shadow-md'
            : 'border-border/70 bg-card/60 opacity-80 hover:opacity-100 hover:border-border'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
              isLive
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border/40 bg-muted text-muted-foreground'
            }`}
          >
            <Icon className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-base font-bold transition-colors ${isLive ? 'text-foreground group-hover:text-primary' : 'text-foreground'}`}>
                {exam.label}
              </h3>
              {isLive ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" />
                  Locked
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{exam.sublabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className={`hidden sm:inline-block rounded-full border px-3 py-1 text-[11px] font-medium ${
            isLive
              ? 'border-primary/20 bg-primary/5 text-primary'
              : 'border-border bg-muted/50 text-muted-foreground'
          }`}>
            {exam.tag}
          </span>
          <span className="hidden md:inline-block text-xs text-muted-foreground">
            {exam.meta}
          </span>
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
              isLive
                ? 'bg-primary text-primary-foreground shadow-xs group-hover:scale-110 group-hover:bg-primary/90'
                : 'border border-border/80 bg-muted/60 text-muted-foreground group-hover:bg-accent group-hover:text-foreground'
            }`}
          >
            {isLive ? <ArrowRight className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col justify-between rounded-2xl border p-5.5 transition-all duration-200 cursor-pointer ${
        isLive
          ? 'border-primary/50 bg-card shadow-xs ring-1 ring-primary/20 hover:border-primary hover:shadow-md hover:-translate-y-0.5'
          : 'border-border/70 bg-card/60 opacity-80 hover:opacity-100 hover:border-border hover:shadow-xs'
      }`}
    >
      {/* Top Row: Icon + Title + Status Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          {/* Icon Box */}
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
              isLive
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border/40 bg-muted text-muted-foreground shadow-2xs'
            }`}
          >
            <Icon className="h-5 w-5 stroke-[2.2]" />
          </div>

          {/* Title & Subtitle */}
          <div>
            <h3 className={`text-[15px] font-bold transition-colors ${isLive ? 'text-foreground group-hover:text-primary' : 'text-foreground'}`}>
              {exam.label}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
              {exam.sublabel}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/80 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Lock className="h-2.5 w-2.5" />
              Locked
            </span>
          )}
        </div>
      </div>

      {/* Middle Row: Tag pill & Action CTA (Arrow for active, Lock for others) */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${
          isLive
            ? 'border-primary/20 bg-primary/5 text-primary'
            : 'border-border bg-muted/50 text-muted-foreground'
        }`}>
          {exam.tag}
        </span>

        {/* Action Button: Arrow for Active, Lock for locked exams */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
            isLive
              ? 'bg-primary text-primary-foreground shadow-xs group-hover:scale-110 group-hover:bg-primary/90'
              : 'border border-border/80 bg-muted/60 text-muted-foreground group-hover:bg-accent group-hover:text-foreground'
          }`}
        >
          {isLive ? <ArrowRight className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
        </div>
      </div>

      {/* Bottom Row: Metadata info */}
      <div className="mt-3.5 border-t border-border/60 pt-2.5">
        <p className="text-[11px] text-muted-foreground">
          {exam.meta}
        </p>
      </div>
    </div>
  )
}
