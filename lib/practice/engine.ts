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
      const isGKFilter =
        filter.subject.toLowerCase().includes('gk') ||
        filter.subject.toLowerCase().includes('general knowledge') ||
        filter.subject.toLowerCase().includes('current affairs')
      const isGKQuestion =
        q.subject.toLowerCase().includes('gk') ||
        q.subject.toLowerCase().includes('general knowledge') ||
        q.subject.toLowerCase().includes('current affairs')
      if (isGKFilter && isGKQuestion) {
        return true
      }

      const isPedFilter =
        filter.subject.toLowerCase().includes('pedagogy') ||
        filter.subject.toLowerCase().includes('educational psychology') ||
        filter.subject.toLowerCase().includes('perspectives in education') ||
        filter.subject.toLowerCase().includes('cdp')
      const isPedQuestion =
        q.subject.toLowerCase().includes('pedagogy') ||
        q.subject.toLowerCase().includes('educational psychology') ||
        q.subject.toLowerCase().includes('perspectives in education') ||
        q.subject.toLowerCase().includes('cdp')
      if (isPedFilter && isPedQuestion) {
        return true
      }

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

/** Optional balance across subjects, for all-subjects sessions. */
export interface BalanceOptions {
  /** The subject a candidate belongs to. */
  groupOf?: (q: PracticeQuestion) => string
  /** Relative share per subject; subjects missing from the pool are skipped. */
  groupWeights?: Record<string, number>
}

const idOf = (q: PracticeQuestion) => q.question_id || q.id
const byScore = (a: QuestionCandidate, b: QuestionCandidate) => (b.selection_score || 0) - (a.selection_score || 0)

/** Split `total` by weight (largest remainder), then cap by what each key has and pass the excess on. */
function quotas(available: Record<string, number>, weights: Record<string, number>, total: number): Record<string, number> {
  const keys = Object.keys(available).filter((k) => available[k] > 0)
  const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]))
  let left = total
  let open = keys
  while (left > 0 && open.length) {
    const sum = open.reduce((n, k) => n + (weights[k] ?? 1), 0)
    const shares = open.map((k) => ({ k, exact: (left * (weights[k] ?? 1)) / sum }))
    const given = shares.map(({ k, exact }) => ({ k, n: Math.floor(exact), rest: exact - Math.floor(exact) }))
    let spare = left - given.reduce((n, g) => n + g.n, 0)
    given.sort((a, b) => b.rest - a.rest || Math.random() - 0.5)
    for (const g of given) { if (spare > 0) { g.n++; spare-- } }
    let placed = 0
    for (const g of given) {
      const room = available[g.k] - out[g.k]
      const take = Math.min(room, g.n)
      out[g.k] += take
      placed += take
    }
    left -= placed
    open = open.filter((k) => out[k] < available[k])
    if (placed === 0) break
  }
  return out
}

/**
 * Within one topic: best-scored first, but taking turns between subtopics,
 * so several questions from a topic do not all test the same subtopic.
 */
function interleaveSubtopics(list: QuestionCandidate[]): QuestionCandidate[] {
  const bySub = new Map<string, QuestionCandidate[]>()
  for (const q of [...list].sort(byScore)) {
    const key = (q.subtopic || '').trim().toLowerCase()
    bySub.set(key, [...(bySub.get(key) ?? []), q])
  }
  const groups = [...bySub.values()].sort((a, b) => byScore(a[0], b[0]))
  const out: QuestionCandidate[] = []
  for (let i = 0; out.length < list.length; i++) for (const g of groups) if (g[i]) out.push(g[i])
  return out
}

/**
 * Up to `count` questions spread as evenly as possible over the topics:
 * round 1 takes one question from each topic, round 2 a second, and so on.
 * Topics go in order of their best question's score, so with more topics than
 * questions the ones that matter most (unseen, weak) come first; scores carry
 * random jitter, so for a new user that order is random.
 */
