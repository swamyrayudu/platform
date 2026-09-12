// ============================================================
// app/api/dsc-sgt/mock-tests/[id]/start/route.ts
// POST /api/dsc-sgt/mock-tests/[id]/start
// ============================================================
// Creates a new attempt OR resumes an existing in-progress attempt.
// Authentication required.
// Returns attempt state including existing answers for session restore.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { getMockTestById, startOrResumeAttempt } from '@/lib/mock-tests/db'
import { isUserPremium } from '@/lib/auth/session'

export const POST = requireAuth(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  { user }
) => {
  try {
    const { id } = await params

    const test = await getMockTestById(id)
    if (!test || test.status !== 'published') {
      return NextResponse.json({ success: false, error: 'Mock test not found' }, { status: 404 })
    }

    // Check premium requirement for non-free tests
    if (!test.is_free && !isUserPremium(user)) {
      return NextResponse.json(
        { success: false, error: 'PREMIUM_REQUIRED', message: 'This test requires a Pro subscription' },
        { status: 403 }
      )
    }

    const result = await startOrResumeAttempt(user.id, test)

    return NextResponse.json({ success: true, ...result })
  } catch (err: unknown) {
    console.error('[POST /api/dsc-sgt/mock-tests/[id]/start]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
