// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/results/route.ts
// ============================================================
// SECURITY: authentication is REQUIRED and the session must belong to the
// caller. This endpoint reveals correct answers and explanations, and it also
// SUBMITS the session as a side effect — so without an ownership check anyone
// holding a session id could both read another user's answer key and force
// their in-progress attempt to be graded.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { getPracticeSessionById, submitPracticeSession } from '@/lib/practice/db'

export const GET = requireAuth(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  { user }
) => {
  try {
    const { id } = await params
    const session = await getPracticeSessionById(id, user.id, false)

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    const results = await submitPracticeSession(id, session.time_spent_seconds, user.id)

    return NextResponse.json({ success: true, results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load results'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
