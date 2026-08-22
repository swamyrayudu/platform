// ============================================================
// lib/practice/db.ts — Practice Engine Database Operations
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  PracticeMedium,
  PracticeMode,
  PracticeQuestion,
  PracticeFilterState,
  PracticeSession,
  PracticeResultSummary,
  TopicPerformance,
  WeakAreaRecommendation,
  UserAnswerRecord,
  PracticeHistoryItem,
} from '@/types/practice'
import { SEED_QUESTIONS } from './seed-questions'
import {
  filterQuestionPool,
  selectSmartQuestions,
  extractFilterOptions,
  type UserAttemptHistory,
} from './engine'
import {
  getAllSubjectProviders,
  getSubjectProvider,
} from './subjects'

// In-memory sessions cache for fallback and instant session continuity
const activeSessionsCache: Map<string, PracticeSession> = new Map()

/**
 * Fetch all available practice questions from database across subject providers.
 * Subject providers handle dedicated tables (e.g. english_subject_questions, telugu_subject_questions)
 * and unified dsc_practice_questions seamlessly.
 */
export async function getAllPracticeQuestions(
  medium?: PracticeMedium,
  subject?: string
): Promise<PracticeQuestion[]> {
  let questions: PracticeQuestion[] = []

  if (subject && subject !== 'All') {
    const provider = getSubjectProvider(subject)
    if (provider) {
      questions = await provider.fetchQuestions(medium)
    } else {
      // Fallback query by subject
      const providers = getAllSubjectProviders()
      const results = await Promise.all(providers.map((p) => p.fetchQuestions(medium)))
      questions = results.flat()
    }
  } else {
    // Fetch from all subject providers in parallel
    const providers = getAllSubjectProviders()
    const results = await Promise.all(providers.map((p) => p.fetchQuestions(medium)))
    questions = results.flat()
  }

  if (medium) {
    return questions.filter((q) => q.medium.toLowerCase() === medium.toLowerCase())
  }

  return questions
}

/**
 * Load user's attempt history for question scoring
 */
export async function getUserAttemptHistory(
  userId: string | null
): Promise<Record<string, UserAttemptHistory>> {
  if (!userId) return {}

  try {
    const { data, error } = await supabaseAdmin
      .from('question_progress')
      .select('*')
      .eq('user_id', userId)

    if (!error && data) {
      const history: Record<string, UserAttemptHistory> = {}
      data.forEach((row: any) => {
        const lastAt = row.last_attempted_at ? new Date(row.last_attempted_at).getTime() : 0
        const isRecent = Date.now() - lastAt < 24 * 60 * 60 * 1000 // Last 24 hours
        history[row.question_id] = {
          question_id: row.question_id,
          attempt_count: row.attempt_count || 0,
          correct_count: row.correct_count || 0,
          incorrect_count: row.incorrect_count || 0,
          last_attempted_at: row.last_attempted_at,
          is_recently_seen: isRecent,
        }
      })
      return history
    }
  } catch (err) {
    console.warn('[Practice DB] Error fetching question progress:', err)
  }

  return {}
}

/**
 * Calculate user weak topics (< 65% accuracy)
 */
export async function getUserWeakTopics(userId: string | null): Promise<Set<string>> {
  const weakSet = new Set<string>()
  if (!userId) return weakSet

  try {
    const { data, error } = await supabaseAdmin
      .from('question_progress')
      .select('topic, correct_count, attempt_count')
      .eq('user_id', userId)

    if (!error && data) {
      const topicStats: Record<string, { correct: number; total: number }> = {}
      data.forEach((row: any) => {
        const t = row.topic?.toLowerCase()
        if (t) {
          if (!topicStats[t]) topicStats[t] = { correct: 0, total: 0 }
          topicStats[t].correct += row.correct_count || 0
          topicStats[t].total += row.attempt_count || 0
        }
      })

      Object.entries(topicStats).forEach(([topic, stat]) => {
        if (stat.total >= 3 && stat.correct / stat.total < 0.65) {
          weakSet.add(topic)
        }
      })
    }
  } catch (err) {
    console.warn('[Practice DB] Error computing weak topics:', err)
  }

  return weakSet
}

/**
 * Create a new Practice Session
 */
