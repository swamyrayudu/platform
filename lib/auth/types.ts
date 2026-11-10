// ============================================================
// lib/auth/types.ts — Shared TypeScript types for the auth system
// ============================================================

// ---- Enums / Literals -------------------------------------------

export type Platform = 'WEB' | 'ANDROID' | 'IOS'
export type AccountType = 'FREE' | 'PREMIUM'
export type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED'
export type UserRole = 'user' | 'admin'
export type EducationMedium = 'english' | 'telugu'
export type LearningGoal = 'mock_test' | 'practice' | 'ai_support' | 'other'

export type SecurityEventType =
  | 'GOOGLE_LOGIN'
  | 'PASSWORD_LOGIN'
  | 'PASSWORD_LOGIN_FAILED'
  | 'NEW_DEVICE_LOGIN'
  | 'SESSION_REVOKED'
  | 'MANUAL_LOGOUT'
  | 'LOGOUT_ALL'
  | 'DEVICE_REVOKED'
  | 'REFRESH'
  | 'REFRESH_TOKEN_REUSE_DETECTED'
  | 'PREMIUM_ACCESS_DENIED'
  | 'SESSION_VERSION_MISMATCH'
  | 'ADMIN_ACCESS_DENIED'
  | 'PAYMENT_ORDER_CREATED'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_SIGNATURE_INVALID'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_WEBHOOK_INVALID'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'PAYMENT_RECONCILE_RUN'
  | 'PLAY_PURCHASE_VERIFIED'
  | 'PLAY_PURCHASE_REJECTED'
  | 'PLAY_SUBSCRIPTION_UPDATED'
  | 'PLAY_RTDN_INVALID'
  | 'ADMIN_PRO_GRANTED'

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
  subscription_plan: string | null
  /** Google Play entitlement (migration 20261107120000). Absent before it is applied. */
  play_account_id?: string | null
  play_expires_at?: string | null
  play_plan?: string | null
  role: UserRole
  learning_goals: LearningGoal[]
  education_medium: EducationMedium | null
  onboarding_completed: boolean
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
  /** Hash of the token replaced by the last rotation — used only for reuse detection. */
  previous_refresh_token_hash: string | null
  /** When the refresh token was last rotated. Drives the reuse leeway window. */
  rotated_at: string | null
  /** Admin-made email accounts: one active session per device, not per user. Missing before migration 20261110120000. */
  multi_device?: boolean
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
  subscriptionPlan: string | null
  /** Which system grants the access above: 'web' (Razorpay/admin) or 'google_play'. null when free. */
  subscriptionSource: SubscriptionSource | null
  /** Active Google Play plan key (play_monthly | play_quarterly | play_yearly), even when web access ends later. */
  playPlan: string | null
  role: UserRole
  onboardingCompleted: boolean
  educationMedium?: EducationMedium | null
  /** Study goals picked at onboarding and editable from the profile page. */
  learningGoals: LearningGoal[]
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

// ---- Shared premium rule (web + Google Play) ---------------------

export type SubscriptionSource = 'web' | 'google_play'

/** Columns the premium rule reads. Partial rows from admin queries satisfy it too. */
export type SubscriptionColumns = Pick<DbUser, 'account_type' | 'subscription_status' | 'subscription_expires_at'> &
  Partial<Pick<DbUser, 'subscription_plan' | 'play_expires_at' | 'play_plan'>>

export interface EffectiveSubscription {
  active: boolean
  source: SubscriptionSource | null
  expiresAt: string | null
  plan: string | null
}

function isFuture(value: string | null | undefined, now: number): value is string {
  return !!value && Date.parse(value) > now
}

/**
 * The ONE premium rule. A user is premium when EITHER
 *   - web access (Razorpay purchase or admin grant, users.subscription_*), OR
 *   - Google Play access (users.play_expires_at, kept by upsert_play_subscription)
 * is active. The later of the two decides the reported expiry and plan.
 *
 * Razorpay keeps writing only users.subscription_*; Play writes only play_*.
 * Neither system can shorten or extend the other's time.
 */
export function effectiveSubscription(user: SubscriptionColumns, now = Date.now()): EffectiveSubscription {
  const webActive =
    user.account_type === 'PREMIUM' &&
    user.subscription_status === 'ACTIVE' &&
    isFuture(user.subscription_expires_at, now)
  const playActive = isFuture(user.play_expires_at, now)

  if (playActive && (!webActive || Date.parse(user.play_expires_at!) > Date.parse(user.subscription_expires_at!))) {
    return { active: true, source: 'google_play', expiresAt: user.play_expires_at!, plan: user.play_plan ?? null }
  }
  if (webActive) {
    return { active: true, source: 'web', expiresAt: user.subscription_expires_at, plan: user.subscription_plan ?? null }
  }
  return { active: false, source: null, expiresAt: user.subscription_expires_at, plan: user.subscription_plan ?? null }
}

// ---- Utility: convert DbUser → PublicUser -----------------------

export function toPublicUser(user: DbUser): PublicUser {
  const sub = effectiveSubscription(user)
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    // Effective values, so every existing client check (web PremiumContext,
    // mobile hasActiveSubscription) honours Play access with no change.
    accountType: sub.active ? 'PREMIUM' : user.account_type,
    subscriptionStatus: sub.active ? 'ACTIVE' : user.subscription_status,
    subscriptionExpiresAt: sub.expiresAt,
    subscriptionPlan: sub.plan,
    subscriptionSource: sub.source,
    playPlan: user.play_expires_at && Date.parse(user.play_expires_at) > Date.now() ? user.play_plan ?? null : null,
    role: user.role,
    onboardingCompleted: user.onboarding_completed,
    educationMedium: user.education_medium ?? null,
    learningGoals: user.learning_goals ?? [],
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
