'use client'

// ============================================================
// app/components/dsc-sgt/practice/exam/ExamProgressBar.tsx
// ============================================================

import React from 'react'

interface ExamProgressBarProps {
  progressPct: number
}

export default function ExamProgressBar({ progressPct }: ExamProgressBarProps) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
      <div
        className="h-full bg-primary transition-all duration-300 rounded-full"
        style={{ width: `${progressPct}%` }}
      />
    </div>
  )
}
