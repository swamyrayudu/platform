-- ============================================================
-- DSC Platform — Migration 011: Telugu Medium Science Questions Table
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

CREATE TABLE IF NOT EXISTS telugu_medium_science (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                              -- Custom identifier from CSV (e.g., SCI_TM_001)
  class_level      TEXT,                                     -- e.g., 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'
  subject          TEXT NOT NULL DEFAULT 'Science',          -- e.g., 'Science', 'సాధారణ సైన్స్'
  chapter          TEXT,                                     -- e.g., 'జీవ శాస్త్రం', 'భౌతిక శాస్త్రం', 'రసాయన శాస్త్రం', 'పరిసరాల విజ్ఞానం'
  topic            TEXT,                                     -- e.g., 'కిరణజన్య సంయోగక్రియ', 'జీవుల లక్షణాలు', 'కాంతి & నీడలు', 'ఆమ్లాలు - క్షారాలు'
  subtopic         TEXT,                                     -- e.g., 'హరితరేణువులు', 'ప్రతిబింబాలు', 'pH విలువ'
  difficulty       TEXT DEFAULT 'Medium',                    -- e.g., 'Easy', 'Medium', 'Hard'
  question_type    TEXT DEFAULT 'MCQ',                       -- e.g., 'MCQ', 'Multiple Choice'
  question         TEXT NOT NULL,                            -- The science question statement in Telugu (UTF-8)
  option_a         TEXT NOT NULL,                            -- Option A
  option_b         TEXT NOT NULL,                            -- Option B
  option_c         TEXT NOT NULL,                            -- Option C
  option_d         TEXT NOT NULL,                            -- Option D
  correct_answer   TEXT NOT NULL,                            -- 'A', 'B', 'C', 'D' or option text
  explanation      TEXT,                                     -- Detailed conceptual explanation in Telugu
  source_type      TEXT DEFAULT 'SCERT',                     -- e.g., 'SCERT', 'Previous Papers', 'Model Test'
  language         TEXT DEFAULT 'telugu',                    -- e.g., 'telugu', 'te'
  tags             TEXT,                                     -- Comma-separated tags or keywords (e.g. 'science,biology,physics')
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at timestamp ---------------------------

CREATE OR REPLACE FUNCTION set_telugu_medium_science_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_telugu_medium_science_updated_at ON telugu_medium_science;
CREATE TRIGGER trg_telugu_medium_science_updated_at
  BEFORE UPDATE ON telugu_medium_science
  FOR EACH ROW
  EXECUTE FUNCTION set_telugu_medium_science_updated_at();

-- ---- Indexes for Fast Filtering & Practice Engine ---------------

CREATE INDEX IF NOT EXISTS idx_sci_tm_q_class_level ON telugu_medium_science(class_level);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_chapter ON telugu_medium_science(chapter);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_topic ON telugu_medium_science(topic);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_difficulty ON telugu_medium_science(difficulty);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_question_type ON telugu_medium_science(question_type);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_source_type ON telugu_medium_science(source_type);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_language ON telugu_medium_science(language);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE telugu_medium_science ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (for taking exams/practice)
DROP POLICY IF EXISTS "Allow public read access to telugu_medium_science" ON telugu_medium_science;
CREATE POLICY "Allow public read access to telugu_medium_science"
  ON telugu_medium_science
  FOR SELECT
  USING (true);

-- Allow insert/update/delete only for service_role (Admin / CSV import backend)
DROP POLICY IF EXISTS "Allow service_role full management on telugu_medium_science" ON telugu_medium_science;
CREATE POLICY "Allow service_role full management on telugu_medium_science"
  ON telugu_medium_science
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- Drop view if it was created earlier so only the table exists
DROP VIEW IF EXISTS science_telugu_medium;

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE telugu_medium_science IS 'Question repository for DSC Science Telugu Medium containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON COLUMN telugu_medium_science.question_id IS 'Unique identifier from CSV imports (e.g. SCI_TM_001)';
COMMENT ON COLUMN telugu_medium_science.correct_answer IS 'Indicates the correct choice (A, B, C, D or exact text matching an option)';
