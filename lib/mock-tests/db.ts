// ============================================================
// lib/mock-tests/db.ts — Grand Mock Database Operations
// ============================================================
// All operations use supabaseAdmin (service-role key) to bypass RLS.
// Called only from server-side API route handlers.
//
// BATCH QUERY STRATEGY:
//   Questions are fetched in ONE batch JOIN per table, not per question.
//   For N questions from M tables, we do at most M queries, never N queries.
//   This eliminates N+1 issues entirely.
//
// SCORING:
//   Never trust frontend scores. All scoring is server-side.
//   Correct answers come from the internal cache key, not from API responses.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  MockTest,
  MockTestAttempt,
  MockTestAnswerRecord,
  MockTestResultSummary,
  SectionScore,
  QuestionReviewItem,
  MockTestLeaderboardEntry,
  SelectedOption,
  MockTestListItem,
  StartAttemptResponse,
} from '@/types/mock-tests'
import type { GeneratedMapping } from './generator'
import type { BlueprintValidationResult } from '@/types/mock-tests'
import { getCachedAnswerKey, warmMockTestCache, invalidateMockTestCache, getQuestionsWithFallback } from './cache'
import { getBlueprintById } from './blueprints'
import { generateGrandMockQuestions } from './generator'
import { validateBlueprint } from './validator'

// ---- Test Queries -----------------------------------------------

/** List all published mock tests, with the requesting user's attempt status. */
export async function listPublishedMockTests(userId: string | null): Promise<MockTestListItem[]> {
  const { data: tests, error } = await supabaseAdmin
    .from('mock_tests')
    .select('id, slug, title, description, category, medium, duration_minutes, total_questions, total_marks, is_free, status, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error || !tests) return []

  if (!userId) {
    return tests.map((t: any) => ({ ...t, user_attempt: null }))
  }

  // Fetch user's most recent attempt per test (one query, not N)
  const testIds = tests.map((t: any) => t.id)
  const { data: attempts } = await supabaseAdmin
    .from('mock_test_attempts')
    .select('id, mock_test_id, status, score, percentage, submitted_at')
    .eq('user_id', userId)
    .in('mock_test_id', testIds)
    .order('started_at', { ascending: false })

  const attemptByTestId = new Map<string, any>()
  if (attempts) {
    for (const a of attempts) {
      if (!attemptByTestId.has(a.mock_test_id)) {
        attemptByTestId.set(a.mock_test_id, a)
      }
    }
  }

  return tests.map((t: any) => {
    const attempt = attemptByTestId.get(t.id)
    return {
      ...t,
      user_attempt: attempt
        ? {
            attempt_id: attempt.id,
            status: attempt.status,
            score: attempt.score,
            percentage: attempt.percentage,
            submitted_at: attempt.submitted_at,
          }
        : null,
    }
  })
}

/** Get a single mock test by ID or slug. */
export async function getMockTestById(idOrSlug: string): Promise<MockTest | null> {
  const isUuid = /^[0-9a-f-]{36}$/.test(idOrSlug)
  const query = supabaseAdmin.from('mock_tests').select('*')
  const { data, error } = await (isUuid ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug)).single()

  if (error || !data) return null
  return data as MockTest
}

// ---- Batch Question Fetch (Cache-Miss Fallback) -----------------

/**
 * Batch-fetch all 160 questions for a mock test from PostgreSQL.
 *
 * Groups question_ids by their source table, then executes ONE query per table.
 * For a test with questions from 7 tables, this is exactly 7 queries — not 160.
 *
 * Returns GeneratedMapping[] suitable for cache warming.
 */
