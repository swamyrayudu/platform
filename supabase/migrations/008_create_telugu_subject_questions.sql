-- ============================================================
-- DSC Platform — Migration 008: Telugu Subject Questions Table
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

CREATE TABLE IF NOT EXISTS telugu_subject_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                              -- Custom identifier from CSV (e.g., TEL_001)
  class_level      TEXT,                                     -- e.g., 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'
  subject          TEXT NOT NULL DEFAULT 'Telugu',           -- e.g., 'Telugu', 'తెలుగు'
  chapter          TEXT,                                     -- e.g., 'వ్యాకరణం', 'సాహిత్యం', 'పాఠ్యభాగం'
  topic            TEXT,                                     -- e.g., 'సంధులు', 'సమాసాలు', 'ఛందస్సు', 'అలంకారాలు', 'పర్యాయపదాలు'
  subtopic         TEXT,                                     -- e.g., 'సవర్ణదీర్ఘ సంధి', 'గుణ సంధి', 'ద్విగు సమాసం'
  difficulty       TEXT DEFAULT 'Medium',                    -- e.g., 'Easy', 'Medium', 'Hard'
  question_type    TEXT DEFAULT 'MCQ',                       -- e.g., 'MCQ', 'Multiple Choice'
  question         TEXT NOT NULL,                            -- The question statement (in Telugu / UTF-8)
  option_a         TEXT NOT NULL,                            -- Option A
  option_b         TEXT NOT NULL,                            -- Option B
  option_c         TEXT NOT NULL,                            -- Option C
  option_d         TEXT NOT NULL,                            -- Option D
  correct_answer   TEXT NOT NULL,                            -- 'A', 'B', 'C', 'D' or option text
  explanation      TEXT,                                     -- Detailed answer explanation
  source_type      TEXT DEFAULT 'SCERT',                     -- e.g., 'SCERT', 'Previous Papers', 'Model Test'
  language         TEXT DEFAULT 'telugu',                    -- e.g., 'telugu', 'te'
  tags             TEXT,                                     -- Comma-separated tags or keywords
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at timestamp ---------------------------

CREATE OR REPLACE FUNCTION set_telugu_subject_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_telugu_subject_questions_updated_at ON telugu_subject_questions;
CREATE TRIGGER trg_telugu_subject_questions_updated_at
  BEFORE UPDATE ON telugu_subject_questions
  FOR EACH ROW
  EXECUTE FUNCTION set_telugu_subject_questions_updated_at();

-- ---- Indexes for Fast Filtering & Practice Engine ---------------

CREATE INDEX IF NOT EXISTS idx_telugu_q_class_level ON telugu_subject_questions(class_level);
CREATE INDEX IF NOT EXISTS idx_telugu_q_chapter ON telugu_subject_questions(chapter);
CREATE INDEX IF NOT EXISTS idx_telugu_q_topic ON telugu_subject_questions(topic);
CREATE INDEX IF NOT EXISTS idx_telugu_q_difficulty ON telugu_subject_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_telugu_q_question_type ON telugu_subject_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_telugu_q_source_type ON telugu_subject_questions(source_type);
CREATE INDEX IF NOT EXISTS idx_telugu_q_language ON telugu_subject_questions(language);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE telugu_subject_questions ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (for taking exams/practice)
CREATE POLICY "Allow public read access to telugu_subject_questions"
  ON telugu_subject_questions
  FOR SELECT
  USING (true);

-- Allow insert/update/delete only for service_role (Admin / CSV import backend)
CREATE POLICY "Allow service_role full management on telugu_subject_questions"
  ON telugu_subject_questions
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE telugu_subject_questions IS 'Question repository for DSC Telugu subject containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON COLUMN telugu_subject_questions.question_id IS 'Unique identifier from CSV imports (e.g. TEL_001)';
COMMENT ON COLUMN telugu_subject_questions.correct_answer IS 'Indicates the correct choice (A, B, C, D or exact text matching an option)';
