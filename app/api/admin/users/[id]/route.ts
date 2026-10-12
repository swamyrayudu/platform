import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { AdminUsersInputError, getAdminUser, getAdminUserHistory, getAdminUserSummary, isUserId } from '@/lib/admin/users'
import { USER_HISTORY_SECTIONS, type UserHistorySection } from '@/types/admin-users'

export const GET = requireAdmin<{ id: string }>(async (request, context) => {
  try {
    const { id } = await context.params
    if (!isUserId(id)) return NextResponse.json({ success: false, error: 'Invalid user ID.' }, { status: 400 })
    const params = new URL(request.url).searchParams
    const section = params.get('section')
    if (section && !(USER_HISTORY_SECTIONS as readonly string[]).includes(section)) {
      return NextResponse.json({ success: false, error: 'Unknown history section.' }, { status: 400 })
    }
    const user = await getAdminUser(id)
    if (!user) return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 })
    const data = section ? await getAdminUserHistory(id, section as UserHistorySection, params) : await getAdminUserSummary(user)
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof AdminUsersInputError) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    console.error('[AdminUsers] detail failed:', error)
    return NextResponse.json({ success: false, error: 'Could not load user data. Please retry.' }, { status: 500 })
  }
})
