// ============================================================================
// lib/practice/subjects/gk/fetch-algorithms.ts
// Specialized Database Fetch & Adaptive Selection Algorithms
// Dedicated for GK & Current Affairs:
//   - English Medium: gk_english_medium
//   - Telugu Medium:  gk_telugu_medium
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

export interface GKQuestionQueryFilter {
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

export interface GKExamBlueprint {
  medium: PracticeMedium
  totalQuestions: number
  difficultyDistribution?: DifficultyRatio
  categoryDistribution?: {
    currentAffairsPct?: number // వర్తమాన వ్యవహారాలు / Current Affairs
    historyPct?: number        // భారత చరిత్ర / Indian History
    polityPct?: number         // భారత రాజ్యాంగం / Indian Polity
    geographyPct?: number      // భౌగోళిక శాస్త్రం / Geography
    apSpecialPct?: number      // ఆంధ్రప్రదేశ్ ప్రత్యేకం / AP State Events & Schemes
    awardsSportsPct?: number   // పురస్కారాలు & క్రీడలు / Awards & Sports
    scienceTechPct?: number    // సైన్స్ & టెక్నాలజీ / Science & Technology
  }
}

// ----------------------------------------------------------------------------
// Helpers: Normalization for bilingual Telugu/English fields
// ----------------------------------------------------------------------------
function normalizeDifficulty(rawDiff?: string | null): 'Easy' | 'Medium' | 'Hard' {
  if (!rawDiff) return 'Medium'
  const d = rawDiff.trim().toLowerCase()
  if (d === 'easy' || d === 'సులభం' || d.includes('సులభ')) return 'Easy'
  if (d === 'hard' || d === 'కఠినం' || d === 'చాలా కఠినం' || d.includes('కఠిన')) return 'Hard'
  return 'Medium'
}

function normalizeClassLevel(rawClass?: string | null): string {
  if (!rawClass) return 'General'
  const trimmed = rawClass.trim()
  if (/^\d+$/.test(trimmed)) {
    return `Class ${trimmed}`
  }
  return trimmed
}

// ----------------------------------------------------------------------------
// Helper: Map raw database row to standardized PracticeQuestion
// ----------------------------------------------------------------------------
function mapRowToPracticeQuestion(row: any, medium: PracticeMedium): PracticeQuestion {
  return {
    id: row.id || row.question_id,
    question_id: row.question_id || row.id,
    medium,
    subject: 'GK & Current Affairs', // Standardized subject name for UI & practice engine
    class_level: normalizeClassLevel(row.class_level),
    chapter: row.chapter || (medium === 'telugu' ? 'వర్తమాన వ్యవహారాలు' : 'Current Affairs'),
    topic: row.topic || (medium === 'telugu' ? 'సాధారణ జ్ఞానం' : 'General Knowledge'),
    subtopic: row.subtopic || null,
    difficulty: normalizeDifficulty(row.difficulty),
    question_type: row.question_type || 'MCQ',
    question: row.question,
    option_a: row.option_a,
    option_b: row.option_b,
    option_c: row.option_c,
    option_d: row.option_d,
    correct_answer: (row.correct_answer || 'A').trim(),
    explanation: row.explanation || null,
    source_type: row.source_type || 'Standard GK',
    language: row.language || (medium === 'telugu' ? 'telugu' : 'english'),
    tags: row.tags || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ============================================================================
// ALGORITHM 1: Dedicated English Medium Database Fetcher (`gk_english_medium`)
// ============================================================================
/**
 * Queries the dedicated `gk_english_medium` table with indexed filters.
 * Supports English questions for National & International Events, AP Schemes, History, Polity, etc.
 */
export async function fetchEnglishMediumGKQuestions(
  filter: GKQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('gk_english_medium')
      .select('*')
      .order('created_at', { ascending: false })

    // 1. Filter by Class Levels (e.g. 'SGT', 'School Assistant', 'General', 'Class 8')
    if (filter.class_levels && filter.class_levels.length > 0 && !filter.class_levels.includes('All')) {
      query = query.in('class_level', filter.class_levels)
    }

    // 2. Filter by Chapters (e.g. 'Current Affairs', 'Indian History', 'Geography', 'Indian Polity')
    if (filter.chapters && filter.chapters.length > 0 && !filter.chapters.includes('All')) {
      query = query.in('chapter', filter.chapters)
    }

    // 3. Filter by Topics (e.g. 'National Events', 'AP State Schemes', 'Science & Tech', 'Sports & Games')
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
      console.warn('[English GK Fetch Algorithm] Table query error, falling back:', error.message)
      return fallbackToUnifiedGKQuestions('english', filter)
    }

    if (!data || data.length === 0) {
      return fallbackToUnifiedGKQuestions('english', filter)
    }

    return data.map((row) => mapRowToPracticeQuestion(row, 'english'))
  } catch (err) {
    console.error('[English GK Fetch Algorithm] Execution error:', err)
    return fallbackToUnifiedGKQuestions('english', filter)
  }
}

// ============================================================================
// ALGORITHM 2: Dedicated Telugu Medium Database Fetcher (`gk_telugu_medium`)
// ============================================================================
/**
 * Queries the dedicated `gk_telugu_medium` table with indexed filters.
 * Supports Telugu text matching, Class levels (SGT, General),
 * chapters/topics (వర్తమాన వ్యవహారాలు, భారత చరిత్ర, భారత రాజ్యాంగం, etc.).
 */
export async function fetchTeluguMediumGKQuestions(
  filter: GKQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('gk_telugu_medium')
      .select('*')
      .order('created_at', { ascending: false })

    // 1. Filter by Class Levels
    if (filter.class_levels && filter.class_levels.length > 0 && !filter.class_levels.includes('All')) {
      query = query.in('class_level', filter.class_levels)
    }

    // 2. Filter by Chapters (e.g. 'వర్తమాన వ్యవహారాలు', 'భారత చరిత్ర', 'భారత రాజ్యాంగం')
    if (filter.chapters && filter.chapters.length > 0 && !filter.chapters.includes('All')) {
      query = query.in('chapter', filter.chapters)
    }

    // 3. Filter by Topics (e.g. 'జాతీయ అంశాలు', 'ఆంధ్రప్రదేశ్ రాష్ట్ర పథకాలు', 'క్రీడారంగం')
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
      console.warn('[Telugu GK Fetch Algorithm] Table query error, falling back:', error.message)
      return fallbackToUnifiedGKQuestions('telugu', filter)
    }

