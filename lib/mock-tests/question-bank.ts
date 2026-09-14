// ============================================================
// lib/mock-tests/question-bank.ts — Shared Question Bank Access
// ============================================================
// The Mock Test generator reads the SAME tables the Practice
// section uses. No question content is ever duplicated: this
// module only reads, normalises and buckets what already exists.
//
//                 EXISTING QUESTION BANK
//                          |
//              +-----------+-----------+
//              |                       |
//          PRACTICE                MOCK TEST
//     (lib/practice/subjects)   (this module)
//
// Responsibilities:
//   1. Medium -> source table resolution (English vs Telugu separation)
//   2. Difficulty normalisation across wildly inconsistent raw values
//   3. Globally-unique question identity (question_uid)
//   4. Paginated full-pool loading (PostgREST caps responses at 1000 rows)
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

// ---- Medium ------------------------------------------------------

/**
 * A mock module is always generated for exactly one medium.
 * ('bilingual' exists on legacy mock_tests rows but is never a
 *  generation target — mixing English and Telugu content in one
 *  paper is precisely what we must avoid.)
 */
export type ExamMedium = 'english' | 'telugu'

export const EXAM_MEDIUMS: ExamMedium[] = ['english', 'telugu']

export function isExamMedium(value: string): value is ExamMedium {
  return value === 'english' || value === 'telugu'
}

// ---- Question identity -------------------------------------------

/**
 * Build a globally unique question identifier.
 *
 * WHY THIS EXISTS:
 *   `question_id` is only unique WITHIN a source table. In the live
 *   data set, `pedagogy_subject_questions` and `telugu_medium_math`
 *   both use the ID space Q000001..Q005000 — 5,000 colliding IDs.
 *   A Telugu module contains both Pedagogy and Mathematics questions,
 *   so a bare `question_id` is ambiguous there: it would either break
 *   the per-module uniqueness constraint or grade a Mathematics answer
 *   against a Pedagogy answer key.
 *
 *   Every mapping, cache payload, answer key and stored answer is
 *   therefore keyed on `table:question_id`.
 */
export function buildQuestionUid(questionTable: string, questionId: string): string {
  return `${questionTable}:${questionId}`
}

export function parseQuestionUid(uid: string): { question_table: string; question_id: string } {
  const idx = uid.indexOf(':')
  if (idx === -1) return { question_table: '', question_id: uid }
  return { question_table: uid.slice(0, idx), question_id: uid.slice(idx + 1) }
}

// ---- Difficulty normalisation ------------------------------------

export type DifficultyBucket = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_BUCKETS: DifficultyBucket[] = ['easy', 'medium', 'hard']

/**
 * The question bank was populated by several independent pipelines and
 * uses inconsistent difficulty labels, including Telugu-language labels:
 *
 *   english_subject_questions   Easy | Medium | Difficult | Very Difficult
 *   telugu_subject_questions    Easy | Medium | Hard | Advanced
 *   pedagogy_subject_questions  సులభం | మధ్యస్థం | కఠినం | చాలా కఠినం
 *   pedagogy_english_medium     Easy | Moderate | Difficult
 *   math_english_medium         Medium | Difficult          (no Easy at all)
 *   telugu_medium_science       Medium | Hard               (no Easy at all)
 *   gk_english_medium           Easy only
 *   gk_telugu_medium            సులభం | మధ్యస్థం | కఠినం
 *
 * Without normalisation the previous generator silently dropped every
 * Telugu-labelled question into an "uncategorised" bucket and ignored the
 * blueprint's difficulty distribution entirely.
 */
const DIFFICULTY_ALIASES: Record<string, DifficultyBucket> = {
  // --- English labels ---
  easy: 'easy',
  simple: 'easy',
  basic: 'easy',
  beginner: 'easy',
  low: 'easy',

  medium: 'medium',
  moderate: 'medium',
  average: 'medium',
  intermediate: 'medium',
  normal: 'medium',

  hard: 'hard',
  difficult: 'hard',
  'very difficult': 'hard',
  'very hard': 'hard',
  advanced: 'hard',
  tough: 'hard',
  challenging: 'hard',
  high: 'hard',
  expert: 'hard',

  // --- Telugu labels ---
  'సులభం': 'easy',
  'తేలిక': 'easy',
  'మధ్యస్థం': 'medium',
  'మధ్యమం': 'medium',
  'కఠినం': 'hard',
  'చాలా కఠినం': 'hard',
  'అత్యంత కఠినం': 'hard',
}

/**
 * Map any raw difficulty label onto one of three canonical buckets.
 * Unknown / null labels fall back to 'medium' so the question stays
 * eligible instead of being silently discarded.
 */
export function normalizeDifficulty(raw: string | null | undefined): DifficultyBucket {
  return matchDifficulty(raw) ?? 'medium'
}

/**
 * The bucket a label genuinely maps to, or null when nothing recognised it.
 *
 * normalizeDifficulty answers 'medium' both for a real "Medium" and for a
 * label it has never seen, which is the right behaviour for generation — a
 * question stays eligible instead of vanishing. It is the wrong answer for an
 * admin about to write that label, who needs to know the difference between
 * "this is medium" and "this will be treated as medium because I do not
 * understand it". Hence the split.
 */
