// ============================================================
// lib/practice/engine.ts — Smart Question Selection Engine
// ============================================================
// Implements intelligent filtering, dynamic priority scoring,
// topic & difficulty balancing, and fallbacks.
// ============================================================

import type {
  PracticeMedium,
  PracticeMode,
  PracticeQuestion,
  PracticeFilterState,
  DynamicFilterOptions,
} from '@/types/practice'
import { SEED_QUESTIONS } from './seed-questions'
import { getAllSubjectMetadata } from './subjects'

export interface QuestionCandidate extends PracticeQuestion {
  selection_score?: number
}

export interface UserAttemptHistory {
  question_id: string
  attempt_count: number
  correct_count: number
  incorrect_count: number
  last_attempted_at?: string
  is_recently_seen?: boolean
}

// Configurable scoring weights
export const PRIORITY_WEIGHTS = {
  never_attempted: 10,
  previously_incorrect: 8,
  weak_topic: 5,
  correct_once: 3,
  correct_repeatedly: 1,
  recently_attempted: -5,
  frequently_seen: -3,
}

/**
 * Filter pool of questions based on user filter parameters.
 */
export function filterQuestionPool(
  questions: PracticeQuestion[],
  filter: Partial<PracticeFilterState>
): PracticeQuestion[] {
  return questions.filter((q) => {
    // 1. Medium check (Strict separation)
    if (filter.medium && q.medium.toLowerCase() !== filter.medium.toLowerCase()) {
      return false
    }

    // 2. Subject check
    if (
      filter.subject &&
      filter.subject !== 'All' &&
      q.subject.toLowerCase() !== filter.subject.toLowerCase()
    ) {
      return false
    }

    // 3. Class level check
    if (
      filter.class_levels &&
      filter.class_levels.length > 0 &&
      !filter.class_levels.includes('All') &&
      !filter.class_levels.includes('All Classes')
    ) {
      const matchesClass = filter.class_levels.some(
        (lvl) =>
          q.class_level.toLowerCase().includes(lvl.toLowerCase()) ||
          lvl.toLowerCase().includes(q.class_level.toLowerCase())
      )
      if (!matchesClass) return false
    }

    // 4. Topic check
    if (
      filter.topics &&
      filter.topics.length > 0 &&
      !filter.topics.includes('All') &&
      !filter.topics.includes('All Topics')
    ) {
      const matchesTopic = filter.topics.some(
        (t) =>
          q.topic.toLowerCase() === t.toLowerCase() ||
          q.topic.toLowerCase().includes(t.toLowerCase())
      )
      if (!matchesTopic) return false
    }

    // 5. Subtopic check
    if (
      filter.subtopics &&
      filter.subtopics.length > 0 &&
      !filter.subtopics.includes('All') &&
      !filter.subtopics.includes('All Subtopics')
    ) {
      if (!q.subtopic) return false
      const matchesSubtopic = filter.subtopics.some(
        (st) =>
          q.subtopic!.toLowerCase() === st.toLowerCase() ||
          q.subtopic!.toLowerCase().includes(st.toLowerCase())
      )
      if (!matchesSubtopic) return false
    }

    // 6. Difficulty check
    if (
      filter.difficulty &&
      filter.difficulty.length > 0 &&
      !filter.difficulty.includes('All')
    ) {
      const matchesDiff = filter.difficulty.some(
        (d) => q.difficulty.toLowerCase() === d.toLowerCase()
      )
      if (!matchesDiff) return false
    }

    return true
  })
}

/**
 * Calculate dynamic selection score for a question candidate
 */
export function calculateQuestionScore(
  q: PracticeQuestion,
  history: Record<string, UserAttemptHistory>,
  weakTopics: Set<string>,
  mode: PracticeMode
): number {
  let score = 0
  const qId = q.question_id || q.id
  const h = history[qId]

  if (mode === 'random') {
    return Math.random() * 10
  }

  if (!h || h.attempt_count === 0) {
    score += PRIORITY_WEIGHTS.never_attempted
    if (mode === 'new_questions') {
      score += 100 // Boost new questions drastically
    }
  } else {
    if (mode === 'new_questions') {
      return -100 // Exclude already attempted questions if possible
    }

    if (h.incorrect_count > 0 && h.correct_count === 0) {
      score += PRIORITY_WEIGHTS.previously_incorrect
      if (mode === 'previously_incorrect') {
        score += 80
      }
    } else if (h.incorrect_count > 0 && h.correct_count > 0) {
      score += Math.max(1, PRIORITY_WEIGHTS.previously_incorrect - h.correct_count * 2)
      if (mode === 'previously_incorrect') {
        score += 40
      }
    } else if (h.correct_count === 1) {
      score += PRIORITY_WEIGHTS.correct_once
    } else if (h.correct_count > 1) {
      score += PRIORITY_WEIGHTS.correct_repeatedly
    }

    if (h.is_recently_seen) {
      score += PRIORITY_WEIGHTS.recently_attempted
    }
    if (h.attempt_count > 3) {
      score += PRIORITY_WEIGHTS.frequently_seen
    }
  }

  // Weak topic boost
  if (weakTopics.has(q.topic.toLowerCase())) {
    score += PRIORITY_WEIGHTS.weak_topic
    if (mode === 'weak_areas') {
      score += 60
    }
  }

  // Small random jitter to break ties and ensure variety
  score += Math.random() * 2

  return score
}

/**
 * Intelligent Balanced Distribution Algorithm
 */
