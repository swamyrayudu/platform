// ============================================================
// lib/app-update-setting.ts — Google Play app update rules (SERVER ONLY)
// ============================================================
// Set at /admin/app-updates, stored in public.app_settings under
// 'android_update' (no migration needed: the table exists since
// 20261017130000). Read by the Play app through /api/app/update-policy.
//
//   minVersionCode  installs below this Android version code must update
//                   before they can use the app (Google Play's full-screen
//                   "immediate" update). 0 = nothing is required.
//   flexible        when Google Play has a newer version, offer it as a small
//                   update that downloads in the background ("flexible").
//
// A Play release with update priority 4 or 5 is also treated as required
// (mobile/utils/play-update-policy.ts).
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

const KEY = 'android_update'

export interface AppUpdateSetting {
  minVersionCode: number
  flexible: boolean
}

export const DEFAULT_APP_UPDATE: AppUpdateSetting = { minVersionCode: 0, flexible: true }

export function parseAppUpdate(value: unknown): AppUpdateSetting {
  const v = (value ?? {}) as Partial<Record<keyof AppUpdateSetting, unknown>>
  const min = Number(v.minVersionCode)
  return {
    minVersionCode: Number.isInteger(min) && min > 0 ? min : 0,
    flexible: v.flexible !== false,
  }
}

/** Missing table or row: nothing required, small updates offered. */
export async function getAppUpdateSetting(): Promise<AppUpdateSetting> {
  const { data, error } = await supabaseAdmin.from('app_settings').select('value').eq('key', KEY).maybeSingle()
  if (error || !data) return DEFAULT_APP_UPDATE
  return parseAppUpdate(data.value)
}

export async function setAppUpdateSetting(setting: AppUpdateSetting): Promise<void> {
  const { error } = await supabaseAdmin.from('app_settings')
    .upsert({ key: KEY, value: parseAppUpdate(setting), updated_at: new Date().toISOString() })
  if (error) throw error
}
