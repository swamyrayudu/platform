-- ============================================================
-- DSC Platform — Auth Schema Migration 001
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE account_type AS ENUM ('FREE', 'PREMIUM');
CREATE TYPE subscription_status AS ENUM ('NONE', 'ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE platform_type AS ENUM ('WEB', 'ANDROID', 'IOS');
CREATE TYPE session_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- ============================================================
-- USERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid           UUID UNIQUE NOT NULL,
  google_id              TEXT UNIQUE NOT NULL,
  email                  TEXT UNIQUE NOT NULL,
  name                   TEXT,
  avatar_url             TEXT,
  account_type           account_type NOT NULL DEFAULT 'FREE',
  subscription_status    subscription_status NOT NULL DEFAULT 'NONE',
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  -- session_version: increment to instantly invalidate ALL sessions for this user
  session_version        INTEGER NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- DEVICES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS devices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id        TEXT NOT NULL,               -- client-generated persistent identifier
  platform         platform_type NOT NULL,
  user_agent       TEXT,
  ip_hash          TEXT,                         -- HMAC-SHA256(ip, IP_HASH_SECRET)
  first_login_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  login_count      INTEGER NOT NULL DEFAULT 1,
  -- One record per user+device pair
  CONSTRAINT devices_user_device_unique UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices(user_id);

-- ============================================================
-- SESSIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id            TEXT NOT NULL,
  platform             platform_type NOT NULL,
  ip_hash              TEXT,                     -- HMAC-SHA256(ip, IP_HASH_SECRET) at login time
  user_agent           TEXT,
  refresh_token_hash   TEXT NOT NULL,            -- HMAC-SHA256 of opaque refresh token
  -- session_version snapshot — must match users.session_version to be valid
  session_version      INTEGER NOT NULL DEFAULT 1,
  status               session_status NOT NULL DEFAULT 'ACTIVE',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at           TIMESTAMPTZ NOT NULL,
  revoked_at           TIMESTAMPTZ,
  revocation_reason    TEXT                      -- e.g. NEW_DEVICE_LOGIN, MANUAL_LOGOUT, etc.
);

-- Fast lookup for finding active session by user
CREATE INDEX IF NOT EXISTS sessions_user_status_idx ON sessions(user_id, status);

-- Fast lookup by refresh token hash on every token refresh
CREATE INDEX IF NOT EXISTS sessions_refresh_token_hash_idx ON sessions(refresh_token_hash);

-- ============================================================
-- CRITICAL: Partial unique index — ONE active session per user
-- This is enforced at the DATABASE level, not just application level.
-- Two concurrent logins will serialize here; the second insert wins.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_per_user
  ON sessions(user_id)
  WHERE status = 'ACTIVE';

-- ============================================================
-- SECURITY EVENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS security_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,  -- nullable for pre-auth events
  event_type  TEXT NOT NULL,
  device_id   TEXT,
  ip_hash     TEXT,
  metadata    JSONB,            -- non-sensitive context only (no tokens, no raw IPs)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_user_id_idx ON security_events(user_id);
CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON security_events(event_type);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Allow full access for service_role and backend operations
CREATE POLICY "Allow full access for service role on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for service role on devices" ON devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for service role on sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access for service role on security_events" ON security_events FOR ALL USING (true) WITH CHECK (true);

-- Upsert Device RPC function helper
CREATE OR REPLACE FUNCTION upsert_device(
  p_user_id UUID,
  p_device_id TEXT,
  p_platform platform_type,
  p_user_agent TEXT,
  p_ip_hash TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO devices (user_id, device_id, platform, user_agent, ip_hash, first_login_at, last_login_at, login_count)
  VALUES (p_user_id, p_device_id, p_platform, p_user_agent, p_ip_hash, now(), now(), 1)
  ON CONFLICT (user_id, device_id)
  DO UPDATE SET
    last_login_at = now(),
    login_count = devices.login_count + 1,
    user_agent = COALESCE(EXCLUDED.user_agent, devices.user_agent),
    ip_hash = COALESCE(EXCLUDED.ip_hash, devices.ip_hash);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE users IS 'DSC Platform user accounts. One record per Google identity.';
COMMENT ON COLUMN users.session_version IS 'Increment to invalidate all sessions for this user globally. Stored in JWT (sv claim) and checked on every request.';
COMMENT ON TABLE sessions IS 'Auth sessions. Enforces one-active-session-per-user via partial unique index.';
COMMENT ON COLUMN sessions.refresh_token_hash IS 'HMAC-SHA256 of opaque refresh token. Raw token is never stored.';
COMMENT ON COLUMN sessions.session_version IS 'Snapshot of users.session_version at session creation. If user.session_version changes, this session is invalidated.';
COMMENT ON TABLE security_events IS 'Append-only audit log of significant auth events.';
COMMENT ON TABLE devices IS 'Known devices per user. device_id is client-generated and persistent.';
