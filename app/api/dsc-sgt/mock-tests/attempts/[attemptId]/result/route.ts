// ============================================================
// app/api/dsc-sgt/mock-tests/attempts/[attemptId]/result/route.ts
// GET /api/dsc-sgt/mock-tests/attempts/[attemptId]/result
// ============================================================
// Returns full result with score, section breakdown, and
// detailed question review WITH correct answers and explanations.
//
// Correct answers are ONLY revealed here — after the exam is submitted.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { getAttemptResult } from '@/lib/mock-tests/db'

export const GET = requireAuth(async (
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
  { user }
) => {
  try {
    const { attemptId } = await params

    const result = await getAttemptResult(attemptId, user.id)

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Result not available. Complete and submit the exam first.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, result })
  } catch (err: unknown) {
    console.error('[GET result]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
