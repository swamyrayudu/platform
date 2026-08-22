'use client'

// ============================================================
// app/components/dsc-sgt/practice/exam/ExamModals.tsx
// ============================================================

import React from 'react'
import { RotateCcw } from 'lucide-react'

interface SubmitModalProps {
  show: boolean
  answeredCount: number
  totalQuestions: number
  isSubmitting: boolean
  onClose: () => void
  onConfirm: () => void
}

export function SubmitModal({
  show,
  answeredCount,
  totalQuestions,
  isSubmitting,
  onClose,
  onConfirm,
}: SubmitModalProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl text-center">
        <h3 className="text-base sm:text-lg font-black text-foreground">
          Submit Practice Session?
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-2">
          You answered <strong>{answeredCount}</strong> of <strong>{totalQuestions}</strong> questions.
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-accent cursor-pointer"
          >
            Keep Solving
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ExitModalProps {
  show: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ExitModal({ show, onClose, onConfirm }: ExitModalProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-3">
          <RotateCcw className="h-6 w-6" />
        </div>
        <h3 className="text-base sm:text-lg font-black text-foreground">
          Exit Practice Session?
        </h3>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          If you exit now without submitting, your session will be discarded and will not be recorded in your history.
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-foreground hover:bg-accent cursor-pointer"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-destructive py-2.5 text-xs font-bold text-destructive-foreground hover:bg-destructive/90 cursor-pointer shadow-xs"
          >
            Exit Without Saving
          </button>
        </div>
      </div>
    </div>
  )
}
