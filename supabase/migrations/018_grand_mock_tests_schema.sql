-- ============================================================
-- DSC Platform — Migration 018: Grand Mock Test System
-- ============================================================
-- Adds:
--   1. mock_tests           — Test definitions & metadata
--   2. mock_test_questions  — Fixed 160-question mappings (shared)
--   3. mock_test_attempts   — Per-user attempt records
--   4. mock_test_answers    — Per-user, per-question answers
--   5. question_usage       — Tracks which users have seen which questions
--                             (used by Practice Mock to avoid repetition)
--
-- DESIGN PRINCIPLES:
--   • Questions are NEVER duplicated — content stays in existing tables
--   • mock_test_questions stores only relational mappings
--   • UNIQUE constraints guarantee fixed, non-repeating question order
--   • Answers are isolated per attempt — users share test definition only
--   • Correct answers are stored in attempt_answers only after submission
-- ============================================================

-- ============================
-- 1. mock_tests
-- ============================
CREATE TABLE IF NOT EXISTS mock_tests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT UNIQUE NOT NULL,           -- e.g. 'dsc-grand-01'
  title               TEXT NOT NULL,
  description         TEXT,
  category            TEXT NOT NULL DEFAULT 'grand_mock',
                                                      -- 'grand_mock' | 'practice_mock' | 'previous_paper' | 'subject_mock'
  medium              TEXT NOT NULL DEFAULT 'bilingual',
                                                      -- 'telugu' | 'english' | 'bilingual'
  duration_minutes    INTEGER NOT NULL DEFAULT 150,
  total_questions     INTEGER NOT NULL DEFAULT 160,
  total_marks         NUMERIC(6,2) NOT NULL DEFAULT 80.00,
  marks_per_question  NUMERIC(4,2) NOT NULL DEFAULT 0.50,
  negative_marks      NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  version             INTEGER NOT NULL DEFAULT 1,
  status              TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published' | 'archived'
  blueprint_id        TEXT NOT NULL DEFAULT 'ap_dsc_sgt_official',
  blueprint_snapshot  JSONB,                          -- Snapshot of blueprint at publish time
  is_free             BOOLEAN NOT NULL DEFAULT false,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_mock_tests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mock_tests_updated_at
  BEFORE UPDATE ON mock_tests
  FOR EACH ROW EXECUTE FUNCTION set_mock_tests_updated_at();

-- Indexes for mock_tests
CREATE INDEX IF NOT EXISTS idx_mock_tests_status ON mock_tests(status);
CREATE INDEX IF NOT EXISTS idx_mock_tests_category ON mock_tests(category, status);

-- ============================
-- 2. mock_test_questions
-- ============================
-- PURPOSE: Stores the FIXED ordered mapping of questions for each mock test.
-- This is the cornerstone of the "fixed grand mock" architecture.
--
-- KEY DESIGN:
--   • question_id references the custom text ID in any subject question table
--   • question_table tells the backend which table to JOIN against
--   • UNIQUE(mock_test_id, question_number) — no two questions can occupy same slot
--   • UNIQUE(mock_test_id, question_id) — same question cannot appear twice in one test
--
-- INDEX idx_mtq_lookup:
--   Used for the primary query: "give me questions Q1..Q50 for mock test X"
--   → Supports chunked delivery without N+1 queries
--   → The ORDER BY question_number + range filter maps directly to this index

CREATE TABLE IF NOT EXISTS mock_test_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_test_id    UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  question_id     TEXT NOT NULL,                      -- References question_id in source table
  question_table  TEXT NOT NULL,                      -- e.g. 'english_subject_questions'
  question_number INTEGER NOT NULL,                   -- 1..160 sequential position
  section_id      TEXT NOT NULL,                      -- e.g. 'gk', 'telugu', 'mathematics'
  section_name    TEXT NOT NULL,                      -- Display name e.g. 'GK & Current Affairs'
  marks           NUMERIC(4,2) NOT NULL DEFAULT 0.50,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- No duplicate question slots in same mock
  CONSTRAINT uq_mock_test_q_number UNIQUE (mock_test_id, question_number),
  -- No same question twice in same mock
  CONSTRAINT uq_mock_test_question UNIQUE (mock_test_id, question_id)
);

-- PRIMARY PERFORMANCE INDEX:
-- Enables single SQL query: SELECT Q1..Q160 ordered by question_number
-- Also serves chunk range queries: WHERE question_number BETWEEN 1 AND 50
-- Eliminates N+1: we never query individual questions — always batch JOINs
CREATE INDEX IF NOT EXISTS idx_mtq_lookup ON mock_test_questions(mock_test_id, question_number);

-- Supports section-level stats and section-filtered navigation
CREATE INDEX IF NOT EXISTS idx_mtq_section ON mock_test_questions(mock_test_id, section_id);

-- Supports JOIN lookups when rebuilding cache from DB
CREATE INDEX IF NOT EXISTS idx_mtq_question_id ON mock_test_questions(question_id);

