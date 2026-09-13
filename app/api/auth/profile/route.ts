// ============================================================
// app/api/auth/profile/route.ts — PATCH /api/auth/profile
// ============================================================
// Updates the parts of a profile the candidate owns: display name, education
// medium and study goals.
//
// Everything else is deliberately not writable here. Email, Google id and
// avatar are asserted by Google at sign-in; role and subscription are set by
// the server. A PATCH that names them is ignored rather than rejected, so a
// client echoing back a whole user object cannot escalate itself.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { updateUserProfile } from '@/lib/auth/db'
import { toPublicUser } from '@/lib/auth/types'
import type { LearningGoal, EducationMedium } from '@/lib/auth/types'

const VALID_LEARNING_GOALS: LearningGoal[] = ['mock_test', 'practice', 'ai_support', 'other']
const VALID_EDUCATION_MEDIUMS: EducationMedium[] = ['english', 'telugu']

const NAME_MAX = 60

export const PATCH = requireAuth(async (request, _ctx, { user }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, learningGoals, educationMedium } = body as Record<string, unknown>
  const patch: Parameters<typeof updateUserProfile>[1] = {}

  // ---- name ------------------------------------------------------
  if (name !== undefined) {
    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'name must be a string' }, { status: 400 })
    }
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    if (trimmed.length > NAME_MAX) {
      return NextResponse.json(
        { error: `Name must be ${NAME_MAX} characters or fewer` },
        { status: 400 }
      )
    }
    patch.name = trimmed
  }

  // ---- learningGoals ---------------------------------------------
  if (learningGoals !== undefined) {
    if (!Array.isArray(learningGoals) || learningGoals.length === 0) {
      return NextResponse.json(
        { error: 'Pick at least one study goal' },
        { status: 400 }
      )
    }
    const unique = [...new Set(learningGoals)] as string[]
    for (const goal of unique) {
      if (!VALID_LEARNING_GOALS.includes(goal as LearningGoal)) {
        return NextResponse.json({ error: `Invalid study goal: "${goal}"` }, { status: 400 })
      }
    }
    patch.learningGoals = unique as LearningGoal[]
  }

  // ---- educationMedium -------------------------------------------
  if (educationMedium !== undefined) {
    if (!VALID_EDUCATION_MEDIUMS.includes(educationMedium as EducationMedium)) {
      return NextResponse.json(
        { error: `educationMedium must be one of: ${VALID_EDUCATION_MEDIUMS.join(', ')}` },
        { status: 400 }
      )
    }
    patch.educationMedium = educationMedium as EducationMedium
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await updateUserProfile(user.id, patch)

  return NextResponse.json({ success: true, user: toPublicUser(updated) })
})
