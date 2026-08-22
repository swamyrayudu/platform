// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/route.ts — Get Session
// ============================================================

import { NextResponse } from 'next/server'
import { getPracticeSessionById } from '@/lib/practice/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getPracticeSessionById(id, true)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Practice session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve practice session'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
