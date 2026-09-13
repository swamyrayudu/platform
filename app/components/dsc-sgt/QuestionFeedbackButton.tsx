// ============================================================
// app/components/dsc-sgt/QuestionFeedbackButton.tsx
// ============================================================
// The small "Report" control that sits on a reviewed question. Opens a
// compact panel: pick what is wrong, optionally say more, send.
// ============================================================
'use client'

import React, { useState } from 'react'
import { Flag, Loader2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { FEEDBACK_REASONS, type FeedbackReason, type FeedbackSource } from '@/types/question-feedback'

interface QuestionFeedbackButtonProps {
  /** `table:question_id` — the same identity the question bank uses. */
  questionUid: string
  source: FeedbackSource
  /** Included so an admin can reproduce the report inside a specific module. */
  mockTestId?: string | null
  /** Question text as shown, kept with the report in case it is later edited. */
  questionText?: string
  className?: string
}

export default function QuestionFeedbackButton({
  questionUid,
  source,
  mockTestId = null,
  questionText,
  className = '',
}: QuestionFeedbackButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<FeedbackReason | null>(null)
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const needsDetails = reason === 'other'
  const canSend = reason !== null && !sending && (!needsDetails || details.trim().length > 0)

  const submit = async () => {
    if (!canSend) return
    setSending(true)
    try {
      const res = await fetch('/api/dsc-sgt/questions/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          questionUid,
          reason,
          details: details.trim() || undefined,
          source,
          mockTestId,
          reportedQuestion: questionText,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        // Only pass a description when it adds something. The server's message
        // is sometimes the same sentence, and repeating it told the reader
        // nothing about what actually went wrong.
        const detail = typeof json.error === 'string' ? json.error : null
        toast.error('Could not send your report', {
          description: detail && detail !== 'Could not send your report' ? detail : undefined,
        })
        return
      }

      setSent(true)
      setOpen(false)
      toast.success(
        json.duplicate ? 'You have already reported this question' : 'Thanks — report sent',
        { description: json.duplicate ? undefined : 'Our team will review this question.' }
      )
    } catch {
      toast.error('Network error', { description: 'Please check your connection and retry.' })
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground ${className}`}
      >
        <Check className="h-3 w-3 text-emerald-500" />
        Reported
      </span>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
      >
        <Flag className="h-3 w-3" strokeWidth={1.8} />
        Report
      </button>

      {open && (
        <>
          {/* Tap-away layer, so the panel closes without a document listener */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          {/* Anchored popover from sm up. On a phone the button sits near the
              right edge, so a right-anchored 288px panel hangs off the left of
              the screen — there it becomes a centred sheet instead. */}
          <div className="fixed inset-x-4 top-1/2 z-40 max-h-[85dvh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-left shadow-xl animate-in fade-in-50 zoom-in-95 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:max-h-none sm:w-72 sm:translate-y-0 sm:overflow-visible">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold text-foreground">What is wrong here?</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 space-y-1">
              {FEEDBACK_REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={`flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                    reason === r.id
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-medium">{r.label}</span>
                    <span className="block text-[11px] opacity-75">{r.hint}</span>
                  </span>
                  {reason === r.id && <Check className="ml-auto mt-0.5 h-3 w-3 shrink-0" />}
                </button>
              ))}
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder={needsDetails ? 'Tell us what is wrong (required)' : 'Anything to add? (optional)'}
              className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
            />

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!canSend}
                className="bloom-pill bloom-pill-dark px-4 py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {sending && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>{sending ? 'Sending…' : 'Send report'}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
