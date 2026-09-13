// ============================================================
// lib/mock-tests/modules.ts — Module Listing & Per-User Progress
// ============================================================
// MODULE PAGINATION lives here (Module 1-20, 21-40, ...).
// QUESTION PAGINATION (Q1-50, Q51-100, Q101-160) is a separate concern
// handled by the questions endpoint and the cache layer — the two are
// deliberately independent.
//
// The module count is bounded only by the data. Nothing in this file or in
// the frontend caps it at 10 or at 100.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  MockTestListItem,
  MockTestListResponse,
  ModuleProgressStatus,
  UserModuleProgress,
} from '@/types/mock-tests'
import type { ExamMedium } from './question-bank'

export const MODULE_PAGE_SIZE_DEFAULT = 20
export const MODULE_PAGE_SIZE_MAX = 100

/**
 * Series gate: modules open one at a time. Module 1 is open to everyone, and
 * submitting module N opens module N+1.
 *
 * Expressed as "up to the highest submitted module, plus one" rather than
 * "is my predecessor submitted" so the ladder cannot strand a candidate. If
 * a gap ever appears in their history — data repair, a module unpublished,
 * or progress made before this rule existed — they keep everything they had
 * reached instead of being sent back to module 1.
 *
 * Legacy one-off papers carry no module_number and are never gated.
 */
export function isModuleSequenceLocked(
  moduleNumber: number | null,
  highestCompletedModule: number
): boolean {
  if (moduleNumber == null) return false
  return moduleNumber > highestCompletedModule + 1
}

/**
 * Highest module_number this candidate has submitted; 0 if none.
 *
 * Deliberately not scoped to a medium. Module 05 is the same paper in Telugu
 * and in English, so clearing it in one medium should not make the candidate
 * climb the ladder again in the other.
 */
export async function getHighestCompletedModule(userId: string): Promise<number> {
  let completedIds: string[] = []

  const { data, error } = await supabaseAdmin
    .from('user_mock_test_progress')
    .select('mock_test_id')
    .eq('user_id', userId)
    .eq('status', 'completed')

  if (!error) {
    completedIds = (data ?? []).map((r) => r.mock_test_id as string)
  } else {
    // Same fallback the listing uses: the progress table arrives with
    // migration 019, so until then derive it from submitted attempts.
    console.warn('[MockModules] progress table unavailable for gate:', error.message)
    const { data: attempts } = await supabaseAdmin
      .from('mock_test_attempts')
      .select('mock_test_id')
      .eq('user_id', userId)
      .eq('status', 'submitted')
    completedIds = [...new Set((attempts ?? []).map((r) => r.mock_test_id as string))]
  }

  if (completedIds.length === 0) return 0

  // Resolved with a second query rather than an embedded join so this does
  // not depend on PostgREST relationship naming.
  const { data: rows } = await supabaseAdmin
    .from('mock_tests')
    .select('module_number')
    .in('id', completedIds)
    .not('module_number', 'is', null)
    .order('module_number', { ascending: false })
    .limit(1)

  return (rows?.[0]?.module_number as number | undefined) ?? 0
}

const MODULE_LIST_COLUMNS =
  'id, slug, title, description, category, medium, duration_minutes, total_questions, ' +
  'total_marks, is_free, status, published_at, module_number, series, version'

export interface ListModulesOptions {
  medium: ExamMedium
  /** Restrict to one series, e.g. 'grand_mock_v1'. Omit for all. */
  series?: string
  category?: string
  search?: string
  /** 1-based page of MODULES. */
  page?: number
  pageSize?: number
}

/**
 * List published modules for ONE medium, one page at a time.
 *
 * Cost: a bounded number of queries (module page + per-medium counts + one
 * progress query for the page) — never one query per module.
 */
