-- ============================================================
-- DSC Platform — Migration 009: Pedagogy Subject Questions Table
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

CREATE TABLE IF NOT EXISTS pedagogy_subject_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                                    -- Custom identifier from CSV (e.g., PED_001, CDP_001)
  class_level      TEXT,                                           -- e.g., 'SGT', 'School Assistant', 'Paper-I', 'Paper-II', 'All'
  subject          TEXT NOT NULL DEFAULT 'Pedagogy',               -- e.g., 'Pedagogy', 'Child Development & Pedagogy', 'సైకాలజీ & బోధనా పద్ధతులు'
  chapter          TEXT,                                           -- e.g., 'Development of Child', 'Learning & Motivation', 'Pedagogical Concerns'
  topic            TEXT,                                           -- e.g., 'Growth & Development', 'Piaget, Kohlberg & Vygotsky', 'Inclusive Education', 'Assessment & CCE'
  subtopic         TEXT,                                           -- e.g., 'Stages of Development', 'Theories of Learning', 'Learning Disabilities', 'Teaching Methods'
  difficulty       TEXT DEFAULT 'Medium',                          -- e.g., 'Easy', 'Medium', 'Hard'
  question_type    TEXT DEFAULT 'MCQ',                             -- e.g., 'MCQ', 'Multiple Choice'
  question         TEXT NOT NULL,                                  -- The question statement (supports Telugu & English Unicode)
  option_a         TEXT NOT NULL,                                  -- Option A
  option_b         TEXT NOT NULL,                                  -- Option B
  option_c         TEXT NOT NULL,                                  -- Option C
  option_d         TEXT NOT NULL,                                  -- Option D
  correct_answer   TEXT NOT NULL,                                  -- 'A', 'B', 'C', 'D' or exact option text
  explanation      TEXT,                                           -- Detailed answer explanation
  source_type      TEXT DEFAULT 'SCERT',                           -- e.g., 'SCERT', 'D.Ed / B.Ed Textbooks', 'Previous Papers', 'Model Test'
  language         TEXT DEFAULT 'english',                         -- e.g., 'english', 'telugu'
  tags             TEXT,                                           -- Comma-separated tags or keywords (e.g. 'cdp,piaget,psychology')
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at timestamp ---------------------------

CREATE OR REPLACE FUNCTION set_pedagogy_subject_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedagogy_subject_questions_updated_at ON pedagogy_subject_questions;
CREATE TRIGGER trg_pedagogy_subject_questions_updated_at
  BEFORE UPDATE ON pedagogy_subject_questions
  FOR EACH ROW
  EXECUTE FUNCTION set_pedagogy_subject_questions_updated_at();

-- ---- Indexes for Fast Filtering & Practice Engine ---------------

CREATE INDEX IF NOT EXISTS idx_pedagogy_q_class_level ON pedagogy_subject_questions(class_level);
CREATE INDEX IF NOT EXISTS idx_pedagogy_q_chapter ON pedagogy_subject_questions(chapter);
CREATE INDEX IF NOT EXISTS idx_pedagogy_q_topic ON pedagogy_subject_questions(topic);
CREATE INDEX IF NOT EXISTS idx_pedagogy_q_difficulty ON pedagogy_subject_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_pedagogy_q_question_type ON pedagogy_subject_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_pedagogy_q_source_type ON pedagogy_subject_questions(source_type);
CREATE INDEX IF NOT EXISTS idx_pedagogy_q_language ON pedagogy_subject_questions(language);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE pedagogy_subject_questions ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (for taking exams/practice)
CREATE POLICY "Allow public read access to pedagogy_subject_questions"
  ON pedagogy_subject_questions
  FOR SELECT
  USING (true);

-- Allow insert/update/delete only for service_role (Admin / CSV import backend)
CREATE POLICY "Allow service_role full management on pedagogy_subject_questions"
  ON pedagogy_subject_questions
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE pedagogy_subject_questions IS 'Question repository for DSC Pedagogy / Child Development & Pedagogy (CDP) containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON COLUMN pedagogy_subject_questions.question_id IS 'Unique identifier from CSV imports (e.g. PED_001, CDP_001)';
COMMENT ON COLUMN pedagogy_subject_questions.correct_answer IS 'Indicates the correct choice (A, B, C, D or exact text matching an option)';
