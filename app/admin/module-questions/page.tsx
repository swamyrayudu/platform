'use client'

// ============================================================
// app/admin/module-questions/page.tsx — Read a module, swap a question
// ============================================================
// Deliberately NOT a "regenerate" or "reshuffle" screen.
//
// mock_test_questions has no version column: a module's 160 mappings are the
// only copy, so regenerating a published module rewrites what every past
// attempt appears to have contained — scores stay frozen while the reviews
// rebuild against questions the candidate never saw. The generate route
// already refuses published tests for that reason. Reordering within a module
// is no better value: sections are contiguous blocks of question_number, and
// sequential unlock means nobody sits a module twice.
//
// What is genuinely worth doing is the surgical version — find the bad
// question, put a better one in its slot, keep everything else exactly where
// it was. That is this page.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  Replace,
  Search,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/app/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/loading-screen'

interface Slot {
  mappingId: string
  questionNumber: number
  sectionId: string
  sectionName: string
  questionTable: string
  questionId: string
  uid: string
  question: string
  correctAnswer: string
  topic: string | null
  difficulty: string | null
  missing: boolean
}

interface ModuleResponse {
  success: true
  test: { id: string; title: string; module_number: number | null; medium: string; status: string }
  slots: Slot[]
  liveAttempts: number
  missingCount: number
}

interface Candidate {
  question_id: string
  question: string
  correct_answer: string
  topic: string | null
  difficulty: string | null
  inUse: boolean
}

interface SlotUsage {
  mockTestId: string
  moduleNumber: number | null
  questionNumber: number
  live: boolean
}

interface LookupResponse {
  success: true
  uid: string
  slots: SlotUsage[]
  liveModules: number
  candidates: Candidate[]
  page: number
  pageSize: number
  total: number
  unusedTotal: number
  totalPages: number
}

interface ModuleOption {
  id: string
  title: string
  module_number: number | null
}

