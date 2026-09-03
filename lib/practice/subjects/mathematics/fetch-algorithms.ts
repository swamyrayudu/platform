// ============================================================================
// lib/practice/subjects/mathematics/fetch-algorithms.ts
// Specialized Database Fetch & Adaptive Selection Algorithms
// Dedicated for Telugu Medium Math (telugu_medium_math) & English Medium Math
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
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

export interface MathQuestionQueryFilter {
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

export interface MathExamBlueprint {
  medium: PracticeMedium
  totalQuestions: number
  difficultyDistribution?: DifficultyRatio
  categoryDistribution?: {
    numberSystemPct?: number     // సంఖ్యా వ్యవస్థ / Number System
    arithmeticPct?: number       // అంకగణితం (శాతాలు, నిష్పత్తి, లాభనష్టాలు)
    algebraPct?: number          // బీజగణితం / Algebra
    geometryPct?: number         // రేఖాగణితం / Geometry
    mensurationPct?: number      // క్షేత్రమితి / Mensuration
    statisticsPct?: number       // సాంఖ్యక శాస్త్రం / Statistics
    pedagogyPct?: number         // గణిత బోధనా పద్ధతులు / Math Pedagogy
  }
}

// ----------------------------------------------------------------------------
// Helper: Map raw database row to standardized PracticeQuestion
// ----------------------------------------------------------------------------
function mapRowToPracticeQuestion(row: any, medium: PracticeMedium): PracticeQuestion {
  return {
    id: row.id || row.question_id,
    question_id: row.question_id || row.id,
    medium,
    subject: 'Mathematics',
    class_level: row.class_level || 'Class 8',
    chapter: row.chapter || null,
    topic: row.topic || 'గణితం',
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
// ALGORITHM 1: Dedicated Telugu Medium Database Fetcher (`telugu_medium_math`)
// ============================================================================
/**
 * Queries the dedicated `telugu_medium_math` table with indexed filters.
 * Supports Telugu text matching, Class levels (Class 6 - 10, SGT),
 * chapters/topics (సంఖ్యా వ్యవస్థ, బీజగణితం, etc.), and source discrimination.
 */
export async function fetchTeluguMediumMathQuestions(
  filter: MathQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('telugu_medium_math')
      .select('*')
      .order('created_at', { ascending: false })

    // 1. Filter by Class Levels (e.g. 'Class 6', 'Class 8', 'SGT')
    if (filter.class_levels && filter.class_levels.length > 0 && !filter.class_levels.includes('All')) {
      query = query.in('class_level', filter.class_levels)
    }

    // 2. Filter by Chapters (e.g. 'సంఖ్యా వ్యవస్థ', 'క్షేత్రమితి', 'రేఖాగణితం')
    if (filter.chapters && filter.chapters.length > 0 && !filter.chapters.includes('All')) {
      query = query.in('chapter', filter.chapters)
    }

    // 3. Filter by Topics (e.g. 'భిన్నాలు', 'పూర్ణాంకాలు', 'ల.సా.గు & గ.సా.భా')
    if (filter.topics && filter.topics.length > 0 && !filter.topics.includes('All')) {
      query = query.in('topic', filter.topics)
    }

    // 4. Filter by Subtopics (e.g. 'భాజనీయత సూత్రాలు', 'పైథాగరస్ సిద్ధాంతం')
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

    // 7. Filter by Language if explicitly specified
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
      console.warn('[Telugu Math Fetch Algorithm] Table query error, falling back:', error.message)
      return fallbackToUnifiedMathQuestions('telugu', filter)
    }

    if (!data || data.length === 0) {
      return fallbackToUnifiedMathQuestions('telugu', filter)
    }

    return data.map((row) => mapRowToPracticeQuestion(row, 'telugu'))
  } catch (err) {
    console.error('[Telugu Math Fetch Algorithm] Execution error:', err)
    return fallbackToUnifiedMathQuestions('telugu', filter)
  }
}

// ============================================================================
// ALGORITHM 2: English Medium Math Database Fetcher
// ============================================================================
export async function fetchEnglishMediumMathQuestions(
  filter: MathQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    // 1. Try math_english_medium first
    let query = supabaseAdmin
      .from('math_english_medium')
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
    if (!error && data && data.length > 0) {
      return data.map((row) => mapRowToPracticeQuestion(row, 'english'))
    }

    // 2. Fallback to mathematics_subject_questions
    const { data: legacyData, error: legacyErr } = await supabaseAdmin
      .from('mathematics_subject_questions')
      .select('*')
      .order('created_at', { ascending: false })

    if (!legacyErr && legacyData && legacyData.length > 0) {
      return legacyData.map((row) => mapRowToPracticeQuestion(row, 'english'))
    }

    return fallbackToUnifiedMathQuestions('english', filter)
  } catch (err) {
    return fallbackToUnifiedMathQuestions('english', filter)
  }
}

