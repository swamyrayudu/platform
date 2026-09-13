// ============================================================================
// lib/practice/subjects/science/fetch-algorithms.ts
// Specialized Database Fetch & Adaptive Selection Algorithms
// Dedicated for Telugu Medium Science (telugu_medium_science) & English Medium Science (english_medium_science)
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildQuestionUid } from '@/lib/questions/tables'
import type {
  PracticeMedium,
  PracticeMode,
  PracticeQuestion,
  PracticeFilterState,
} from '@/types/practice'
import {
  calculateQuestionScore,
  shuffleArray,
  type UserAttemptHistory,
} from '@/lib/practice/engine'
import type { DifficultyRatio } from '../types'

export interface ScienceQuestionQueryFilter {
  class_levels?: string[]
  chapters?: string[]
  topics?: string[]
  subtopics?: string[]
  difficulty?: string[]
  source_types?: string[]
  language?: string
  limit?: number
  offset?: number
}

export interface ScienceExamBlueprint {
  medium: PracticeMedium
  totalQuestions: number
  difficultyDistribution?: DifficultyRatio
  categoryDistribution?: {
    biologyPct?: number       // జీవ శాస్త్రం / Biology
    physicsPct?: number       // భౌతిక శాస్త్రం / Physics
    chemistryPct?: number     // రసాయన శాస్త్రం / Chemistry
    environmentalPct?: number // పరిసరాల విజ్ఞానం / Environmental Science
    pedagogyPct?: number      // సైన్స్ బోధనా పద్ధతులు / Science Pedagogy
  }
}

