// ============================================================
// app/api/dsc-sgt/mock-tests/attempts/[attemptId]/route.ts
// GET /api/dsc-sgt/mock-tests/attempts/[attemptId]
// Returns attempt state: status, time, existing answers
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const GET = requireAuth(async (
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
  { user }
) => {
  try {
    const { attemptId } = await params

    // Validate ownership
    const { data: attempt, error } = await supabaseAdmin
      .from('mock_test_attempts')
      .select('id, mock_test_id, status, duration_seconds, time_spent_seconds, started_at, submitted_at, score, percentage, correct_count, incorrect_count, unanswered_count, rank, percentile, section_scores')
      .eq('id', attemptId)
      .eq('user_id', user.id)
      .single()

    if (error || !attempt) {
      return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 })
    }

    // Load saved answers (for session restore)
    const { data: answers } = await supabaseAdmin
      .from('mock_test_answers')
      .select('question_id, question_number, selected_option, marked_for_review, time_taken_seconds')
      .eq('attempt_id', attemptId)

    const existingAnswers: Record<string, { selected_option: string | null; marked_for_review: boolean }> = {}
    if (answers) {
      for (const a of answers) {
        existingAnswers[a.question_id] = {
          selected_option: a.selected_option,
          marked_for_review: a.marked_for_review,
        }
      }
    }

    return NextResponse.json({
      success: true,
      attempt: {
        ...attempt,
        existing_answers: existingAnswers,
      },
    })
  } catch (err: unknown) {
    console.error('[GET attempt]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
