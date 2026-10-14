'use client'

import { addNextBatchTopic, fillTopicBatch, nextPendingBatchTopic } from '@/lib/questions/topic-batch'
import { TOPIC_BATCH_MAX_QUESTIONS, type BulkTopicOption } from '@/types/bulk-update'

export default function TopicBatchSelector({ topics, selected, disabled, onChange, onClose, onLoad }: {
  topics: BulkTopicOption[]
  selected: (string | null)[]
  disabled: boolean
  onChange: (topics: (string | null)[]) => void
  onClose: () => void
  onLoad: () => void
}) {
  const count = selected.reduce<number>((sum, topic) => sum + (topics.find((entry) => entry.topic === topic)?.count ?? 0), 0)
  const next = addNextBatchTopic(topics, selected)
  const pending = nextPendingBatchTopic(topics, selected)
  return <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold">Include the next topics in this batch</h3>
        <p role="status" className={`mt-1 text-xs ${count > TOPIC_BATCH_MAX_QUESTIONS ? 'text-destructive' : 'text-muted-foreground'}`}>
          {selected.length} topics · {count} / {TOPIC_BATCH_MAX_QUESTIONS} questions
        </p>
      </div>
      {selected.length > 1 && <button type="button" disabled={disabled} onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Use one topic</button>}
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground">Your current topic is included. Add the next topic or tick topics below, then load them and copy one CSV to rewrite and preview together. No topic limit; maximum 100 questions in total.</p>
    <p className="mt-1 text-[11px] text-muted-foreground">Automatic selection follows topic order and stops before the next topic would exceed 100. A batch below 100 is ready to use.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={disabled || next.length === selected.length} onClick={() => onChange(next)}
        className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Add next topic</button>
      <button type="button" disabled={disabled || next.length === selected.length} onClick={() => onChange(fillTopicBatch(topics, selected))}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">Fill batch in topic order</button>
    </div>
    {pending && count <= TOPIC_BATCH_MAX_QUESTIONS && count + pending.count > TOPIC_BATCH_MAX_QUESTIONS && (
      <p role="status" className="mt-2 text-xs text-muted-foreground">The next topic has {pending.count} questions and would exceed 100. Keep this {count}-question batch; the next topic stays for the following batch.</p>
    )}
    <fieldset disabled={disabled} className="mt-3 max-h-52 space-y-1 overflow-y-auto">
      <legend className="sr-only">Topics in the combined batch</legend>
      {topics.filter((entry) => entry.count <= TOPIC_BATCH_MAX_QUESTIONS || selected.includes(entry.topic)).map((entry) => {
        const checked = selected.includes(entry.topic)
        const cannotAdd = !checked && count + entry.count > TOPIC_BATCH_MAX_QUESTIONS
        return <label key={JSON.stringify(entry.topic)} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${cannotAdd ? 'opacity-50' : 'hover:bg-background'}`}>
          <input type="checkbox" checked={checked} disabled={cannotAdd || (checked && selected[0] === entry.topic)}
            onChange={() => onChange(checked ? selected.filter((topic) => topic !== entry.topic) : [...selected, entry.topic])}
            className="h-3.5 w-3.5 accent-primary" />
          <span className="min-w-0 flex-1 break-words">{entry.topic === null ? 'No topic (unassigned)' : entry.topic === '' ? 'No topic (empty)' : entry.topic}</span>
          <span className="shrink-0 text-muted-foreground">{entry.count} questions · Updated {entry.updateCount ?? 0} times</span>
        </label>
      })}
    </fieldset>
    {selected.length > 1 && <button type="button" onClick={onLoad} disabled={disabled || count > TOPIC_BATCH_MAX_QUESTIONS || count === 0}
      className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
      Load selected topics · {count} questions
    </button>}
    {count > TOPIC_BATCH_MAX_QUESTIONS && <p role="alert" className="mt-2 text-xs text-destructive">The topic counts changed. Remove a topic to stay within 100 questions.</p>}
  </div>
}