export async function createPracticeSession(
  filter: PracticeFilterState,
  userId: string | null
): Promise<PracticeSession> {
  const allQuestions = await getAllPracticeQuestions(filter.medium)
  const pool = filterQuestionPool(allQuestions, filter)

  // Load user attempt history & weak areas
  const history = await getUserAttemptHistory(userId)
  const weakTopics = await getUserWeakTopics(userId)

  // Smart Question Selection
  const requestedCount = Math.min(filter.question_count, pool.length || filter.question_count)
  const selectedQuestions = selectSmartQuestions(
    pool.length > 0 ? pool : allQuestions,
    requestedCount,
    filter.mode,
    history,
    weakTopics
  )

  const sessionId = crypto.randomUUID()
  const questionIds = selectedQuestions.map((q) => q.question_id || q.id)

  const session: PracticeSession = {
    id: sessionId,
    user_id: userId,
    medium: filter.medium,
    subject: filter.subject,
    class_levels: filter.class_levels,
    topics: filter.topics,
    subtopics: filter.subtopics,
    difficulty: filter.difficulty,
    mode: filter.mode,
    feedback_mode: filter.feedback_mode,
    has_timer: filter.has_timer,
    duration_seconds: filter.has_timer ? (filter.duration_minutes || 30) * 60 : 0,
    question_count: selectedQuestions.length,
    question_ids: questionIds,
    questions: selectedQuestions,
    user_answers: {},
    time_spent_seconds: 0,
    score: 0,
    accuracy_pct: 0,
    status: 'in_progress',
    started_at: new Date().toISOString(),
  }

  // Cache in-memory during active solving (DO NOT write to DB before submit)
  activeSessionsCache.set(sessionId, session)

  return session
}

/**
 * Abandon a practice session without saving any information.
 * Purges in-memory session and ensures nothing is stored.
 */
export async function abandonPracticeSession(sessionId: string): Promise<void> {
  activeSessionsCache.delete(sessionId)
  try {
    await supabaseAdmin.from('practice_sessions').delete().eq('id', sessionId)
  } catch (err) {
    // Ignore cleanup errors
  }
}

/**
 * Get Practice Session by ID
 */
export async function getPracticeSessionById(
  sessionId: string,
  maskAnswers = true
): Promise<PracticeSession | null> {
  let session = activeSessionsCache.get(sessionId)

  if (!session) {
    try {
      const { data, error } = await supabaseAdmin
        .from('practice_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (!error && data) {
        // Re-attach questions
        const allQuestions = await getAllPracticeQuestions()
        const questionMap = new Map(allQuestions.map((q) => [q.question_id || q.id, q]))
        const loadedQuestions = (data.question_ids || [])
          .map((id: string) => questionMap.get(id))
          .filter(Boolean) as PracticeQuestion[]

        session = {
          ...data,
          questions: loadedQuestions,
        }
        activeSessionsCache.set(sessionId, session!)
      }
    } catch (err) {
      console.warn('[Practice DB] Error reading practice_session:', err)
    }
  }

  if (!session) return null

  // Redact correct answers & explanations if session is in progress and maskAnswers is true
  if (maskAnswers && session.status === 'in_progress' && session.feedback_mode === 'end') {
    const maskedQuestions = session.questions.map((q) => {
      const { correct_answer, explanation, ...rest } = q
      return rest as PracticeQuestion
    })
    return {
      ...session,
      questions: maskedQuestions,
    }
  }

  return session
}

/**
 * Record user's answer for a question in a practice session (in-memory only while active)
 */
export async function recordQuestionAnswer(
  sessionId: string,
  questionId: string,
  selectedAnswer: 'A' | 'B' | 'C' | 'D' | null,
  timeTakenSeconds = 0,
  markedForReview = false,
  _userId: string | null
): Promise<{
  is_correct: boolean
  correct_answer: string
  explanation: string | null
  session: PracticeSession
}> {
  const session = activeSessionsCache.get(sessionId) || (await getPracticeSessionById(sessionId, false))
  if (!session) {
    throw new Error('Practice session not found')
  }

  const question = session.questions.find((q) => (q.question_id || q.id) === questionId)
  if (!question) {
    throw new Error('Question not found in session')
  }

  // Validate correctness
  const rawCorrect = (question.correct_answer || '').trim().toUpperCase()
  let isCorrect = false
  if (selectedAnswer) {
    if (rawCorrect === selectedAnswer) isCorrect = true
    else if (rawCorrect.endsWith(selectedAnswer)) isCorrect = true
    else {
      const optMap = {
        A: (question.option_a || '').trim().toLowerCase(),
        B: (question.option_b || '').trim().toLowerCase(),
        C: (question.option_c || '').trim().toLowerCase(),
        D: (question.option_d || '').trim().toLowerCase(),
      }
      if (rawCorrect.toLowerCase() === optMap[selectedAnswer]) isCorrect = true
    }
  }

  // Update user answers map in memory only
  session.user_answers[questionId] = {
    question_id: questionId,
    selected_answer: selectedAnswer,
    is_correct: isCorrect,
    time_taken_seconds: timeTakenSeconds,
    marked_for_review: markedForReview,
    answered_at: new Date().toISOString(),
    correct_answer: question.correct_answer,
    explanation: question.explanation,
  }

  // Recalculate score & accuracy
  let correctCount = 0
  let attemptedCount = 0
  Object.values(session.user_answers).forEach((ans) => {
    if (ans.selected_answer) {
      attemptedCount++
      if (ans.is_correct) correctCount++
    }
  })

  session.score = correctCount
  session.accuracy_pct = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0
  session.time_spent_seconds += timeTakenSeconds

  activeSessionsCache.set(sessionId, session)

  return {
    is_correct: isCorrect,
    correct_answer: question.correct_answer || 'A',
    explanation: question.explanation || null,
    session,
  }
}

