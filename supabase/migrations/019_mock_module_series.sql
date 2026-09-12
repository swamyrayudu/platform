-- ============================================================
-- DSC Platform — Migration 019: 100-Module Mock Test Series
-- ============================================================
-- Purpose: scale the Grand Mock system from a handful of ad-hoc
-- seeded tests to N predefined, medium-separated exam modules
-- (Module 01..100 for English + Module 01..100 for Telugu),
-- each with a FIXED 160-question set drawn from the EXISTING
-- Practice question bank.
--
-- This migration is ADDITIVE ONLY. It does not drop, rename or
-- rewrite any Practice table, and it does not duplicate any
-- question content. The Practice section is untouched.
--
-- Contents:
--   1. mock_tests             — add module_number / series / generation metadata
--   2. mock_test_questions    — add question_uid (fixes cross-table ID collision)
--   3. mock_question_usage    — GLOBAL per-medium usage counters (repetition control)
--   4. user_mock_test_progress— per-user module completion state
--   5. mock_generation_reports— coverage/repetition audit per generation run
--   6. is_active flags + selection indexes on the existing question tables
-- ============================================================


-- ============================================================
-- 1. mock_tests — module identity
-- ============================================================
-- Modules are addressed as (series, medium, module_number) instead of
-- ad-hoc slugs, so the module list is driven entirely by data and the
-- module count is NOT bounded by anything in the frontend.

ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS module_number   INTEGER;
ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS series          TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS generated_at    TIMESTAMPTZ;
ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS generation_meta JSONB;

COMMENT ON COLUMN mock_tests.module_number IS
  'Module position within (series, medium). NULL for legacy/one-off tests.';
COMMENT ON COLUMN mock_tests.series IS
  'Groups modules into an ordered series, e.g. grand_mock_v1. Legacy rows keep the default.';

-- One Module N per (series, medium). English Module 01 and Telugu Module 01
-- are independent rows, exactly as required.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mock_tests_series_module
  ON mock_tests (series, medium, module_number)
  WHERE module_number IS NOT NULL;

-- Drives the module list query: medium tab + status + ordered modules.
CREATE INDEX IF NOT EXISTS idx_mock_tests_medium_status_module
  ON mock_tests (medium, status, module_number);

-- Drives the module list query when scoped to a series.
CREATE INDEX IF NOT EXISTS idx_mock_tests_series_medium_status
  ON mock_tests (series, medium, status, module_number);


-- ============================================================
-- 2. mock_test_questions — composite question UID
-- ============================================================
-- PROBLEM THIS FIXES:
--   question_id is only unique WITHIN a source table. In the live data,
--   pedagogy_subject_questions and telugu_medium_math both use the ID
--   space Q000001..Q005000 — 5,000 colliding IDs.
--   A Telugu module draws Pedagogy and Mathematics questions into the same
--   test, so the old UNIQUE(mock_test_id, question_id) constraint could
--   reject a perfectly valid module, and an answer key keyed by bare
--   question_id could grade a Mathematics answer against a Pedagogy key.
--
-- FIX: identify a question by  question_table || ':' || question_id.
--      This is globally unique and is the key used by the mappings,
--      the Redis payload, the answer key and mock_test_answers.

ALTER TABLE mock_test_questions ADD COLUMN IF NOT EXISTS question_uid TEXT;

-- Backfill existing rows
UPDATE mock_test_questions
   SET question_uid = question_table || ':' || question_id
 WHERE question_uid IS NULL;

ALTER TABLE mock_test_questions ALTER COLUMN question_uid SET NOT NULL;

-- Replace the unsafe per-test uniqueness with UID-based uniqueness.
ALTER TABLE mock_test_questions DROP CONSTRAINT IF EXISTS uq_mock_test_question;
ALTER TABLE mock_test_questions DROP CONSTRAINT IF EXISTS uq_mock_test_question_uid;
ALTER TABLE mock_test_questions
  ADD CONSTRAINT uq_mock_test_question_uid UNIQUE (mock_test_id, question_uid);

-- UNIQUE(mock_test_id, question_number) is kept as-is: fixed position per module.

CREATE INDEX IF NOT EXISTS idx_mtq_question_uid ON mock_test_questions (question_uid);


-- ============================================================
-- 3. mock_question_usage — global repetition control
-- ============================================================
-- One row per (question, medium). usage_count = how many modules of that
-- medium have used the question.
--
-- The generator reads this to prefer:
--   1. questions never used   (usage_count = 0)
--   2. then least-used        (lowest usage_count)
--
-- Usage is tracked PER MEDIUM so the English series and the Telugu series
-- each maximise their own coverage independently. Per-module membership is
-- NOT duplicated here — mock_test_questions remains the source of truth.

