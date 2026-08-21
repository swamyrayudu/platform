// ============================================================
// app/api/auth/me/route.ts — GET /api/auth/me
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { toPublicUser } from '@/lib/auth/types'
import { setOnboardingCookie } from '@/lib/auth/cookies'

export const GET = requireAuth(async (_request, _ctx, { user }) => {
  const publicUser = toPublicUser(user)
  const response = NextResponse.json(publicUser)

  // Sync onboarding cookie for returning users or existing sessions
  if (user.onboarding_completed) {
    setOnboardingCookie(response)
  }

  return response
})