/**
 * Submit & complete practice session — ONLY AT THIS POINT IS DATA SAVED TO DB
 */
export async function submitPracticeSession(
  sessionId: string,
  totalTimeSpentSeconds: number
): Promise<PracticeResultSummary> {
  const session = activeSessionsCache.get(sessionId) || (await getPracticeSessionById(sessionId, false))
  if (!session) {
    throw new Error('Session not found')
  }

  session.status = 'completed'
  session.completed_at = new Date().toISOString()
  session.time_spent_seconds = totalTimeSpentSeconds || session.time_spent_seconds

  const totalQuestions = session.questions.length
  let correctCount = 0
  let incorrectCount = 0
  let skippedCount = 0

  // Topic performance mapping
  const topicStats: Record<string, { total: number; attempted: number; correct: number; incorrect: number }> = {}

  session.questions.forEach((q) => {
    const qId = q.question_id || q.id
    const t = q.topic || 'General'

    if (!topicStats[t]) {
      topicStats[t] = { total: 0, attempted: 0, correct: 0, incorrect: 0 }
    }
    topicStats[t].total++

    const ans = session.user_answers[qId]
    if (!ans || !ans.selected_answer) {
      skippedCount++
    } else if (ans.is_correct) {
      correctCount++
      topicStats[t].attempted++
      topicStats[t].correct++
    } else {
      incorrectCount++
      topicStats[t].attempted++
      topicStats[t].incorrect++
    }
  })

  const attemptedCount = correctCount + incorrectCount
  const score = correctCount
  const accuracyPct = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0
  const avgTime = totalQuestions > 0 ? Math.round(session.time_spent_seconds / totalQuestions) : 0

  session.score = score
  session.accuracy_pct = accuracyPct

  // Format topic performance
  const topic_breakdown: TopicPerformance[] = Object.entries(topicStats).map(([topic, stat]) => {
    const acc = stat.attempted > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
    return {
      topic,
      total_questions: stat.total,
      attempted: stat.attempted,
      correct: stat.correct,
      incorrect: stat.incorrect,
      accuracy_pct: acc,
      is_weak: acc < 65,
      is_mastered: acc >= 85,
    }
  })

  // Format weak recommendations
  const weak_recommendations: WeakAreaRecommendation[] = topic_breakdown
    .filter((tp) => tp.is_weak || tp.incorrect > 0)
    .map((tp) => ({
      subject: session.subject,
      topic: tp.topic,
      total_attempted: tp.attempted,
      accuracy_pct: tp.accuracy_pct,
      incorrect_count: tp.incorrect,
      recommended_question_count: Math.min(25, Math.max(10, tp.incorrect * 5)),
      action_label: `Practice ${tp.topic} (${tp.accuracy_pct}%)`,
    }))

  // Format review questions
  const questions_review = session.questions.map((q) => {
    const qId = q.question_id || q.id
    const ans = session.user_answers[qId]
    return {
      ...q,
      user_answer: ans?.selected_answer || null,
      is_correct: ans?.is_correct || false,
      is_skipped: !ans?.selected_answer,
      is_marked: ans?.marked_for_review || false,
      correct_answer: q.correct_answer || 'A',
      explanation: q.explanation || null,
      time_taken_seconds: ans?.time_taken_seconds || 0,
    }
  })

  // 1. Persist completed session record into Supabase
  try {
    await supabaseAdmin
      .from('practice_sessions')
      .upsert({
        id: session.id,
        user_id: session.user_id,
        medium: session.medium,
        subject: session.subject,
        class_levels: session.class_levels,
        topics: session.topics,
        subtopics: session.subtopics,
        difficulty: session.difficulty,
        mode: session.mode,
        feedback_mode: session.feedback_mode,
        has_timer: session.has_timer,
        duration_seconds: session.duration_seconds,
        question_count: session.question_count,
        question_ids: session.question_ids,
        user_answers: session.user_answers,
        time_spent_seconds: session.time_spent_seconds,
        score: session.score,
        accuracy_pct: session.accuracy_pct,
        status: 'completed',
        started_at: session.started_at,
        completed_at: session.completed_at,
      })
  } catch (err) {
    console.warn('[Practice DB] Error saving completed practice_session:', err)
  }

  // 2. Persist individual question attempts and update mastery progress for user
  if (session.user_id) {
    const answeredEntries = Object.values(session.user_answers).filter((a) => a.selected_answer)
    for (const ans of answeredEntries) {
      const q = session.questions.find((item) => (item.question_id || item.id) === ans.question_id)
      if (q) {
        saveAnswerProgressAsync(
          session.user_id,
          session.id,
          q,
          ans.selected_answer,
          ans.is_correct || false,
          ans.time_taken_seconds || 0
        ).catch(() => {})
      }
    }
  }

  activeSessionsCache.set(sessionId, session)

  return {
    session_id: sessionId,
    subject: session.subject,
    medium: session.medium,
    mode: session.mode,
    total_questions: totalQuestions,
    attempted_count: attemptedCount,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    skipped_count: skippedCount,
    score,
    accuracy_pct: accuracyPct,
    total_time_seconds: session.time_spent_seconds,
    avg_time_per_question_seconds: avgTime,
    topic_breakdown,
    weak_recommendations,
    questions_review,
  }
}

