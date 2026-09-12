// ============================================================
// app/api/dsc-sgt/performance/route.ts
// GET /api/dsc-sgt/performance — real analytics for the current user
// ============================================================
// The Performance page previously rendered hard-coded arrays, so every user
// saw the same invented scores. This serves their actual data.
//
// SECURITY: authentication required, and everything is scoped to the caller's
// own user id inside lib/dsc-sgt/analytics.ts. No id is accepted from the
// client, so there is nothing to enumerate.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { getPerformanceSummary } from '@/lib/dsc-sgt/analytics'

export const GET = requireAuth(async (_request: Request, _context: unknown, { user }) => {
  try {
    const summary = await getPerformanceSummary(user.id)
    return NextResponse.json({ success: true, ...summary })
  } catch (err: unknown) {
    console.error('[GET /api/dsc-sgt/performance]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
