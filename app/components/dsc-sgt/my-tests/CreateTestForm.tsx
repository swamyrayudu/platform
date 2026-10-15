'use client'

// ============================================================
// app/components/dsc-sgt/my-tests/CreateTestForm.tsx
// ============================================================
// 1. Describe the test  →  2. Copy the AI prompt  →  3. Upload the file
// The file is read and checked in the browser, then sent as JSON; the
// server checks it again and stores it compressed in Supabase Storage.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Copy, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { SUBJECT_LIST } from '@/app/components/dsc-sgt/practice/setup/SubjectSelector'
import {
  MY_TEST_LIMITS, MY_TEST_QUESTION_COUNTS, buildPrompt, defaultDurationMinutes,
  type MyTestMedium, type PromptOptions, type ReadResult,
} from '@/lib/my-tests/format'
import { readQuestionFiles } from '@/lib/my-tests/read-upload'

const DIFFICULTIES: { value: PromptOptions['difficulty']; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const chip = (active: boolean) =>
  `rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
    active ? 'bg-primary text-primary-foreground shadow-xs' : 'border border-border bg-card text-muted-foreground hover:text-foreground'
  }`

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-xs sm:p-7">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{n}</span>
        <h2 className="text-sm font-bold text-foreground sm:text-base">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function CreateTestForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [medium, setMedium] = useState<MyTestMedium>('telugu')
  const [subject, setSubject] = useState(SUBJECT_LIST[0].name)
  const [topics, setTopics] = useState<string[]>([])
  const [topicInput, setTopicInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [questionCount, setQuestionCount] = useState<number>(50)
  const [difficulty, setDifficulty] = useState<PromptOptions['difficulty']>('mixed')
  const [duration, setDuration] = useState<number>(defaultDurationMinutes(50))
  const [copied, setCopied] = useState(false)
  const [reading, setReading] = useState(false)
  const [upload, setUpload] = useState<ReadResult | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const subjectConfig = SUBJECT_LIST.find((s) => s.name === subject) ?? SUBJECT_LIST[0]
  const subjectLabel = medium === 'telugu' ? `${subjectConfig.name} (${subjectConfig.teluguName})` : subjectConfig.name

  // Topic ideas from the question bank for this subject and medium, largest first.
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ medium, subject, fields: 'topics' })
    fetch(`/api/dsc-sgt/practice/filters?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) setSuggestions(json.data.available_topics.slice(0, 24).map((t: { name: string }) => t.name))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [medium, subject])

  const prompt = useMemo(
    () => buildPrompt({ subject: subjectLabel, medium, topics, questionCount, difficulty }),
    [subjectLabel, medium, topics, questionCount, difficulty]
  )

  const addTopics = (text: string) => {
    const next = text.split(',').map((t) => t.trim()).filter(Boolean)
    if (next.length) setTopics((prev) => [...new Set([...prev, ...next])].slice(0, 30))
    setTopicInput('')
  }
  const toggleTopic = (t: string) =>
    setTopics((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].slice(0, 30)))

  const chooseCount = (n: number) => {
    setQuestionCount(n)
    setDuration(defaultDurationMinutes(n))
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the text and copy it yourself.')
    }
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setReading(true)
    setReadError(null)
    setUpload(null)
    try {
      setUpload(await readQuestionFiles(Array.from(files)))
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Could not read the file.')
    } finally {
      setReading(false)
    }
  }

  const ready = upload?.questions ?? []
  const tooMany = ready.length > MY_TEST_LIMITS.maxQuestions
  const canSave = title.trim().length > 0 && ready.length > 0 && !tooMany && !saving

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/dsc-sgt/my-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), medium, subject, topics, duration_minutes: duration, questions: ready }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not save your test.')
      toast.success('Test saved')
      router.push(`/dsc-sgt/my-tests/${json.test.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your test.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <Step n={1} title="Describe your test">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-muted-foreground sm:col-span-2">
            Test name
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MY_TEST_LIMITS.maxShortChars}
              placeholder="e.g. Social Studies revision 1"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </label>

          <div>
            <p className="text-xs font-semibold text-muted-foreground">Medium</p>
            <div className="mt-1.5 flex gap-2">
              {(['telugu', 'english'] as const).map((m) => (
                <button key={m} type="button" onClick={() => { setMedium(m); setTopics([]) }} className={chip(medium === m)}>
                  {m === 'telugu' ? 'తెలుగు' : 'English'}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold text-muted-foreground">
            Subject
            <select
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setTopics([]) }}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            >
              {SUBJECT_LIST.map((s) => (
                <option key={s.name} value={s.name}>{medium === 'telugu' ? `${s.teluguName} — ${s.name}` : s.name}</option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-muted-foreground">Topics (leave empty for the whole subject)</p>
            <div className="mt-1.5 flex gap-2">
              <input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopics(topicInput) } }}
                placeholder="Type a topic and press Enter (commas for several)"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
              />
              <button type="button" onClick={() => addTopics(topicInput)} className="rounded-xl border border-border px-4 text-xs font-semibold cursor-pointer">
                Add
              </button>
            </div>
            {topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {topics.map((t) => (
                  <button key={t} type="button" onClick={() => toggleTopic(t)} className={chip(true)} aria-label={`Remove ${t}`}>
                    {t} ×
                  </button>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] text-muted-foreground">Popular topics in our question bank:</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {suggestions.filter((t) => !topics.includes(t)).map((t) => (
                    <button key={t} type="button" onClick={() => toggleTopic(t)} className="rounded-lg border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground">Number of questions</p>
            <div className="mt-1.5 flex gap-2">
              {MY_TEST_QUESTION_COUNTS.map((n) => (
                <button key={n} type="button" onClick={() => chooseCount(n)} className={chip(questionCount === n)}>{n}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground">Difficulty</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <button key={d.value} type="button" onClick={() => setDifficulty(d.value)} className={chip(difficulty === d.value)}>{d.label}</button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold text-muted-foreground">
            Time limit (minutes)
            <input
              type="number"
              min={1}
              max={MY_TEST_LIMITS.maxDurationMinutes}
              value={duration}
              onChange={(e) => setDuration(Math.min(MY_TEST_LIMITS.maxDurationMinutes, Math.max(1, Number(e.target.value) || 1)))}
              className="mt-1.5 w-32 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground"
            />
          </label>
        </div>
      </Step>

      <Step n={2} title="Copy this prompt into ChatGPT or Gemini">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Paste it into an AI chat tool and download the Excel file it creates. For 160 questions it may give
          several files — upload them all together in step 3. Check the answers: AI tools can make mistakes.
        </p>
        <textarea
          readOnly
          value={prompt}
          rows={12}
          className="w-full rounded-2xl border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground"
        />
        <button
          type="button"
          onClick={copyPrompt}
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy prompt'}
        </button>
      </Step>

      <Step n={3} title="Upload the Excel or CSV file">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/20 p-6 text-center hover:border-primary/50">
          <FileSpreadsheet className="h-7 w-7 text-primary" />
          <span className="text-sm font-semibold text-foreground">Choose .xlsx or .csv files</span>
          <span className="text-[11px] text-muted-foreground">
            Columns: question, option_a–option_d, correct_answer, explanation, topic, difficulty
          </span>
          <input
            type="file"
            accept=".xlsx,.csv"
            multiple
            className="sr-only"
            onChange={(e) => { onFiles(e.target.files); e.target.value = '' }}
          />
        </label>

        {reading && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reading your file…</p>
        )}
        {readError && <p role="alert" className="mt-3 text-xs text-destructive">{readError}</p>}

        {upload && (
          <div className="mt-4 space-y-2 text-xs">
            <p className={`font-semibold ${ready.length ? 'text-foreground' : 'text-destructive'}`}>
              {ready.length} question{ready.length === 1 ? '' : 's'} ready
              {ready.length > 0 && ready.length !== questionCount && ` (you chose ${questionCount}; that is fine)`}
            </p>
            {tooMany && <p className="text-destructive">A test can have at most {MY_TEST_LIMITS.maxQuestions} questions. Remove some rows.</p>}
            {upload.problems.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="font-semibold text-foreground">
                  {upload.problems.length} row{upload.problems.length === 1 ? '' : 's'} skipped:
                </p>
                <ul className="mt-1.5 space-y-1 text-muted-foreground">
                  {upload.problems.slice(0, 10).map((p, i) => (
                    <li key={i}>{p.file ? `${p.file}, ` : ''}row {p.row}: {p.message}</li>
                  ))}
                  {upload.problems.length > 10 && <li>…and {upload.problems.length - 10} more.</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto cursor-pointer"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {ready.length ? `Save test · ${Math.min(ready.length, MY_TEST_LIMITS.maxQuestions)} questions` : 'Save test'}
        </button>
        {!title.trim() && ready.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Add a test name in step 1 to save.</p>}
      </Step>
    </div>
  )
}