/**
 * Async helper to record attempt and update mastery progress in DB on SUBMIT ONLY
 */
async function saveAnswerProgressAsync(
  userId: string,
  sessionId: string,
  question: PracticeQuestion,
  selectedAnswer: string | null,
  isCorrect: boolean,
  timeTaken: number
) {
  try {
    const qId = question.question_id || question.id

    // 1. Record in question_attempts
    await supabaseAdmin.from('question_attempts').insert({
      session_id: sessionId,
      user_id: userId,
      question_id: qId,
      subject: question.subject,
      topic: question.topic,
      subtopic: question.subtopic,
      difficulty: question.difficulty,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      time_taken_seconds: timeTaken,
    })

    // 2. Upsert progress in question_progress
    const { data: existing } = await supabaseAdmin
      .from('question_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', qId)
      .single()

    if (existing) {
      const attempts = (existing.attempt_count || 0) + 1
      const corrects = (existing.correct_count || 0) + (isCorrect ? 1 : 0)
      const incorrects = (existing.incorrect_count || 0) + (isCorrect ? 0 : 1)
      const mastery = Math.round((corrects / attempts) * 100)

      await supabaseAdmin
        .from('question_progress')
        .update({
          attempt_count: attempts,
          correct_count: corrects,
          incorrect_count: incorrects,
          last_attempted_at: new Date().toISOString(),
          last_correct_at: isCorrect ? new Date().toISOString() : existing.last_correct_at,
          mastery_score: mastery,
        })
        .eq('id', existing.id)
    } else {
      await supabaseAdmin.from('question_progress').insert({
        user_id: userId,
        question_id: qId,
        subject: question.subject,
        topic: question.topic,
        subtopic: question.subtopic,
        attempt_count: 1,
        correct_count: isCorrect ? 1 : 0,
        incorrect_count: isCorrect ? 0 : 1,
        last_attempted_at: new Date().toISOString(),
        last_correct_at: isCorrect ? new Date().toISOString() : null,
        mastery_score: isCorrect ? 100 : 0,
      })
    }
  } catch (err) {
    console.warn('[Practice DB] Error recording attempt in DB:', err)
  }
}

/**
 * Fetch past practice sessions for user history — ONLY COMPLETED TESTS
 */
export async function getPracticeHistory(userId: string | null): Promise<PracticeHistoryItem[]> {
  if (!userId) {
    return Array.from(activeSessionsCache.values())
      .filter((s) => s.status === 'completed')
      .map((s) => ({
        id: s.id,
        medium: s.medium,
        subject: s.subject,
        mode: s.mode,
        topics: s.topics,
        question_count: s.question_count,
        score: s.score,
        accuracy_pct: s.accuracy_pct,
        time_spent_seconds: s.time_spent_seconds,
        started_at: s.started_at,
        completed_at: s.completed_at || null,
        status: s.status,
      }))
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('practice_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(30)

    if (!error && data && data.length > 0) {
      return data as PracticeHistoryItem[]
    }
  } catch (err) {
    console.warn('[Practice DB] Error fetching history:', err)
  }

  return Array.from(activeSessionsCache.values())
    .filter((s) => s.status === 'completed')
    .map((s) => ({
      id: s.id,
      medium: s.medium,
      subject: s.subject,
      mode: s.mode,
      topics: s.topics,
      question_count: s.question_count,
      score: s.score,
      accuracy_pct: s.accuracy_pct,
      time_spent_seconds: s.time_spent_seconds,
      started_at: s.started_at,
      completed_at: s.completed_at || null,
      status: s.status,
    }))
}
