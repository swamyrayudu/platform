// ============================================================================
// lib/practice/subjects/pedagogy/fetch-algorithms.ts
// Specialized Database Fetch & Adaptive Selection Algorithms
// Dedicated for Pedagogy / CDP (pedagogy_subject_questions) supporting Telugu & English mediums
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

export interface PedagogyQuestionQueryFilter {
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

export interface PedagogyExamBlueprint {
  medium: PracticeMedium
  totalQuestions: number
  difficultyDistribution?: DifficultyRatio
  categoryDistribution?: {
    childDevelopmentPct?: number // శిశు వికాసం
    individualDifferencesPct?: number // వ్యక్తిగత భేదాలు
    learningProcessPct?: number // అభ్యసన ప్రక్రియ
    evaluationPct?: number // మూల్యాంకనం
    classroomManagementPct?: number // తరగతి నిర్వహణ
    inclusiveEducationPct?: number // ప్రత్యేక మరియు సమగ్ర విద్య
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
  if (!rawClass) return 'Class 8'
  const trimmed = rawClass.trim()
  if (/^\d+$/.test(trimmed)) {
    return `Class ${trimmed}`
  }
  return trimmed
}

// ----------------------------------------------------------------------------
// Helper: Map raw database row to standardized PracticeQuestion
// ----------------------------------------------------------------------------
function mapRowToPracticeQuestion(row: any, medium: PracticeMedium = 'telugu'): PracticeQuestion {
  const rowLang = (row.language || '').toLowerCase()
  const derivedMedium: PracticeMedium =
    row.medium ||
    (rowLang === 'telugu' || rowLang === 'te' ? 'telugu' : rowLang === 'english' ? 'english' : medium)

  return {
    id: row.id || row.question_id,
    question_id: row.question_id || row.id,
    medium: derivedMedium,
    subject: 'Pedagogy', // Standardized to 'Pedagogy' so UI card & filter counts sync perfectly
    class_level: normalizeClassLevel(row.class_level),
    chapter: row.chapter || null,
    topic: row.topic || 'Child Development',
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
    source_type: row.source_type || 'SCERT',
    language: row.language || (derivedMedium === 'telugu' ? 'telugu' : 'english'),
    tags: row.tags || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ============================================================================
// ALGORITHM 1: Intelligent Database Fetcher from `pedagogy_subject_questions`
// ============================================================================
/**
 * Queries `pedagogy_subject_questions` table with indexing support.
 * Serves Telugu Medium and English Medium candidates taking Child Development & Pedagogy.
 */
export async function fetchPedagogyQuestions(
  medium: PracticeMedium = 'telugu',
  filter: PedagogyQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    const primaryTable = medium === 'english' ? 'pedagogy_english_medium' : 'pedagogy_subject_questions'
    let query = supabaseAdmin
      .from(primaryTable)
      .select('*')
      .order('created_at', { ascending: false })

    // 1. Filter by Class Levels (supports '6', 'Class 6', etc.)
    if (filter.class_levels && filter.class_levels.length > 0 && !filter.class_levels.includes('All')) {
      const expandedClasses = new Set<string>()
      filter.class_levels.forEach((cl) => {
        expandedClasses.add(cl)
        const digits = cl.replace(/\D/g, '')
        if (digits) {
          expandedClasses.add(digits)
          expandedClasses.add(`Class ${digits}`)
        }
      })
      query = query.in('class_level', Array.from(expandedClasses))
    }

    // 2. Filter by Chapters (e.g. 'శిశు వికాసం', 'వ్యక్తిగత భేదాలు', 'అభ్యసన ప్రక్రియ', 'మూల్యాంకనం')
    if (filter.chapters && filter.chapters.length > 0 && !filter.chapters.includes('All')) {
      query = query.in('chapter', filter.chapters)
    }

    // 3. Filter by Topics (e.g. 'వృద్ధి–వికాసం', 'వికాస సూత్రాలు', 'పియాజే', 'వైగోట్స్కీ')
    if (filter.topics && filter.topics.length > 0 && !filter.topics.includes('All')) {
      query = query.in('topic', filter.topics)
    }

    // 4. Filter by Subtopics
    if (filter.subtopics && filter.subtopics.length > 0 && !filter.subtopics.includes('All')) {
      query = query.in('subtopic', filter.subtopics)
    }

    // 5. Filter by Difficulty (supports bilingual: Easy/సులభం, Medium/మధ్యస్థం, Hard/కఠినం)
    if (filter.difficulty && filter.difficulty.length > 0 && !filter.difficulty.includes('All')) {
      const expandedDiffs = new Set<string>()
      filter.difficulty.forEach((d) => {
        const lower = d.toLowerCase()
        if (lower === 'easy' || lower === 'సులభం') {
          expandedDiffs.add('Easy')
          expandedDiffs.add('సులభం')
        } else if (lower === 'hard' || lower === 'కఠినం' || lower === 'చాలా కఠినం') {
          expandedDiffs.add('Hard')
          expandedDiffs.add('కఠినం')
          expandedDiffs.add('చాలా కఠినం')
        } else {
          expandedDiffs.add('Medium')
          expandedDiffs.add('మధ్యస్థం')
        }
      })
      query = query.in('difficulty', Array.from(expandedDiffs))
    }

    // 6. Filter by Source Type
    if (filter.source_types && filter.source_types.length > 0) {
      query = query.in('source_type', filter.source_types)
    }

    // 7. Filter by Language if explicitly supplied
    if (filter.language) {
      query = query.ilike('language', filter.language)
    }

    // 8. Pagination
    if (filter.limit) {
      const from = filter.offset || 0
      const to = from + filter.limit - 1
      query = query.range(from, to)
    } else {
      // Default safety limit up to 2000 rows
      query = query.limit(2000)
    }

    const { data, error } = await query

    if (!error && data && data.length > 0) {
      return data.map((row) => mapRowToPracticeQuestion(row, medium))
    }

    // If English requested and pedagogy_english_medium had no rows, try legacy pedagogy_subject_questions
    if (primaryTable === 'pedagogy_english_medium') {
      const { data: legacyData, error: legacyErr } = await supabaseAdmin
        .from('pedagogy_subject_questions')
        .select('*')
        .limit(2000)

      if (!legacyErr && legacyData && legacyData.length > 0) {
        return legacyData.map((row) => mapRowToPracticeQuestion(row, medium))
      }
    }

    return fallbackToUnifiedPedagogyQuestions(medium, filter)
  } catch (err) {
    console.error('[Pedagogy Fetch Algorithm] Execution error:', err)
    return fallbackToUnifiedPedagogyQuestions(medium, filter)
  }
}

/**
 * Fallback to dsc_practice_questions if primary table has no data or migration not run yet
 */
async function fallbackToUnifiedPedagogyQuestions(
  medium: PracticeMedium,
  filter: PedagogyQuestionQueryFilter = {}
): Promise<PracticeQuestion[]> {
  try {
    let query = supabaseAdmin
      .from('dsc_practice_questions')
      .select('*')
      .or('subject.ilike.Pedagogy,subject.ilike.%Psychology%,subject.ilike.%సైకాలజీ%')
      .eq('is_active', true)

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
// ALGORITHM 2: Smart Algorithmic Question Selector (NOT Random Selection)
// ============================================================================
/**
 * Advanced multi-criteria algorithmic question selector for Pedagogy practice & mock tests.
 *
 * Selection Rules:
 * 1. Medium unification: Serves Telugu medium practice seamlessly from `pedagogy_subject_questions`.
 * 2. Spaced Repetition & Heuristic Priority Scoring:
 *    - Unattempted questions (+10)
 *    - Previously incorrect questions (+8, or +80 in previously_incorrect mode)
 *    - Weak topics (<65% mastery) (+5, or +60 in weak_areas mode)
 *    - Penalizes questions answered repeatedly or attempted in the last 24h (-5)
 * 3. Difficulty Curve Balancing (30% Easy, 50% Medium, 20% Hard per DSC standards)
 * 4. Topic Stratification across Syllabus (Child Development, Individual Differences, Learning Process, Evaluation, Classroom Management, Inclusive Education)
 */
export async function generateSmartPedagogySession(options: {
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

  // 1. Fetch raw pool from pedagogy_subject_questions
  const pool = await fetchPedagogyQuestions(medium, {
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

  // Sort descending by priority score (Non-random priority ranking)
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

  const easyPool = scored
    .filter((s) => (s.question.difficulty || '').toLowerCase() === 'easy')
    .map((s) => s.question)
  const mediumPool = scored
    .filter((s) => (s.question.difficulty || '').toLowerCase() === 'medium')
    .map((s) => s.question)
  const hardPool = scored
    .filter((s) => (s.question.difficulty || '').toLowerCase() === 'hard')
    .map((s) => s.question)

  const selectedSet = new Set<string>()
  const finalQuestions: PracticeQuestion[] = []

  const pickFromPool = (candidatePool: PracticeQuestion[], targetCount: number) => {
    // Topic-aware selection within difficulty bucket
    const byTopic: Record<string, PracticeQuestion[]> = {}
    candidatePool.forEach((q) => {
      const t = q.topic || q.chapter || 'General'
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

  // 6. Return randomized order for exam delivery (shuffles question positions, not selection)
  return shuffleArray(finalQuestions)
}

// ============================================================================
// ALGORITHM 3: Pedagogy Syllabus Coverage & Analytics Aggregator
// ============================================================================
/**
 * Direct real-time aggregation of questions by Class, Chapter, Topic & Difficulty.
 */
export async function getPedagogyAnalytics(medium: PracticeMedium = 'telugu') {
  try {
    const { data, error } = await supabaseAdmin
      .from('pedagogy_subject_questions')
      .select('class_level, chapter, topic, difficulty')

    if (error || !data) {
      return { total: 0, classes: [], chapters: [], topics: [], difficulties: { Easy: 0, Medium: 0, Hard: 0 } }
    }

    const classes = new Set<string>()
    const chapters = new Set<string>()
    const topicsMap: Record<string, number> = {}
    const difficulties: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 }

    data.forEach((row) => {
      if (row.class_level) classes.add(normalizeClassLevel(row.class_level))
      if (row.chapter) chapters.add(row.chapter)
      if (row.topic) {
        topicsMap[row.topic] = (topicsMap[row.topic] || 0) + 1
      }
      const diff = normalizeDifficulty(row.difficulty)
      difficulties[diff] = (difficulties[diff] || 0) + 1
    })

    return {
      tableName: 'pedagogy_subject_questions',
      medium,
      total: data.length,
      classes: Array.from(classes),
      chapters: Array.from(chapters),
      topics: Object.entries(topicsMap).map(([name, count]) => ({ name, count })),
      difficulties,
    }
  } catch (err) {
    console.error('[Pedagogy Analytics Algorithm] Failed:', err)
    return { total: 0, classes: [], chapters: [], topics: [], difficulties: { Easy: 0, Medium: 0, Hard: 0 } }
  }
}