/**
 * Dispatcher: Fetches math questions matching requested medium
 */
export async function fetchMathQuestionsByMedium(
  medium: PracticeMedium,
  filter: MathQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  if (medium === 'telugu') {
    return fetchTeluguMediumMathQuestions(filter)
  }
  return fetchEnglishMediumMathQuestions(filter)
}

/**
 * Fallback to dsc_practice_questions if primary table has no data or migration not run
 */
async function fallbackToUnifiedMathQuestions(
  medium: PracticeMedium,
  filter: MathQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('dsc_practice_questions')
      .select('*')
      .ilike('subject', 'Mathematics')
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

    return data.map((row) => mapRowToPracticeQuestion(row, medium))
  } catch (err) {
    return []
  }
}

// ============================================================================
// ALGORITHM 3: Smart Algorithmic Question Selector for Mathematics
// ============================================================================
/**
 * Advanced multi-criteria algorithmic question selector for Mathematics.
 * 
 * Algorithms applied:
 * 1. Medium-Aware Fetch: Targets `telugu_medium_math` for Telugu Medium.
 * 2. Spaced Repetition & Heuristic Scoring:
 *    - Unattempted questions (+10)
 *    - Previously incorrect questions (+8)
 *    - Weak topics (<65% mastery) (+5)
 *    - Avoids questions answered repeatedly or attempted in the last 24h (-5)
 * 3. Difficulty Curve Balancing (e.g. 30% Easy, 50% Medium, 20% Hard)
 * 4. Mathematics Topic / Chapter Stratification across Syllabus:
 *    (Number System, Arithmetic, Algebra, Geometry, Mensuration, Statistics, Pedagogy)
 */
