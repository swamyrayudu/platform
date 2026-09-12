// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/abandon/route.ts
// ============================================================
// SECURITY: authentication is REQUIRED and the session must belong to the
// caller.
//
// This is the most destructive route in the practice flow: for a FREE user
// abandoning COMPLETES their one lifetime session (permanently consuming it),
// and for a Pro user it HARD-DELETES the row. It previously accepted a bare
// session id with no auth, so anyone holding an id could burn or destroy
// another user's session. Ownership is now enforced in the data layer and
// every write is scoped by user_id.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { abandonPracticeSession } from '@/lib/practice/db'

export const POST = requireAuth(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  { user }
) => {
  try {
    const { id } = await params
    const abandoned = await abandonPracticeSession(id, user.id)

    // Consistent with the other session routes: a session that is not the
    // caller's is indistinguishable from one that does not exist.
    if (!abandoned) {
      return NextResponse.json(
        { success: false, error: 'Practice session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, message: 'Session discarded without saving' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to discard session'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
