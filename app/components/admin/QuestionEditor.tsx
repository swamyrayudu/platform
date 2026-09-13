// ============================================================
// app/components/admin/QuestionEditor.tsx
// ============================================================
// Edits one question in place. The question bank is the single source of
// truth for both practice and mock tests, so saving here reaches both — see
// app/api/admin/questions/[uid]/route.ts for how the mock cache is cleared.
// ============================================================
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, RotateCcw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { EditableQuestion } from '@/types/question-feedback'

const OPTIONS = ['A', 'B', 'C', 'D'] as const

interface QuestionEditorProps {
  questionUid: string
  /** Called after a successful save so the queue can refresh. */
  onSaved?: () => void
}

type Draft = Pick<
  EditableQuestion,
  | 'question'
  | 'option_a'
  | 'option_b'
  | 'option_c'
  | 'option_d'
  | 'correct_answer'
  | 'explanation'
  | 'difficulty'
  | 'topic'
>

function toDraft(q: EditableQuestion): Draft {
  return {
    question: q.question ?? '',
    option_a: q.option_a ?? '',
    option_b: q.option_b ?? '',
    option_c: q.option_c ?? '',
    option_d: q.option_d ?? '',
    correct_answer: (q.correct_answer ?? 'A').toUpperCase(),
    explanation: q.explanation ?? '',
    difficulty: q.difficulty ?? '',
    topic: q.topic ?? '',
  }
}

export default function QuestionEditor({ questionUid, onSaved }: QuestionEditorProps) {
  const [question, setQuestion] = useState<EditableQuestion | null>(null)
  const [modules, setModules] = useState<{ id: string; title: string; module_number: number | null }[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(questionUid)}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Could not load this question')
        setLoading(false)
        return
      }
      setQuestion(json.question)
      setDraft(toDraft(json.question))
      setModules(json.used_in_modules ?? [])
      setError(null)
      setLoading(false)
    } catch {
      setError('Network error — please try again')
      setLoading(false)
    }
  }, [questionUid])

  useEffect(() => {
    void load()
  }, [load])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d))

  const dirty =
    question != null && draft != null && JSON.stringify(draft) !== JSON.stringify(toDraft(question))

  const save = async () => {
    if (!draft || !dirty) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/questions/${encodeURIComponent(questionUid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        toast.error('Could not save', { description: json.error })
        return
      }

      setQuestion(json.question)
      setDraft(toDraft(json.question))
      toast.success('Question updated', {
        description:
          json.invalidated_modules > 0
            ? `Live in practice, and refreshed in ${json.invalidated_modules} mock module${json.invalidated_modules === 1 ? '' : 's'}.`
            : 'Live in practice. Not used by any mock module yet.',
      })
      onSaved?.()
    } catch {
      toast.error('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading question…
      </div>
    )
  }

  if (error || !draft || !question) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{error ?? 'Question unavailable'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Where this question is in use */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <code className="rounded bg-muted px-1.5 py-0.5">{question.question_uid}</code>
        {question.subject && <span>· {question.subject}</span>}
        <span>
          · Used in {modules.length} mock module{modules.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Question text */}
      <label className="block">
        <span className="text-[11px] font-semibold text-foreground">Question</span>
        <textarea
          value={draft.question}
          onChange={(e) => set('question', e.target.value)}
          rows={3}
          className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
        />
      </label>

      {/* Options + answer key */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-foreground">
          Options — select the correct one
        </span>
        {OPTIONS.map((letter) => {
          const key = `option_${letter.toLowerCase()}` as keyof Draft
          const isCorrect = draft.correct_answer === letter
          return (
            <div key={letter} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => set('correct_answer', letter)}
                aria-pressed={isCorrect}
                title={`Mark ${letter} correct`}
                className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold transition ${
                  isCorrect
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {letter}
              </button>
              <textarea
                value={String(draft[key] ?? '')}
                onChange={(e) => set(key, e.target.value as Draft[typeof key])}
                rows={1}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
              />
            </div>
          )
        })}
      </div>

      {/* Explanation */}
      <label className="block">
        <span className="text-[11px] font-semibold text-foreground">Explanation</span>
        <textarea
          value={draft.explanation ?? ''}
          onChange={(e) => set('explanation', e.target.value)}
          rows={2}
          className="mt-1 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-semibold text-foreground">Topic</span>
          <input
            value={draft.topic ?? ''}
            onChange={(e) => set('topic', e.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-foreground">Difficulty</span>
          <input
            value={draft.difficulty ?? ''}
            onChange={(e) => set('difficulty', e.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-ring/60 focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        {dirty && (
          <button
            type="button"
            onClick={() => setDraft(toDraft(question))}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Discard
          </button>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="bloom-pill bloom-pill-dark px-4 py-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          <span>{saving ? 'Saving…' : 'Save question'}</span>
        </button>
      </div>
    </div>
  )
}