CREATE TABLE IF NOT EXISTS mock_question_usage (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_uid       TEXT    NOT NULL,        -- 'table:question_id'
  question_id        TEXT    NOT NULL,
  question_table     TEXT    NOT NULL,
  medium             TEXT    NOT NULL,        -- 'english' | 'telugu'
  section_id         TEXT,                    -- last section it was used in
  usage_count        INTEGER NOT NULL DEFAULT 0,
  last_module_number INTEGER,
  last_mock_test_id  UUID REFERENCES mock_tests(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_mock_question_usage UNIQUE (question_uid, medium)
);

-- The generator's hot path: "least-used eligible questions for this medium".
CREATE INDEX IF NOT EXISTS idx_mqu_medium_usage
  ON mock_question_usage (medium, usage_count);

-- Per-section least-used lookup.
CREATE INDEX IF NOT EXISTS idx_mqu_medium_section_usage
  ON mock_question_usage (medium, section_id, usage_count);

CREATE INDEX IF NOT EXISTS idx_mqu_question_uid ON mock_question_usage (question_uid);


-- ============================================================
-- 4. user_mock_test_progress — per-user completion state
-- ============================================================
-- Module definitions are shared by every user; completion state is not.
-- Answers still live in mock_test_answers, keyed by attempt.

CREATE TABLE IF NOT EXISTS user_mock_test_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mock_test_id    UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'not_started',  -- not_started | in_progress | completed
  attempt_id      UUID REFERENCES mock_test_attempts(id) ON DELETE SET NULL,
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  best_score      NUMERIC(6,2),
  best_percentage NUMERIC(5,2),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_user_mock_progress UNIQUE (user_id, mock_test_id)
);

-- Powers the module list badges: one query for all of a user's module states.
CREATE INDEX IF NOT EXISTS idx_umtp_user ON user_mock_test_progress (user_id, status);

CREATE OR REPLACE FUNCTION set_user_mock_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_mock_progress_updated_at ON user_mock_test_progress;
CREATE TRIGGER user_mock_progress_updated_at
  BEFORE UPDATE ON user_mock_test_progress
  FOR EACH ROW EXECUTE FUNCTION set_user_mock_progress_updated_at();


-- ============================================================
-- 5. mock_generation_reports — coverage audit
-- ============================================================
-- Persisted so the coverage / repetition numbers for a generation run can
-- be verified later instead of only being printed to a console.

CREATE TABLE IF NOT EXISTS mock_generation_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series                TEXT    NOT NULL,
  medium                TEXT    NOT NULL,
  blueprint_id          TEXT    NOT NULL,
  modules_generated     INTEGER NOT NULL,
  module_from           INTEGER NOT NULL,
  module_to             INTEGER NOT NULL,
  total_slots           INTEGER NOT NULL,
  unique_questions_used INTEGER NOT NULL,
  repeated_assignments  INTEGER NOT NULL,
  eligible_pool_size    INTEGER NOT NULL,
  coverage_pct          NUMERIC(5,2) NOT NULL,
  per_section           JSONB   NOT NULL DEFAULT '[]'::jsonb,
  warnings              JSONB   NOT NULL DEFAULT '[]'::jsonb,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mgr_series_medium
  ON mock_generation_reports (series, medium, created_at DESC);


-- ============================================================
-- 6. Existing question tables — is_active flag + selection indexes
-- ============================================================
-- ADDITIVE ONLY. Practice reads these tables with SELECT * and maps columns
-- explicitly, so an extra column changes nothing for Practice.
-- The generator uses is_active to exclude retired questions, which satisfies
-- the "active/valid questions only" selection rule.

DO $$
DECLARE
  t TEXT;
  idx_base TEXT;
  question_tables TEXT[] := ARRAY[
    'english_subject_questions',
    'telugu_subject_questions',
    'pedagogy_subject_questions',
    'pedagogy_english_medium',
    'telugu_medium_math',
    'math_english_medium',
    'telugu_medium_science',
    'english_medium_science',
    'socal_telugu_medimum',
    'socal_english_medium',
    'gk_english_medium',
    'gk_telugu_medium',
    'dsc_practice_questions'
  ];
BEGIN
  FOREACH t IN ARRAY question_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = t) THEN

      idx_base := 'idx_' || left(t, 40);

      -- is_active flag (dsc_practice_questions already has one; IF NOT EXISTS covers it)
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true', t);

      -- Generator selection path: active questions bucketed by difficulty / topic
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (is_active, difficulty)',
                     idx_base || '_active_diff', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (is_active, topic)',
                     idx_base || '_active_topic', t);

      -- Batch re-fetch path on cache miss: WHERE question_id IN (...)
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (question_id)',
                     idx_base || '_qid', t);

    END IF;
  END LOOP;
END $$;


-- ============================================================
-- 7. Row Level Security
-- ============================================================

ALTER TABLE mock_question_usage     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mock_test_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_generation_reports ENABLE ROW LEVEL SECURITY;

-- mock_question_usage: written only by the generator (service role). Admin read.
DROP POLICY IF EXISTS "Admins read question usage" ON mock_question_usage;
CREATE POLICY "Admins read question usage"
  ON mock_question_usage FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- user_mock_test_progress: a user sees only their own progress.
DROP POLICY IF EXISTS "Users manage their own module progress" ON user_mock_test_progress;
CREATE POLICY "Users manage their own module progress"
  ON user_mock_test_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all module progress" ON user_mock_test_progress;
CREATE POLICY "Admins read all module progress"
  ON user_mock_test_progress FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- mock_generation_reports: admin-only.
DROP POLICY IF EXISTS "Admins read generation reports" ON mock_generation_reports;
CREATE POLICY "Admins read generation reports"
  ON mock_generation_reports FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));