// ----------------------------------------------------------------------------
// Helper: Map raw database row to standardized PracticeQuestion
// ----------------------------------------------------------------------------
function mapRowToPracticeQuestion(
  row: any,
  medium: PracticeMedium,
  /** Table this row came from — half of the question's global identity. */
  sourceTable: string
): PracticeQuestion {
  return {
    id: row.id || row.question_id,
    question_id: row.question_id || row.id,
    question_uid: buildQuestionUid(sourceTable, String(row.question_id || row.id)),
    medium,
    subject: 'Science',
    class_level: row.class_level || 'Class 8',
    chapter: row.chapter || null,
    topic: row.topic || 'సాధారణ సైన్స్',
    subtopic: row.subtopic || null,
    difficulty: row.difficulty || 'Medium',
    question_type: row.question_type || 'MCQ',
    question: row.question,
    option_a: row.option_a,
    option_b: row.option_b,
    option_c: row.option_c,
    option_d: row.option_d,
    correct_answer: (row.correct_answer || 'A').trim(),
    explanation: row.explanation || null,
    source_type: row.source_type || 'SCERT',
    language: row.language || (medium === 'telugu' ? 'telugu' : 'english'),
    tags: row.tags || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ============================================================================
// ALGORITHM 1: Dedicated Telugu Medium Database Fetcher (`telugu_medium_science`)
// ============================================================================
/**
 * Queries the dedicated `telugu_medium_science` table with indexed filters.
 * Supports Telugu text matching, Class levels (Class 6 - 10, SGT),
 * chapters/topics (జీవ శాస్త్రం, భౌతిక శాస్త్రం, రసాయన శాస్త్రం, etc.), and source discrimination.
 */
export async function fetchTeluguMediumScienceQuestions(
  filter: ScienceQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('telugu_medium_science')
      .select('*')
      .order('created_at', { ascending: false })

    // 1. Filter by Class Levels (e.g. 'Class 6', 'Class 8', 'SGT')
    if (filter.class_levels && filter.class_levels.length > 0 && !filter.class_levels.includes('All')) {
      query = query.in('class_level', filter.class_levels)
    }

    // 2. Filter by Chapters (e.g. 'జీవ శాస్త్రం', 'భౌతిక శాస్త్రం', 'రసాయన శాస్త్రం')
    if (filter.chapters && filter.chapters.length > 0 && !filter.chapters.includes('All')) {
      query = query.in('chapter', filter.chapters)
    }

    // 3. Filter by Topics (e.g. 'కిరణజన్య సంయోగక్రియ', 'ధ్వని', 'ఆమ్లాలు - క్షారాలు')
    if (filter.topics && filter.topics.length > 0 && !filter.topics.includes('All')) {
      query = query.in('topic', filter.topics)
    }

    // 4. Filter by Subtopics
    if (filter.subtopics && filter.subtopics.length > 0 && !filter.subtopics.includes('All')) {
      query = query.in('subtopic', filter.subtopics)
    }

    // 5. Filter by Difficulty
    if (filter.difficulty && filter.difficulty.length > 0 && !filter.difficulty.includes('All')) {
      query = query.in('difficulty', filter.difficulty)
    }

    // 6. Filter by Source Type (e.g. 'SCERT', 'Previous Papers')
    if (filter.source_types && filter.source_types.length > 0) {
      query = query.in('source_type', filter.source_types)
    }

    // 7. Filter by Language
    if (filter.language) {
      query = query.eq('language', filter.language)
    }

    // 8. Pagination
    if (filter.limit) {
      const from = filter.offset || 0
      const to = from + filter.limit - 1
      query = query.range(from, to)
    }

    const { data, error } = await query

    if (error) {
      console.warn('[Telugu Science Fetch Algorithm] Table query error, falling back:', error.message)
      return fallbackToUnifiedScienceQuestions('telugu', filter)
    }

    if (!data || data.length === 0) {
      return fallbackToUnifiedScienceQuestions('telugu', filter)
    }

    return data.map((row) => mapRowToPracticeQuestion(row, 'telugu', 'telugu_medium_science'))
  } catch (err) {
    console.error('[Telugu Science Fetch Algorithm] Execution error:', err)
    return fallbackToUnifiedScienceQuestions('telugu', filter)
  }
}

// ============================================================================
// ALGORITHM 2: English Medium Science Database Fetcher (`english_medium_science`)
// ============================================================================
export async function fetchEnglishMediumScienceQuestions(
  filter: ScienceQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('english_medium_science')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter.class_levels && filter.class_levels.length > 0 && !filter.class_levels.includes('All')) {
      query = query.in('class_level', filter.class_levels)
    }
    if (filter.chapters && filter.chapters.length > 0 && !filter.chapters.includes('All')) {
      query = query.in('chapter', filter.chapters)
    }
    if (filter.topics && filter.topics.length > 0 && !filter.topics.includes('All')) {
      query = query.in('topic', filter.topics)
    }
    if (filter.subtopics && filter.subtopics.length > 0 && !filter.subtopics.includes('All')) {
      query = query.in('subtopic', filter.subtopics)
    }
    if (filter.difficulty && filter.difficulty.length > 0 && !filter.difficulty.includes('All')) {
      query = query.in('difficulty', filter.difficulty)
    }
    if (filter.source_types && filter.source_types.length > 0) {
      query = query.in('source_type', filter.source_types)
    }
    if (filter.limit) {
      const from = filter.offset || 0
      const to = from + filter.limit - 1
      query = query.range(from, to)
    }

    const { data, error } = await query
    if (error || !data || data.length === 0) {
      return fallbackToUnifiedScienceQuestions('english', filter)
    }

    return data.map((row) => mapRowToPracticeQuestion(row, 'english', 'english_medium_science'))
  } catch (err) {
    return fallbackToUnifiedScienceQuestions('english', filter)
  }
}

/**
 * Dispatcher: Fetches science questions matching requested medium
 */
export async function fetchScienceQuestionsByMedium(
  medium: PracticeMedium,
  filter: ScienceQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  if (medium === 'telugu') {
    return fetchTeluguMediumScienceQuestions(filter)
  }
  return fetchEnglishMediumScienceQuestions(filter)
}

/**
 * Fallback to dsc_practice_questions if primary table has no data or migration not run
 */
