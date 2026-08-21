// ============================================================
// app/api/auth/onboarding/route.ts — POST /api/auth/onboarding
// ============================================================
// Saves onboarding data (learning goals + education medium)
// and marks onboarding_completed = true for the user.
// Protected by requireAuth — only authenticated users can call.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { updateOnboarding } from '@/lib/auth/db'
import { toPublicUser } from '@/lib/auth/types'
import type { LearningGoal, EducationMedium } from '@/lib/auth/types'
import { setOnboardingCookie } from '@/lib/auth/cookies'

const VALID_LEARNING_GOALS: LearningGoal[] = ['mock_test', 'practice', 'ai_support', 'other']
const VALID_EDUCATION_MEDIUMS: EducationMedium[] = ['english', 'telugu']

export const POST = requireAuth(async (request, _ctx, { user }) => {
  // ---- Parse body ------------------------------------------------
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { learningGoals, educationMedium } = body as Record<string, unknown>

  // ---- Validate learningGoals ------------------------------------
  if (!Array.isArray(learningGoals) || learningGoals.length === 0) {
    return Response.json(
      { error: 'learningGoals must be a non-empty array' },
      { status: 400 }
    )
  }

  // Deduplicate and validate each goal
  const uniqueGoals = [...new Set(learningGoals)] as string[]
  for (const goal of uniqueGoals) {
    if (!VALID_LEARNING_GOALS.includes(goal as LearningGoal)) {
      return Response.json(
        { error: `Invalid learning goal: "${goal}". Allowed: ${VALID_LEARNING_GOALS.join(', ')}` },
        { status: 400 }
      )
    }
  }

  // ---- Validate educationMedium ----------------------------------
  if (!educationMedium || !VALID_EDUCATION_MEDIUMS.includes(educationMedium as EducationMedium)) {
    return Response.json(
      { error: `educationMedium must be one of: ${VALID_EDUCATION_MEDIUMS.join(', ')}` },
      { status: 400 }
    )
  }

  // ---- Check if already completed --------------------------------
  if (user.onboarding_completed) {
    return Response.json(
      { error: 'Onboarding already completed', user: toPublicUser(user) },
      { status: 409 }
    )
  }

  // ---- Save to database ------------------------------------------
  const updatedUser = await updateOnboarding(
    user.id,
    uniqueGoals as LearningGoal[],
    educationMedium as EducationMedium
  )

  // ---- Set onboarding cookie for proxy ---------------------------
  const response = NextResponse.json({
    success: true,
    user: toPublicUser(updatedUser),
  })
  setOnboardingCookie(response)

  return response
})
