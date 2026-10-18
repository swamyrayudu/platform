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
// Pass 1 reads the WHOLE matching bank (light columns, in parallel pages),
// not a capped slice. The cap used to be the first 250 rows, which are stored
// chapter by chapter, so a session drew from one or two topics however
// balanced the selection was (Telugu-medium maths: 3,702 questions in 31
// topics, the first 250 all in one). An all-subjects session reads an evenly
// spread sample of each bank instead, to stay quick across seven tables.
//
// The JavaScript filter still runs over pass 1. Class and difficulty are only
// narrowed here, with semantics looser than or equal to it. Topic and subtopic
// match exactly: the names come from the filter options, and `includes` pulled
// neighbours into a session ("Water" also served "Water Cycle"). The counts in
// public.practice_filter_options use these same rules.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { QUESTION_TABLES } from '@/lib/questions/tables'
import { buildQuestionUid } from '@/lib/questions/tables'
import { isReviewedOnly, loadReviewedTopics } from './reviewed-topics'
import type { PracticeFilterState, PracticeMedium, PracticeQuestion } from '@/types/practice'

/** Columns the pool filter and the smart scorer read. Nothing else. */
const LIGHT_COLUMNS = 'question_id, subject, class_level, topic, subtopic, difficulty'

/** Full row, fetched only for the questions actually chosen. */
const FULL_COLUMNS =
  'question_id, subject, class_level, chapter, topic, subtopic, difficulty, question_type, ' +
  'question, option_a, option_b, option_c, option_d, correct_answer, explanation, source_type, language'

/** PostgREST returns at most this many rows per request. */
const PAGE_SIZE = 1000
/** A single subject's whole bank is read if it is at most this big (all are today). */
const FULL_BANK_LIMIT = 8000
/**
 * An all-subjects session reads this many rows per table, as windows spread
 * evenly through the bank so every part of it (and so every chapter) is in.
 */
const SAMPLE_PER_TABLE = 1200
const SAMPLE_WINDOW = 300

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

/** Language papers are written in every medium, so their banks serve both. */
const LANGUAGE_SUBJECTS = new Set<string | null>(['english', 'telugu'])

/** Tables worth querying for this subject and medium. */
export function practiceTablesFor(medium: PracticeMedium | undefined, subject?: string): string[] {
  const key = subjectKeyFor(subject)
  return QUESTION_TABLES.filter((t) => {
    if (t.legacy) return false // unified/legacy tables are not the practice source
    if (medium && t.medium && t.medium !== medium && !LANGUAGE_SUBJECTS.has(t.subjectKey)) return false
    if (key && t.subjectKey !== key) return false
    return true
  }).map((t) => t.table)
}

export const meaningful = (values?: string[]) =>
  (values ?? []).filter(
    (v) => v && !/^all($| classes| topics| subtopics)/i.test(v.trim())
  )

/** A PostgREST filter value, double-quoted so commas and brackets stay literal. */
const quoted = (v: string) => `"${v.replace(/["\\]/g, '\\$&')}"`

interface LightRow {
  question_id: string
  subject: string | null
  class_level: string | null
  topic: string | null
  subtopic: string | null
  difficulty: string | null
}

interface Filterable<T> {
  or(filters: string): T
  in(column: string, values: readonly string[]): T
}

/**
 * The practice filters as PostgREST conditions — shared by the session pool
 * and the question count, so a count is what a session can draw from.
 * Values inside `or=` are double-quoted: PostgREST separates conditions with
 * commas, and stripping them instead left names such as
 * "Memory, Forgetting and Assessment" matching nothing.
 */
function applyPracticeFilters<T extends Filterable<T>>(query: T, filter: Partial<PracticeFilterState>): T {
  const classes = meaningful(filter.class_levels)
  if (classes.length) {
    query = query.or(classes.map((c) => `class_level.ilike.${quoted(`*${c.trim()}*`)}`).join(','))
  }
  // `in` quotes values that contain commas or brackets.
  const topics = meaningful(filter.topics)
  if (topics.length) query = query.in('topic', topics)
  const subtopics = meaningful(filter.subtopics)
  if (subtopics.length) query = query.in('subtopic', subtopics)
  // ilike, not `in`: the JavaScript filter compares difficulty
  // case-insensitively, and an exact `in` here would silently drop rows it
  // would have kept. Banks are also inconsistent between them — maths
  // stores "Difficult" where social studies stores "Hard".
  const difficulty = meaningful(filter.difficulty)
  if (difficulty.length) {
    query = query.or(difficulty.map((d) => `difficulty.ilike.${quoted(d.trim())}`).join(','))
  }
  return query
}

