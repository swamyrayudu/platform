// ============================================================
// app/api/dsc-sgt/mock-tests/[id]/leaderboard/route.ts
// GET /api/dsc-sgt/mock-tests/[id]/leaderboard
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { getMockTestById, getLeaderboard } from '@/lib/mock-tests/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await getOptionalAuth(request)
    const userId = auth?.user?.id ?? null

    const url = new URL(request.url)
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10))

    const test = await getMockTestById(id)
    if (!test || test.status !== 'published') {
      return NextResponse.json({ success: false, error: 'Mock test not found' }, { status: 404 })
    }

    const leaderboard = await getLeaderboard(test.id, userId, limit)

    return NextResponse.json({ success: true, leaderboard })
  } catch (err: unknown) {
    console.error('[GET leaderboard]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
