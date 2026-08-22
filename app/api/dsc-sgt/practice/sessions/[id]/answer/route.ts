// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/answer/route.ts
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { recordQuestionAnswer } from '@/lib/practice/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await getOptionalAuth(request)
    const userId = auth?.user?.id || null

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
      userId
    )

    return NextResponse.json({
      success: true,
      is_correct: result.is_correct,
      correct_answer: result.correct_answer,
      explanation: result.explanation,
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
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