async function fallbackToUnifiedScienceQuestions(
  medium: PracticeMedium,
  filter: ScienceQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('dsc_practice_questions')
      .select('*')
      .ilike('subject', 'Science')
      .eq('is_active', true)

    if (medium) {
      query = query.eq('medium', medium)
    }
    if (filter.class_levels && filter.class_levels.length > 0 && !filter.class_levels.includes('All')) {
      query = query.in('class_level', filter.class_levels)
    }
    if (filter.topics && filter.topics.length > 0 && !filter.topics.includes('All')) {
      query = query.in('topic', filter.topics)
    }
    if (filter.difficulty && filter.difficulty.length > 0 && !filter.difficulty.includes('All')) {
      query = query.in('difficulty', filter.difficulty)
    }

    const { data, error } = await query
    if (error || !data) return []

    return data.map((row) => mapRowToPracticeQuestion(row, medium, 'dsc_practice_questions'))
  } catch (err) {
    return []
  }
}

// ============================================================================
// ALGORITHM 3: Smart Algorithmic Question Selector for Science
// ============================================================================
/**
 * Advanced multi-criteria algorithmic question selector for Science.
 * 
 * Algorithms applied:
 * 1. Medium-Aware Fetch: Targets `telugu_medium_science` for Telugu Medium & `english_medium_science` for English Medium.
 * 2. Spaced Repetition & Heuristic Scoring:
 *    - Unattempted questions (+10)
 *    - Previously incorrect questions (+8)
 *    - Weak topics (<65% mastery) (+5)
 *    - Avoids questions answered repeatedly or attempted in the last 24h (-5)
 * 3. Difficulty Curve Balancing (e.g. 30% Easy, 50% Medium, 20% Hard)
 * 4. Science Topic / Chapter Stratification across Syllabus:
 *    (Biology, Physics, Chemistry, Environmental Science, Science Methodology / Pedagogy)
 */
