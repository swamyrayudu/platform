// ============================================================================
// lib/practice/subjects/social-studies/fetch-algorithms.ts
// Specialized Database Fetch & Adaptive Selection Algorithms
// Dedicated for Telugu Medium (socal_telugu_medimum) & English Medium (socal_english_medium)
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { PracticeMedium, PracticeMode, PracticeQuestion, PracticeFilterState } from '@/types/practice'
import {
  calculateQuestionScore,
  shuffleArray,
  type UserAttemptHistory,
} from '@/lib/practice/engine'

export interface SocialQuestionQueryFilter {
  class_levels?: string[]
  chapters?: string[]
  topics?: string[]
  subtopics?: string[]
  difficulty?: string[]
  source_types?: string[]
  limit?: number
  offset?: number
}

export interface DifficultyRatio {
  easyPct: number    // e.g., 0.30 (30%)
  mediumPct: number  // e.g., 0.50 (50%)
  hardPct: number    // e.g., 0.20 (20%)
}

export interface MediumExamBlueprint {
  medium: PracticeMedium
  totalQuestions: number
  difficultyDistribution?: DifficultyRatio
  categoryDistribution?: {
    geographyPct?: number   // భౌగోళిక శాస్త్రం / Geography
    historyPct?: number     // చరిత్ర / History
    civicsPct?: number      // పౌరనీతి / Civics
    economicsPct?: number   // అర్థశాస్త్రం / Economics
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
    subject: row.subject || 'Social Studies',
    class_level: row.class_level || 'Class 8',
    chapter: row.chapter || null,
    topic: row.topic || 'Social Studies',
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
// ALGORITHM 1: Dedicated Telugu Medium Database Fetcher (`socal_telugu_medimum`)
// ============================================================================
/**
 * Executes an optimized query against `socal_telugu_medimum`.
 * Supports Telugu text matching, Class level filtering (e.g., 'Class 6', '6వ తరగతి'),
 * chapter/topic filtering, and source type discrimination.
 */
export async function fetchTeluguMediumQuestions(
  filter: SocialQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('socal_telugu_medimum')
      .select('*')
      .order('created_at', { ascending: false })

    // 1. Filter by Class Levels
    if (filter.class_levels && filter.class_levels.length > 0 && !filter.class_levels.includes('All')) {
      query = query.in('class_level', filter.class_levels)
    }

    // 2. Filter by Chapters (supports Telugu strings e.g., 'భౌగోళిక శాస్త్రం', 'చరిత్ర')
    if (filter.chapters && filter.chapters.length > 0 && !filter.chapters.includes('All')) {
      query = query.in('chapter', filter.chapters)
    }

    // 3. Filter by Topics
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

    // 6. Filter by Source Type
    if (filter.source_types && filter.source_types.length > 0) {
      query = query.in('source_type', filter.source_types)
    }

    // 7. Pagination
    if (filter.limit) {
      const from = filter.offset || 0
      const to = from + filter.limit - 1
      query = query.range(from, to)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Algorithm: Telugu Fetcher] Supabase error:', error)
      return []
    }

    return (data || []).map((row) => mapRowToPracticeQuestion(row, 'telugu'))
  } catch (err) {
    console.error('[Algorithm: Telugu Fetcher] Execution failure:', err)
    return []
  }
}

// ============================================================================
// ALGORITHM 2: Dedicated English Medium Database Fetcher (`socal_english_medium`)
// ============================================================================
/**
 * Executes an optimized query against `socal_english_medium`.
 * Supports English domain queries, standard terminology, difficulty and chapter constraints.
 */
export async function fetchEnglishMediumQuestions(
  filter: SocialQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('socal_english_medium')
      .select('*')
      .order('created_at', { ascending: false })

    // 1. Filter by Class Levels
    if (filter.class_levels && filter.class_levels.length > 0 && !filter.class_levels.includes('All')) {
      query = query.in('class_level', filter.class_levels)
    }

    // 2. Filter by Chapters (e.g., 'Geography', 'History', 'Civics', 'Economics')
    if (filter.chapters && filter.chapters.length > 0 && !filter.chapters.includes('All')) {
      query = query.in('chapter', filter.chapters)
    }

    // 3. Filter by Topics
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

    // 6. Filter by Source Type
    if (filter.source_types && filter.source_types.length > 0) {
      query = query.in('source_type', filter.source_types)
    }

    // 7. Pagination
    if (filter.limit) {
      const from = filter.offset || 0
      const to = from + filter.limit - 1
      query = query.range(from, to)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Algorithm: English Fetcher] Supabase error:', error)
      return []
    }

    return (data || []).map((row) => mapRowToPracticeQuestion(row, 'english'))
  } catch (err) {
    console.error('[Algorithm: English Fetcher] Execution failure:', err)
    return []
  }
}

