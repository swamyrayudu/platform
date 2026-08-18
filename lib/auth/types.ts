// ============================================================
// lib/auth/types.ts — Shared TypeScript types for the auth system
// ============================================================

// ---- Enums / Literals -------------------------------------------

export type Platform = 'WEB' | 'ANDROID' | 'IOS'
export type AccountType = 'FREE' | 'PREMIUM'
export type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED'

export type SecurityEventType =
  | 'GOOGLE_LOGIN'
  | 'NEW_DEVICE_LOGIN'
  | 'SESSION_REVOKED'
  | 'MANUAL_LOGOUT'
  | 'LOGOUT_ALL'
  | 'DEVICE_REVOKED'
  | 'REFRESH'
  | 'REFRESH_TOKEN_REUSE_DETECTED'
  | 'PREMIUM_ACCESS_DENIED'
  | 'SESSION_VERSION_MISMATCH'

// ---- Database row shapes ----------------------------------------

export interface DbUser {
  id: string
  supabase_uid: string
  google_id: string
  email: string
  name: string | null
  avatar_url: string | null
  account_type: AccountType
  subscription_status: SubscriptionStatus
  subscription_started_at: string | null
  subscription_expires_at: string | null
  session_version: number
  created_at: string
  updated_at: string
}

export interface DbSession {
  id: string
  user_id: string
  device_id: string
  platform: Platform
  ip_hash: string | null
  user_agent: string | null
  refresh_token_hash: string
  session_version: number
  status: SessionStatus
  created_at: string
  last_activity_at: string
  expires_at: string
  revoked_at: string | null
  revocation_reason: string | null
}

export interface DbDevice {
  id: string
  user_id: string
  device_id: string
  platform: Platform
  user_agent: string | null
  ip_hash: string | null
  first_login_at: string
  last_login_at: string
  login_count: number
}

export interface DbSecurityEvent {
  id: string
  user_id: string | null
  event_type: SecurityEventType
  device_id: string | null
  ip_hash: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ---- Input shapes -----------------------------------------------

export interface GoogleProfile {
  googleId: string
  email: string
  name: string | null
  avatarUrl: string | null
}

export interface DeviceInfo {
  deviceId: string
  platform: Platform
  userAgent: string
}

// ---- Token shapes -----------------------------------------------

export interface AccessTokenPayload {
  /** user id */
  sub: string
  /** session id */
  sid: string
  /** session_version snapshot */
  sv: number
  iat: number
  exp: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

// ---- API response shapes (public — no sensitive fields) ---------

export interface PublicUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  accountType: AccountType
  subscriptionStatus: SubscriptionStatus
  subscriptionExpiresAt: string | null
}

export interface PublicSession {
  id: string
  platform: Platform
  deviceId: string
  status: SessionStatus
  createdAt: string
  lastActivityAt: string
  expiresAt: string
}

export interface PublicDevice {
  deviceId: string
  platform: Platform
  firstLoginAt: string
  lastLoginAt: string
  loginCount: number
  lastActivityAt: string | null
  currentSessionStatus: SessionStatus | null
}

// ---- Middleware context ------------------------------------------

export interface AuthContext {
  user: DbUser
  session: DbSession
}

// ---- Utility: convert DbUser → PublicUser -----------------------

export function toPublicUser(user: DbUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    accountType: user.account_type,
    subscriptionStatus: user.subscription_status,
    subscriptionExpiresAt: user.subscription_expires_at,
  }
}

export function toPublicSession(session: DbSession): PublicSession {
  return {
    id: session.id,
    platform: session.platform,
    deviceId: session.device_id,
    status: session.status,
    createdAt: session.created_at,
    lastActivityAt: session.last_activity_at,
    expiresAt: session.expires_at,
  }
}
