// ============================================================
// lib/auth/db.ts — Database operations for auth (SERVER ONLY)
// ============================================================
// All DB access goes through the Supabase admin client.
// Uses service-role key to bypass RLS. Never call from client.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  DbUser,
  DbSession,
  DbDevice,
  GoogleProfile,
  DeviceInfo,
  Platform,
  SecurityEventType,
  PublicDevice,
} from './types'
import { AuthError } from './errors'

// ---- Refresh token expiry -------------------------------------------

const REFRESH_TOKEN_EXPIRES_DAYS = 30

function refreshTokenExpiresAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRES_DAYS)
  return d.toISOString()
}

// ---- Users -----------------------------------------------------------

/**
 * Find an existing user by google_id, or create a new one.
 * Uses an upsert on google_id to prevent duplicate accounts.
 */
export async function findOrCreateUser(
  supabaseUid: string,
  profile: GoogleProfile
): Promise<DbUser> {
  // Try to find existing user by google_id first
  const { data: existing, error: selectErr } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('google_id', profile.googleId)
    .maybeSingle()

  if (selectErr) {
    console.error('[DB] findOrCreateUser select error:', selectErr)
    throw new AuthError('INTERNAL_ERROR', 500)
  }

  if (existing) {
    // Update name/avatar in case they changed in Google
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('users')
      .update({
        name: profile.name,
        avatar_url: profile.avatarUrl,
        supabase_uid: supabaseUid,
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (updateErr) {
      console.error('[DB] findOrCreateUser update error:', updateErr)
      // Non-fatal: return existing data
      return existing as DbUser
    }
    return updated as DbUser
  }

  // Create new user
  const { data: created, error: insertErr } = await supabaseAdmin
    .from('users')
    .insert({
      supabase_uid: supabaseUid,
      google_id: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatar_url: profile.avatarUrl,
      account_type: 'FREE',
      subscription_status: 'NONE',
      session_version: 1,
    })
    .select('*')
    .single()

  if (insertErr) {
    // Handle race condition: another request created the user
    if (insertErr.code === '23505') {
      const { data: race } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('google_id', profile.googleId)
        .single()
      if (race) return race as DbUser
    }
    console.error('[DB] findOrCreateUser insert error:', insertErr)
    throw new AuthError('INTERNAL_ERROR', 500)
  }

  return created as DbUser
}

/**
 * Fetch a user by their internal ID.
 */
export async function getUserById(userId: string): Promise<DbUser | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[DB] getUserById error:', error)
    return null
  }
  return data as DbUser | null
}

// ---- Devices ---------------------------------------------------------

/**
 * Upsert device record. Creates on first login; updates stats on subsequent logins.
 */
export async function upsertDevice(
  userId: string,
  deviceInfo: DeviceInfo,
  ipHash: string
): Promise<void> {
  const { error } = await supabaseAdmin.rpc('upsert_device', {
    p_user_id: userId,
    p_device_id: deviceInfo.deviceId,
    p_platform: deviceInfo.platform,
    p_user_agent: deviceInfo.userAgent,
    p_ip_hash: ipHash,
  })

  if (error) {
    // RPC not available — use manual upsert
    const { error: upsertErr } = await supabaseAdmin
      .from('devices')
      .upsert(
        {
          user_id: userId,
          device_id: deviceInfo.deviceId,
          platform: deviceInfo.platform,
          user_agent: deviceInfo.userAgent,
          ip_hash: ipHash,
          last_login_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,device_id',
          ignoreDuplicates: false,
        }
      )

    if (upsertErr) {
      console.error('[DB] upsertDevice error:', upsertErr)
      // Non-fatal: continue login even if device tracking fails
    }
  }
}

/**
 * Get all known devices for a user, joined with their latest session status.
 */
