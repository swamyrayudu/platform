// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/route.ts — Get Session
// ============================================================
// SECURITY: authentication is REQUIRED and the session must belong to the
// caller. A session id is not an authorisation token — it travels in the URL,
// browser history and referrers. Ownership is enforced in the data layer
// (getPracticeSessionById scopes by user_id), and a session belonging to
// someone else returns 404 rather than 403 so this endpoint never confirms
// that another user's session exists.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { getPracticeSessionById } from '@/lib/practice/db'

export const GET = requireAuth(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  { user }
) => {
  try {
    const { id } = await params
    const session = await getPracticeSessionById(id, user.id, true)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Practice session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, session })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve practice session'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
