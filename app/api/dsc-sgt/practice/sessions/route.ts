// ============================================================
// app/api/dsc-sgt/practice/sessions/route.ts — Create Session
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { createPracticeSession, canUserCreatePracticeSession } from '@/lib/practice/db'
import type { PracticeFilterState } from '@/types/practice'

export async function POST(request: Request) {
  try {
    const auth = await getOptionalAuth(request)
    if (!auth?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please sign in to access practice sessions.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      )
    }

    const quota = await canUserCreatePracticeSession(auth.user)
    if (!quota.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: quota.reason,
          code: 'FREE_LIMIT_REACHED',
          isPremium: quota.isPremium,
          completedSessions: quota.completedSessions,
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const requestedCount = parseInt(body.question_count || '25', 10)
    // Enforce question count cap: 25 for Free tier, up to 150 for Pro
    const cappedCount = Math.max(5, Math.min(requestedCount || 25, quota.maxQuestions))

    const filter: PracticeFilterState = {
      medium: body.medium || 'english',
      subject: body.subject || 'English',
      class_levels: body.class_levels || [],
      topics: body.topics || [],
      subtopics: body.subtopics || [],
      difficulty: body.difficulty || [],
      question_count: cappedCount,
      mode: body.mode || 'balanced',
      feedback_mode: body.feedback_mode || 'instant',
      has_timer: Boolean(body.has_timer),
      duration_minutes: parseInt(body.duration_minutes || '30', 10),
    }

    const session = await createPracticeSession(filter, auth.user.id)

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
