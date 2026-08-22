'use client'

// ============================================================
// app/components/dsc-sgt/practice/results/QuestionReviewList.tsx
// ============================================================

import React, { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { PracticeResultSummary } from '@/types/practice'

type ReviewFilter = 'all' | 'incorrect' | 'correct' | 'skipped' | 'marked'

interface QuestionReviewListProps {
  questionsReview: PracticeResultSummary['questions_review']
}

export default function QuestionReviewList({ questionsReview }: QuestionReviewListProps) {
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())

  const toggleExpand = (qId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(qId)) next.delete(qId)
      else next.add(qId)
      return next
    })
  }

  const filteredQuestions = React.useMemo(() => {
    return questionsReview.filter((q) => {
      if (reviewFilter === 'incorrect') return !q.is_correct && !q.is_skipped
      if (reviewFilter === 'correct') return q.is_correct
      if (reviewFilter === 'skipped') return q.is_skipped
      if (reviewFilter === 'marked') return q.is_marked
      return true
    })
  }, [questionsReview, reviewFilter])

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-base font-bold text-foreground">Detailed Question Review</h2>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border/60">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'incorrect', label: 'Incorrect' },
              { id: 'correct', label: 'Correct' },
              { id: 'skipped', label: 'Skipped' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setReviewFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                reviewFilter === f.id
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Review Questions Accordion / Cards */}
      <div className="space-y-3">
        {filteredQuestions.map((q, idx) => {
          const qId = q.question_id || q.id || `rq-${idx}`
          const isExpanded = expandedQuestions.has(qId)

          return (
            <div
              key={qId}
              className={`rounded-2xl border transition-all ${
                q.is_correct
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : q.is_skipped
                  ? 'border-border/60 bg-muted/10'
                  : 'border-destructive/20 bg-destructive/5'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpand(qId)}
                className="flex w-full items-start justify-between gap-3 p-4 sm:p-5 text-left cursor-pointer"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {q.is_correct ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : q.is_skipped ? (
                    <div className="h-5 w-5 rounded-full border border-muted-foreground/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                      —
                    </div>
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] font-black text-foreground">Q {idx + 1}</span>
                      <span className="text-[11px] text-muted-foreground">• {q.topic}</span>
                      {q.is_marked && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                          Marked
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2">
                      {q.question}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {q.time_taken_seconds || 0}s
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border/40 p-4 sm:p-5 pt-3 space-y-3 animate-in fade-in-50 text-xs sm:text-sm">
                  {/* 4 Options Grid */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { key: 'A', text: q.option_a },
                      { key: 'B', text: q.option_b },
                      { key: 'C', text: q.option_c },
                      { key: 'D', text: q.option_d },
                    ].map((opt) => {
                      const isUserChoice = q.user_answer === opt.key
                      const isCorrectChoice = q.correct_answer === opt.key

                      let optStyle = 'border-border/60 bg-card text-muted-foreground'
                      if (isCorrectChoice) {
                        optStyle = 'border-emerald-500 bg-emerald-500/10 text-foreground font-bold'
                      } else if (isUserChoice && !q.is_correct) {
                        optStyle = 'border-destructive bg-destructive/10 text-foreground'
                      }

                      return (
                        <div
                          key={opt.key}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border ${optStyle}`}
                        >
                          <span className="font-black shrink-0">{opt.key}.</span>
                          <span className="flex-1 text-xs">{opt.text}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Explanation Banner */}
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-foreground">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                      <Lightbulb className="h-4 w-4" /> Explanation:
                    </div>
                    <p className="leading-relaxed whitespace-pre-line">
                      {q.explanation || 'Official SCERT verified key answer.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
