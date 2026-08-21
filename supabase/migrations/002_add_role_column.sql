-- ============================================================
-- DSC Platform — Migration 002: Add role column
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Adds a role column to the users table with:
--   - Default value 'user' for all new and existing rows
--   - Database trigger to prevent role escalation
--   - Only service_role can modify the role column
-- ============================================================

-- ---- Enum -------------------------------------------------------

CREATE TYPE user_role AS ENUM ('user', 'admin');

-- ---- Add column -------------------------------------------------

ALTER TABLE users
  ADD COLUMN role user_role NOT NULL DEFAULT 'user';

-- ---- Security: Trigger to block role changes --------------------
-- Only the service_role (supabaseAdmin) can update the role column.
-- Any attempt to change role from a non-service-role session is blocked.

CREATE OR REPLACE FUNCTION protect_role_column()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow if role is not being changed
  IF NEW.role = OLD.role THEN
    RETURN NEW;
  END IF;

  -- Allow if the current session is service_role
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block all other attempts to change role
  RAISE EXCEPTION 'Changing user role is not permitted'
    USING ERRCODE = '42501'; -- insufficient_privilege
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_users_role
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION protect_role_column();

-- ---- Comment ----------------------------------------------------

COMMENT ON COLUMN users.role IS 'User role: "user" (default) or "admin". Can only be changed via service_role (supabaseAdmin). Protected by database trigger.';
