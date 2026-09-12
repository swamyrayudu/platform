// ============================================================
// app/api/admin/mock-tests/[id]/publish/route.ts
// POST /api/admin/mock-tests/[id]/publish
// ============================================================
// Validates, warms Redis cache, and publishes a Grand Mock test.
// Steps:
//   1. Validate 160 questions and distribution
//   2. Batch-fetch question content
//   3. Warm Redis cache (client-safe payload + answer key)
//   4. Set status = 'published'
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getMockTestById, publishMockTest } from '@/lib/mock-tests/db'

export const POST = requireAdmin(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  { user }: any
) => {
  try {
    const { id } = await params

    const test = await getMockTestById(id)
    if (!test) {
      return NextResponse.json({ success: false, error: 'Mock test not found' }, { status: 404 })
    }

    const { validation, cacheWarmed } = await publishMockTest(id, user.id)

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed — cannot publish',
          validation,
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Mock test published successfully',
      cache_warmed: cacheWarmed,
      validation,
    })
  } catch (err: unknown) {
    console.error('[POST publish]', err)
    const message = err instanceof Error ? err.message : 'Publish failed'
    const status = message.includes('already published') ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
})
