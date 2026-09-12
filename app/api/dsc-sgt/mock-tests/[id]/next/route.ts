// ============================================================
// app/api/dsc-sgt/mock-tests/[id]/next/route.ts
// GET /api/dsc-sgt/mock-tests/[id]/next
// ============================================================
// After a user completes Module N, the completion screen offers
// [ Next Module ]. This resolves what that next module is, within the
// same series and the same medium.
//
// Returns null when the user is on the last module of the series.
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { getMockTestById } from '@/lib/mock-tests/db'
import { getNextModule, loadUserProgressForTests } from '@/lib/mock-tests/modules'
import { resolveGenerationMedium } from '@/lib/mock-tests/generator'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const test = await getMockTestById(id)
    if (!test || test.status !== 'published') {
      return NextResponse.json({ success: false, error: 'Mock test not found' }, { status: 404 })
    }

    if (test.module_number === null || test.module_number === undefined) {
      // A legacy one-off test is not part of an ordered series.
      return NextResponse.json({ success: true, next_module: null, is_last: true })
    }

    const next = await getNextModule(
      test.series,
      resolveGenerationMedium(test.medium),
      test.module_number
    )

    if (!next) {
      return NextResponse.json({ success: true, next_module: null, is_last: true })
    }

    // Include the user's state for the next module so the button can read
    // Start / Continue / Completed without a second request.
    const auth = await getOptionalAuth(request)
    const userId = auth?.user?.id ?? null
    let progressStatus = 'not_started'

    if (userId) {
      const progress = await loadUserProgressForTests(userId, [next.id])
      progressStatus = progress.get(next.id)?.status ?? 'not_started'
    }

    return NextResponse.json({
      success: true,
      is_last: false,
      next_module: { ...next, progress_status: progressStatus },
    })
  } catch (err: unknown) {
    console.error('[GET /api/dsc-sgt/mock-tests/[id]/next]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