/**
 * How many topic names go into one `topic=in.(...)`. The filter travels in the
 * request line, and a gated table's reviewed list runs to hundreds of Telugu
 * names, which percent-encode to three bytes a character — one list ran past
 * the 8 KB header limit and the request came back as a 414. Slices are counted
 * in parallel and added up; topics are distinct, so nothing is counted twice.
 */
const TOPIC_SLICE = 20

/**
 * The topic lists one table is counted under. A single `undefined` means the
 * filter's own topics, unchanged; `null` means the table can contribute
 * nothing — see lib/practice/reviewed-topics.ts.
 */
async function topicSlicesFor(
  table: string,
  filter: Partial<PracticeFilterState>
): Promise<(string[] | undefined)[] | null> {
  if (!isReviewedOnly(table)) return [undefined]
  const reviewed = await loadReviewedTopics(table)
  const chosen = meaningful(filter.topics)
  const topics = chosen.length ? chosen.filter((t) => reviewed.has(t)) : [...reviewed]
  if (topics.length === 0) return null
  const slices: string[][] = []
  for (let i = 0; i < topics.length; i += TOPIC_SLICE) slices.push(topics.slice(i, i + TOPIC_SLICE))
  return slices
}

/**
 * Active questions of one table matching the filter, counted by the database
 * so no rows are transferred, with the reviewed-topic gate applied.
 */
export async function countActiveMatching(
  table: string,
  filter: Partial<PracticeFilterState>
): Promise<number> {
  const slices = await topicSlicesFor(table, filter)
  if (slices === null) return 0
  const counts = await Promise.all(slices.map(async (topics) => {
    const query = supabaseAdmin.from(table)
      .select('question_id', { count: 'exact', head: true })
      .eq('is_active', true)
    const { count, error } = await applyPracticeFilters(query, topics ? { ...filter, topics } : filter)
    if (error) throw error
    return count ?? 0
  }))
  return counts.reduce((sum, n) => sum + n, 0)
}

/**
 * Active questions matching the filter across the subject's tables: one count
 * per table, run by the database, so no rows are transferred.
 */
export async function countMatchingQuestions(
  filter: Partial<PracticeFilterState> & { medium: PracticeMedium }
): Promise<number> {
  const counts = await Promise.all(
    practiceTablesFor(filter.medium, filter.subject).map((table) => countActiveMatching(table, filter)))
  return counts.reduce((sum, n) => sum + n, 0)
}

/**
 * Matching rows of one table, light or full columns. The whole match is read
 * in parallel pages when `sample` is off and the bank is within
 * FULL_BANK_LIMIT; otherwise evenly spread windows are read.
 */
async function runFiltered(
  table: string,
  columns: string,
  filter: Partial<PracticeFilterState>,
  sample = false
): Promise<Record<string, unknown>[]> {
  const base = (withActive: boolean, select: string, head = false) => {
    let query = supabaseAdmin.from(table).select(select, head ? { count: 'exact', head: true } : undefined)
    if (withActive) query = query.eq('is_active', true)
    return applyPracticeFilters(query, filter)
  }

  // Count first; most likely a failure means the table has no is_active column.
  let withActive = true
  let { count, error } = await base(true, 'question_id', true)
  if (error) {
    withActive = false
    ;({ count, error } = await base(false, 'question_id', true))
    if (error) {
      console.warn(`[practice] candidate count failed for ${table}:`, error.message)
      return []
    }
  }
  const total = count ?? 0
  if (total === 0) return []

  // Stable order, so pages and windows never overlap or skip.
  const range = (from: number, to: number) => base(withActive, columns).order('question_id', { ascending: true }).range(from, to)
  const windows: [number, number][] = []
  const budget = sample ? SAMPLE_PER_TABLE : FULL_BANK_LIMIT
  if (total <= budget) {
    for (let from = 0; from < total; from += PAGE_SIZE) windows.push([from, Math.min(total, from + PAGE_SIZE) - 1])
  } else {
    // One window at a random place inside each equal slice of the bank.
    const parts = Math.ceil(budget / SAMPLE_WINDOW)
    const slice = total / parts
    for (let i = 0; i < parts; i++) {
      const from = Math.floor(i * slice + Math.random() * Math.max(0, slice - SAMPLE_WINDOW))
      windows.push([from, Math.min(total, from + SAMPLE_WINDOW) - 1])
    }
  }

  const pages = await Promise.all(windows.map(async ([from, to]) => {
    const { data, error: pageError } = await range(from, to)
    if (pageError) {
      console.warn(`[practice] candidate page failed for ${table}:`, pageError.message)
      return []
    }
    return (data ?? []) as unknown as Record<string, unknown>[]
  }))
  return pages.flat()
}

