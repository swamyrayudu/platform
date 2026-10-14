// ============================================================
// app/api/auth/account/route.ts — DELETE /api/auth/account
// ============================================================
// Permanently deletes the signed-in user's account and personal data.
// Google Play requires this both in the app and on the web
// (/delete-account); both call this route.
//
// The body must be { confirm: "DELETE" } so a stray request cannot delete an
// account. Admin accounts are refused here: removing the last admin would
// lock everyone out of the admin panel, so those are handled manually.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { deleteUserAccount } from '@/lib/auth/db'
import { clearAuthCookies } from '@/lib/auth/cookies'
import { handleAuthError } from '@/lib/auth/errors'

export const DELETE = requireAuth(async (request, _ctx, { user }) => {
  try {
    const body = await request.json().catch(() => null)
    if (body?.confirm !== 'DELETE') {
      return NextResponse.json(
        { success: false, error: 'Confirm by sending { "confirm": "DELETE" }.' },
        { status: 400 }
      )
    }
    if (user.role === 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin accounts cannot be deleted here. Contact support.' },
        { status: 403 }
      )
    }

    await deleteUserAccount(user.id)
    console.info('[Auth] Account deleted:', user.id)

    const response = NextResponse.json({ success: true })
    clearAuthCookies(response)
    return response
  } catch (err) {
    return handleAuthError(err)
  }
})
