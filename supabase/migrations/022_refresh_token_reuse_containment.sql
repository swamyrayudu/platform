-- ============================================================
-- DSC Platform — Migration 022: Refresh-token reuse containment
-- ============================================================
-- THE GAP
--   Rotation overwrites sessions.refresh_token_hash with no history. So when a
--   stolen token is used and then the victim presents their now-stale token,
--   the lookup finds NOTHING: the event is logged with userId = null and the
--   session is left ACTIVE. Detection happened, containment did not — the
--   attacker keeps rotating indefinitely while the victim just sees a logout.
--
-- THE FIX
--   1. Keep ONE generation of history (previous_refresh_token_hash) so a
--      rotated-away token still resolves to its session, and therefore to a
--      user that can be acted upon.
--   2. Provide increment_session_version(), which lib/auth/db.ts already calls
--      but which did not exist in this database (it was silently falling back
--      to a read-then-write). Bumping session_version invalidates every access
--      token for that user, because validateSession compares the token's `sv`
--      against users.session_version on every request.
--
--   Storing only the previous hash is deliberate: it is enough to attribute a
--   reuse to its session, without accumulating a long-lived table of token
--   hashes. Hashes are HMAC-SHA256, never raw tokens.
-- ============================================================


-- ============================================================
-- 1. One generation of rotation history
-- ============================================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS previous_refresh_token_hash TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

COMMENT ON COLUMN sessions.previous_refresh_token_hash IS
  'Hash of the refresh token replaced by the most recent rotation. Used ONLY to attribute a reuse attempt to its session so the session family can be revoked.';

-- Reuse detection looks the presented hash up here after the primary lookup
-- misses, so it needs to be indexed.
CREATE INDEX IF NOT EXISTS idx_sessions_previous_refresh_hash
  ON sessions (previous_refresh_token_hash)
  WHERE previous_refresh_token_hash IS NOT NULL;

REVOKE ALL ON sessions FROM anon, authenticated;


-- ============================================================
-- 2. increment_session_version — referenced by code, never created
-- ============================================================
-- lib/auth/db.ts calls supabaseAdmin.rpc('increment_session_version'). The
-- function did not exist, so every call fell through to the error branch.
-- An atomic increment also avoids the read-then-write race in that fallback.

CREATE OR REPLACE FUNCTION increment_session_version(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_new INTEGER;
BEGIN
  UPDATE users
     SET session_version = COALESCE(session_version, 0) + 1
   WHERE id = p_user_id
  RETURNING session_version INTO v_new;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id USING ERRCODE = 'P0002';
  END IF;

  RETURN v_new;
END;
$$ LANGUAGE plpgsql;

-- Never reachable from the public API; the backend calls it as service_role.
REVOKE ALL ON FUNCTION increment_session_version(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_session_version(UUID) TO service_role;


-- ============================================================
-- 3. Verification
-- ============================================================
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='sessions' AND column_name IN
--          ('previous_refresh_token_hash','rotated_at');   -- expect 2 rows
--
--   SELECT has_function_privilege('anon',        'increment_session_version(uuid)','EXECUTE'),
--          has_function_privilege('service_role','increment_session_version(uuid)','EXECUTE');
--   -- expect false, true
