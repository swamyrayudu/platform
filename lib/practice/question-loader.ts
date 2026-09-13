// ============================================================
// lib/practice/question-loader.ts — Candidate loading for practice
// ============================================================
// Starting a practice session used to load the whole bank for the medium and
// filter it in memory: 6,457 rows and 1.4 MB transferred to choose 25
// questions, about 2.9 seconds. Two things caused that.
//
//   1. No filter reached the database. Class, topic and difficulty were all
//      applied in JavaScript after everything had been fetched.
//   2. Every row arrived complete — stem, four options and explanation —
//      even though selection only reads topic and difficulty.
//
// This module fixes both:
//
//   PASS 1  narrow in SQL, and select only the six columns the filter and the
//           scorer actually read. A candidate row is ~70 bytes instead of
//           ~330, and the query returns matches rather than the whole table.
//   PASS 2  hydrate only the questions that were chosen.
//
// The JavaScript filter still runs over pass 1 and remains the authority on
// what matches — SQL only narrows. Its `includes` semantics are deliberately
// looser than anything expressed here, so pushing a filter down can only ever
// return a superset, never drop a question the old path would have kept.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { QUESTION_TABLES } from '@/lib/questions/tables'
import { buildQuestionUid } from '@/lib/questions/tables'
import type { PracticeFilterState, PracticeMedium, PracticeQuestion } from '@/types/practice'

/** Columns the pool filter and the smart scorer read. Nothing else. */
const LIGHT_COLUMNS = 'question_id, subject, class_level, topic, subtopic, difficulty'

/** Full row, fetched only for the questions actually chosen. */
const FULL_COLUMNS =
  'question_id, subject, class_level, chapter, topic, subtopic, difficulty, question_type, ' +
  'question, option_a, option_b, option_c, option_d, correct_answer, explanation, source_type, language'

/**
 * Upper bound on candidates per table. The scorer needs more than it returns
 * so it has something to choose between, but it does not need thousands —
 * beyond a few hundred the extra rows change nothing except transfer cost.
 */
const POOL_PER_TABLE = 250

/** Which subject key a practice subject name maps to. */
function subjectKeyFor(subject?: string): string | null {
  if (!subject || subject === 'All') return null
  const s = subject.toLowerCase()
  if (s.includes('gk') || s.includes('general knowledge') || s.includes('current affairs')) return 'gk'
  if (s.includes('pedagogy') || s.includes('psychology') || s.includes('perspectives') || s.includes('cdp')) return 'pedagogy'
  if (s.includes('math') || s.includes('గణిత')) return 'mathematics'
  if (s.includes('science') || s.includes('సైన్స')) return 'science'
  if (s.includes('social') || s.includes('సాంఘిక')) return 'social_studies'
  if (s.includes('telugu') || s.includes('తెలుగు')) return 'telugu'
  if (s.includes('english') || s.includes('ఇంగ్ల')) return 'english'
  return null
}

/** Tables worth querying for this subject and medium. */
function tablesFor(medium: PracticeMedium | undefined, subject?: string): string[] {
  const key = subjectKeyFor(subject)
  return QUESTION_TABLES.filter((t) => {
    if (t.legacy) return false // unified/legacy tables are not the practice source
    if (medium && t.medium && t.medium !== medium) return false
    if (key && t.subjectKey !== key) return false
    return true
  }).map((t) => t.table)
}

const meaningful = (values?: string[]) =>
  (values ?? []).filter(
    (v) => v && !/^all($| classes| topics| subtopics)/i.test(v.trim())
  )

interface LightRow {
  question_id: string
  subject: string | null
  class_level: string | null
  topic: string | null
  subtopic: string | null
  difficulty: string | null
}

/**
 * Run one filtered, capped query. `%` and `,` are stripped from user values
 * because PostgREST's `or=` is comma separated and `ilike` treats `%` as a
 * wildcard — leaving them in would let a topic name reshape the filter.
 */
async function runFiltered(
  table: string,
  columns: string,
  filter: Partial<PracticeFilterState>
): Promise<Record<string, unknown>[]> {
  const build = (withActive: boolean) => {
    let query = supabaseAdmin.from(table).select(columns).limit(POOL_PER_TABLE)
    if (withActive) query = query.eq('is_active', true)

    const safe = (v: string) => v.replace(/[%,()*]/g, '').trim()

    const classes = meaningful(filter.class_levels)
    if (classes.length) {
      query = query.or(classes.map((c) => `class_level.ilike.*${safe(c)}*`).join(','))
    }
    const topics = meaningful(filter.topics)
    if (topics.length) {
      query = query.or(topics.map((t) => `topic.ilike.*${safe(t)}*`).join(','))
    }
    // ilike, not `in`: the JavaScript filter compares difficulty
    // case-insensitively, and an exact `in` here would silently drop rows it
    // would have kept. Banks are also inconsistent between them — maths
    // stores "Difficult" where social studies stores "Hard".
    const difficulty = meaningful(filter.difficulty)
    if (difficulty.length) {
      query = query.or(difficulty.map((d) => `difficulty.ilike.${safe(d)}`).join(','))
    }

    return query
  }

  let { data, error } = await build(true)
  if (error) {
    // Most likely the table has no is_active column; retry without it rather
    // than losing the subject entirely.
    ;({ data, error } = await build(false))
    if (error) {
      console.warn(`[practice] candidate load failed for ${table}:`, error.message)
      return []
    }
  }
  return (data ?? []) as unknown as Record<string, unknown>[]
}

