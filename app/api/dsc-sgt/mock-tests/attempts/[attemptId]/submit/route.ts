// ============================================================
// app/api/dsc-sgt/mock-tests/attempts/[attemptId]/submit/route.ts
// POST /api/dsc-sgt/mock-tests/attempts/[attemptId]/submit
// ============================================================
// Final submission and server-side scoring.
// Frontend score is NEVER trusted.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { submitAttempt } from '@/lib/mock-tests/db'

export const POST = requireAuth(async (
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
  { user }
) => {
  try {
    const { attemptId } = await params
    const body = await request.json().catch(() => ({}))
    const totalTimeSpentSeconds = Number(body.totalTimeSpentSeconds) || 0

    const result = await submitAttempt(attemptId, user.id, totalTimeSpentSeconds)

    return NextResponse.json({ success: true, result })
  } catch (err: unknown) {
    console.error('[POST submit]', err)
    const message = err instanceof Error ? err.message : 'Submission failed'
    const status =
      message.includes('unauthorized') || message.includes('not found') ? 403 :
      message.includes('already submitted') ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
})
