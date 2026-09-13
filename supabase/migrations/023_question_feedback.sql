-- ============================================================
-- 023_question_feedback.sql — Candidate reports on question quality
-- ============================================================
-- Two tables, because a question and a report are different things:
--
--   question_feedback          one row per QUESTION. Holds the question
--                              snapshot once, plus a running report_count and
--                              a per-reason breakdown. This is what the admin
--                              queue lists.
--
--   question_feedback_reports  one row per REPORTER. Tiny: who, which reason,
--                              optional detail. Carries no question text.
--
-- The alternative — one fat row per report — stores the whole question again
-- for every candidate who flags it. Fifty reports on one bad answer key meant
-- fifty copies of that question, and an admin queue that showed the same
-- question fifty times.
--
-- report_count is maintained by trigger rather than by the application, so it
-- stays correct when two candidates report the same question at once.
--
-- IDENTITY: questions live in one table per subject+medium, and question_id is
-- only unique WITHIN a table (pedagogy_subject_questions and telugu_medium_math
-- share the Q000001..Q005000 id space). So everything keys on the same
-- `table:question_id` uid the mock bank uses. It is deliberately not a foreign
-- key: it points into one of twelve tables, which Postgres cannot express as a
-- single reference. The application allowlists the table name
-- (lib/questions/tables.ts) before any query is built.
-- ============================================================

-- This migration has not shipped to an environment holding data. If an earlier
-- draft of 023 was applied, this replaces it.
DROP TABLE IF EXISTS question_feedback_reports CASCADE;
DROP TABLE IF EXISTS question_feedback CASCADE;

-- ---- One row per question ---------------------------------------

CREATE TABLE question_feedback (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- uid = question_table || ':' || question_id
  question_uid       TEXT NOT NULL UNIQUE,
  question_table     TEXT NOT NULL,
  question_id        TEXT NOT NULL,

  -- The question as the first reporter saw it. Stored once, and kept even if
  -- an admin later edits the question — otherwise the report would no longer
  -- describe anything that exists.
  reported_question  TEXT,

  -- Maintained by trigger from question_feedback_reports.
  report_count       INTEGER NOT NULL DEFAULT 0,
  reason_counts      JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Moderation, at the question level
  status             TEXT NOT NULL DEFAULT 'open',
  admin_note         TEXT,
  resolved_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at        TIMESTAMPTZ,

  first_reported_at  TIMESTAMPTZ,
  last_reported_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_qf_status CHECK (status IN ('open', 'resolved', 'dismissed'))
);

-- Queue ordering: most-reported first within a status is the useful triage.
CREATE INDEX idx_qf_status_count ON question_feedback (status, report_count DESC, last_reported_at DESC);
CREATE INDEX idx_qf_last_reported ON question_feedback (last_reported_at DESC);

-- ---- One row per reporter ---------------------------------------

CREATE TABLE question_feedback_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id   UUID NOT NULL REFERENCES question_feedback(id) ON DELETE CASCADE,

  -- Denormalised so a report can be found without joining the parent.
  question_uid  TEXT NOT NULL,

  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  details       TEXT,
  source        TEXT NOT NULL DEFAULT 'unknown',
  mock_test_id  UUID REFERENCES mock_tests(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_qfr_reason CHECK (
    reason IN (
      'wrong_answer',
      'wrong_question',
      'wrong_option',
      'wrong_explanation',
      'typo',
      'duplicate',
      'other'
    )
  ),
  CONSTRAINT chk_qfr_details_len CHECK (details IS NULL OR char_length(details) <= 1000),

  -- One report per candidate per question. This is what keeps report_count an
  -- honest count of distinct people rather than of button presses.
  CONSTRAINT uq_qfr_user_question UNIQUE (user_id, question_uid)
);

CREATE INDEX idx_qfr_feedback ON question_feedback_reports (feedback_id, created_at DESC);
CREATE INDEX idx_qfr_user ON question_feedback_reports (user_id, created_at DESC);

-- ---- Rollup trigger ---------------------------------------------

CREATE OR REPLACE FUNCTION question_feedback_rollup()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE question_feedback f
       SET report_count      = f.report_count + 1,
           reason_counts     = jsonb_set(
                                 f.reason_counts,
                                 ARRAY[NEW.reason],
                                 to_jsonb(COALESCE((f.reason_counts ->> NEW.reason)::int, 0) + 1),
                                 true
                               ),
           first_reported_at = LEAST(COALESCE(f.first_reported_at, NEW.created_at), NEW.created_at),
           last_reported_at  = NEW.created_at,
           -- A fresh report on something already closed means the fix did not
           -- land, or the question regressed. Put it back in the queue.
           status            = 'open',
           resolved_by       = NULL,
           resolved_at       = NULL,
           updated_at        = NOW()
     WHERE f.id = NEW.feedback_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE question_feedback f
       SET report_count = GREATEST(0, f.report_count - 1),
           reason_counts = jsonb_set(
                             f.reason_counts,
                             ARRAY[OLD.reason],
                             to_jsonb(GREATEST(0, COALESCE((f.reason_counts ->> OLD.reason)::int, 0) - 1)),
                             true
                           ),
           updated_at = NOW()
     WHERE f.id = OLD.feedback_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_qfr_rollup
  AFTER INSERT OR DELETE ON question_feedback_reports
  FOR EACH ROW EXECUTE FUNCTION question_feedback_rollup();

-- ---- updated_at on the parent -----------------------------------

CREATE OR REPLACE FUNCTION touch_question_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_qf_updated_at
  BEFORE UPDATE ON question_feedback
  FOR EACH ROW EXECUTE FUNCTION touch_question_feedback_updated_at();

-- ---- Row level security -----------------------------------------
-- Every route reaches these tables through the service role, which bypasses
-- RLS. These policies exist so a leaked anon key cannot read the queue.

ALTER TABLE question_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reports"
  ON question_feedback_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all reports"
  ON question_feedback_reports
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));

CREATE POLICY "Admins read the feedback queue"
  ON question_feedback
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));
