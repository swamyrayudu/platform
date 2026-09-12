// ============================================================
// app/api/dsc-sgt/mock-tests/route.ts
// GET /api/dsc-sgt/mock-tests — List published grand mock tests
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { listPublishedMockTests } from '@/lib/mock-tests/db'

export async function GET(request: Request) {
  try {
    const auth = await getOptionalAuth(request)
    const userId = auth?.user?.id ?? null

    const tests = await listPublishedMockTests(userId)

    return NextResponse.json({ success: true, tests })
  } catch (err: unknown) {
    console.error('[GET /api/dsc-sgt/mock-tests]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
