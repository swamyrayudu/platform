// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/submit/route.ts
// ============================================================
// SECURITY: authentication is REQUIRED and the session must belong to the
// caller. Without it, anyone holding a session id could force-submit another
// user's in-progress practice attempt.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { submitPracticeSession } from '@/lib/practice/db'

export const POST = requireAuth(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  { user }
) => {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const totalTimeSpentSeconds = parseInt(body.totalTimeSpentSeconds || '0', 10)

    const results = await submitPracticeSession(id, totalTimeSpentSeconds, user.id)

    return NextResponse.json({ success: true, results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit practice session'
    console.error('[Submit Practice Session Error]', err)
    // A session that is not the caller's is reported as not found, so this
    // endpoint never confirms that someone else's session exists.
    const status = /not found/i.test(message) ? 404 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
})
