// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/submit/route.ts
// ============================================================

import { NextResponse } from 'next/server'
import { submitPracticeSession } from '@/lib/practice/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const totalTimeSpentSeconds = parseInt(body.totalTimeSpentSeconds || '0', 10)

    const results = await submitPracticeSession(id, totalTimeSpentSeconds)

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit practice session'
    console.error('[Submit Practice Session Error]', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
