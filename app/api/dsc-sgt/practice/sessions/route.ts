// ============================================================
// app/api/dsc-sgt/practice/sessions/route.ts — Create Session
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { createPracticeSession } from '@/lib/practice/db'
import type { PracticeFilterState } from '@/types/practice'

export async function POST(request: Request) {
  try {
    const auth = await getOptionalAuth(request)
    const userId = auth?.user?.id || null

    const body = await request.json()
    const filter: PracticeFilterState = {
      medium: body.medium || 'english',
      subject: body.subject || 'English',
      class_levels: body.class_levels || [],
      topics: body.topics || [],
      subtopics: body.subtopics || [],
      difficulty: body.difficulty || [],
      question_count: parseInt(body.question_count || '25', 10),
      mode: body.mode || 'balanced',
      feedback_mode: body.feedback_mode || 'instant',
      has_timer: Boolean(body.has_timer),
      duration_minutes: parseInt(body.duration_minutes || '30', 10),
    }

    const session = await createPracticeSession(filter, userId)

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create practice session'
    console.error('[Practice Create Session Error]', err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
