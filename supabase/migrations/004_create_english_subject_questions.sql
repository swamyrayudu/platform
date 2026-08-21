-- ============================================================
-- DSC Platform — Migration 004: English Subject Questions Table
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

CREATE TABLE IF NOT EXISTS english_subject_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                     -- Custom identifier from CSV (e.g., ENG_001)
  class_level      TEXT,                            -- e.g., 'Class 6', 'Class 7', 'SGT'
  subject          TEXT NOT NULL DEFAULT 'English', -- e.g., 'English'
  chapter          TEXT,                            -- e.g., 'Grammar', 'Vocabulary', 'Reading'
  topic            TEXT,                            -- e.g., 'Tenses', 'Prepositions', 'Direct Speech'
  subtopic         TEXT,                            -- e.g., 'Present Perfect', 'Phrasal Verbs'
  difficulty       TEXT,                            -- e.g., 'Easy', 'Medium', 'Hard'
  question_type    TEXT DEFAULT 'MCQ',              -- e.g., 'MCQ', 'Multiple Choice'
  question         TEXT NOT NULL,                   -- The question statement
  option_a         TEXT NOT NULL,                   -- Option A
  option_b         TEXT NOT NULL,                   -- Option B
  option_c         TEXT NOT NULL,                   -- Option C
  option_d         TEXT NOT NULL,                   -- Option D
  correct_answer   TEXT NOT NULL,                   -- e.g., 'A', 'B', 'C', 'D' or option text
  explanation      TEXT,                            -- Detailed answer explanation
  source_type      TEXT,                            -- e.g., 'SCERT', 'Previous Papers', 'Model Test'
  language         TEXT DEFAULT 'english',          -- e.g., 'english'
  tags             TEXT,                            -- Comma-separated tags or keywords
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at timestamp ---------------------------

CREATE OR REPLACE FUNCTION set_english_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER english_questions_updated_at
  BEFORE UPDATE ON english_subject_questions
  FOR EACH ROW
  EXECUTE FUNCTION set_english_questions_updated_at();

-- ---- Indexes for Fast Filtering & Practice Queries --------------

CREATE INDEX IF NOT EXISTS idx_english_q_class_level ON english_subject_questions(class_level);
CREATE INDEX IF NOT EXISTS idx_english_q_chapter ON english_subject_questions(chapter);
CREATE INDEX IF NOT EXISTS idx_english_q_topic ON english_subject_questions(topic);
CREATE INDEX IF NOT EXISTS idx_english_q_difficulty ON english_subject_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_english_q_question_type ON english_subject_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_english_q_source_type ON english_subject_questions(source_type);
CREATE INDEX IF NOT EXISTS idx_english_q_language ON english_subject_questions(language);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE english_subject_questions ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (for taking exams/practice)
CREATE POLICY "Allow public read access to english questions"
  ON english_subject_questions
  FOR SELECT
  USING (true);

-- Allow insert/update/delete only for service_role (Admin / CSV import backend)
CREATE POLICY "Allow service_role full management on english questions"
  ON english_subject_questions
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE english_subject_questions IS 'Question repository for DSC English subject containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON COLUMN english_subject_questions.question_id IS 'Unique identifier from CSV imports';
COMMENT ON COLUMN english_subject_questions.correct_answer IS 'Indicates the correct choice (A, B, C, D or exact text matching an option)';