export function matchDifficulty(raw: string | null | undefined): DifficultyBucket | null {
  if (!raw) return null
  const key = String(raw).trim().toLowerCase()
  const direct = DIFFICULTY_ALIASES[key]
  if (direct) return direct

  // Substring fallback catches decorated labels e.g. "Hard (PYQ)"
  for (const [alias, bucket] of Object.entries(DIFFICULTY_ALIASES)) {
    if (key.includes(alias)) return bucket
  }
  return null
}

// ---- Pool question shape -----------------------------------------

/** A single eligible question loaded from the shared question bank. */
export interface PoolQuestion {
  /** `table:question_id` — globally unique */
  uid: string
  question_id: string
  question_table: string

  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string | null

  /** Canonical bucket used by the blueprint distribution rules */
  difficulty: DifficultyBucket
  /** Original label, preserved for reporting */
  raw_difficulty: string | null

  subject: string | null
  chapter: string | null
  topic: string
  subtopic: string | null
  question_type: string
  source_type: string | null

  /** How many modules of this medium already use this question */
  usage_count: number
}

// The column list every question table shares.
const QUESTION_COLUMNS = [
  'question_id',
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'explanation',
  'difficulty',
  'subject',
  'chapter',
  'topic',
  'subtopic',
  'question_type',
  'source_type',
].join(', ')

const PAGE_SIZE = 1000 // PostgREST hard-caps a single response at 1000 rows

/** A question is only eligible if it is complete and answerable. */
function isEligible(row: Record<string, unknown>): boolean {
  return Boolean(
    row.question_id &&
      row.question &&
      row.option_a &&
      row.option_b &&
      row.option_c &&
      row.option_d &&
      row.correct_answer
  )
}

/** Normalise `correct_answer` to a bare option letter where possible. */
export function normalizeCorrectAnswer(raw: unknown): string {
  return String(raw ?? 'A').trim().toUpperCase()
}

export interface LoadTableOptions {
  /** Keep only rows whose `subject` is in this list (exact, case-insensitive). */
  subjectIn?: string[]
  /** Honour the is_active flag when the column exists. Defaults to true. */
  requireActive?: boolean
}

/**
 * Load every eligible row from one question table.
 *
 * PostgREST returns at most 1000 rows per request, so a 6,615-row table
 * must be paged. The previous generator used a single `.limit(500)` with no
 * ordering, which meant every module was drawn from the same first 500
 * physical rows — the single biggest cause of repetition across modules.
 */
export async function loadQuestionTable(
  tableName: string,
  options: LoadTableOptions = {}
): Promise<PoolQuestion[]> {
  const { subjectIn, requireActive = true } = options
  const wanted = subjectIn?.map((s) => s.trim().toLowerCase())

  const out: PoolQuestion[] = []
  let from = 0
  let activeColumnMissing = false

  for (;;) {
    let query = supabaseAdmin
      .from(tableName)
      .select(QUESTION_COLUMNS)
      .order('question_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (requireActive && !activeColumnMissing) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      // The is_active column is added by migration 019. If the migration has
      // not been applied yet, retry once without the filter rather than
      // returning an empty pool.
      if (requireActive && !activeColumnMissing && /is_active/i.test(error.message)) {
        activeColumnMissing = true
        continue
      }
      console.warn(`[QuestionBank] Failed to load ${tableName}: ${error.message}`)
      break
    }

    if (!data || data.length === 0) break

    for (const row of data as unknown as Record<string, unknown>[]) {
      if (!isEligible(row)) continue

      if (wanted && wanted.length > 0) {
        const subject = String(row.subject ?? '').trim().toLowerCase()
        if (!wanted.includes(subject)) continue
      }

      const str = (v: unknown): string => String(v ?? '')
      const nullable = (v: unknown): string | null =>
        v === null || v === undefined || v === '' ? null : String(v)

      const questionId = str(row.question_id)
      const rawDifficulty = nullable(row.difficulty)
      const topic = str(row.topic ?? row.chapter ?? 'General').trim()

      out.push({
        uid: buildQuestionUid(tableName, questionId),
        question_id: questionId,
        question_table: tableName,
        question: str(row.question),
        option_a: str(row.option_a),
        option_b: str(row.option_b),
        option_c: str(row.option_c),
        option_d: str(row.option_d),
        correct_answer: normalizeCorrectAnswer(row.correct_answer),
        explanation: nullable(row.explanation),
        difficulty: normalizeDifficulty(rawDifficulty),
        raw_difficulty: rawDifficulty,
        subject: nullable(row.subject),
        chapter: nullable(row.chapter),
        topic: topic || 'General',
        subtopic: nullable(row.subtopic),
        question_type: str(row.question_type ?? 'MCQ'),
        source_type: nullable(row.source_type),
        usage_count: 0,
      })
    }

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return out
}

/**
 * Load and merge the pools for a set of tables, de-duplicating by uid.
 * Runs the table loads in parallel — one paged read per table, never per question.
 */
export async function loadPool(
  tables: string[],
  options: LoadTableOptions = {}
): Promise<PoolQuestion[]> {
  const results = await Promise.all(tables.map((t) => loadQuestionTable(t, options)))

  const seen = new Set<string>()
  const merged: PoolQuestion[] = []
  for (const list of results) {
    for (const q of list) {
      if (seen.has(q.uid)) continue
      seen.add(q.uid)
      merged.push({ ...q, usage_count: 0 })
    }
  }
  return merged
}