/** One table's candidates, light columns only. */
async function loadLightFromTable(
  table: string,
  medium: PracticeMedium,
  filter: Partial<PracticeFilterState>,
  sample: boolean
): Promise<PracticeQuestion[]> {
  let rows = await runFiltered(table, LIGHT_COLUMNS, filter, sample)
  // The reviewed-topic gate is applied here rather than in SQL: a gated
  // table's topic list is too long for the request line (see TOPIC_SLICE),
  // and a single-subject pass has already read the whole matching bank, so
  // dropping the unreviewed rows from it costs nothing. A sampled
  // all-subjects pass keeps the gated share of its windows, which is enough
  // for that subject's slice of the paper.
  if (isReviewedOnly(table)) {
    const reviewed = await loadReviewedTopics(table)
    rows = rows.filter((r) => typeof r.topic === 'string' && reviewed.has(r.topic))
  }
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
 * Candidate pool for a practice session: light rows (six columns) for every
 * matching question of a subject, or an evenly spread sample of each bank for
 * all subjects. The chosen questions are hydrated afterwards.
 */
export async function loadCandidatePool(
  filter: Partial<PracticeFilterState> & { medium: PracticeMedium }
): Promise<{ pool: PracticeQuestion[]; alreadyHydrated: boolean }> {
  const tables = practiceTablesFor(filter.medium, filter.subject)
  if (tables.length === 0) return { pool: [], alreadyHydrated: false }
  const sample = tables.length > 1
  const results = await Promise.all(tables.map((t) => loadLightFromTable(t, filter.medium, filter, sample)))
  return { pool: results.flat(), alreadyHydrated: false }
}

/** The subject a candidate came from, by its table (for all-subjects balance). */
export function subjectGroupOf(q: Pick<PracticeQuestion, 'question_uid'>): string {
  const table = (q.question_uid ?? '').split(':')[0]
  return QUESTION_TABLES.find((t) => t.table === table)?.subjectKey ?? 'other'
}

/**
 * Share of an all-subjects session per subject: the real paper's questions
 * (GK 16, Psychology + Perspectives 24, 24 for each of the five subjects).
 */
export const SUBJECT_WEIGHTS: Record<string, number> = {
  gk: 16, pedagogy: 24, telugu: 24, english: 24, mathematics: 24, science: 24, social_studies: 24,
}

function toFullQuestion(table: string, medium: PracticeMedium, r: Record<string, unknown>): PracticeQuestion {
  return {
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
  } as PracticeQuestion
}

/**
 * A stored session's questions, fetched by id from the tables its subject
 * uses. Loading the subject's whole bank instead moved ~900 KB per request
 * and, cut off at 1,000 rows, lost questions past that point.
 */
export async function loadQuestionsByIds(
  medium: PracticeMedium,
  subject: string | undefined,
  ids: string[]
): Promise<PracticeQuestion[]> {
  if (ids.length === 0) return []
  const found = new Map<string, PracticeQuestion>()
  await Promise.all(practiceTablesFor(medium, subject).map(async (table) => {
    const { data, error } = await supabaseAdmin.from(table).select(FULL_COLUMNS).in('question_id', ids)
    if (error) {
      console.warn(`[practice] session question load failed for ${table}:`, error.message)
      return
    }
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const q = toFullQuestion(table, medium, row)
      if (!found.has(q.question_id)) found.set(q.question_id, q)
    }
  }))
  return ids.map((id) => found.get(id)).filter((q): q is PracticeQuestion => q !== undefined)
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
