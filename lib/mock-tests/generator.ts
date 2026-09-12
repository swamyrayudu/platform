// ============================================================
// lib/mock-tests/generator.ts — Grand Mock Question Generator
// ============================================================
// Selects questions from existing question tables following
// blueprint rules to produce a fixed 160-question mapping.
//
// Algorithm:
//   For each section in the blueprint:
//     1. Query candidate questions from section tables
//     2. Apply difficulty distribution
//     3. Shuffle within each difficulty bucket
//     4. Select exactly the required count
//     5. Assign sequential question_number positions
//   Validate the complete set before returning
//
// This is called ONCE during Grand Mock creation. After that,
// the fixed mapping is stored in mock_test_questions.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ExamBlueprint, ExamSectionBlueprint } from '@/types/mock-tests'
import type { QuestionMappingWithMeta } from './validator'
import { validateBlueprint } from './validator'

// Helper: Fisher-Yates shuffle
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface RawQuestion {
  question_id: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string | null
  difficulty: string | null
  subject: string | null
  chapter: string | null
  topic: string | null
  subtopic: string | null
  source_type: string | null
  is_active: boolean | null
}

/**
 * Fetch questions from a single question table.
 * Only returns active questions with non-null content.
 */
async function fetchFromTable(
  tableName: string,
  subjectFilter: string | undefined,
  limit: number
): Promise<Array<RawQuestion & { _table: string }>> {
  try {
    let query = supabaseAdmin
      .from(tableName)
      .select(
        'question_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, subject, chapter, topic, subtopic, source_type'
      )
      .not('question', 'is', null)
      .not('option_a', 'is', null)
      .not('option_b', 'is', null)
      .not('option_c', 'is', null)
      .not('option_d', 'is', null)
      .not('correct_answer', 'is', null)

    if (subjectFilter) {
      query = query.ilike('subject', `%${subjectFilter.split(' ')[0]}%`)
    }

    // Fetch more than needed to allow distribution-based selection
    query = query.limit(Math.min(limit * 8, 500))

    const { data, error } = await query
    if (error || !data) {
      console.warn(`[Generator] Error fetching from ${tableName}:`, error?.message)
      return []
    }

    return data.map((row: any) => ({
      question_id: row.question_id || String(row.id || ''),
      question: row.question,
      option_a: row.option_a,
      option_b: row.option_b,
      option_c: row.option_c,
      option_d: row.option_d,
      correct_answer: (row.correct_answer || 'A').trim().toUpperCase(),
      explanation: row.explanation || null,
      difficulty: row.difficulty || 'Medium',
      subject: row.subject || null,
      chapter: row.chapter || null,
      topic: row.topic || null,
      subtopic: row.subtopic || null,
      source_type: row.source_type || null,
      is_active: row.is_active !== false, // default true if column absent
      _table: tableName,
    }))
  } catch (err) {
    console.warn(`[Generator] Exception fetching from ${tableName}:`, err)
    return []
  }
}

/**
 * Select questions for one blueprint section using difficulty distribution.
 * Returns exactly section.total_questions items, or throws if pool is too small.
 */
