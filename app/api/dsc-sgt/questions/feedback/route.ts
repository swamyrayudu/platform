// ============================================================
// app/api/dsc-sgt/questions/feedback/route.ts
// POST /api/dsc-sgt/questions/feedback — report a problem with a question
// ============================================================
// Two writes, in this order:
//
//   1. Find or create the QUESTION row. The question snapshot is written only
//      when the row is created, so the tenth reporter does not store a tenth
//      copy of the same question.
//   2. Insert this candidate's REPORT against it. A trigger on that insert
//      bumps report_count and the per-reason breakdown, which keeps the count
//      correct when two candidates report the same question at once.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { parseQuestionUid } from '@/lib/questions/tables'
import type { FeedbackReason, FeedbackSource } from '@/types/question-feedback'

const REASONS: FeedbackReason[] = [
  'wrong_answer',
  'wrong_question',
  'wrong_option',
  'wrong_explanation',
  'typo',
  'duplicate',
  'other',
]

const SOURCES: FeedbackSource[] = [
  'mock_result',
  'practice_result',
  'mock_exam',
  'practice_exam',
  'unknown',
]

const DETAILS_MAX = 1000
const SNAPSHOT_MAX = 2000

/**
 * The question's row in the queue, created on first report.
 *
 * Insert-then-read rather than read-then-insert: two candidates reporting the
 * same unreported question at the same moment both see "not found", and the
 * unique index on question_uid is what settles it. The loser reads the winner's
 * row instead of failing.
 */
async function findOrCreateQuestionRow(
  questionUid: string,
  questionTable: string,
  questionId: string,
  snapshot: string | null
): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from('question_feedback')
    .select('id')
    .eq('question_uid', questionUid)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const { data: created, error } = await supabaseAdmin
    .from('question_feedback')
    .insert({
      question_uid: questionUid,
      question_table: questionTable,
      question_id: questionId,
      reported_question: snapshot,
    })
    .select('id')
    .single()

  if (!error && created?.id) return created.id as string

  // Lost the race — the row exists now, so read it.
  if (error?.code === '23505') {
    const { data: raced } = await supabaseAdmin
      .from('question_feedback')
      .select('id')
      .eq('question_uid', questionUid)
      .maybeSingle()
    return (raced?.id as string) ?? null
  }

  if (error) console.error('[feedback] could not create question row', error)
  return null
}

export const POST = requireAuth(async (request, _ctx, { user }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { questionUid, reason, details, source, mockTestId, reportedQuestion } =
    body as Record<string, unknown>

  // ---- question identity -----------------------------------------
  // parseQuestionUid also allowlists the table: the uid comes from the client,
  // and an unchecked table name would be fed straight into a query.
  if (typeof questionUid !== 'string') {
    return NextResponse.json({ error: 'questionUid is required' }, { status: 400 })
  }
  const parsed = parseQuestionUid(questionUid)
  if (!parsed) {
    return NextResponse.json({ error: 'Unknown question' }, { status: 400 })
  }

  // ---- reason ----------------------------------------------------
  if (!REASONS.includes(reason as FeedbackReason)) {
    return NextResponse.json({ error: 'Pick what is wrong with the question' }, { status: 400 })
  }

  // ---- details ---------------------------------------------------
  let trimmedDetails: string | null = null
  if (details !== undefined && details !== null && details !== '') {
    if (typeof details !== 'string') {
      return NextResponse.json({ error: 'details must be text' }, { status: 400 })
    }
    trimmedDetails = details.trim().slice(0, DETAILS_MAX)
  }
  if (reason === 'other' && !trimmedDetails) {
    return NextResponse.json(
      { error: 'Tell us what is wrong so we can look into it' },
      { status: 400 }
    )
  }

  const safeSource: FeedbackSource = SOURCES.includes(source as FeedbackSource)
    ? (source as FeedbackSource)
    : 'unknown'

  const snapshot =
    typeof reportedQuestion === 'string' ? reportedQuestion.slice(0, SNAPSHOT_MAX) : null

  // ---- 1. the question ------------------------------------------
  const feedbackId = await findOrCreateQuestionRow(
    questionUid,
    parsed.questionTable,
    parsed.questionId,
    snapshot
  )
  if (!feedbackId) {
    return NextResponse.json(
      { error: 'Something went wrong saving it. Please try again.' },
      { status: 500 }
    )
  }

  // ---- 2. this candidate's report -------------------------------
  const { error } = await supabaseAdmin.from('question_feedback_reports').insert({
    feedback_id: feedbackId,
    question_uid: questionUid,
    user_id: user.id,
    reason,
    details: trimmedDetails,
    source: safeSource,
    mock_test_id: typeof mockTestId === 'string' && mockTestId ? mockTestId : null,
  })

  if (error) {
    // One report per candidate per question — a second press is not an error,
    // and must not bump the count.
    if (error.code === '23505') {
      return NextResponse.json(
        { success: true, duplicate: true, message: 'You have already reported this question.' },
        { status: 200 }
      )
    }
    console.error('[POST /api/dsc-sgt/questions/feedback]', error)
    return NextResponse.json(
      { error: 'Something went wrong saving it. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
})