export async function listMockTestModules(
  userId: string | null,
  options: ListModulesOptions
): Promise<MockTestListResponse> {
  const {
    medium,
    series,
    category,
    search,
    page = 1,
    pageSize = MODULE_PAGE_SIZE_DEFAULT,
  } = options

  const safePageSize = Math.min(MODULE_PAGE_SIZE_MAX, Math.max(1, pageSize))
  const safePage = Math.max(1, page)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  let query = supabaseAdmin
    .from('mock_tests')
    .select(MODULE_LIST_COLUMNS, { count: 'exact' })
    .eq('status', 'published')
    .eq('medium', medium)

  if (series) query = query.eq('series', series)
  if (category) query = query.eq('category', category)
  if (search) query = query.ilike('title', '%' + search + '%')

  // Modules first, in module order; legacy rows without a module number last.
  query = query
    .order('module_number', { ascending: true, nullsFirst: false })
    .order('published_at', { ascending: false })
    .range(from, to)

  const { data: tests, count, error } = await query

  if (error || !tests) {
    if (error) console.warn('[MockModules] listMockTestModules failed:', error.message)
    return {
      success: false,
      medium,
      tests: [],
      page: safePage,
      page_size: safePageSize,
      total: 0,
      total_pages: 0,
      medium_counts: { english: 0, telugu: 0 },
      highest_completed_module: 0,
    }
  }

  const [mediumCounts, progressByTestId, highestCompleted] = await Promise.all([
    countPublishedByMedium(series, category),
    userId
      ? loadUserProgressForTests(
          userId,
          (tests as unknown as MockTestListItem[]).map((t) => t.id)
        )
      : Promise.resolve(new Map<string, UserModuleProgress>()),
    // Signed-out visitors see the gate as it applies to a brand-new candidate.
    userId ? getHighestCompletedModule(userId) : Promise.resolve(0),
  ])

  const items: MockTestListItem[] = (tests as unknown as MockTestListItem[]).map((t) => {
    const progress = progressByTestId.get(t.id)
    return {
      ...t,
      progress_status: progress?.status ?? 'not_started',
      is_sequence_locked: isModuleSequenceLocked(t.module_number, highestCompleted),
      user_attempt: progress?.attempt_id
        ? {
            attempt_id: progress.attempt_id,
            status: progress.status === 'completed' ? 'submitted' : 'in_progress',
            score: progress.best_score,
            percentage: progress.best_percentage,
            submitted_at: progress.completed_at,
          }
        : null,
    }
  })

  const total = count ?? items.length
  return {
    success: true,
    medium,
    tests: items,
    page: safePage,
    page_size: safePageSize,
    total,
    total_pages: Math.max(1, Math.ceil(total / safePageSize)),
    medium_counts: mediumCounts,
    highest_completed_module: highestCompleted,
  }
}