export function selectSmartQuestions(
  pool: PracticeQuestion[],
  count: number,
  mode: PracticeMode,
  history: Record<string, UserAttemptHistory> = {},
  weakTopics: Set<string> = new Set()
): PracticeQuestion[] {
  if (pool.length <= count) {
    // If pool is smaller than or equal to requested count, shuffle and return all
    return shuffleArray([...pool])
  }

  // Score each candidate
  const scored: QuestionCandidate[] = pool.map((q) => ({
    ...q,
    selection_score: calculateQuestionScore(q, history, weakTopics, mode),
  }))

  // Sort descending by priority score
  scored.sort((a, b) => (b.selection_score || 0) - (a.selection_score || 0))

  if (mode === 'random') {
    return shuffleArray(scored).slice(0, count)
  }

  if (mode === 'weak_areas' || mode === 'previously_incorrect' || mode === 'new_questions') {
    // Top scored questions with light shuffle in top bucket
    const topBucket = scored.slice(0, Math.min(scored.length, count * 2))
    return shuffleArray(topBucket).slice(0, count)
  }

  // BALANCED MODE: Group by topic to ensure fair topic distribution
  const byTopic: Record<string, QuestionCandidate[]> = {}
  scored.forEach((q) => {
    const t = q.topic || 'General'
    if (!byTopic[t]) byTopic[t] = []
    byTopic[t].push(q)
  })

  const topics = Object.keys(byTopic)
  const selected: QuestionCandidate[] = []
  const selectedIds = new Set<string>()

  // Round-robin selection across topics from highest scored items
  let round = 0
  while (selected.length < count && round < 50) {
    let addedInRound = false
    for (const t of topics) {
      if (selected.length >= count) break
      const topicList = byTopic[t]
      if (round < topicList.length) {
        const candidate = topicList[round]
        const cId = candidate.question_id || candidate.id
        if (!selectedIds.has(cId)) {
          selected.push(candidate)
          selectedIds.add(cId)
          addedInRound = true
        }
      }
    }
    round++
    if (!addedInRound) break
  }

  // If still need more, take remaining top items
  if (selected.length < count) {
    for (const q of scored) {
      const cId = q.question_id || q.id
      if (!selectedIds.has(cId)) {
        selected.push(q)
        selectedIds.add(cId)
        if (selected.length >= count) break
      }
    }
  }

  // Randomize the final generated session so questions don't appear in topic clumps
  return shuffleArray(selected)
}

/**
 * Fisher-Yates shuffle
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Extract dynamic filter options from question pool
 */
export function extractFilterOptions(
  allQuestions: PracticeQuestion[],
  currentFilter: Partial<PracticeFilterState>
): DynamicFilterOptions {
  const medium = currentFilter.medium || 'english'

  // Filter pool by medium first
  const mediumPool = allQuestions.filter(
    (q) => q.medium.toLowerCase() === medium.toLowerCase()
  )

  // Initialize subjects from subject metadata registry
  const allMetadata = getAllSubjectMetadata()
  const subjectsMap: Record<string, { count: number; code: string; teluguName: string }> = {}

  allMetadata.forEach((meta) => {
    subjectsMap[meta.name] = {
      count: 0,
      code: meta.code,
      teluguName: meta.teluguName,
    }
  })

  mediumPool.forEach((q) => {
    if (subjectsMap[q.subject]) {
      subjectsMap[q.subject].count++
    } else {
      subjectsMap[q.subject] = { count: 1, code: q.subject.slice(0, 3).toUpperCase(), teluguName: q.subject }
    }
  })

  const available_subjects = Object.entries(subjectsMap).map(([name, data]) => ({
    id: name,
    name,
    teluguName: data.teluguName,
    code: data.code,
    question_count: data.count,
  }))

  // Narrow pool by subject for topics / subtopics
  const subjectPool = currentFilter.subject && currentFilter.subject !== 'All'
    ? mediumPool.filter((q) => q.subject.toLowerCase() === currentFilter.subject?.toLowerCase())
    : mediumPool

  // Available classes
  const classesSet = new Set<string>()
  subjectPool.forEach((q) => {
    if (q.class_level) classesSet.add(q.class_level)
  })
  const available_classes = Array.from(classesSet).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0
    return numA - numB
  })

  // Narrow pool by class for topics
  const classPool = currentFilter.class_levels &&
    currentFilter.class_levels.length > 0 &&
    !currentFilter.class_levels.includes('All') &&
    !currentFilter.class_levels.includes('All Classes')
    ? subjectPool.filter((q) =>
        currentFilter.class_levels!.some(
          (lvl) =>
            q.class_level.toLowerCase().includes(lvl.toLowerCase()) ||
            lvl.toLowerCase().includes(q.class_level.toLowerCase())
        )
      )
    : subjectPool

  // Topics and their subtopics
  const topicMap: Record<string, { count: number; subtopics: Set<string> }> = {}
  classPool.forEach((q) => {
    if (!topicMap[q.topic]) {
      topicMap[q.topic] = { count: 0, subtopics: new Set() }
    }
    topicMap[q.topic].count++
    if (q.subtopic) {
      topicMap[q.topic].subtopics.add(q.subtopic)
    }
  })

  const available_topics = Object.entries(topicMap).map(([name, data]) => ({
    name,
    count: data.count,
    subtopics: Array.from(data.subtopics),
  }))

  // Available difficulties with count
  const diffMap: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 }
  classPool.forEach((q) => {
    const diff = q.difficulty || 'Medium'
    diffMap[diff] = (diffMap[diff] || 0) + 1
  })
  const available_difficulties = Object.entries(diffMap).map(([name, count]) => ({
    name,
    count,
  }))

  // Total matching questions based on all active filters
  const matched = filterQuestionPool(allQuestions, currentFilter)

  return {
    medium,
    available_subjects,
    available_classes: available_classes.length > 0 ? available_classes : ['Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'],
    available_topics,
    available_difficulties,
    total_matching_questions: matched.length,
  }
}
