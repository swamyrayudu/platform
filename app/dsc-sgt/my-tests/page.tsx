'use client'

// ============================================================
// app/dsc-sgt/my-tests/page.tsx — The user's own tests
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Clock, FilePlus2, ListChecks, Loader2, Play, Trash2 } from 'lucide-react'

interface TestRow {
  id: string
  title: string
  medium: 'english' | 'telugu'
  subject: string
  question_count: number
  duration_minutes: number
  created_at: string
  attempts: number
  best_correct: number | null
}

async function fetchMyTests(): Promise<{ tests: TestRow[]; limit: number }> {
  const res = await fetch('/api/dsc-sgt/my-tests')
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw Object.assign(new Error(json.error || 'Could not load your tests.'), { code: json.code as string | undefined })
  }
  return json
}

export default function MyTestsPage() {
  const [tests, setTests] = useState<TestRow[] | null>(null)
  const [limit, setLimit] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The feature's tables are not in the database yet: nothing went wrong for the user.
  const [notSetUp, setNotSetUp] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const show = useCallback((data: { tests: TestRow[]; limit: number }) => {
    setTests(data.tests)
    setLimit(data.limit)
  }, [])
  const fail = useCallback((err: unknown) => {
    if ((err as { code?: string })?.code === 'NOT_SET_UP') setNotSetUp(true)
    else setError(err instanceof Error ? err.message : 'Could not load your tests.')
  }, [])

  useEffect(() => {
    let current = true
    fetchMyTests()
      .then((data) => current && show(data))
      .catch((err) => current && fail(err))
    return () => {
      current = false
    }
  }, [show, fail])

  const retry = () => {
    setError(null)
    fetchMyTests().then(show).catch(fail)
  }

  const remove = async (test: TestRow) => {
    if (!window.confirm(`Delete "${test.title}" and its results? This cannot be undone.`)) return
    setDeleting(test.id)
    try {
      const res = await fetch(`/api/dsc-sgt/my-tests/${test.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || 'Could not delete this test.')
      setTests((prev) => prev?.filter((t) => t.id !== test.id) ?? prev)
      toast.success('Test deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete this test.')
    } finally {
      setDeleting(null)
    }
  }

  const atLimit = tests !== null && limit !== null && tests.length >= limit

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-1 rounded-full bg-primary" />
            <h1 className="text-xl font-black text-foreground sm:text-2xl">My Tests</h1>
          </div>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Prepare your own mock test with an AI tool, upload the Excel file, and practise it with a timer.
            {limit !== null && ` You can keep up to ${limit} tests.`}
          </p>
        </div>
        {notSetUp ? null : atLimit ? (
          <span className="text-xs font-semibold text-muted-foreground">Limit reached — delete a test to add another.</span>
        ) : (
          <Link
            href="/dsc-sgt/my-tests/new"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
          >
            <FilePlus2 className="h-4 w-4" />
            Create a test
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-3xl border border-border bg-card p-6 text-sm">
          <p className="text-destructive">{error}</p>
          <button type="button" onClick={retry} className="mt-3 font-semibold text-primary hover:underline cursor-pointer">
            Try again
          </button>
        </div>
      )}

      {notSetUp && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <ListChecks className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-base font-bold">Coming soon</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Soon you can create your own mock tests here: pick a subject and topics, prepare the questions with an
            AI tool, and practise them with a timer.
          </p>
        </div>
      )}

      {!error && !notSetUp && tests === null && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your tests…
        </p>
      )}

      {tests?.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <ListChecks className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 text-base font-bold">No tests yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Pick a subject and topics, copy the prompt into ChatGPT or Gemini, and upload the Excel file it gives you.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {tests?.map((test) => (
          <article key={test.id} className="flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-5 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-foreground">{test.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {test.subject} · {test.medium === 'telugu' ? 'Telugu medium' : 'English medium'}
              </p>
              <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />{test.question_count} questions</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{test.duration_minutes} min</span>
              </p>
              <p className="mt-2 text-xs font-semibold text-foreground">
                {test.attempts === 0
                  ? 'Not attempted yet'
                  : `Best: ${test.best_correct} / ${test.question_count} · ${test.attempts} attempt${test.attempts === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Link
                href={`/dsc-sgt/my-tests/${test.id}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Play className="h-3.5 w-3.5" />
                {test.attempts === 0 ? 'Start' : 'Open'}
              </Link>
              <button
                type="button"
                onClick={() => remove(test)}
                disabled={deleting === test.id}
                aria-label={`Delete ${test.title}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50 cursor-pointer"
              >
                {deleting === test.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
