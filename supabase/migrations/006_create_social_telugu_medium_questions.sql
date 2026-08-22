-- ============================================================
-- DSC Platform — Migration 006: Social Telugu Medium Questions Table
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

CREATE TABLE IF NOT EXISTS socal_telugu_medimum (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                              -- Custom identifier from CSV (e.g., SOC_TM_001)
  class_level      TEXT,                                     -- e.g., 'Class 6', 'Class 7', 'Class 8', 'SGT'
  subject          TEXT NOT NULL DEFAULT 'Social Studies',   -- e.g., 'Social Studies', 'సాంఘిక శాస్త్రం'
  chapter          TEXT,                                     -- e.g., 'భౌగోళిక శాస్త్రం', 'చరిత్ర', 'పౌరనీతి', 'Geography', 'History'
  topic            TEXT,                                     -- e.g., 'సౌర కుటుంబం', 'భారత రాజ్యాంగం'
  subtopic         TEXT,                                     -- e.g., 'గ్రహాలు', 'ప్రాథమిక హక్కులు'
  difficulty       TEXT DEFAULT 'Medium',                    -- e.g., 'Easy', 'Medium', 'Hard'
  question_type    TEXT DEFAULT 'MCQ',                       -- e.g., 'MCQ', 'Multiple Choice'
  question         TEXT NOT NULL,                            -- The question statement in Telugu/English
  option_a         TEXT NOT NULL,                            -- Option A
  option_b         TEXT NOT NULL,                            -- Option B
  option_c         TEXT NOT NULL,                            -- Option C
  option_d         TEXT NOT NULL,                            -- Option D
  correct_answer   TEXT NOT NULL,                            -- 'A', 'B', 'C', 'D' or option text
  explanation      TEXT,                                     -- Detailed answer explanation in Telugu/English
  source_type      TEXT DEFAULT 'SCERT',                     -- e.g., 'SCERT', 'Previous Papers', 'Model Test'
  language         TEXT DEFAULT 'telugu',                    -- e.g., 'telugu', 'te'
  tags             TEXT,                                     -- Comma-separated tags or keywords
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at timestamp ---------------------------

CREATE OR REPLACE FUNCTION set_socal_telugu_medimum_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_socal_telugu_medimum_updated_at ON socal_telugu_medimum;
CREATE TRIGGER trg_socal_telugu_medimum_updated_at
  BEFORE UPDATE ON socal_telugu_medimum
  FOR EACH ROW
  EXECUTE FUNCTION set_socal_telugu_medimum_updated_at();

-- ---- Indexes for Fast Filtering & Practice Engine ---------------

CREATE INDEX IF NOT EXISTS idx_soc_tm_q_class_level ON socal_telugu_medimum(class_level);
CREATE INDEX IF NOT EXISTS idx_soc_tm_q_chapter ON socal_telugu_medimum(chapter);
CREATE INDEX IF NOT EXISTS idx_soc_tm_q_topic ON socal_telugu_medimum(topic);
CREATE INDEX IF NOT EXISTS idx_soc_tm_q_difficulty ON socal_telugu_medimum(difficulty);
CREATE INDEX IF NOT EXISTS idx_soc_tm_q_question_type ON socal_telugu_medimum(question_type);
CREATE INDEX IF NOT EXISTS idx_soc_tm_q_source_type ON socal_telugu_medimum(source_type);
CREATE INDEX IF NOT EXISTS idx_soc_tm_q_language ON socal_telugu_medimum(language);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE socal_telugu_medimum ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (for taking exams/practice)
CREATE POLICY "Allow public read access to socal_telugu_medimum"
  ON socal_telugu_medimum
  FOR SELECT
  USING (true);

-- Allow insert/update/delete only for service_role (Admin / CSV import backend)
CREATE POLICY "Allow service_role full management on socal_telugu_medimum"
  ON socal_telugu_medimum
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE socal_telugu_medimum IS 'Question repository for DSC Social Studies Telugu Medium containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON COLUMN socal_telugu_medimum.question_id IS 'Unique identifier from CSV imports (e.g. SOC_TM_001)';
COMMENT ON COLUMN socal_telugu_medimum.correct_answer IS 'Indicates the correct choice (A, B, C, D or exact text matching an option)';