export async function getUserDevices(userId: string): Promise<PublicDevice[]> {
  const { data, error } = await supabaseAdmin
    .from('devices')
    .select(`
      device_id,
      platform,
      first_login_at,
      last_login_at,
      login_count
    `)
    .eq('user_id', userId)
    .order('last_login_at', { ascending: false })

  if (error) {
    console.error('[DB] getUserDevices error:', error)
    return []
  }

  // Fetch latest session for each device to get status
  const devices = data as DbDevice[]
  const result: PublicDevice[] = await Promise.all(
    devices.map(async (device) => {
      const { data: sessionData } = await supabaseAdmin
        .from('sessions')
        .select('status, last_activity_at')
        .eq('user_id', userId)
        .eq('device_id', device.device_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return {
        deviceId: device.device_id,
        platform: device.platform,
        firstLoginAt: device.first_login_at,
        lastLoginAt: device.last_login_at,
        loginCount: device.login_count,
        lastActivityAt: sessionData?.last_activity_at ?? null,
        currentSessionStatus: sessionData?.status ?? null,
      }
    })
  )

  return result
}

// ---- Sessions --------------------------------------------------------

/**
 * Revoke the current active session for a user.
 * Called inside a transaction before creating the new session.
 */
export async function revokeActiveSession(
  userId: string,
  reason: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('sessions')
    .update({
      status: 'REVOKED',
      revoked_at: new Date().toISOString(),
      revocation_reason: reason,
    })
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')

  if (error) {
    console.error('[DB] revokeActiveSession error:', error)
    throw new AuthError('INTERNAL_ERROR', 500)
  }
}

/**
 * Create a new ACTIVE session.
 * The partial unique index guarantees only one active session exists per user.
 */
export async function createSession(
  userId: string,
  deviceInfo: DeviceInfo,
  ipHash: string,
  refreshTokenHash: string,
  sessionVersion: number
): Promise<DbSession> {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({
      user_id: userId,
      device_id: deviceInfo.deviceId,
      platform: deviceInfo.platform,
      user_agent: deviceInfo.userAgent,
      ip_hash: ipHash,
      refresh_token_hash: refreshTokenHash,
      session_version: sessionVersion,
      status: 'ACTIVE',
      last_activity_at: new Date().toISOString(),
      expires_at: refreshTokenExpiresAt(),
    })
    .select('*')
    .single()

  if (error) {
    console.error('[DB] createSession error:', error)
    // Unique constraint violation = two concurrent logins race
    if (error.code === '23505') {
      throw new AuthError('INTERNAL_ERROR', 409, 'Session conflict — please retry login')
    }
    throw new AuthError('INTERNAL_ERROR', 500)
  }

  return data as DbSession
}

/**
 * Find a session by its refresh token hash.
 * Used during token refresh. Returns null if not found.
 */
export async function findSessionByRefreshTokenHash(
  tokenHash: string
): Promise<(DbSession & { user: DbUser }) | null> {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select(`*, user:users(*)`)
    .eq('refresh_token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    console.error('[DB] findSessionByRefreshTokenHash error:', error)
    return null
  }

  return data as (DbSession & { user: DbUser }) | null
}

/**
 * Rotate the refresh token: replace the stored hash with a new one.
 * Atomically updates last_activity_at too.
 */
export async function rotateRefreshToken(
  sessionId: string,
  newTokenHash: string
): Promise<DbSession> {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update({
      refresh_token_hash: newTokenHash,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .select('*')
    .single()

  if (error) {
    console.error('[DB] rotateRefreshToken error:', error)
    throw new AuthError('INTERNAL_ERROR', 500)
  }

  return data as DbSession
}

/**
 * Revoke a specific session by ID.
 */
export async function revokeSession(
  sessionId: string,
  reason: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('sessions')
    .update({
      status: 'REVOKED',
      revoked_at: new Date().toISOString(),
      revocation_reason: reason,
    })
    .eq('id', sessionId)

  if (error) {
    console.error('[DB] revokeSession error:', error)
    throw new AuthError('INTERNAL_ERROR', 500)
  }
}

/**
 * Revoke ALL active sessions for a user (logout-all).
 */
export async function revokeAllUserSessions(
  userId: string,
  reason: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('sessions')
    .update({
      status: 'REVOKED',
      revoked_at: new Date().toISOString(),
      revocation_reason: reason,
    })
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')

  if (error) {
    console.error('[DB] revokeAllUserSessions error:', error)
    throw new AuthError('INTERNAL_ERROR', 500)
  }
}

/**
 * Find a session by ID.
 */
export async function findSessionById(sessionId: string): Promise<DbSession | null> {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (error) {
    console.error('[DB] findSessionById error:', error)
    return null
  }
  return data as DbSession | null
}

/**
 * Update session's last_activity_at timestamp.
 * Fire-and-forget — does not throw.
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  await supabaseAdmin
    .from('sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', sessionId)
}

/**
 * Increment session_version for a user, invalidating all existing sessions.
 */
export async function incrementSessionVersion(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('increment_session_version', {
    p_user_id: userId,
  })
  if (error) {
    // Fallback: manual increment
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('session_version')
      .eq('id', userId)
      .single()
    if (user) {
      await supabaseAdmin
        .from('users')
        .update({ session_version: (user.session_version as number) + 1 })
        .eq('id', userId)
    }
  }
}

/**
 * Find an active session for a specific device.
 * Used when revoking a specific device.
 */
export async function findActiveSessionByDevice(
  userId: string,
  deviceId: string
): Promise<DbSession | null> {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (error) {
    console.error('[DB] findActiveSessionByDevice error:', error)
    return null
  }
  return data as DbSession | null
}

// ---- Security Events -------------------------------------------------

interface SecurityEventInput {
  userId?: string | null
  eventType: SecurityEventType
  deviceId?: string | null
  ipHash?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Log a security event. Best-effort: never throws, never blocks.
 */
export async function logSecurityEvent(event: SecurityEventInput): Promise<void> {
  try {
    await supabaseAdmin.from('security_events').insert({
      user_id: event.userId ?? null,
      event_type: event.eventType,
      device_id: event.deviceId ?? null,
      ip_hash: event.ipHash ?? null,
      metadata: event.metadata ?? null,
    })
  } catch (err) {
    // Non-fatal: log to server console but never block the request
    console.error('[DB] logSecurityEvent failed:', err)
  }
}