/** Published module counts per medium — drives the English/Telugu tab badges. */
export async function countPublishedByMedium(
  series?: string,
  category?: string
): Promise<Record<ExamMedium, number>> {
  const counts: Record<ExamMedium, number> = { english: 0, telugu: 0 }

  await Promise.all(
    (['english', 'telugu'] as ExamMedium[]).map(async (m) => {
      let q = supabaseAdmin
        .from('mock_tests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .eq('medium', m)
      if (series) q = q.eq('series', series)
      if (category) q = q.eq('category', category)
      const { count } = await q
      counts[m] = count ?? 0
    })
  )

  return counts
}

// ---- Per-user module progress -------------------------------------

/** Load a user's progress rows for a set of modules in ONE query. */
export async function loadUserProgressForTests(
  userId: string,
  mockTestIds: string[]
): Promise<Map<string, UserModuleProgress>> {
  const out = new Map<string, UserModuleProgress>()
  if (mockTestIds.length === 0) return out

  const { data, error } = await supabaseAdmin
    .from('user_mock_test_progress')
    .select(
      'mock_test_id, status, attempt_id, attempt_count, best_score, best_percentage, started_at, completed_at'
    )
    .eq('user_id', userId)
    .in('mock_test_id', mockTestIds)

  if (error) {
    // The table arrives with migration 019. Until then, derive the same
    // information from attempts so the UI still shows Continue / Completed.
    console.warn('[MockModules] user_mock_test_progress unavailable:', error.message)
    return loadProgressFromAttempts(userId, mockTestIds)
  }

  for (const row of data ?? []) out.set(row.mock_test_id, row as UserModuleProgress)
  return out
}

/** Derive progress from raw attempts (fallback path). */
async function loadProgressFromAttempts(
  userId: string,
  mockTestIds: string[]
): Promise<Map<string, UserModuleProgress>> {
  const out = new Map<string, UserModuleProgress>()

  const { data } = await supabaseAdmin
    .from('mock_test_attempts')
    .select('id, mock_test_id, status, score, percentage, started_at, submitted_at')
    .eq('user_id', userId)
    .in('mock_test_id', mockTestIds)
    .order('started_at', { ascending: false })

  for (const a of data ?? []) {
    if (out.has(a.mock_test_id)) continue
    out.set(a.mock_test_id, {
      mock_test_id: a.mock_test_id,
      status: a.status === 'submitted' ? 'completed' : 'in_progress',
      attempt_id: a.id,
      attempt_count: 1,
      best_score: a.score,
      best_percentage: a.percentage,
      started_at: a.started_at,
      completed_at: a.submitted_at,
    })
  }

  return out
}

/**
 * Record that a user started a module. Idempotent, and never downgrades a
 * module that is already completed.
 */
export async function markModuleStarted(
  userId: string,
  mockTestId: string,
  attemptId: string
): Promise<void> {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from('user_mock_test_progress')
    .select('id, status, attempt_count')
    .eq('user_id', userId)
    .eq('mock_test_id', mockTestId)
    .maybeSingle()

  if (readErr) {
    console.warn('[MockModules] markModuleStarted skipped:', readErr.message)
    return
  }

  if (!existing) {
    const { error } = await supabaseAdmin.from('user_mock_test_progress').insert({
      user_id: userId,
      mock_test_id: mockTestId,
      status: 'in_progress',
      attempt_id: attemptId,
      attempt_count: 1,
      started_at: new Date().toISOString(),
    })
    if (error) console.warn('[MockModules] markModuleStarted insert failed:', error.message)
    return
  }

  const { error } = await supabaseAdmin
    .from('user_mock_test_progress')
    .update({
      status: existing.status === 'completed' ? 'completed' : 'in_progress',
      attempt_id: attemptId,
      attempt_count: (existing.attempt_count ?? 0) + 1,
    })
    .eq('id', existing.id)

  if (error) console.warn('[MockModules] markModuleStarted update failed:', error.message)
}

/** Record module completion, keeping the user's best score. */
export async function markModuleCompleted(
  userId: string,
  mockTestId: string,
  attemptId: string,
  score: number,
  percentage: number
): Promise<void> {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from('user_mock_test_progress')
    .select('id, best_score, best_percentage')
    .eq('user_id', userId)
    .eq('mock_test_id', mockTestId)
    .maybeSingle()

  if (readErr) {
    console.warn('[MockModules] markModuleCompleted skipped:', readErr.message)
    return
  }

  const nowIso = new Date().toISOString()
  const payload = {
    user_id: userId,
    mock_test_id: mockTestId,
    status: 'completed' as ModuleProgressStatus,
    attempt_id: attemptId,
    best_score: Math.max(score, Number(existing?.best_score ?? 0)),
    best_percentage: Math.max(percentage, Number(existing?.best_percentage ?? 0)),
    completed_at: nowIso,
  }

  const { error } = existing
    ? await supabaseAdmin.from('user_mock_test_progress').update(payload).eq('id', existing.id)
    : await supabaseAdmin
        .from('user_mock_test_progress')
        .insert({ ...payload, attempt_count: 1, started_at: nowIso })

  if (error) console.warn('[MockModules] markModuleCompleted failed:', error.message)
}

// ---- Next-module navigation ---------------------------------------

/**
 * The next module after `moduleNumber` in the same series and medium.
 * Powers the "Next Module" action on the completion screen.
 */
export async function getNextModule(
  series: string,
  medium: ExamMedium,
  moduleNumber: number
): Promise<{ id: string; slug: string; title: string; module_number: number } | null> {
  const { data } = await supabaseAdmin
    .from('mock_tests')
    .select('id, slug, title, module_number')
    .eq('series', series)
    .eq('medium', medium)
    .eq('status', 'published')
    .gt('module_number', moduleNumber)
    .order('module_number', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (data as { id: string; slug: string; title: string; module_number: number } | null) ?? null
}
