// ============================================================
// app/api/dsc-sgt/overview/route.ts
// GET /api/dsc-sgt/overview — dashboard summary for the current user
// ============================================================
// Returns the user's real study stats plus the exam structure read from the
// blueprint, so the Overview page stops advertising numbers that disagree with
// the papers actually being generated.
//
// SECURITY: authentication required; stats are scoped to the caller.
// The syllabus portion is not user-specific and contains no answers.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { getOverviewSummary, getSyllabusSections } from '@/lib/dsc-sgt/analytics'

export const GET = requireAuth(async (request: Request, _context: unknown, { user }) => {
  try {
    const url = new URL(request.url)
    const blueprintId = url.searchParams.get('blueprint') || undefined

    const [summary, syllabus] = await Promise.all([
      getOverviewSummary(user.id),
      Promise.resolve(getSyllabusSections(blueprintId)),
    ])

    return NextResponse.json({ success: true, summary, syllabus })
  } catch (err: unknown) {
    console.error('[GET /api/dsc-sgt/overview]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
