// ============================================================
// lib/practice/reviewed-topics.ts — The admin-reviewed topic gate
// ============================================================
// Social Studies practice serves only what an admin has been through. A topic
// becomes eligible the first time a bulk update is applied to it — the same
// "Updated N times" the admin topic list shows, recorded in
// public.admin_question_topic_updates. Every other subject keeps its whole
// bank, and nothing here touches mock tests.
//
// The gate is strict, in both mediums (socal_english_medium and
// socal_telugu_medimum):
//
//   * a question in a topic with no recorded update is never served, and
//     never counted in the filter screen;
//   * a question with no topic at all is not served either — a review is
//     recorded against a topic, and there is no topic to record it against;
//   * a 25- or 50-question session comes back short, or empty, rather than
//     topping up from unreviewed topics.
//
// Matching is on the topic NAME, so renaming a topic in the admin editor
// moves its questions out of the gate until the new name is reviewed. That is
// the same row the editor itself counts against, and the bulk update records
// both the old and the new name.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getQuestionTable, type QuestionSubjectKey } from '@/lib/questions/tables'

/** Subjects whose practice pool is limited to admin-reviewed topics. */
const REVIEWED_ONLY_SUBJECTS = new Set<QuestionSubjectKey>(['social_studies'])

/** How long a table's reviewed set is reused, matching the admin page's refresh. */
const CACHE_MS = 30_000

/** PostgREST returns at most this many rows per request. */
const PAGE_SIZE = 1000

/** True for a table whose practice questions must sit in a reviewed topic. */
export function isReviewedOnly(table: string): boolean {
  const config = getQuestionTable(table)
  if (!config || config.legacy || !config.subjectKey) return false
  return REVIEWED_ONLY_SUBJECTS.has(config.subjectKey)
}

/** The gated tables among `tables` — what the SQL counters need to know. */
export function reviewedOnlyTables(tables: string[]): string[] {
  return [...new Set(tables)].filter(isReviewedOnly)
}

async function fetchReviewedTopics(table: string): Promise<Set<string>> {
  const names = new Set<string>()
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from('admin_question_topic_updates')
      .select('topic')
      .eq('question_table', table)
      .gt('update_count', 0)
      .order('topic_key')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as { topic: string | null }[]
    for (const row of rows) if (row.topic !== null) names.add(row.topic)
    if (rows.length < PAGE_SIZE) return names
  }
}

const cache = new Map<string, { at: number; topics: Promise<Set<string>> }>()

/**
 * Reviewed topic names of one table. The result is shared for CACHE_MS so a
 * filter screen polling counts does not re-read the table on every keystroke;
 * a failed load is dropped rather than cached.
 */
export function loadReviewedTopics(table: string): Promise<Set<string>> {
  const hit = cache.get(table)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.topics
  const topics = fetchReviewedTopics(table).catch((err) => {
    cache.delete(table)
    throw err
  })
  cache.set(table, { at: Date.now(), topics })
  return topics
}
