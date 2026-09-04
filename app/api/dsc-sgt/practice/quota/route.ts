// ============================================================
// app/api/dsc-sgt/practice/quota/route.ts — Practice Session Quota
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { canUserCreatePracticeSession } from '@/lib/practice/db'

export async function GET(request: Request) {
  try {
    const auth = await getOptionalAuth(request)
    const quota = await canUserCreatePracticeSession(auth?.user || null)

    return NextResponse.json({
      success: true,
      isAuthenticated: Boolean(auth?.user),
      isPremium: quota.isPremium,
      canPractice: quota.allowed,
      completedSessions: quota.completedSessions,
      allowedSessions: quota.isPremium ? 'unlimited' : 1,
      maxQuestions: quota.maxQuestions,
      reason: quota.reason || null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch practice quota'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