export async function fetchMockTestQuestionsFromDB(mockTestId: string): Promise<GeneratedMapping[] | null> {
  // 1. Fetch all mappings ordered by question_number
  const { data: mappings, error } = await supabaseAdmin
    .from('mock_test_questions')
    .select('question_id, question_table, question_number, section_id, section_name, marks')
    .eq('mock_test_id', mockTestId)
    .order('question_number', { ascending: true })

  if (error || !mappings || mappings.length === 0) {
    console.warn(`[MockDB] No question mappings found for mock ${mockTestId}`)
    return null
  }

  // 2. Group by source table — critical for batch efficiency
  const tableGroups = new Map<string, { question_id: string; question_number: number; section_id: string; section_name: string; marks: number }[]>()
  for (const m of mappings) {
    const group = tableGroups.get(m.question_table) ?? []
    group.push(m)
    tableGroups.set(m.question_table, group)
  }

  // 3. One query per table (never one query per question)
  const allResults: GeneratedMapping[] = []
  const batchPromises: Promise<void>[] = []

  tableGroups.forEach((items, tableName) => {
    const ids = items.map((i) => i.question_id)

    batchPromises.push(
      Promise.resolve(
        supabaseAdmin
          .from(tableName)
          .select('question_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, subject, chapter, topic, subtopic')
          .in('question_id', ids)
        .then(({ data, error: qErr }) => {
          if (qErr || !data) {
            console.warn(`[MockDB] Batch fetch failed for table ${tableName}:`, qErr?.message)
            return
          }

          const rowByQuestionId = new Map<string, any>()
          data.forEach((row: any) => rowByQuestionId.set(row.question_id, row))

          for (const item of items) {
            const row = rowByQuestionId.get(item.question_id)
            if (!row) {
              console.warn(`[MockDB] Question ${item.question_id} not found in ${tableName}`)
              continue
            }

            allResults.push({
              question_id: item.question_id,
              question_table: tableName,
              question_number: item.question_number,
              section_id: item.section_id,
              section_name: item.section_name,
              marks: item.marks,
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
            })
          }
        })
      ) // close Promise.resolve()
    ) // close batchPromises.push()
  })

  await Promise.all(batchPromises)

  // Sort by question_number to guarantee correct order
  allResults.sort((a, b) => a.question_number - b.question_number)
  return allResults
}

// ---- Attempt Management -----------------------------------------

/** Create or resume an existing in-progress attempt for a user. */
export async function startOrResumeAttempt(
  userId: string,
  mockTest: MockTest
): Promise<StartAttemptResponse> {
  // Check for existing in-progress attempt
  const { data: existing } = await supabaseAdmin
    .from('mock_test_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('mock_test_id', mockTest.id)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    // Resume existing attempt — load their saved answers
    const { data: answers } = await supabaseAdmin
      .from('mock_test_answers')
      .select('question_id, selected_option, marked_for_review')
      .eq('attempt_id', existing.id)

    const existingAnswers: Record<string, { selected_option: SelectedOption; marked_for_review: boolean }> = {}
    if (answers) {
      for (const a of answers) {
        existingAnswers[a.question_id] = {
          selected_option: a.selected_option as SelectedOption,
          marked_for_review: a.marked_for_review,
        }
      }
    }

    return {
      attempt_id: existing.id,
      mock_test_id: mockTest.id,
      status: 'in_progress',
      duration_seconds: existing.duration_seconds,
      time_spent_seconds: existing.time_spent_seconds,
      started_at: existing.started_at,
      existing_answers: existingAnswers,
    }
  }

  // Create new attempt
  const durationSeconds = mockTest.duration_minutes * 60
  const { data: newAttempt, error } = await supabaseAdmin
    .from('mock_test_attempts')
    .insert({
      user_id: userId,
      mock_test_id: mockTest.id,
      test_version: mockTest.version,
      status: 'in_progress',
      duration_seconds: durationSeconds,
      time_spent_seconds: 0,
      total_questions: mockTest.total_questions,
      total_marks: mockTest.total_marks,
      unanswered_count: mockTest.total_questions,
    })
    .select('id, started_at')
    .single()

  if (error || !newAttempt) {
    throw new Error(`Failed to create attempt: ${error?.message}`)
  }

  return {
    attempt_id: newAttempt.id,
    mock_test_id: mockTest.id,
    status: 'in_progress',
    duration_seconds: durationSeconds,
    time_spent_seconds: 0,
    started_at: newAttempt.started_at,
    existing_answers: {},
  }
}