-- ============================
-- 3. mock_test_attempts
-- ============================
-- Each user who takes a Grand Mock gets their own attempt row.
-- Attempts reference the shared mock_tests definition — questions are NOT duplicated.
--
-- STATUS LIFECYCLE:
--   in_progress → submitted (normal completion)
--   in_progress → expired   (timer ran out)
--   in_progress → abandoned (user left without submitting)
--
-- test_version: Pinned at attempt start so question changes don't affect active tests.

CREATE TABLE IF NOT EXISTS mock_test_attempts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mock_test_id      UUID NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  test_version      INTEGER NOT NULL DEFAULT 1,       -- Pinned at start — immutable
  status            TEXT NOT NULL DEFAULT 'in_progress',
  duration_seconds  INTEGER NOT NULL DEFAULT 9000,    -- From test definition at start
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  score             NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  total_marks       NUMERIC(6,2) NOT NULL DEFAULT 80.00,
  percentage        NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  total_questions   INTEGER NOT NULL DEFAULT 160,
  correct_count     INTEGER NOT NULL DEFAULT 0,
  incorrect_count   INTEGER NOT NULL DEFAULT 0,
  unanswered_count  INTEGER NOT NULL DEFAULT 160,
  section_scores    JSONB NOT NULL DEFAULT '{}'::jsonb,  -- Per-section breakdown
  rank              INTEGER,
  percentile        NUMERIC(5,2),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_mock_test_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mock_test_attempts_updated_at
  BEFORE UPDATE ON mock_test_attempts
  FOR EACH ROW EXECUTE FUNCTION set_mock_test_attempts_updated_at();

-- User's own attempt history (most recent first)
CREATE INDEX IF NOT EXISTS idx_mta_user_history ON mock_test_attempts(user_id, started_at DESC);

-- Leaderboard: rank submitted attempts by score (desc) then time_spent (asc)
-- Partial index on status = 'submitted' eliminates in-progress rows from leaderboard scans
CREATE INDEX IF NOT EXISTS idx_mta_leaderboard
  ON mock_test_attempts(mock_test_id, score DESC, time_spent_seconds ASC)
  WHERE status = 'submitted';

-- ============================
-- 4. mock_test_answers
-- ============================
-- Each row is one user's answer to one question in one attempt.
-- is_correct is NULL until exam is submitted (server-side grading only).
-- Correct answers are NEVER stored here until after submission.
--
-- UNIQUE(attempt_id, question_id): prevents duplicate answer rows per question

CREATE TABLE IF NOT EXISTS mock_test_answers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       UUID NOT NULL REFERENCES mock_test_attempts(id) ON DELETE CASCADE,
  question_id      TEXT NOT NULL,
  question_number  INTEGER NOT NULL,
  selected_option  TEXT,                             -- 'A' | 'B' | 'C' | 'D' | NULL = skipped
  marked_for_review BOOLEAN NOT NULL DEFAULT false,
  is_correct       BOOLEAN,                          -- NULL while in_progress, set on submit
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  answered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);

-- Fast retrieval of all answers for an attempt (used on resume and submit)
CREATE INDEX IF NOT EXISTS idx_mtans_attempt ON mock_test_answers(attempt_id);

-- ============================
-- 5. question_usage
-- ============================
-- Tracks which users have seen which questions (used in Practice Mock generation
-- to prefer questions the user hasn't encountered in grand mocks or practice).
-- NOT used for fixed Grand Mocks — their questions are always identical for all users.

CREATE TABLE IF NOT EXISTS question_usage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id  TEXT NOT NULL,
  mock_test_id UUID REFERENCES mock_tests(id) ON DELETE SET NULL,
  seen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_user_question_usage UNIQUE (user_id, question_id, mock_test_id)
);

CREATE INDEX IF NOT EXISTS idx_qu_user_question ON question_usage(user_id, question_id);

-- ============================
-- 6. Row Level Security
-- ============================

ALTER TABLE mock_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_usage ENABLE ROW LEVEL SECURITY;

-- mock_tests: public can read published tests; admin manages all
CREATE POLICY "Public can read published mock tests"
  ON mock_tests FOR SELECT
  USING (status = 'published');

CREATE POLICY "Admins manage all mock tests"
  ON mock_tests FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- mock_test_questions: public read (client-safe payload has no correct answers)
CREATE POLICY "Public can read mock test questions"
  ON mock_test_questions FOR SELECT USING (true);

CREATE POLICY "Admins manage mock test questions"
  ON mock_test_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- mock_test_attempts: users manage their own attempts only
CREATE POLICY "Users manage their own attempts"
  ON mock_test_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all attempts"
  ON mock_test_attempts FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

-- mock_test_answers: users manage their own answers only
CREATE POLICY "Users manage their own answers"
  ON mock_test_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mock_test_attempts a
      WHERE a.id = attempt_id AND a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mock_test_attempts a
      WHERE a.id = attempt_id AND a.user_id = auth.uid()
    )
  );

-- question_usage: users manage their own usage records
CREATE POLICY "Users manage their own question usage"
  ON question_usage FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
