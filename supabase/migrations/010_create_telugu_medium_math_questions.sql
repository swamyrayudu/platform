-- ============================================================
-- DSC Platform — Migration 010: Telugu Medium Math Questions Table
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

CREATE TABLE IF NOT EXISTS telugu_medium_math (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                              -- Custom identifier from CSV (e.g., MATH_TM_001)
  class_level      TEXT,                                     -- e.g., 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'
  subject          TEXT NOT NULL DEFAULT 'Mathematics',      -- e.g., 'Mathematics', 'గణితం'
  chapter          TEXT,                                     -- e.g., 'సంఖ్యా వ్యవస్థ', 'బీజగణితం', 'రేఖాగణితం', 'క్షేత్రమితి'
  topic            TEXT,                                     -- e.g., 'పూర్ణాంకాలు', 'భిన్నాలు & దశాంశాలు', 'ల.సా.గు & గ.సా.భా', 'శాతాలు'
  subtopic         TEXT,                                     -- e.g., 'భాజనీయత సూత్రాలు', 'పైథాగరస్ సిద్ధాంతం', 'సాధారణ వడ్డీ'
  difficulty       TEXT DEFAULT 'Medium',                    -- e.g., 'Easy', 'Medium', 'Hard'
  question_type    TEXT DEFAULT 'MCQ',                       -- e.g., 'MCQ', 'Multiple Choice'
  question         TEXT NOT NULL,                            -- The math question statement in Telugu / UTF-8
  option_a         TEXT NOT NULL,                            -- Option A
  option_b         TEXT NOT NULL,                            -- Option B
  option_c         TEXT NOT NULL,                            -- Option C
  option_d         TEXT NOT NULL,                            -- Option D
  correct_answer   TEXT NOT NULL,                            -- 'A', 'B', 'C', 'D' or option text
  explanation      TEXT,                                     -- Step-by-step mathematical explanation in Telugu / UTF-8
  source_type      TEXT DEFAULT 'SCERT',                     -- e.g., 'SCERT', 'Previous Papers', 'Model Test'
  language         TEXT DEFAULT 'telugu',                    -- e.g., 'telugu', 'te'
  tags             TEXT,                                     -- Comma-separated tags or keywords (e.g. 'maths,geometry,fractions')
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at timestamp ---------------------------

CREATE OR REPLACE FUNCTION set_telugu_medium_math_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_telugu_medium_math_updated_at ON telugu_medium_math;
CREATE TRIGGER trg_telugu_medium_math_updated_at
  BEFORE UPDATE ON telugu_medium_math
  FOR EACH ROW
  EXECUTE FUNCTION set_telugu_medium_math_updated_at();

-- ---- Indexes for Fast Filtering & Practice Engine ---------------

CREATE INDEX IF NOT EXISTS idx_telugu_math_q_class_level ON telugu_medium_math(class_level);
CREATE INDEX IF NOT EXISTS idx_telugu_math_q_chapter ON telugu_medium_math(chapter);
CREATE INDEX IF NOT EXISTS idx_telugu_math_q_topic ON telugu_medium_math(topic);
CREATE INDEX IF NOT EXISTS idx_telugu_math_q_difficulty ON telugu_medium_math(difficulty);
CREATE INDEX IF NOT EXISTS idx_telugu_math_q_question_type ON telugu_medium_math(question_type);
CREATE INDEX IF NOT EXISTS idx_telugu_math_q_source_type ON telugu_medium_math(source_type);
CREATE INDEX IF NOT EXISTS idx_telugu_math_q_language ON telugu_medium_math(language);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE telugu_medium_math ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (for taking exams/practice)
CREATE POLICY "Allow public read access to telugu_medium_math"
  ON telugu_medium_math
  FOR SELECT
  USING (true);

-- Allow insert/update/delete only for service_role (Admin / CSV import backend)
CREATE POLICY "Allow service_role full management on telugu_medium_math"
  ON telugu_medium_math
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE telugu_medium_math IS 'Question repository for DSC Mathematics Telugu Medium containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON COLUMN telugu_medium_math.question_id IS 'Unique identifier from CSV imports (e.g. MATH_TM_001)';
COMMENT ON COLUMN telugu_medium_math.correct_answer IS 'Indicates the correct choice (A, B, C, D or exact text matching an option)';
