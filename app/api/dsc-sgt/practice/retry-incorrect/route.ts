// ============================================================
// app/api/dsc-sgt/practice/retry-incorrect/route.ts
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { createPracticeSession, getPracticeSessionById } from '@/lib/practice/db'
import type { PracticeFilterState } from '@/types/practice'

export async function POST(request: Request) {
  try {
    const auth = await getOptionalAuth(request)
    const userId = auth?.user?.id || null

    const body = await request.json()
    const { fromSessionId, topic, subject, medium } = body

    let targetTopic = topic
    let targetSubject = subject || 'English'
    let targetMedium = medium || 'english'

    if (fromSessionId) {
      const prevSession = await getPracticeSessionById(fromSessionId, false)
      if (prevSession) {
        targetSubject = prevSession.subject
        targetMedium = prevSession.medium
        if (topic) targetTopic = topic
      }
    }

    const filter: PracticeFilterState = {
      medium: targetMedium,
      subject: targetSubject,
      class_levels: [],
      topics: targetTopic ? [targetTopic] : [],
      subtopics: [],
      difficulty: [],
      question_count: 20,
      mode: 'previously_incorrect',
      feedback_mode: 'instant',
      has_timer: false,
      duration_minutes: 20,
    }

    const newSession = await createPracticeSession(filter, userId)

    return NextResponse.json({
      success: true,
      session: newSession,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to launch retry session'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
