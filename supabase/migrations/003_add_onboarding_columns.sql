-- ============================================================
-- DSC Platform — Migration 003: Add onboarding columns
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Adds onboarding fields to the users table:
--   - learning_goals: TEXT[] array of selected learning goals
--   - education_medium: constrained enum ('english' or 'telugu')
--   - onboarding_completed: boolean flag (default false)
-- ============================================================

-- ---- Enum for education medium ----------------------------------

CREATE TYPE education_medium_type AS ENUM ('english', 'telugu');

-- ---- Add columns ------------------------------------------------

ALTER TABLE users
  ADD COLUMN learning_goals TEXT[] DEFAULT '{}',
  ADD COLUMN education_medium education_medium_type,
  ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- ---- Constraint: learning_goals values must be from allowed set --
-- Allowed values: 'mock_test', 'practice', 'ai_support', 'other'

CREATE OR REPLACE FUNCTION validate_learning_goals()
RETURNS TRIGGER AS $$
DECLARE
  goal TEXT;
  allowed TEXT[] := ARRAY['mock_test', 'practice', 'ai_support', 'other'];
BEGIN
  IF NEW.learning_goals IS NOT NULL THEN
    FOREACH goal IN ARRAY NEW.learning_goals LOOP
      IF goal != ALL(allowed) THEN
        RAISE EXCEPTION 'Invalid learning goal: %. Allowed: mock_test, practice, ai_support, other', goal
          USING ERRCODE = '23514'; -- check_violation
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_users_learning_goals
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_learning_goals();

-- ---- Constraint: onboarding_completed requires both fields ------

ALTER TABLE users
  ADD CONSTRAINT onboarding_fields_complete
  CHECK (
    onboarding_completed = false
    OR (
      onboarding_completed = true
      AND education_medium IS NOT NULL
      AND array_length(learning_goals, 1) > 0
    )
  );

-- ---- Comments ---------------------------------------------------

COMMENT ON COLUMN users.learning_goals IS 'Array of learning goals selected during onboarding. Allowed: mock_test, practice, ai_support, other.';
COMMENT ON COLUMN users.education_medium IS 'Education medium: english or telugu. Selected during onboarding.';
COMMENT ON COLUMN users.onboarding_completed IS 'Whether the user has completed the mandatory first-time onboarding flow.';