export default function ModuleQuestionsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [modules, setModules] = useState<ModuleOption[]>([])
  const [moduleId, setModuleId] = useState('')
  const [data, setData] = useState<ModuleResponse | null>(null)
  const [loadingModule, setLoadingModule] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [target, setTarget] = useState<Slot | null>(null)
  const [lookup, setLookup] = useState<LookupResponse | null>(null)
  const [search, setSearch] = useState('')
  const [unusedOnly, setUnusedOnly] = useState(false)
  const [working, setWorking] = useState(false)
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') router.replace('/dsc-sgt')
    if (!authLoading && !user) router.replace('/')
  }, [authLoading, user, router])

  // The module list is small and static enough to fetch once.
  useEffect(() => {
    // The list route answers { success, tests, ... } and pages with pageSize;
    // 300 covers the 206 modules that exist with room to grow.
    fetch('/api/admin/mock-tests?pageSize=300', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success || !Array.isArray(d.tests)) return
        const list: ModuleOption[] = d.tests
          .map((t: Record<string, unknown>) => ({
            id: t.id as string,
            title: (t.title as string) ?? '',
            module_number: (t.module_number as number | null) ?? null,
          }))
          .filter((t: ModuleOption) => Boolean(t.id))
          .sort((a: ModuleOption, b: ModuleOption) =>
            (a.module_number ?? 1e9) - (b.module_number ?? 1e9)
          )
        setModules(list)
      })
      .catch(() => {})
  }, [])

  const loadModule = useCallback(async (id: string) => {
    if (!id) return
    setLoadingModule(true)
    setError(null)
    setTarget(null)
    setLookup(null)
    try {
      const res = await fetch(`/api/admin/mock-tests/${id}/questions`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok || !d.success) {
        setError(d.error ?? 'Could not load that module')
        return
      }
      setData(d as ModuleResponse)
    } catch {
      setError('Network error.')
    } finally {
      setLoadingModule(false)
    }
  }, [])

  const openReplace = useCallback(
    async (slot: Slot, term: string, page = 1, spareOnly = false) => {
      setTarget(slot)
      setLoadingCandidates(true)
      try {
        const params = new URLSearchParams({
          uid: slot.uid,
          page: String(page),
          pageSize: '25',
        })
        if (term.trim()) params.set('search', term.trim())
        if (spareOnly) params.set('unusedOnly', '1')
        const res = await fetch(`/api/admin/mock-tests/replace-question?${params}`, {
          credentials: 'include',
        })
        const d = await res.json()
        if (res.ok && d.success) setLookup(d as LookupResponse)
        else setError(d.error ?? 'Lookup failed')
      } catch {
        setError('Network error.')
      } finally {
        setLoadingCandidates(false)
      }
    },
    []
  )

  const doReplace = useCallback(
    async (scope: 'module' | 'all', replacementId?: string) => {
      if (!target || !data) return
      setWorking(true)
      try {
        const res = await fetch('/api/admin/mock-tests/replace-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            uid: target.uid,
            scope,
            mockTestId: data.test.id,
            replacementId,
          }),
        })
        const d = await res.json()
        if (!res.ok || !d.success) {
          setError(d.error ?? 'Replace failed')
          return
        }
        const { replaced, blockedLive, noCandidate } = d.summary
        toast.success(`Replaced in ${replaced} slot${replaced === 1 ? '' : 's'}`, {
          description:
            blockedLive || noCandidate
              ? `${blockedLive} skipped (exam in progress), ${noCandidate} had no candidate.`
              : 'Module caches refreshed.',
        })
        setTarget(null)
        setLookup(null)
        loadModule(data.test.id)
      } catch {
        setError('Network error.')
      } finally {
        setWorking(false)
      }
    },
    [target, data, loadModule]
  )

  if (authLoading) return <LoadingScreen message="Checking access…" />
  if (!user || user.role !== 'admin') return null

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin')}
          className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </button>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Module questions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read a module and swap out a weak question. The slot, its section and its position stay
          exactly where they are — only the question in it changes.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="mb-5 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Module
            </span>
            <select
              value={moduleId}
              onChange={(e) => {
                setModuleId(e.target.value)
                loadModule(e.target.value)
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Choose a module…</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.module_number != null ? `Module ${m.module_number} · ` : ''}
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          {loadingModule && <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {data && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>{data.slots.length} questions</span>
            <span className="capitalize">{data.test.status}</span>
            {data.liveAttempts > 0 && (
              <span className="font-semibold text-destructive">
                {data.liveAttempts} attempt(s) in progress — replacing is off for this module
              </span>
            )}
            {data.missingCount > 0 && (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {data.missingCount} slot(s) point at a question that no longer exists
              </span>
            )}
          </div>
        )}
      </section>

      {data && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="max-h-[40rem] space-y-2 overflow-y-auto pr-1">
            {data.slots.map((slot) => (
              <article
                key={slot.mappingId}
                className={`rounded-xl border bg-background p-3 ${
                  slot.missing ? 'border-destructive/50' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-muted-foreground">
                        Q{slot.questionNumber}
                      </span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {slot.sectionName}
                      </span>
                      {slot.difficulty && (
                        <span className="text-[10px] text-muted-foreground">{slot.difficulty}</span>
                      )}
                      {slot.missing && (
                        <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">
                          missing
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-foreground">
                      {slot.question || <em className="text-destructive">No question row found</em>}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      <code>{slot.questionId}</code> · answer {slot.correctAnswer || '—'}
                    </p>
                  </div>
                  <button
                    onClick={() => openReplace(slot, '')}
                    disabled={data.liveAttempts > 0}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    <Replace className="h-3 w-3" />
                    Replace
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Replace panel ── */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">
                  Replace Q{target.questionNumber}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {target.question}
                </p>
              </div>
              <button
                onClick={() => {
                  setTarget(null)
                  setLookup(null)
                  setSearch('')
                  setUnusedOnly(false)
                }}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!lookup ? (
              <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Finding where this question is used…
              </div>
            ) : (
              <>
                <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">
                  This question fills <strong>{lookup.slots.length}</strong> slot(s) across your
                  modules
                  {lookup.liveModules > 0 && (
                    <>
                      {' '}
                      — <span className="text-destructive">{lookup.liveModules}</span> of those
                      modules have an exam in progress and will be skipped
                    </>
                  )}
                  .
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openReplace(target, search, 1, unusedOnly)
                      }}
                      placeholder={`Search all ${lookup.total.toLocaleString('en-IN')} questions in this subject…`}
                      className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-3 text-xs text-foreground"
                    />
                  </div>
                  <button
                    onClick={() => openReplace(target, search, 1, unusedOnly)}
                    className="rounded-xl border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Search
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={unusedOnly}
                      onChange={(e) => {
                        setUnusedOnly(e.target.checked)
                        openReplace(target, search, 1, e.target.checked)
                      }}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    Only questions no module uses ({lookup.unusedTotal.toLocaleString('en-IN')})
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {lookup.total.toLocaleString('en-IN')} question(s) · page {lookup.page} of{' '}
                    {lookup.totalPages}
                  </span>
                </div>

                <div className="relative mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {loadingCandidates && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {lookup.candidates.map((candidate) => (
                    <button
                      key={candidate.question_id}
                      onClick={() => doReplace('module', candidate.question_id)}
                      disabled={working}
                      className="w-full rounded-xl border border-border bg-background p-3 text-left transition hover:border-primary disabled:opacity-50"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-[10px] font-semibold text-foreground">
                          {candidate.question_id}
                        </code>
                        {candidate.inUse ? (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600 dark:text-amber-400">
                            already used elsewhere
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                            unused
                          </span>
                        )}
                        {candidate.difficulty && (
                          <span className="text-[9px] text-muted-foreground">
                            {candidate.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-foreground">
                        {candidate.question}
                      </p>
                    </button>
                  ))}
                  {lookup.candidates.length === 0 && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Nothing matched. Try a different search.
                    </p>
                  )}
                </div>

                {lookup.totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      onClick={() => openReplace(target, search, lookup.page - 1, unusedOnly)}
                      disabled={lookup.page <= 1 || loadingCandidates}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-[11px] text-muted-foreground">
                      {lookup.page} / {lookup.totalPages}
                    </span>
                    <button
                      onClick={() => openReplace(target, search, lookup.page + 1, unusedOnly)}
                      disabled={lookup.page >= lookup.totalPages || loadingCandidates}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-[11px] text-muted-foreground">
                    Pick one above to replace it in this module only.
                  </p>
                  <button
                    onClick={() => doReplace('all')}
                    disabled={working}
                    className="flex items-center gap-2 rounded-xl border border-destructive/40 px-3.5 py-2 text-[11px] font-semibold text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {working ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Retire it from all {lookup.slots.length} slot(s)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
