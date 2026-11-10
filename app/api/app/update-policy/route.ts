// ============================================================
// app/api/app/update-policy/route.ts — App update rules (public)
// ============================================================
// GET → { android: { minVersionCode, flexible } }
// Read by the Google Play app on start and when it comes back to the
// foreground (mobile/components/play-app-update.tsx). No sign-in needed: a
// required update must also reach people who are signed out.
// Set at /admin/app-updates (lib/app-update-setting.ts).
// ============================================================

import { NextResponse } from 'next/server'
import { getAppUpdateSetting } from '@/lib/app-update-setting'

export async function GET() {
  const android = await getAppUpdateSetting()
  // Short cache: a new minimum reaches phones within about a minute.
  return NextResponse.json({ android }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } })
}
