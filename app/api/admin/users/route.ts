import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { AdminUsersInputError, listAdminUsers } from '@/lib/admin/users'

export const GET = requireAdmin(async (request) => {
  try {
    return NextResponse.json(await listAdminUsers(new URL(request.url).searchParams), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof AdminUsersInputError) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    console.error('[AdminUsers] directory failed:', error)
    return NextResponse.json({ success: false, error: 'Could not load users. Please retry.' }, { status: 500 })
  }
})