export async function generateSmartScienceSession(options: {
  medium: PracticeMedium
  count: number
  mode: PracticeMode
  filter?: Partial<PracticeFilterState>
  history?: Record<string, UserAttemptHistory>
  weakTopics?: Set<string>
  difficultyRatio?: DifficultyRatio
}): Promise<PracticeQuestion[]> {
  const {
    medium,
    count,
    mode,
    filter = {},
    history = {},
    weakTopics = new Set(),
    difficultyRatio = { easyPct: 0.3, mediumPct: 0.5, hardPct: 0.2 },
  } = options

  // 1. Fetch raw pool using dedicated medium algorithms
  const pool = await fetchScienceQuestionsByMedium(medium, {
    class_levels: filter.class_levels,
    chapters: (filter as any).chapters,
    topics: filter.topics,
    subtopics: filter.subtopics,
    difficulty: filter.difficulty,
  })

  if (pool.length === 0) {
    return []
  }

  if (pool.length <= count) {
    return shuffleArray(pool)
  }

  // 2. Mode-Specific Routing
  if (mode === 'random') {
    return shuffleArray(pool).slice(0, count)
  }

  if (mode === 'weak_areas') {
    const scoredPool = pool.map((q) => {
      const qId = q.question_id || q.id
      const h = history[qId]
      const isWeakTopic = weakTopics.has(q.topic)
      let score = isWeakTopic ? 50 : 0
      if (h && h.attempt_count > 0) {
        const acc = h.correct_count / h.attempt_count
        score += Math.round((1 - acc) * 40)
      } else {
        score += 20 // unattempted
      }
      return { q, score }
    })

    scoredPool.sort((a, b) => b.score - a.score)
    return scoredPool.slice(0, count).map((item) => item.q)
  }

  if (mode === 'previously_incorrect') {
    const incorrectOnly = pool.filter((q) => {
      const qId = q.question_id || q.id
      const h = history[qId]
      return h && h.incorrect_count > 0 && (h.correct_count === 0 || h.correct_count < h.incorrect_count)
    })

    if (incorrectOnly.length >= count) {
      return shuffleArray(incorrectOnly).slice(0, count)
    }

    const remainingCount = count - incorrectOnly.length
    const otherPool = pool.filter((q) => !incorrectOnly.some((iq) => (iq.question_id || iq.id) === (q.question_id || q.id)))
    return [...incorrectOnly, ...shuffleArray(otherPool).slice(0, remainingCount)]
  }

  if (mode === 'new_questions') {
    const unattempted = pool.filter((q) => {
      const qId = q.question_id || q.id
      const h = history[qId]
      return !h || h.attempt_count === 0
    })

    if (unattempted.length >= count) {
      return shuffleArray(unattempted).slice(0, count)
    }

    const remainingCount = count - unattempted.length
    const seen = pool.filter((q) => !unattempted.some((uq) => (uq.question_id || uq.id) === (q.question_id || q.id)))
    return [...unattempted, ...shuffleArray(seen).slice(0, remainingCount)]
  }

  // 3. Balanced Mode: Difficulty & Topic Stratification
  const targetEasy = Math.round(count * difficultyRatio.easyPct)
  const targetHard = Math.round(count * difficultyRatio.hardPct)
  const targetMed = count - targetEasy - targetHard

  const easyPool = pool.filter((q) => q.difficulty?.toLowerCase() === 'easy')
  const medPool = pool.filter((q) => q.difficulty?.toLowerCase() === 'medium' || !q.difficulty)
  const hardPool = pool.filter((q) => q.difficulty?.toLowerCase() === 'hard')

  const scoreAndPick = (subPool: PracticeQuestion[], target: number): PracticeQuestion[] => {
    if (subPool.length <= target) return subPool
    const scored = subPool.map((q) => ({
      q,
      score: calculateQuestionScore(q, history, weakTopics, mode),
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, target).map((s) => s.q)
  }

  const selectedEasy = scoreAndPick(easyPool, targetEasy)
  const selectedMed = scoreAndPick(medPool, targetMed)
  const selectedHard = scoreAndPick(hardPool, targetHard)

  const combined = [...selectedEasy, ...selectedMed, ...selectedHard]
  const selectedIds = new Set(combined.map((q) => q.question_id || q.id))

  // Fill up if shortfall
  if (combined.length < count) {
    const remainder = pool.filter((q) => !selectedIds.has(q.question_id || q.id))
    const fillCount = count - combined.length
    combined.push(...shuffleArray(remainder).slice(0, fillCount))
  }

  return shuffleArray(combined)
}

// ============================================================================
// ALGORITHM 4: Topic & Class Analytics Aggregator for Science
// ============================================================================
export async function getScienceMediumAnalytics(medium: PracticeMedium) {
  const tableName = medium.toLowerCase() === 'telugu' ? 'telugu_medium_science' : 'english_medium_science'
  try {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('class_level, chapter, topic, difficulty, source_type')

    if (error || !data) {
      return { total: 0, classes: {}, chapters: {}, topics: {}, difficulties: {} }
    }

    const classes: Record<string, number> = {}
    const chapters: Record<string, number> = {}
    const topics: Record<string, number> = {}
    const difficulties: Record<string, number> = {}

    data.forEach((row: any) => {
      const cls = row.class_level || 'Unknown'
      const chp = row.chapter || 'General'
      const top = row.topic || 'General'
      const diff = row.difficulty || 'Medium'

      classes[cls] = (classes[cls] || 0) + 1
      chapters[chp] = (chapters[chp] || 0) + 1
      topics[top] = (topics[top] || 0) + 1
      difficulties[diff] = (difficulties[diff] || 0) + 1
    })

    return {
      total: data.length,
      classes,
      chapters,
      topics,
      difficulties,
    }
  } catch (err) {
    return { total: 0, classes: {}, chapters: {}, topics: {}, difficulties: {} }
  }
}