export async function generateSmartMathSession(options: {
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
  const pool = await fetchMathQuestionsByMedium(medium, {
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
    return shuffleArray([...pool])
  }

  // 2. Score candidate questions based on student learning state
  const scored = pool.map((q) => ({
    question: q,
    score: calculateQuestionScore(q, history, weakTopics, mode),
  }))

  // Sort descending by priority score
  scored.sort((a, b) => b.score - a.score)

  // 3. For targeted modes: weak_areas, previously_incorrect, new_questions
  if (mode === 'weak_areas' || mode === 'previously_incorrect' || mode === 'new_questions') {
    const topCandidates = scored.slice(0, Math.min(scored.length, count * 2)).map((s) => s.question)
    return shuffleArray(topCandidates).slice(0, count)
  }

  // 4. BALANCED / EXAM MODE: Intelligent Topic Stratification + Difficulty Curve Allocation
  const targetEasy = Math.round(count * difficultyRatio.easyPct)
  const targetHard = Math.round(count * difficultyRatio.hardPct)
  const targetMedium = count - (targetEasy + targetHard)

  const easyPool = scored.filter((s) => (s.question.difficulty || '').toLowerCase() === 'easy').map((s) => s.question)
  const mediumPool = scored.filter((s) => (s.question.difficulty || '').toLowerCase() === 'medium').map((s) => s.question)
  const hardPool = scored.filter((s) => (s.question.difficulty || '').toLowerCase() === 'hard').map((s) => s.question)

  const selectedSet = new Set<string>()
  const finalQuestions: PracticeQuestion[] = []

  const pickFromPool = (candidatePool: PracticeQuestion[], targetCount: number) => {
    // Topic-aware stratification within difficulty bucket
    const byTopic: Record<string, PracticeQuestion[]> = {}
    candidatePool.forEach((q) => {
      const t = q.topic || q.chapter || 'General Math'
      if (!byTopic[t]) byTopic[t] = []
      byTopic[t].push(q)
    })

    const topics = Object.keys(byTopic)
    let round = 0
    let picked = 0

    while (picked < targetCount && round < 50) {
      let addedInRound = false
      for (const t of topics) {
        if (picked >= targetCount) break
        const list = byTopic[t]
        if (round < list.length) {
          const cand = list[round]
          const qId = cand.question_id || cand.id
          if (!selectedSet.has(qId)) {
            selectedSet.add(qId)
            finalQuestions.push(cand)
            picked++
            addedInRound = true
          }
        }
      }
      round++
      if (!addedInRound) break
    }

    // Fill remaining within pool if topic round-robin ended early
    if (picked < targetCount) {
      for (const q of candidatePool) {
        if (picked >= targetCount) break
        const qId = q.question_id || q.id
        if (!selectedSet.has(qId)) {
          selectedSet.add(qId)
          finalQuestions.push(q)
          picked++
        }
      }
    }
  }

  // Allocate per difficulty curve
  pickFromPool(easyPool, targetEasy)
  pickFromPool(mediumPool, targetMedium)
  pickFromPool(hardPool, targetHard)

  // 5. If any shortfall remains, backfill from highest priority scored questions
  if (finalQuestions.length < count) {
    for (const s of scored) {
      const qId = s.question.question_id || s.question.id
      if (!selectedSet.has(qId)) {
        selectedSet.add(qId)
        finalQuestions.push(s.question)
        if (finalQuestions.length >= count) break
      }
    }
  }

  // 6. Return randomized order for test session
  return shuffleArray(finalQuestions)
}

// ============================================================================
// ALGORITHM 4: Mathematics Real-Time Analytics & Syllabus Coverage Aggregator
// ============================================================================
/**
 * Aggregates live question counts, chapters, topics, and difficulty distribution from `telugu_medium_math`.
 */
export async function getMathAnalytics(medium: PracticeMedium = 'telugu') {
  const tableName = medium === 'telugu' ? 'telugu_medium_math' : 'math_english_medium'
  try {
    let { data, error } = await supabaseAdmin
      .from(tableName)
      .select('class_level, chapter, topic, difficulty')

    if ((error || !data || data.length === 0) && tableName === 'math_english_medium') {
      const legacyRes = await supabaseAdmin
        .from('mathematics_subject_questions')
        .select('class_level, chapter, topic, difficulty')
      if (!legacyRes.error && legacyRes.data && legacyRes.data.length > 0) {
        data = legacyRes.data
        error = null
      }
    }

    if (error || !data) {
      return { total: 0, classes: [], chapters: [], topics: [], difficulties: { Easy: 0, Medium: 0, Hard: 0 } }
    }

    const classes = new Set<string>()
    const chapters = new Set<string>()
    const topicsMap: Record<string, number> = {}
    const difficulties: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 }

    data.forEach((row) => {
      if (row.class_level) classes.add(row.class_level)
      if (row.chapter) chapters.add(row.chapter)
      if (row.topic) {
        topicsMap[row.topic] = (topicsMap[row.topic] || 0) + 1
      }
      const diff = row.difficulty || 'Medium'
      difficulties[diff] = (difficulties[diff] || 0) + 1
    })

    return {
      tableName,
      medium,
      total: data.length,
      classes: Array.from(classes),
      chapters: Array.from(chapters),
      topics: Object.entries(topicsMap).map(([name, count]) => ({ name, count })),
      difficulties,
    }
  } catch (err) {
    console.error('[Math Analytics Algorithm] Failed:', err)
    return { total: 0, classes: [], chapters: [], topics: [], difficulties: { Easy: 0, Medium: 0, Hard: 0 } }
  }
}