/** Get attempt by ID. Validates ownership. */
export async function getAttemptById(
  attemptId: string,
  userId: string
): Promise<MockTestAttempt | null> {
  const { data, error } = await supabaseAdmin
    .from('mock_test_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single()

  if (error || !data) return null
  return data as MockTestAttempt
}

/**
 * Save or update a single answer within an attempt.
 *
 * Uses UPSERT with conflict on (attempt_id, question_id) to handle
 * re-saves (e.g. user changes their answer).
 *
 * IMPORTANT: Does NOT evaluate correctness — that happens only on submit.
 * This keeps the answer-save path very lightweight.
 */
export async function saveAttemptAnswer(
  attemptId: string,
  userId: string,
  questionId: string,
  questionNumber: number,
  selectedOption: SelectedOption,
  markedForReview: boolean,
  timeTakenSeconds: number
): Promise<void> {
  // Validate the attempt belongs to this user and is still in progress
  const { data: attempt } = await supabaseAdmin
    .from('mock_test_attempts')
    .select('user_id, status')
    .eq('id', attemptId)
    .single()

  if (!attempt || attempt.user_id !== userId) {
    throw new Error('Attempt not found or unauthorized')
  }
  if (attempt.status !== 'in_progress') {
    throw new Error('Cannot modify a submitted or expired attempt')
  }

  await supabaseAdmin
    .from('mock_test_answers')
    .upsert({
      attempt_id: attemptId,
      question_id: questionId,
      question_number: questionNumber,
      selected_option: selectedOption,
      marked_for_review: markedForReview,
      time_taken_seconds: timeTakenSeconds,
      answered_at: new Date().toISOString(),
      is_correct: null, // Evaluated on submit, not on save
    }, {
      onConflict: 'attempt_id,question_id',
    })

  // Update time_spent in attempt (non-blocking)
  void supabaseAdmin
    .from('mock_test_attempts')
    .update({ time_spent_seconds: timeTakenSeconds, updated_at: new Date().toISOString() })
    .eq('id', attemptId)
}

// ---- Submission & Server-Side Scoring ---------------------------

/**
 * Submit an attempt and calculate the final score server-side.
 *
 * Steps:
 *  1. Validate attempt ownership and status
 *  2. Load all user answers from DB
 *  3. Get the answer key from Redis cache (or DB)
 *  4. Evaluate each answer against the key
 *  5. Calculate score, section breakdown, accuracy
 *  6. Persist final results to mock_test_attempts
 *  7. Mark attempt as submitted
 *  8. Calculate rank and percentile
 *
 * The frontend score is NEVER used. Score is always calculated here.
 */
export async function submitAttempt(
  attemptId: string,
  userId: string,
  totalTimeSpentSeconds: number
): Promise<MockTestResultSummary> {
  // 1. Validate ownership and status
  const { data: attempt, error: aErr } = await supabaseAdmin
    .from('mock_test_attempts')
    .select('*, mock_tests(id, title, version, total_questions, total_marks, total_questions)')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single()

  if (aErr || !attempt) throw new Error('Attempt not found or unauthorized')
  if (attempt.status === 'submitted') throw new Error('Attempt already submitted')
  if (attempt.status === 'expired') throw new Error('Attempt has expired')

  const mockTest = attempt.mock_tests as any
  const mockTestId = attempt.mock_test_id
  const testVersion = attempt.test_version

  // 2. Load all user answers in one query
  const { data: userAnswers } = await supabaseAdmin
    .from('mock_test_answers')
    .select('question_id, question_number, selected_option, marked_for_review, time_taken_seconds')
    .eq('attempt_id', attemptId)

  // 3. Get answer key from cache (with DB fallback)
  let answerKeyMap = await getCachedAnswerKey(mockTestId, testVersion)
  if (!answerKeyMap) {
    // Cache miss — rebuild from DB
    const dbMappings = await fetchMockTestQuestionsFromDB(mockTestId)
    if (dbMappings) {
      await warmMockTestCache(mockTestId, testVersion, dbMappings)
      answerKeyMap = await getCachedAnswerKey(mockTestId, testVersion)
    }
  }

  if (!answerKeyMap) throw new Error('Answer key unavailable')

  // 4. Evaluate answers
  const answersMap = new Map<string, any>()
  if (userAnswers) {
    for (const a of userAnswers) answersMap.set(a.question_id, a)
  }

  let correctCount = 0
  let incorrectCount = 0
  let unansweredCount = 0
  let totalScore = 0
  const sectionData = new Map<string, { name: string; total: number; correct: number; incorrect: number; score: number; total_marks: number }>()

  // Get section mappings
  const { data: qMappings } = await supabaseAdmin
    .from('mock_test_questions')
    .select('question_id, question_number, section_id, section_name, marks')
    .eq('mock_test_id', mockTestId)

  const sectionByQ = new Map<string, { section_id: string; section_name: string; marks: number }>()
  if (qMappings) {
    for (const m of qMappings) {
      sectionByQ.set(m.question_id, { section_id: m.section_id, section_name: m.section_name, marks: m.marks })
    }
  }

  const updatedAnswers: Array<{
    attempt_id: string; question_id: string; is_correct: boolean
  }> = []

  for (const [qId, keyEntry] of answerKeyMap.entries()) {
    const userAnswer = answersMap.get(qId)
    const section = sectionByQ.get(qId)

    if (!sectionData.has(section?.section_id || 'unknown')) {
      sectionData.set(section?.section_id || 'unknown', {
        name: section?.section_name || 'Unknown',
        total: 0, correct: 0, incorrect: 0, score: 0, total_marks: 0
      })
    }
    const sd = sectionData.get(section?.section_id || 'unknown')!
    sd.total++
    sd.total_marks += keyEntry.marks

    if (!userAnswer || !userAnswer.selected_option) {
      unansweredCount++
    } else {
      const isCorrect = userAnswer.selected_option.toUpperCase() === keyEntry.correct_answer
      if (isCorrect) {
        correctCount++
        totalScore += keyEntry.marks
        sd.correct++
        sd.score += keyEntry.marks
      } else {
        incorrectCount++
        sd.incorrect++
      }
      updatedAnswers.push({ attempt_id: attemptId, question_id: qId, is_correct: isCorrect })
    }
  }

  const percentage = attempt.total_marks > 0
    ? Math.round((totalScore / attempt.total_marks) * 10000) / 100
    : 0

  const avgTime = (attempt.total_questions || 160) > 0
    ? Math.round(totalTimeSpentSeconds / (attempt.total_questions || 160))
    : 0

  // Build section scores
  const sectionScores: Record<string, SectionScore> = {}
  sectionData.forEach((sd, sectionId) => {
    sectionScores[sectionId] = {
      section_id: sectionId,
      section_name: sd.name,
      total: sd.total,
      correct: sd.correct,
      incorrect: sd.incorrect,
      score: sd.score,
      total_marks: sd.total_marks,
    }
  })

  // 5. Persist final results
  await supabaseAdmin
    .from('mock_test_attempts')
    .update({
      status: 'submitted',
      score: totalScore,
      percentage,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      unanswered_count: unansweredCount,
      section_scores: sectionScores,
      time_spent_seconds: totalTimeSpentSeconds,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)

  // 6. Update is_correct on all answers (batch update, non-blocking)
  if (updatedAnswers.length > 0) {
    for (const ua of updatedAnswers) {
      void supabaseAdmin
        .from('mock_test_answers')
        .update({ is_correct: ua.is_correct })
        .eq('attempt_id', ua.attempt_id)
        .eq('question_id', ua.question_id)
    }
  }

  // 7. Calculate rank (non-blocking)
  calculateAndUpdateRank(attemptId, mockTestId, totalScore, totalTimeSpentSeconds).catch(() => {})

  // 8. Build questions review (reveal correct answers + explanations now)
  const questionsReview = buildQuestionsReview(
    qMappings || [],
    answersMap,
    answerKeyMap,
    await getCachedQuestionsForReview(mockTestId, testVersion)
  )

  return {
    attempt_id: attemptId,
    mock_test_id: mockTestId,
    test_title: mockTest?.title || '',
    total_questions: attempt.total_questions || 160,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    score: totalScore,
    total_marks: attempt.total_marks || 80,
    percentage,
    total_time_seconds: totalTimeSpentSeconds,
    avg_time_per_question_seconds: avgTime,
    section_scores: Object.values(sectionScores),
    rank: null, // Set async
    percentile: null,
    questions_review: questionsReview,
  }
}

/** Get questions with full content for review (after submission). */
async function getCachedQuestionsForReview(
  mockTestId: string,
  version: number
): Promise<Map<string, { question: string; option_a: string; option_b: string; option_c: string; option_d: string; subject: string; topic: string; difficulty: string; chapter: string | null; subtopic: string | null; section_id: string; section_name: string; question_number: number; marks: number }>> {
  const questionMap = new Map<string, any>()

  const { data: mappings } = await supabaseAdmin
    .from('mock_test_questions')
    .select('question_id, question_table, question_number, section_id, section_name, marks')
    .eq('mock_test_id', mockTestId)
    .order('question_number', { ascending: true })

  if (!mappings) return questionMap

  // Group by table for batch fetch
  const tableGroups = new Map<string, string[]>()
  const metaByQid = new Map<string, any>()

  for (const m of mappings) {
    const group = tableGroups.get(m.question_table) ?? []
    group.push(m.question_id)
    tableGroups.set(m.question_table, group)
    metaByQid.set(m.question_id, m)
  }

  const fetches = Array.from(tableGroups.entries()).map(([tableName, ids]) =>
    supabaseAdmin
      .from(tableName)
      .select('question_id, question, option_a, option_b, option_c, option_d, subject, chapter, topic, subtopic, difficulty')
      .in('question_id', ids)
      .then(({ data }) => {
        if (!data) return
        for (const row of data) {
          const meta = metaByQid.get(row.question_id)
          if (meta) {
            questionMap.set(row.question_id, {
              question: row.question,
              option_a: row.option_a,
              option_b: row.option_b,
              option_c: row.option_c,
              option_d: row.option_d,
              subject: row.subject || '',
              chapter: row.chapter || null,
              topic: row.topic || '',
              subtopic: row.subtopic || null,
              difficulty: row.difficulty || 'Medium',
              section_id: meta.section_id,
              section_name: meta.section_name,
              question_number: meta.question_number,
              marks: meta.marks,
            })
          }
        }
      })
  )

  await Promise.all(fetches)
  return questionMap
}

function buildQuestionsReview(
  qMappings: any[],
  answersMap: Map<string, any>,
  answerKeyMap: Map<string, any>,
  questionContent: Map<string, any>
): QuestionReviewItem[] {
  return qMappings
    .sort((a: any, b: any) => a.question_number - b.question_number)
    .map((m: any) => {
      const content = questionContent.get(m.question_id)
      const userAnswer = answersMap.get(m.question_id)
      const keyEntry = answerKeyMap.get(m.question_id)

      return {
        question_id: m.question_id,
        question_number: m.question_number,
        section_id: m.section_id,
        section_name: m.section_name,
        subject: content?.subject || '',
        chapter: content?.chapter || null,
        topic: content?.topic || '',
        subtopic: content?.subtopic || null,
        difficulty: content?.difficulty || 'Medium',
        question_type: 'MCQ',
        question: content?.question || '',
        option_a: content?.option_a || '',
        option_b: content?.option_b || '',
        option_c: content?.option_c || '',
        option_d: content?.option_d || '',
        marks: m.marks,
        user_answer: userAnswer?.selected_option ?? null,
        correct_answer: keyEntry?.correct_answer || 'A',  // Revealed after submit
        explanation: keyEntry?.explanation || null,        // Revealed after submit
        is_correct: userAnswer?.selected_option === keyEntry?.correct_answer,
        is_skipped: !userAnswer?.selected_option,
        is_marked: userAnswer?.marked_for_review || false,
        time_taken_seconds: userAnswer?.time_taken_seconds || 0,
      }
    })
}

/** Calculate rank among all submitted attempts for this mock test. */
async function calculateAndUpdateRank(
  attemptId: string,
  mockTestId: string,
  score: number,
  timeSpentSeconds: number
): Promise<void> {
  try {
    // Count attempts with higher score, or same score but faster
    const { count } = await supabaseAdmin
      .from('mock_test_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('mock_test_id', mockTestId)
      .eq('status', 'submitted')
      .or(`score.gt.${score},and(score.eq.${score},time_spent_seconds.lt.${timeSpentSeconds})`)

    const rank = (count ?? 0) + 1

    // Count total submitted for percentile
    const { count: totalCount } = await supabaseAdmin
      .from('mock_test_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('mock_test_id', mockTestId)
      .eq('status', 'submitted')

    const percentile = totalCount && totalCount > 1
      ? Math.round(((totalCount - rank) / (totalCount - 1)) * 100 * 100) / 100
      : 100

    await supabaseAdmin
      .from('mock_test_attempts')
      .update({ rank, percentile })
      .eq('id', attemptId)
  } catch (err) {
    console.warn('[MockDB] Rank calculation failed:', err)
  }
}

// ---- Result Retrieval -------------------------------------------

/** Get full result for a submitted attempt. */
export async function getAttemptResult(
  attemptId: string,
  userId: string
): Promise<MockTestResultSummary | null> {
  const { data: attempt } = await supabaseAdmin
    .from('mock_test_attempts')
    .select('*, mock_tests(id, title, version, total_marks, total_questions)')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single()

  if (!attempt || attempt.status !== 'submitted') return null

  const mockTest = attempt.mock_tests as any

  // Load answers
  const { data: userAnswers } = await supabaseAdmin
    .from('mock_test_answers')
    .select('question_id, question_number, selected_option, marked_for_review, is_correct, time_taken_seconds')
    .eq('attempt_id', attemptId)

  const answersMap = new Map<string, any>()
  if (userAnswers) {
    for (const a of userAnswers) answersMap.set(a.question_id, a)
  }

  // Get answer key from cache
  const answerKeyMap = await getCachedAnswerKey(attempt.mock_test_id, attempt.test_version)

  const { data: qMappings } = await supabaseAdmin
    .from('mock_test_questions')
    .select('question_id, question_number, section_id, section_name, marks')
    .eq('mock_test_id', attempt.mock_test_id)
    .order('question_number', { ascending: true })

  const questionContent = await getCachedQuestionsForReview(attempt.mock_test_id, attempt.test_version)
  const questionsReview = answerKeyMap
    ? buildQuestionsReview(qMappings || [], answersMap, answerKeyMap, questionContent)
    : []

  const avgTime = attempt.total_questions > 0
    ? Math.round(attempt.time_spent_seconds / attempt.total_questions)
    : 0

  return {
    attempt_id: attemptId,
    mock_test_id: attempt.mock_test_id,
    test_title: mockTest?.title || '',
    total_questions: attempt.total_questions,
    correct_count: attempt.correct_count,
    incorrect_count: attempt.incorrect_count,
    unanswered_count: attempt.unanswered_count,
    score: attempt.score,
    total_marks: attempt.total_marks,
    percentage: attempt.percentage,
    total_time_seconds: attempt.time_spent_seconds,
    avg_time_per_question_seconds: avgTime,
    section_scores: Object.values(attempt.section_scores || {}),
    rank: attempt.rank,
    percentile: attempt.percentile,
    questions_review: questionsReview,
  }
}

// ---- Leaderboard ------------------------------------------------

export async function getLeaderboard(
  mockTestId: string,
  currentUserId: string | null,
  limit = 50
): Promise<MockTestLeaderboardEntry[]> {
  const { data } = await supabaseAdmin
    .from('mock_test_attempts')
    .select('id, user_id, score, percentage, time_spent_seconds, submitted_at, rank')
    .eq('mock_test_id', mockTestId)
    .eq('status', 'submitted')
    .order('score', { ascending: false })
    .order('time_spent_seconds', { ascending: true })
    .limit(limit)

  if (!data) return []

  const userIds = [...new Set(data.map((a: any) => a.user_id))]
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email')
    .in('id', userIds)

  const userMap = new Map<string, any>()
  if (users) {
    for (const u of users) userMap.set(u.id, u)
  }

  return data.map((a: any, idx: number) => {
    const user = userMap.get(a.user_id)
    const fullName: string | null = user?.full_name || null
    // Anonymize: show first name + last initial only
    const displayName = fullName
      ? `${fullName.split(' ')[0]} ${fullName.split(' ').slice(1).map((n: string) => n[0] + '.').join(' ')}`.trim()
      : 'Candidate'

    return {
      rank: a.rank || idx + 1,
      attempt_id: a.id,
      user_id: a.user_id,
      user_name: displayName,
      score: a.score,
      percentage: a.percentage,
      time_spent_seconds: a.time_spent_seconds,
      submitted_at: a.submitted_at,
      is_current_user: a.user_id === currentUserId,
    }
  })
}

// ---- Admin Operations -------------------------------------------

/** Create a new Grand Mock test record (status = draft). */
export async function createMockTest(
  createdBy: string,
  data: {
    slug: string
    title: string
    description?: string
    category: string
    medium: string
    blueprint_id: string
    is_free: boolean
  }
): Promise<MockTest> {
  const blueprint = getBlueprintById(data.blueprint_id)
  if (!blueprint) throw new Error(`Blueprint not found: ${data.blueprint_id}`)

  const { data: test, error } = await supabaseAdmin
    .from('mock_tests')
    .insert({
      slug: data.slug,
      title: data.title,
      description: data.description || null,
      category: data.category,
      medium: data.medium,
      blueprint_id: data.blueprint_id,
      duration_minutes: blueprint.duration_minutes,
      total_questions: blueprint.total_questions,
      total_marks: blueprint.total_marks,
      marks_per_question: blueprint.marks_per_question,
      negative_marks: blueprint.negative_marks,
      is_free: data.is_free,
      created_by: createdBy,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error || !test) throw new Error(`Failed to create mock test: ${error?.message}`)
  return test as MockTest
}

/** Generate and store fixed 160-question mapping for a draft mock test. */
export async function generateAndStoreMockQuestions(
  mockTestId: string,
  blueprintId: string
): Promise<{ mappings: GeneratedMapping[]; validation: BlueprintValidationResult }> {
  const blueprint = getBlueprintById(blueprintId)
  if (!blueprint) throw new Error(`Blueprint not found: ${blueprintId}`)

  const { mappings, validation } = await generateGrandMockQuestions(blueprint)

  if (!validation.valid) {
    throw new Error(`Question generation failed validation:\n${validation.errors.join('\n')}`)
  }

  // Delete any existing question mappings for this test (idempotent re-generation)
  await supabaseAdmin.from('mock_test_questions').delete().eq('mock_test_id', mockTestId)

  // Insert all 160 mappings in one batch
  const rows = mappings.map((m) => ({
    mock_test_id: mockTestId,
    question_id: m.question_id,
    question_table: m.question_table,
    question_number: m.question_number,
    section_id: m.section_id,
    section_name: m.section_name,
    marks: m.marks,
  }))

  const { error } = await supabaseAdmin.from('mock_test_questions').insert(rows)
  if (error) throw new Error(`Failed to store question mappings: ${error.message}`)

  return { mappings, validation }
}

/**
 * Publish a Grand Mock: validate → warm Redis cache → set status to published.
 * Returns full validation result. Throws if validation fails.
 */
export async function publishMockTest(
  mockTestId: string,
  adminUserId: string
): Promise<{ validation: BlueprintValidationResult; cacheWarmed: boolean }> {
  const test = await getMockTestById(mockTestId)
  if (!test) throw new Error('Mock test not found')
  if (test.status === 'published') throw new Error('Mock test is already published')

  // Fetch current question mappings
  const { data: mappings, error } = await supabaseAdmin
    .from('mock_test_questions')
    .select('*')
    .eq('mock_test_id', mockTestId)
    .order('question_number', { ascending: true })

  if (error || !mappings || mappings.length === 0) {
    throw new Error('No questions found. Run Generate first.')
  }

  // Validate against blueprint
  const blueprint = getBlueprintById(test.blueprint_id)
  if (!blueprint) throw new Error(`Blueprint not found: ${test.blueprint_id}`)

  const validation = validateBlueprint(blueprint, mappings)
  if (!validation.valid) {
    return { validation, cacheWarmed: false }
  }

  // Batch-fetch full question content for cache warming
  const fullMappings = await fetchMockTestQuestionsFromDB(mockTestId)
  let cacheWarmed = false

  if (fullMappings) {
    cacheWarmed = await warmMockTestCache(mockTestId, test.version, fullMappings)
  }

  // Publish
  await supabaseAdmin
    .from('mock_tests')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      blueprint_snapshot: blueprint,
      updated_at: new Date().toISOString(),
    })
    .eq('id', mockTestId)

  return { validation, cacheWarmed }
}

/** List all mock tests for admin (all statuses). */
export async function adminListMockTests(): Promise<MockTest[]> {
  const { data, error } = await supabaseAdmin
    .from('mock_tests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data as MockTest[]
}
