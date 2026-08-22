// ============================================================
// app/api/dsc-sgt/practice/sessions/[id]/abandon/route.ts
// ============================================================

import { NextResponse } from 'next/server'
import { abandonPracticeSession } from '@/lib/practice/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await abandonPracticeSession(id)
    return NextResponse.json({ success: true, message: 'Session discarded without saving' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to discard session'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
