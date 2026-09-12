// ============================================================
// lib/mock-tests/usage.ts — Global Question Usage Tracking
// ============================================================
// `mock_question_usage` answers one question for the generator:
//
//   "How many modules of this medium already use this question?"
//
//   Question A -> 0 times   (prefer first)
//   Question B -> 1 time
//   Question C -> 5 times   (prefer last)
//
// Usage is tracked PER MEDIUM, so the English series and the Telugu series
// each maximise their own coverage. It is NOT per user — the per-user
// "have I seen this question" signal is a different concern and lives in
// `question_usage` (used by Practice).
//
// `mock_test_questions` remains the source of truth for which module holds
// which question; this table is a denormalised counter for fast selection.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ExamMedium } from './question-bank'
import { buildQuestionUid } from './question-bank'

const PAGE_SIZE = 1000
const UPSERT_CHUNK = 500

/**
 * Load current usage counts for a medium as uid -> count.
 *
 * Returns an empty map (not an error) when the table does not exist yet, so a
 * dry run can be executed before migration 019 has been applied.
 */
export async function loadUsageCounts(medium: ExamMedium): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  let from = 0

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('mock_question_usage')
      .select('question_uid, usage_count')
      .eq('medium', medium)
      .order('question_uid', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.warn(`[MockUsage] Could not read mock_question_usage: ${error.message}`)
      return counts
    }
    if (!data || data.length === 0) break

    for (const row of data) counts.set(row.question_uid, row.usage_count ?? 0)

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return counts
}

export interface UsageIncrement {
  question_uid: string
  question_id: string
  question_table: string
  section_id: string
  /** number of modules in THIS run that used the question */
  increment: number
  last_module_number: number
  last_mock_test_id: string | null
}

/**
 * Apply usage increments for a whole generation run.
 *
 * Batched: the counters are read once, merged in memory, then written back in
 * chunked upserts. For a 100-module English run that is ~16,000 assignments
 * collapsed into a few thousand rows and a handful of requests — not 16,000
 * individual updates.
 */
export async function applyUsageIncrements(
  medium: ExamMedium,
  increments: UsageIncrement[]
): Promise<{ rows: number; error: string | null }> {
  if (increments.length === 0) return { rows: 0, error: null }

  const existing = await loadUsageCounts(medium)

  const rows = increments.map((inc) => ({
    question_uid: inc.question_uid,
    question_id: inc.question_id,
    question_table: inc.question_table,
    medium,
    section_id: inc.section_id,
    usage_count: (existing.get(inc.question_uid) ?? 0) + inc.increment,
    last_module_number: inc.last_module_number,
    last_mock_test_id: inc.last_mock_test_id,
    updated_at: new Date().toISOString(),
  }))

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK)
    const { error } = await supabaseAdmin
      .from('mock_question_usage')
      .upsert(chunk, { onConflict: 'question_uid,medium' })

    if (error) return { rows: i, error: error.message }
  }

  return { rows: rows.length, error: null }
}

/**
 * Rebuild `mock_question_usage` from `mock_test_questions`, which is the
 * source of truth. Use this after deleting or regenerating modules so the
 * counters cannot drift away from reality.
 */
export async function rebuildUsageCounts(
  medium: ExamMedium
): Promise<{ rows: number; error: string | null }> {
  // 1. Which mock tests belong to this medium?
  const { data: tests, error: testErr } = await supabaseAdmin
    .from('mock_tests')
    .select('id, module_number')
    .eq('medium', medium)
    .neq('status', 'archived')

  if (testErr) return { rows: 0, error: testErr.message }
  if (!tests || tests.length === 0) {
    await supabaseAdmin.from('mock_question_usage').delete().eq('medium', medium)
    return { rows: 0, error: null }
  }

  const moduleByTest = new Map(tests.map((t) => [t.id as string, t.module_number as number | null]))
  const testIds = [...moduleByTest.keys()]

  // 2. Page through every mapping for those tests (one paged read, no N+1).
  const tally = new Map<
    string,
    { question_id: string; question_table: string; section_id: string; count: number; lastModule: number; lastTest: string }
  >()

  for (let i = 0; i < testIds.length; i += 50) {
    const idChunk = testIds.slice(i, i + 50)
    let from = 0
    for (;;) {
      const { data, error } = await supabaseAdmin
        .from('mock_test_questions')
        .select('mock_test_id, question_uid, question_id, question_table, section_id')
        .in('mock_test_id', idChunk)
        .order('question_uid', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) return { rows: 0, error: error.message }
      if (!data || data.length === 0) break

      for (const row of data) {
        const uid = row.question_uid ?? buildQuestionUid(row.question_table, row.question_id)
        const entry = tally.get(uid)
        const moduleNumber = moduleByTest.get(row.mock_test_id) ?? 0
        if (entry) {
          entry.count++
          if (moduleNumber >= entry.lastModule) {
            entry.lastModule = moduleNumber
            entry.lastTest = row.mock_test_id
          }
        } else {
          tally.set(uid, {
            question_id: row.question_id,
            question_table: row.question_table,
            section_id: row.section_id,
            count: 1,
            lastModule: moduleNumber,
            lastTest: row.mock_test_id,
          })
        }
      }

      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  // 3. Replace the medium's counters wholesale.
  const { error: delErr } = await supabaseAdmin
    .from('mock_question_usage')
    .delete()
    .eq('medium', medium)
  if (delErr) return { rows: 0, error: delErr.message }

  const rows = [...tally.entries()].map(([uid, e]) => ({
    question_uid: uid,
    question_id: e.question_id,
    question_table: e.question_table,
    medium,
    section_id: e.section_id,
    usage_count: e.count,
    last_module_number: e.lastModule || null,
    last_mock_test_id: e.lastTest,
  }))

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await supabaseAdmin
      .from('mock_question_usage')
      .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: 'question_uid,medium' })
    if (error) return { rows: i, error: error.message }
  }

  return { rows: rows.length, error: null }
}

/** Aggregate usage statistics for a medium, for the admin report view. */
export interface UsageStats {
  medium: ExamMedium
  tracked_questions: number
  total_assignments: number
  never_used_estimate: number
  max_usage: number
  histogram: Record<string, number>
}

export async function getUsageStats(medium: ExamMedium): Promise<UsageStats> {
  const counts = await loadUsageCounts(medium)
  const values = [...counts.values()]
  const histogram: Record<string, number> = {}
  for (const v of values) {
    const key = v >= 6 ? '6+' : String(v)
    histogram[key] = (histogram[key] ?? 0) + 1
  }

  return {
    medium,
    tracked_questions: counts.size,
    total_assignments: values.reduce((a, b) => a + b, 0),
    never_used_estimate: values.filter((v) => v === 0).length,
    max_usage: values.length ? Math.max(...values) : 0,
    histogram,
  }
}
