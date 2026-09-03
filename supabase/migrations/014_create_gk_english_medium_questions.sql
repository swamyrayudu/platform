-- ============================================================
-- DSC Platform — Migration 014: General Knowledge English Medium Questions Table
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

CREATE TABLE IF NOT EXISTS gk_english_medium (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                                            -- Custom identifier from CSV (e.g., GK_EM_001)
  class_level      TEXT,                                                   -- e.g., 'SGT', 'School Assistant', 'General'
  subject          TEXT NOT NULL DEFAULT 'General Knowledge & Current Affairs', -- e.g., 'General Knowledge & Current Affairs'
  chapter          TEXT,                                                   -- e.g., 'Current Affairs', 'Indian History', 'Geography', 'Indian Polity', 'Awards & Honors'
  topic            TEXT,                                                   -- e.g., 'National Events', 'AP State Schemes', 'Science & Tech', 'Sports & Games'
  subtopic         TEXT,                                                   -- e.g., 'Nobel Prizes 2025', 'ISRO Missions', 'Constitutional Amendments'
  difficulty       TEXT DEFAULT 'Medium',                                  -- e.g., 'Easy', 'Medium', 'Hard'
  question_type    TEXT DEFAULT 'MCQ',                                     -- e.g., 'MCQ', 'Multiple Choice'
  question         TEXT NOT NULL,                                          -- Question statement in English
  option_a         TEXT NOT NULL,                                          -- Option A
  option_b         TEXT NOT NULL,                                          -- Option B
  option_c         TEXT NOT NULL,                                          -- Option C
  option_d         TEXT NOT NULL,                                          -- Option D
  correct_answer   TEXT NOT NULL,                                          -- 'A', 'B', 'C', 'D' or option text
  explanation      TEXT,                                                   -- Detailed conceptual explanation in English
  source_type      TEXT DEFAULT 'SCERT',                                   -- e.g., 'SCERT', 'Previous Papers', 'Standard GK'
  language         TEXT DEFAULT 'english',                                 -- e.g., 'english', 'en'
  tags             TEXT,                                                   -- Comma-separated tags (e.g. 'gk,current_affairs,history')
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at timestamp ---------------------------

CREATE OR REPLACE FUNCTION set_gk_english_medium_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gk_english_medium_updated_at ON gk_english_medium;
CREATE TRIGGER trg_gk_english_medium_updated_at
  BEFORE UPDATE ON gk_english_medium
  FOR EACH ROW
  EXECUTE FUNCTION set_gk_english_medium_updated_at();

-- ---- Indexes for Fast Filtering & Practice Engine ---------------

CREATE INDEX IF NOT EXISTS idx_gk_em_q_class_level ON gk_english_medium(class_level);
CREATE INDEX IF NOT EXISTS idx_gk_em_q_chapter ON gk_english_medium(chapter);
CREATE INDEX IF NOT EXISTS idx_gk_em_q_topic ON gk_english_medium(topic);
CREATE INDEX IF NOT EXISTS idx_gk_em_q_difficulty ON gk_english_medium(difficulty);
CREATE INDEX IF NOT EXISTS idx_gk_em_q_question_type ON gk_english_medium(question_type);
CREATE INDEX IF NOT EXISTS idx_gk_em_q_source_type ON gk_english_medium(source_type);
CREATE INDEX IF NOT EXISTS idx_gk_em_q_language ON gk_english_medium(language);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE gk_english_medium ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (for taking exams/practice)
DROP POLICY IF EXISTS "Allow public read access to gk_english_medium" ON gk_english_medium;
CREATE POLICY "Allow public read access to gk_english_medium"
  ON gk_english_medium
  FOR SELECT
  USING (true);

-- Allow insert/update/delete only for service_role (Admin / CSV import backend)
DROP POLICY IF EXISTS "Allow service_role full management on gk_english_medium" ON gk_english_medium;
CREATE POLICY "Allow service_role full management on gk_english_medium"
  ON gk_english_medium
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE gk_english_medium IS 'Question repository for DSC General Knowledge & Current Affairs English Medium containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON COLUMN gk_english_medium.question_id IS 'Unique identifier from CSV imports (e.g. GK_EM_001)';
COMMENT ON COLUMN gk_english_medium.correct_answer IS 'Indicates the correct choice (A, B, C, D or exact text matching an option)';
