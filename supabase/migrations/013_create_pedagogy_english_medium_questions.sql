-- ============================================================
-- DSC Platform — Migration 013: Pedagogy English Medium Questions Table
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

CREATE TABLE IF NOT EXISTS pedagogy_english_medium (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                              -- Custom identifier from CSV (e.g., PED_EM_001)
  class_level      TEXT,                                     -- e.g., 'Class 1-5', 'Class 6-8', 'SGT', 'School Assistant'
  subject          TEXT NOT NULL DEFAULT 'Pedagogy',         -- e.g., 'Pedagogy', 'Educational Psychology'
  chapter          TEXT,                                     -- e.g., 'Child Development', 'Learning Theories', 'Pedagogical Concerns', 'ICT'
  topic            TEXT,                                     -- e.g., 'Piaget Cognitive Stages', 'Vygotsky Scaffolding', 'Inclusive Education'
  subtopic         TEXT,                                     -- e.g., 'Schema & Assimilation', 'Zone of Proximal Development', 'RTE Act 2009'
  difficulty       TEXT DEFAULT 'Medium',                    -- e.g., 'Easy', 'Medium', 'Hard'
  question_type    TEXT DEFAULT 'MCQ',                       -- e.g., 'MCQ', 'Multiple Choice'
  question         TEXT NOT NULL,                            -- Question statement in English
  option_a         TEXT NOT NULL,                            -- Option A
  option_b         TEXT NOT NULL,                            -- Option B
  option_c         TEXT NOT NULL,                            -- Option C
  option_d         TEXT NOT NULL,                            -- Option D
  correct_answer   TEXT NOT NULL,                            -- 'A', 'B', 'C', 'D' or option text
  explanation      TEXT,                                     -- Detailed conceptual explanation in English
  source_type      TEXT DEFAULT 'SCERT',                     -- e.g., 'SCERT', 'Previous Papers', 'Model Test'
  language         TEXT DEFAULT 'english',                   -- e.g., 'english', 'en'
  tags             TEXT,                                     -- Comma-separated tags (e.g. 'pedagogy,cdp,psychology')
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at timestamp ---------------------------

CREATE OR REPLACE FUNCTION set_pedagogy_english_medium_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedagogy_english_medium_updated_at ON pedagogy_english_medium;
CREATE TRIGGER trg_pedagogy_english_medium_updated_at
  BEFORE UPDATE ON pedagogy_english_medium
  FOR EACH ROW
  EXECUTE FUNCTION set_pedagogy_english_medium_updated_at();

-- ---- Indexes for Fast Filtering & Practice Engine ---------------

CREATE INDEX IF NOT EXISTS idx_ped_em_q_class_level ON pedagogy_english_medium(class_level);
CREATE INDEX IF NOT EXISTS idx_ped_em_q_chapter ON pedagogy_english_medium(chapter);
CREATE INDEX IF NOT EXISTS idx_ped_em_q_topic ON pedagogy_english_medium(topic);
CREATE INDEX IF NOT EXISTS idx_ped_em_q_difficulty ON pedagogy_english_medium(difficulty);
CREATE INDEX IF NOT EXISTS idx_ped_em_q_question_type ON pedagogy_english_medium(question_type);
CREATE INDEX IF NOT EXISTS idx_ped_em_q_source_type ON pedagogy_english_medium(source_type);
CREATE INDEX IF NOT EXISTS idx_ped_em_q_language ON pedagogy_english_medium(language);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE pedagogy_english_medium ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (for taking exams/practice)
DROP POLICY IF EXISTS "Allow public read access to pedagogy_english_medium" ON pedagogy_english_medium;
CREATE POLICY "Allow public read access to pedagogy_english_medium"
  ON pedagogy_english_medium
  FOR SELECT
  USING (true);

-- Allow insert/update/delete only for service_role (Admin / CSV import backend)
DROP POLICY IF EXISTS "Allow service_role full management on pedagogy_english_medium" ON pedagogy_english_medium;
CREATE POLICY "Allow service_role full management on pedagogy_english_medium"
  ON pedagogy_english_medium
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE pedagogy_english_medium IS 'Question repository for DSC Child Development and Pedagogy English Medium containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON COLUMN pedagogy_english_medium.question_id IS 'Unique identifier from CSV imports (e.g. PED_EM_001)';
COMMENT ON COLUMN pedagogy_english_medium.correct_answer IS 'Indicates the correct choice (A, B, C, D or exact text matching an option)';
