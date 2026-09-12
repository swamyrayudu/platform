// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/answer/route.ts
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { recordQuestionAnswer } from '@/lib/practice/db'

// SECURITY: authentication is REQUIRED and the session must belong to the
// caller. This previously used getOptionalAuth and passed the id into a
// parameter the data layer ignored (`_userId`), so the ownership check was
// accepted but never performed.
export const POST = requireAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  { user }
) => {
  try {
    const { id } = await params

    const body = await request.json()
    const { questionId, selectedAnswer, timeTakenSeconds, markedForReview } = body

    if (!questionId) {
      return NextResponse.json(
        { success: false, error: 'questionId is required' },
        { status: 400 }
      )
    }

    const result = await recordQuestionAnswer(
      id,
      questionId,
      selectedAnswer,
      timeTakenSeconds || 0,
      markedForReview || false,
      user.id
    )

    // In 'end' feedback mode the exam must not reveal anything until it is
    // submitted, so the answer is withheld per question too — not just hidden
    // in the UI. `is_correct` is still returned because the client needs it to
    // track progress, and it discloses nothing the user did not just choose.
    const revealAnswer = result.session.feedback_mode === 'instant'

    return NextResponse.json({
      success: true,
      is_correct: result.is_correct,
      correct_answer: revealAnswer ? result.correct_answer : null,
      explanation: revealAnswer ? result.explanation : null,
      session: {
        score: result.session.score,
        accuracy_pct: result.session.accuracy_pct,
        time_spent_seconds: result.session.time_spent_seconds,
        user_answers: result.session.user_answers,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record answer'
    console.error('[Record Answer Error]', err)
    const status = /not found/i.test(message) ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
})