    if (!data || data.length === 0) {
      return fallbackToUnifiedGKQuestions('telugu', filter)
    }

    return data.map((row) => mapRowToPracticeQuestion(row, 'telugu'))
  } catch (err) {
    console.error('[Telugu GK Fetch Algorithm] Execution error:', err)
    return fallbackToUnifiedGKQuestions('telugu', filter)
  }
}

// ============================================================================
// ALGORITHM 3: Medium-Unified Dynamic Dispatcher
// ============================================================================
/**
 * Dispatcher: Fetches GK & Current Affairs questions matching requested medium
 */
export async function fetchGKQuestionsByMedium(
  medium: PracticeMedium,
  filter: GKQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  if (medium.toLowerCase() === 'telugu') {
    return fetchTeluguMediumGKQuestions(filter)
  }
  return fetchEnglishMediumGKQuestions(filter)
}

/**
 * Fallback to dsc_practice_questions if primary table has no data or migration not run
 */
async function fallbackToUnifiedGKQuestions(
  medium: PracticeMedium,
  filter: GKQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('dsc_practice_questions')
      .select('*')
      .eq('medium', medium)
      .or('subject.ilike.%gk%,subject.ilike.%general knowledge%,subject.ilike.%current affairs%')
      .order('created_at', { ascending: false })

    if (filter.difficulty && filter.difficulty.length > 0 && !filter.difficulty.includes('All')) {
      query = query.in('difficulty', filter.difficulty)
    }

    if (filter.limit) {
      query = query.limit(filter.limit)
    }

    const { data, error } = await query
    if (error || !data || data.length === 0) {
      return []
    }

    return data.map((row) => mapRowToPracticeQuestion(row, medium))
  } catch (err) {
    return []
  }
}

// ============================================================================
// ALGORITHM 4: Smart Adaptive GK Session Generator
// ============================================================================
/**
 * Intelligently generates an adaptive session for GK & Current Affairs,
 * weighting questions by user attempt history and difficulty ratios.
 */
export async function generateSmartGKSession(
  filter: PracticeFilterState,
  history: Record<string, UserAttemptHistory> = {},
  weakTopics: Set<string> = new Set()
): Promise<PracticeQuestion[]> {
  const pool = await fetchGKQuestionsByMedium(filter.medium, {
    class_levels: filter.class_levels,
    topics: filter.topics,
    subtopics: filter.subtopics,
    difficulty: filter.difficulty,
  })

  if (pool.length === 0) return []

  const requestedCount = Math.min(filter.question_count, pool.length)

  if (filter.mode === 'random') {
    return shuffleArray(pool).slice(0, requestedCount)
  }

  // Score questions for adaptive modes
  const scored = pool.map((q) => {
    const qId = q.question_id || q.id
    const isWeak = weakTopics.has(q.topic)
    const score = calculateQuestionScore(q, history, weakTopics, filter.mode)
    return { ...q, selection_score: score }
  })

  // Sort by score descending and take top questions
  scored.sort((a, b) => (b.selection_score || 0) - (a.selection_score || 0))
  const selected = scored.slice(0, requestedCount)

  return shuffleArray(selected).map(({ selection_score, ...rest }) => rest as PracticeQuestion)
}

// ============================================================================
// ALGORITHM 5: GK & Current Affairs Medium Analytics
// ============================================================================
/**
 * Aggregates topic distribution and difficulty breakdown for GK & Current Affairs.
 */
export async function getGKMediumAnalytics(medium: PracticeMedium): Promise<{
  totalCount: number
  topicDistribution: Record<string, number>
  chapterDistribution: Record<string, number>
  difficultyBreakdown: { easy: number; medium: number; hard: number }
}> {
  const questions = await fetchGKQuestionsByMedium(medium)

  const topicMap: Record<string, number> = {}
  const chapterMap: Record<string, number> = {}
  const diffMap = { easy: 0, medium: 0, hard: 0 }

  questions.forEach((q) => {
    topicMap[q.topic] = (topicMap[q.topic] || 0) + 1
    if (q.chapter) {
      chapterMap[q.chapter] = (chapterMap[q.chapter] || 0) + 1
    }
    const diff = (q.difficulty || 'Medium').toLowerCase()
    if (diff === 'easy') diffMap.easy++
    else if (diff === 'hard') diffMap.hard++
    else diffMap.medium++
  })

  return {
    totalCount: questions.length,
    topicDistribution: topicMap,
    chapterDistribution: chapterMap,
    difficultyBreakdown: diffMap,
  }
}
