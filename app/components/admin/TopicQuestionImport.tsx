'use client'

import { useState } from 'react'
import { Check, ClipboardCopy, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { ImportPreviewResponse } from '@/types/bulk-import'

const HEADER = 'question,option_a,option_b,option_c,option_d,correct_answer,explanation,subtopic,chapter,difficulty,class_level'

export default function TopicQuestionImport({ table, topic, disabled, onBusyChange, onAdded }: {
  table: string
  topic: string | null
  disabled: boolean
  onBusyChange: (busy: boolean) => void
  onAdded: () => void
}) {
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const applied = preview?.applied === true
  const refused = preview ? preview.summary.invalid + preview.summary.duplicateId + preview.summary.duplicateText : 0

  async function run(apply: boolean) {
    if (!csv.trim() || busy || disabled || applied) return
    if (apply && (!preview || refused > 0 || preview.summary.toInsert === 0)) return
    setBusy(true)
    onBusyChange(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/questions/import', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, topic, csv, apply }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Could not add questions')
        return
      }
      setPreview(data as ImportPreviewResponse)
      if (apply) {
        toast.success(`Added ${data.summary.inserted ?? 0} new question(s)`, {
          description: 'New IDs created. The selected topic is ready for review.',
        })
        onAdded()
      }
    } catch {
      setError('Network error while adding questions.')
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-primary/30 bg-card p-5" aria-label="Add new questions to the selected topic">
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Plus className="h-4 w-4" /> Add new questions
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Add one or more questions to <strong className="text-foreground">{topic || 'No topic'}</strong>.
        New IDs are generated automatically, and the selected topic is assigned to every new row.
        Paste only new questions here. Existing questions stay unchanged.
      </p>
      <button disabled={disabled || busy} onClick={async () => {
        try {
          await navigator.clipboard.writeText(HEADER)
          toast.success('Copied new-question CSV header')
        } catch { toast.error('Could not copy. Use the header shown in the CSV box.') }
      }} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50">
        <ClipboardCopy className="h-3.5 w-3.5" /> Copy CSV header
      </button>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-xs font-semibold">New question CSV (up to 500 rows)</span>
        <textarea value={csv} disabled={disabled || busy} spellCheck={false}
          onChange={(e) => { setCsv(e.target.value); setPreview(null); setError(null) }}
          placeholder={`${HEADER}\n"New question","First option","Second option","Third option","Fourth option",B,"Explanation","Subtopic","Chapter","Medium","6"`}
          className="h-44 w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/50" />
      </label>
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      <button onClick={() => run(false)} disabled={disabled || busy || !csv.trim() || applied}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Preview new questions
      </button>
      {preview && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs font-semibold">
            {applied ? `${preview.summary.inserted ?? 0} questions added` : `${preview.summary.toInsert} new questions · ${preview.summary.generatedIds} new IDs · ${refused} refused rows`}
          </p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {preview.rows.map((row) => (
              <div key={row.line} className={`rounded-lg border p-3 text-xs ${row.status === 'new' ? 'border-border' : 'border-destructive/40'}`}>
                <p className="font-medium">Line {row.line} · {row.questionId ?? 'No ID'} · {row.status.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-muted-foreground">{row.preview}</p>
                {row.errors.map((message) => <p key={message} className="mt-1 text-destructive">{message}</p>)}
                {row.warnings.map((message) => <p key={message} className="mt-1 text-amber-600">{message}</p>)}
              </div>
            ))}
          </div>
          {preview.fileErrors.map((message) => <p key={message} className="mt-2 text-xs text-muted-foreground">{message}</p>)}
          {!applied ? (
            <button onClick={() => run(true)} disabled={disabled || busy || refused > 0 || preview.summary.toInsert === 0}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add {preview.summary.toInsert} new question(s)
            </button>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-600"><Check className="h-3.5 w-3.5" /> Live in practice. Available for future mock modules.</span>
              <button disabled={disabled || busy} onClick={() => { setCsv(''); setPreview(null); setError(null) }}
                className="rounded-lg border border-border px-3 py-2 font-semibold hover:bg-accent disabled:opacity-50">Add more questions</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