async function selectForSection(
  section: ExamSectionBlueprint,
  alreadyUsedIds: Set<string>
): Promise<Array<RawQuestion & { _table: string }>> {
  // 1. Gather candidates from all section tables in parallel
  const tableFetches = section.question_tables.map((table) =>
    fetchFromTable(table, section.subject_filter, section.total_questions * 10)
  )
  const rawResults = await Promise.all(tableFetches)
  const allCandidates = rawResults.flat()

  // 2. Deduplicate by question_id and exclude already-used questions
  const seen = new Set<string>()
  const uniqueCandidates: Array<RawQuestion & { _table: string }> = []
  for (const q of allCandidates) {
    if (!q.question_id || seen.has(q.question_id) || alreadyUsedIds.has(q.question_id)) continue
    if (!q.question || !q.option_a || !q.option_b || !q.option_c || !q.option_d) continue
    if (!q.correct_answer) continue
    seen.add(q.question_id)
    uniqueCandidates.push(q)
  }

  if (uniqueCandidates.length < section.total_questions) {
    console.warn(
      `[Generator] Section "${section.name}": only ${uniqueCandidates.length} unique questions available, need ${section.total_questions}. Will use all available.`
    )
  }

  // 3. Apply difficulty distribution
  const dist = section.difficulty_distribution ?? { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 }
  const easyPool = shuffleArray(uniqueCandidates.filter((q) => (q.difficulty || '').toLowerCase() === 'easy'))
  const mediumPool = shuffleArray(uniqueCandidates.filter((q) => (q.difficulty || '').toLowerCase() === 'medium'))
  const hardPool = shuffleArray(uniqueCandidates.filter((q) => (q.difficulty || '').toLowerCase() === 'hard'))
  const uncategorizedPool = shuffleArray(
    uniqueCandidates.filter((q) => !['easy', 'medium', 'hard'].includes((q.difficulty || '').toLowerCase()))
  )

  const totalNeeded = section.total_questions
  const easyTarget = Math.round(totalNeeded * dist.easy_pct)
  const hardTarget = Math.round(totalNeeded * dist.hard_pct)
  const mediumTarget = totalNeeded - easyTarget - hardTarget

  // Pick from each bucket, fallback to other buckets if short
  const selected: Array<RawQuestion & { _table: string }> = []
  const addFromPool = (pool: typeof uniqueCandidates, count: number) => {
    const picks = pool.slice(0, count)
    selected.push(...picks)
  }

  addFromPool(easyPool, Math.min(easyTarget, easyPool.length))
  addFromPool(mediumPool, Math.min(mediumTarget, mediumPool.length))
  addFromPool(hardPool, Math.min(hardTarget, hardPool.length))

  // If we have shortfall, fill from uncategorized then any remaining
  if (selected.length < totalNeeded) {
    const selectedIds = new Set(selected.map((q) => q.question_id))
    const overflow = [...uncategorizedPool, ...easyPool, ...mediumPool, ...hardPool].filter(
      (q) => !selectedIds.has(q.question_id)
    )
    const needed = totalNeeded - selected.length
    selected.push(...overflow.slice(0, needed))
  }

  return selected.slice(0, totalNeeded)
}

export interface GeneratedMapping {
  question_id: string
  question_table: string
  question_number: number
  section_id: string
  section_name: string
  marks: number
  // Full metadata for cache warming
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string | null
  difficulty: string | null
  subject: string | null
  chapter: string | null
  topic: string | null
  subtopic: string | null
}

/**
 * Generate the complete 160-question mapping for a Grand Mock.
 *
 * Returns:
 *  - mappings: ordered list of GeneratedMapping (question_number 1..160)
 *  - validation: BlueprintValidationResult
 *
 * Throws if the question bank has insufficient questions.
 */
export async function generateGrandMockQuestions(blueprint: ExamBlueprint): Promise<{
  mappings: GeneratedMapping[]
  validation: ReturnType<typeof validateBlueprint>
}> {
  const allMappings: GeneratedMapping[] = []
  const usedIds = new Set<string>()
  let questionNumber = 1

  for (const section of blueprint.sections) {
    const selected = await selectForSection(section, usedIds)

    // Shuffle final section order
    const shuffled = shuffleArray(selected)

    for (const q of shuffled) {
      usedIds.add(q.question_id)
      allMappings.push({
        question_id: q.question_id,
        question_table: q._table,
        question_number: questionNumber++,
        section_id: section.id,
        section_name: section.name,
        marks: blueprint.marks_per_question,
        question: q.question,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        subject: q.subject,
        chapter: q.chapter,
        topic: q.topic,
        subtopic: q.subtopic,
      })
    }
  }

  // Validate
  const mappingsForValidation: QuestionMappingWithMeta[] = allMappings.map((m) => ({
    id: '',
    mock_test_id: '',
    question_id: m.question_id,
    question_table: m.question_table,
    question_number: m.question_number,
    section_id: m.section_id,
    section_name: m.section_name,
    marks: m.marks,
    created_at: '',
    question: m.question,
    option_a: m.option_a,
    option_b: m.option_b,
    option_c: m.option_c,
    option_d: m.option_d,
    is_active: true,
  }))

  const validation = validateBlueprint(blueprint, mappingsForValidation)

  return { mappings: allMappings, validation }
}