function pickAcrossTopics(cands: QuestionCandidate[], count: number): QuestionCandidate[] {
  const byTopic = new Map<string, QuestionCandidate[]>()
  for (const q of cands) {
    const key = (q.topic || 'General').trim().toLowerCase()
    byTopic.set(key, [...(byTopic.get(key) ?? []), q])
  }
  const topics = [...byTopic.values()].map(interleaveSubtopics).sort((a, b) => byScore(a[0], b[0]))
  const out: QuestionCandidate[] = []
  for (let round = 0; out.length < count; round++) {
    let added = false
    for (const list of topics) {
      if (out.length >= count) break
      if (list[round]) { out.push(list[round]); added = true }
    }
    if (!added) break
  }
  return out
}

/** Balanced pick: subjects by weight (if given), then topics evenly within each. */
function pickBalanced(cands: QuestionCandidate[], count: number, options: BalanceOptions): QuestionCandidate[] {
  if (count <= 0 || cands.length === 0) return []
  const { groupOf, groupWeights } = options
  if (!groupOf || !groupWeights) return pickAcrossTopics(cands, count)
  const groups = new Map<string, QuestionCandidate[]>()
  for (const q of cands) {
    const g = groupOf(q)
    groups.set(g, [...(groups.get(g) ?? []), q])
  }
  if (groups.size <= 1) return pickAcrossTopics(cands, count)
  const share = quotas(Object.fromEntries([...groups].map(([g, list]) => [g, list.length])), groupWeights, count)
  return [...groups].flatMap(([g, list]) => pickAcrossTopics(list, share[g] ?? 0))
}

/**
 * Choose a session's questions.
 *
 * Every mode is balanced across topics (and across subjects in an
 * all-subjects session, in the paper's proportions). The mode decides which
 * questions go first: unseen ones for new_questions, wrongly answered ones
 * for previously_incorrect, weak topics for weak_areas. If that group is too
 * small, the rest fills up, still balanced. The score orders questions within
 * a topic (unseen and weak first, recently seen and well-known last); in
 * random mode it is random.
 */
export function selectSmartQuestions(
  pool: PracticeQuestion[],
  count: number,
  mode: PracticeMode,
  history: Record<string, UserAttemptHistory> = {},
  weakTopics: Set<string> = new Set(),
  options: BalanceOptions = {}
): PracticeQuestion[] {
  if (pool.length <= count) return shuffleArray([...pool])

  const scored: QuestionCandidate[] = pool.map((q) => ({
    ...q,
    selection_score: calculateQuestionScore(q, history, weakTopics, mode),
  }))

  const first = (q: QuestionCandidate) => {
    const h = history[idOf(q)]
    if (mode === 'new_questions') return !h || h.attempt_count === 0
    if (mode === 'previously_incorrect') return !!h && h.incorrect_count > 0
    if (mode === 'weak_areas') return weakTopics.has((q.topic || '').toLowerCase())
    return true
  }
  const preferred = scored.filter(first)
  const chosen = pickBalanced(preferred, count, options)
  if (chosen.length < count) {
    const taken = new Set(chosen.map(idOf))
    chosen.push(...pickBalanced(scored.filter((q) => !taken.has(idOf(q))), count - chosen.length, options))
  }

  // Shuffle the order, so the session does not run topic by topic.
  return shuffleArray(chosen)
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
    ? mediumPool.filter((q) => {
        if (q.subject.toLowerCase() === currentFilter.subject?.toLowerCase()) return true
        const isGKFilter =
          currentFilter.subject?.toLowerCase().includes('gk') ||
          currentFilter.subject?.toLowerCase().includes('general knowledge') ||
          currentFilter.subject?.toLowerCase().includes('current affairs')
        const isGKQuestion =
          q.subject.toLowerCase().includes('gk') ||
          q.subject.toLowerCase().includes('general knowledge') ||
          q.subject.toLowerCase().includes('current affairs')
        if (isGKFilter && isGKQuestion) return true

        const isPedFilter =
          currentFilter.subject?.toLowerCase().includes('pedagogy') ||
          currentFilter.subject?.toLowerCase().includes('educational psychology') ||
          currentFilter.subject?.toLowerCase().includes('perspectives in education') ||
          currentFilter.subject?.toLowerCase().includes('cdp')
        const isPedQuestion =
          q.subject.toLowerCase().includes('pedagogy') ||
          q.subject.toLowerCase().includes('educational psychology') ||
          q.subject.toLowerCase().includes('perspectives in education') ||
          q.subject.toLowerCase().includes('cdp')
        if (isPedFilter && isPedQuestion) return true

        return false
      })
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