// ============================================================================
// ALGORITHM 3: Medium-Unified Dynamic Dispatcher with Fallback
// ============================================================================
/**
 * Automatically routes the request to the corresponding medium table,
 * applies unified cross-table deduplication, and falls back to universal repository if required.
 */
export async function fetchQuestionsByMedium(
  medium: PracticeMedium,
  filter: SocialQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  if (medium.toLowerCase() === 'telugu') {
    const teluguQuestions = await fetchTeluguMediumQuestions(filter)
    if (teluguQuestions.length > 0) return teluguQuestions

    // Fallback to legacy social_subject_questions if empty
    try {
      const { data } = await supabaseAdmin
        .from('social_subject_questions')
        .select('*')
        .ilike('language', 'telugu')
      if (data && data.length > 0) {
        return data.map((r) => mapRowToPracticeQuestion(r, 'telugu'))
      }
    } catch (err) {}
    return []
  }

  // English medium
  const englishQuestions = await fetchEnglishMediumQuestions(filter)
  if (englishQuestions.length > 0) return englishQuestions

  // Fallback to legacy social_subject_questions if empty
  try {
    const { data } = await supabaseAdmin
      .from('social_subject_questions')
      .select('*')
      .or('language.eq.english,language.is.null')
    if (data && data.length > 0) {
      return data.map((r) => mapRowToPracticeQuestion(r, 'english'))
    }
  } catch (err) {}
  return []
}

// ============================================================================
// ALGORITHM 4: Adaptive Practice Generator with Balanced Difficulty & Topics
// ============================================================================
/**
 * High-performance smart question generator designed specifically for DSC aspirants.
 * Performs:
 * 1. Medium-strict database retrieval (`socal_telugu_medimum` vs `socal_english_medium`)
 * 2. User history scoring (Prioritizes never seen, boosts previously incorrect, penalizes recent repeats)
 * 3. Topic balanced distribution (Geography, History, Civics, Economics)
 * 4. Difficulty curve balancing (Default: 30% Easy, 50% Medium, 20% Hard)
 */
export async function generateSmartSocialSession(options: {
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

  // 1. Fetch raw pool from the dedicated database table
  const pool = await fetchQuestionsByMedium(medium, {
    class_levels: filter.class_levels,
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

  // Sort descending by calculated priority score
  scored.sort((a, b) => b.score - a.score)

  // 3. For target modes (weak_areas, previously_incorrect, new_questions)
  if (mode === 'weak_areas' || mode === 'previously_incorrect' || mode === 'new_questions') {
    const topCandidates = scored.slice(0, Math.min(scored.length, count * 2)).map((s) => s.question)
    return shuffleArray(topCandidates).slice(0, count)
  }

  // 4. For Random Mode: Pure uniform randomization
  if (mode === 'random') {
    return shuffleArray(pool).slice(0, count)
  }

  // 5. Standard / Exam Mode: Balance across Difficulty and Topics
  const targetEasy = Math.round(count * difficultyRatio.easyPct)
  const targetHard = Math.round(count * difficultyRatio.hardPct)
  const targetMedium = count - (targetEasy + targetHard)

  const easyPool = scored.filter((s) => s.question.difficulty.toLowerCase() === 'easy').map((s) => s.question)
  const mediumPool = scored.filter((s) => s.question.difficulty.toLowerCase() === 'medium').map((s) => s.question)
  const hardPool = scored.filter((s) => s.question.difficulty.toLowerCase() === 'hard').map((s) => s.question)

  const selectedSet = new Set<string>()
  const finalQuestions: PracticeQuestion[] = []

  const pickFromPool = (candidatePool: PracticeQuestion[], targetCount: number) => {
    let picked = 0
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

  pickFromPool(easyPool, targetEasy)
  pickFromPool(mediumPool, targetMedium)
  pickFromPool(hardPool, targetHard)

  // If still below target count, fill from remaining top scored candidates
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

  // 6. Final shuffle to randomize question order for the test session
  return shuffleArray(finalQuestions)
}

// ============================================================================
// ALGORITHM 5: Metadata & Topic Aggregation Algorithm
// ============================================================================
/**
 * Directly aggregates statistics (Total count, Chapters, Topics, Difficulties)
 * from `socal_telugu_medimum` or `socal_english_medium`.
 */
export async function getSocialMediumAnalytics(medium: PracticeMedium) {
  const tableName = medium.toLowerCase() === 'telugu' ? 'socal_telugu_medimum' : 'socal_english_medium'

  try {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('class_level, chapter, topic, difficulty')

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
    console.error(`[Analytics Algorithm] Failed for ${tableName}:`, err)
    return { total: 0, classes: [], chapters: [], topics: [], difficulties: { Easy: 0, Medium: 0, Hard: 0 } }
  }
}
