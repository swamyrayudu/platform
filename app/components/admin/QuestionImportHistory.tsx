'use client'

import { useEffect, useRef, useState } from 'react'
import { History, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import CsvFilePicker from './CsvFilePicker'
import type { ImportUndoPreview, QuestionImportBatch } from '@/types/bulk-import'

export default function QuestionImportHistory({ table, topic, revision = 0, disabled = false, onBusyChange, onChanged }: {
  table: string
  topic?: string | null
  revision?: number | string
  disabled?: boolean
  onBusyChange: (busy: boolean) => void
  onChanged: () => void
}) {
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<{ batches: QuestionImportBatch[]; total: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const inProgress = useRef(false)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportUndoPreview | null>(null)
  const [recovery, setRecovery] = useState(false)
  const [csv, setCsv] = useState('')
  const [recoveryTopic, setRecoveryTopic] = useState('')
  const [noTopic, setNoTopic] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const scopedTopic = topic === undefined ? (noTopic ? null : recoveryTopic) : topic

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ table, page: String(page) })
    if (topic !== undefined) params.set('topic', JSON.stringify(topic))
    async function load() {
      try {
        const response = await fetch(`/api/admin/questions/import/history?${params}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.error ?? 'Could not load imports')
        if (!controller.signal.aborted) { setHistory(data); setHistoryError(null) }
      } catch (err) {
        if (!controller.signal.aborted) setHistoryError(err instanceof Error ? err.message : 'Could not load imports')
      }
    }
    void load()
    const timer = window.setInterval(() => { if (!inProgress.current) void load() }, 30000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [table, topic, page, revision, refresh])

  function changeCsv(text: string) { setCsv(text); setPreview(null); setRequestId(null); setError(null) }

  async function run(batchId: string | null, action: 'undo' | 'restore', apply: boolean) {
    if (busy || disabled || (apply && !preview?.eligible)) return
    inProgress.current = true
    setBusy(true); onBusyChange(true); setError(null)
    const id = requestId ?? crypto.randomUUID()
    if (!batchId) setRequestId(id)
    try {
      const response = await fetch(`/api/admin/questions/import/${batchId ? 'history' : 'recover'}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchId ? { table, batchId, action, apply } : {
          table, topic: scopedTopic, csv, requestId: id, apply, snapshotHash: preview?.snapshotHash,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error ?? 'Could not change import')
      if (apply) {
        toast.success(action === 'undo' ? `Undone: ${data.count} added questions removed. Backup saved.` : `Restored ${data.count} questions with their original IDs.`)
        setPreview(null); setCsv(''); setRequestId(null); setRecovery(false)
        setRefresh((n) => n + 1); onChanged()
      } else setPreview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. You can safely retry.')
      if (!apply) setPreview(null)
    } finally { inProgress.current = false; setBusy(false); onBusyChange(false) }
  }

  return (
    <section className="mb-5 rounded-2xl border border-border bg-card p-5" aria-label="Question import history and undo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" /> Added question history · Undo</h2>
        <button disabled={busy || disabled} onClick={() => setRefresh((n) => n + 1)} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50">Refresh history</button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Shared with all admins. Preview an import to undo its additions. A saved backup lets you restore the same IDs.</p>
      {(error || historyError) && <p role="alert" className="mt-3 text-xs text-destructive">{error || historyError}</p>}
      {!history ? <p className="mt-3 text-xs text-muted-foreground">Loading imports…</p> : (
        <>
          {!history.batches.length && <p className="mt-3 text-xs text-muted-foreground">No recorded imports here yet. For an earlier mistake, use the original CSV below.</p>}
          <div className="mt-3 space-y-3">
            {history.batches.map((batch) => (
              <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-xs">
                <div>
                  <p className="font-semibold">{batch.row_count} questions · {batch.status === 'undone' ? 'Undone · backup saved' : batch.origin === 'recovery' ? 'Recovered import restored' : 'Added'}</p>
                  <p className="mt-1 text-muted-foreground">{batch.topics.map((name) => name ?? 'No topic').join(', ')} · {new Date(batch.created_at).toLocaleString()}</p>
                  <p className="mt-1 text-muted-foreground">{batch.actor?.name || batch.actor?.email || 'Admin'}{batch.origin === 'recovery' ? ' · Earlier import recovered' : ''}</p>
                </div>
                <button disabled={busy || disabled} onClick={() => { setRecovery(false); setPreview(null); void run(batch.id, batch.status === 'undone' ? 'restore' : 'undo', false) }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-50">
                  <RotateCcw className="h-3.5 w-3.5" /> Preview {batch.status === 'undone' ? 'Restore' : 'Undo'}
                </button>
              </div>
            ))}
          </div>
          {history.total > 20 && <div className="mt-3 flex items-center gap-3 text-xs">
            <button disabled={busy || disabled || page === 1} onClick={() => { setPage((n) => n - 1); setPreview(null) }} className="rounded-lg border p-2 disabled:opacity-50">Previous</button>
            <span>Page {page} of {Math.ceil(history.total / 20)}</span>
            <button disabled={busy || disabled || page * 20 >= history.total} onClick={() => { setPage((n) => n + 1); setPreview(null) }} className="rounded-lg border p-2 disabled:opacity-50">Next</button>
          </div>}
        </>
      )}
      <button disabled={busy || disabled} onClick={() => { setRecovery(!recovery); setPreview(null); setError(null) }} className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">{recovery ? 'Close earlier import' : 'Undo an earlier import using its original CSV'}</button>
      {recovery && <div className="mt-3 rounded-xl border border-border p-4">
        <p className="text-xs text-muted-foreground">Use the file you originally added by mistake. We match its question text, options and answer in the wrong topic. Review every matched question before Undo.</p>
        {topic === undefined && <label className="mt-3 block text-xs">Wrong topic (exact name)
          <input value={recoveryTopic} disabled={busy || disabled || noTopic} onChange={(e) => { setRecoveryTopic(e.target.value); setPreview(null); setRequestId(null) }} className="mt-1 block w-full rounded-lg border border-border bg-background p-2" />
          <span className="mt-2 flex items-center gap-2"><input type="checkbox" checked={noTopic} disabled={busy || disabled} onChange={(e) => { setNoTopic(e.target.checked); setPreview(null); setRequestId(null) }} /> Questions with no topic</span>
        </label>}
        <CsvFilePicker value={csv} disabled={busy || disabled} onBusyChange={(reading) => { inProgress.current = reading; setBusy(reading); onBusyChange(reading) }} onLoad={async (text) => { changeCsv(text) }} />
        <textarea value={csv} disabled={busy || disabled} onChange={(e) => changeCsv(e.target.value)} aria-label="Original CSV for earlier import" placeholder="Paste the original new-question CSV, including its header" className="mt-3 h-36 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs" />
        <button disabled={busy || disabled || !csv.trim()} onClick={() => { setPreview(null); void run(null, 'undo', false) }} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Find questions and preview Undo</button>
      </div>}
      {busy && <p role="status" className="mt-3 flex items-center gap-2 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking import…</p>}
      {preview && <div className="mt-4 rounded-xl border border-primary/30 p-4">
        <h3 className="text-sm font-semibold">{preview.action === 'undo' ? 'Undo additions' : 'Restore backup'} · {preview.count} questions</h3>
        <p className="mt-1 text-xs text-muted-foreground">{preview.action === 'undo' ? 'These questions will be removed from the question bank. Their full backup stays in history.' : 'These questions will return to their original topics with the same IDs.'}</p>
        {preview.reason && <p role="alert" className="mt-3 text-xs text-destructive">{preview.reason}</p>}
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {preview.rows.map((row) => <div key={row.question_id} className="rounded-lg border border-border p-3 text-xs"><p className="font-semibold">{row.question_id} · {row.topic ?? 'No topic'}</p><p className="mt-1">{row.question}</p></div>)}
        </div>
        <div className="mt-3 flex gap-3">
          <button disabled={busy || disabled || !preview.eligible} onClick={() => run(preview.snapshotHash ? null : preview.batchId, preview.action, true)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">{preview.action === 'undo' ? 'Undo' : 'Restore'} {preview.count} questions</button>
          <button disabled={busy || disabled} onClick={() => setPreview(null)} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50">Cancel</button>
        </div>
      </div>}
    </section>
  )
}
