// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/results/route.ts
// ============================================================

import { NextResponse } from 'next/server'
import { getPracticeSessionById, submitPracticeSession } from '@/lib/practice/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getPracticeSessionById(id, false)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    const results = await submitPracticeSession(id, session.time_spent_seconds)

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load results'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
