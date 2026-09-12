// ============================================================
// app/api/dsc-sgt/mock-tests/attempts/[attemptId]/answer/route.ts
// POST /api/dsc-sgt/mock-tests/attempts/[attemptId]/answer
// ============================================================
// Lightweight answer save — does NOT evaluate correctness.
// Evaluation happens only at submit time (server-side).
//
// Body: { questionId, questionNumber, selectedOption, markedForReview, timeTakenSeconds }
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { saveAttemptAnswer } from '@/lib/mock-tests/db'
import type { SelectedOption } from '@/types/mock-tests'

export const POST = requireAuth(async (
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
  { user }
) => {
  try {
    const { attemptId } = await params
    const body = await request.json()
    const {
      questionId,
      questionNumber,
      selectedOption,
      markedForReview = false,
      timeTakenSeconds = 0,
    } = body

    if (!questionId) {
      return NextResponse.json({ success: false, error: 'questionId is required' }, { status: 400 })
    }

    if (selectedOption && !['A', 'B', 'C', 'D'].includes(selectedOption)) {
      return NextResponse.json({ success: false, error: 'Invalid selectedOption' }, { status: 400 })
    }

    await saveAttemptAnswer(
      attemptId,
      user.id,
      questionId,
      questionNumber || 0,
      (selectedOption as SelectedOption) || null,
      Boolean(markedForReview),
      Number(timeTakenSeconds) || 0
    )

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[POST answer]', err)
    const message = err instanceof Error ? err.message : 'Failed to save answer'
    const status = message.includes('unauthorized') || message.includes('not found') ? 403 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
})