/** One table's candidates, light columns only. */
async function loadLightFromTable(
  table: string,
  medium: PracticeMedium,
  filter: Partial<PracticeFilterState>
): Promise<PracticeQuestion[]> {
  const rows = await runFiltered(table, LIGHT_COLUMNS, filter)
  return (rows as unknown as LightRow[]).map((r) => ({
    id: r.question_id,
    question_id: r.question_id,
    question_uid: buildQuestionUid(table, r.question_id),
    medium,
    subject: r.subject ?? '',
    class_level: r.class_level ?? 'General',
    chapter: null,
    topic: r.topic ?? '',
    subtopic: r.subtopic ?? null,
    difficulty: r.difficulty ?? 'Medium',
    question_type: 'MCQ',
    // Deliberately empty on a candidate row — hydrated after selection.
    question: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    language: medium,
  })) as PracticeQuestion[]
}

/**
 * Candidate pool for a practice session.
 *
 * One subject resolves to a single table, and there the two-pass shape costs
 * more than it saves: a second round trip outweighs the bytes it avoids. That
 * case fetches full rows once, still filtered and still capped. Only the
 * all-subjects case, which fans out across six tables, uses light-then-hydrate.
 */
export async function loadCandidatePool(
  filter: Partial<PracticeFilterState> & { medium: PracticeMedium }
): Promise<{ pool: PracticeQuestion[]; alreadyHydrated: boolean }> {
  const tables = tablesFor(filter.medium, filter.subject)
  if (tables.length === 0) return { pool: [], alreadyHydrated: false }

  if (tables.length === 1) {
    const pool = await loadFullFromTable(tables[0], filter.medium, filter)
    return { pool, alreadyHydrated: true }
  }

  const results = await Promise.all(
    tables.map((t) => loadLightFromTable(t, filter.medium, filter))
  )
  return { pool: results.flat(), alreadyHydrated: false }
}

/** Single-table path: filtered, capped, complete rows, one round trip. */
async function loadFullFromTable(
  table: string,
  medium: PracticeMedium,
  filter: Partial<PracticeFilterState>
): Promise<PracticeQuestion[]> {
  const rows = await runFiltered(table, FULL_COLUMNS, filter)
  return rows.map((r) => ({
    id: String(r.question_id),
    question_id: String(r.question_id),
    question_uid: buildQuestionUid(table, String(r.question_id)),
    medium,
    subject: (r.subject as string) ?? '',
    class_level: (r.class_level as string) ?? 'General',
    chapter: (r.chapter as string) ?? null,
    topic: (r.topic as string) ?? '',
    subtopic: (r.subtopic as string) ?? null,
    difficulty: (r.difficulty as string) ?? 'Medium',
    question_type: (r.question_type as string) ?? 'MCQ',
    question: (r.question as string) ?? '',
    option_a: (r.option_a as string) ?? '',
    option_b: (r.option_b as string) ?? '',
    option_c: (r.option_c as string) ?? '',
    option_d: (r.option_d as string) ?? '',
    correct_answer: (r.correct_answer as string) ?? 'A',
    explanation: (r.explanation as string) ?? null,
    source_type: (r.source_type as string) ?? null,
    language: (r.language as string) ?? medium,
  })) as PracticeQuestion[]
}

/**
 * Replace candidate rows with their full content, in one query per table.
 * Order follows the selection, so the session keeps the scorer's sequence.
 */
export async function hydrateQuestions(
  selected: PracticeQuestion[]
): Promise<PracticeQuestion[]> {
  if (selected.length === 0) return []

  const byTable = new Map<string, string[]>()
  for (const q of selected) {
    const table = (q.question_uid ?? '').split(':')[0]
    if (!table) continue
    byTable.set(table, [...(byTable.get(table) ?? []), q.question_id])
  }

  const loaded = new Map<string, Record<string, unknown>>()
  await Promise.all(
    [...byTable.entries()].map(async ([table, ids]) => {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select(FULL_COLUMNS)
        .in('question_id', ids)
      if (error) {
        console.warn(`[practice] hydrate failed for ${table}:`, error.message)
        return
      }
      for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
        loaded.set(buildQuestionUid(table, String(row.question_id)), row)
      }
    })
  )

  return selected
    .map((q) => {
      const row = loaded.get(q.question_uid ?? '')
      if (!row) return null
      return {
        ...q,
        chapter: (row.chapter as string) ?? null,
        question_type: (row.question_type as string) ?? 'MCQ',
        question: (row.question as string) ?? '',
        option_a: (row.option_a as string) ?? '',
        option_b: (row.option_b as string) ?? '',
        option_c: (row.option_c as string) ?? '',
        option_d: (row.option_d as string) ?? '',
        correct_answer: (row.correct_answer as string) ?? 'A',
        explanation: (row.explanation as string) ?? null,
        source_type: (row.source_type as string) ?? null,
        language: (row.language as string) ?? q.language,
      } as PracticeQuestion
    })
    .filter((q): q is PracticeQuestion => q !== null)
}
