// ============================================================
// app/api/admin/app-updates/route.ts — App update rules (admin)
// ============================================================
//   GET    { minVersionCode, flexible }
//   PATCH  { minVersionCode, flexible } save them
// See lib/app-update-setting.ts.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getAppUpdateSetting, setAppUpdateSetting } from '@/lib/app-update-setting'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export const GET = requireAdmin(async () => {
  try {
    return NextResponse.json({ success: true, ...(await getAppUpdateSetting()) }, { headers: NO_STORE })
  } catch (error) {
    console.error('[AppUpdates] load failed:', error)
    return NextResponse.json({ success: false, error: 'Could not load the update settings.' }, { status: 500 })
  }
})

export const PATCH = requireAdmin(async (request) => {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const minVersionCode = Number(body.minVersionCode ?? 0)
    if (!Number.isInteger(minVersionCode) || minVersionCode < 0 || minVersionCode > 2_100_000_000) {
      return NextResponse.json({ success: false, error: 'Minimum version code must be a whole number, 0 or more.' }, { status: 400 })
    }
    if (typeof body.flexible !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Small updates must be on or off.' }, { status: 400 })
    }
    await setAppUpdateSetting({ minVersionCode, flexible: body.flexible })
    return NextResponse.json({ success: true, minVersionCode, flexible: body.flexible }, { headers: NO_STORE })
  } catch (error) {
    console.error('[AppUpdates] save failed:', error)
    return NextResponse.json({ success: false, error: 'Could not save the update settings.' }, { status: 500 })
  }
})
