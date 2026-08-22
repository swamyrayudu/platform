// ============================================================
// app/api/dsc-sgt/practice/history/route.ts
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { getPracticeHistory } from '@/lib/practice/db'

export async function GET(request: Request) {
  try {
    const auth = await getOptionalAuth(request)
    const userId = auth?.user?.id || null

    const history = await getPracticeHistory(userId)

    return NextResponse.json({
      success: true,
      history,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load practice history'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
