-- ============================================================
-- DSC Platform — Migration 015: General Knowledge Telugu Medium Questions Table
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

CREATE TABLE IF NOT EXISTS gk_telugu_medium (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                                            -- Custom identifier from CSV (e.g., GK_TM_001)
  class_level      TEXT,                                                   -- e.g., 'SGT', 'School Assistant', 'General'
  subject          TEXT NOT NULL DEFAULT 'General Knowledge & Current Affairs', -- e.g., 'General Knowledge & Current Affairs', 'సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు'
  chapter          TEXT,                                                   -- e.g., 'వర్తమాన వ్యవహారాలు', 'భారత చరిత్ర', 'భౌగోళిక శాస్త్రం', 'భారత రాజ్యాంగం', 'పురస్కారాలు & గౌరవాలు'
  topic            TEXT,                                                   -- e.g., 'జాతీయ అంశాలు', 'ఆంధ్రప్రదేశ్ రాష్ట్ర పథకాలు', 'సైన్స్ & టెక్నాలజీ', 'క్రీడారంగం'
  subtopic         TEXT,                                                   -- e.g., 'నోబెల్ బహుమతులు', 'ఇస్రో ప్రయోగాలు', 'రాజ్యాంగ సవరణలు'
  difficulty       TEXT DEFAULT 'Medium',                                  -- e.g., 'Easy', 'Medium', 'Hard'
  question_type    TEXT DEFAULT 'MCQ',                                     -- e.g., 'MCQ', 'Multiple Choice'
  question         TEXT NOT NULL,                                          -- Question statement in Telugu (UTF-8)
  option_a         TEXT NOT NULL,                                          -- Option A
  option_b         TEXT NOT NULL,                                          -- Option B
  option_c         TEXT NOT NULL,                                          -- Option C
  option_d         TEXT NOT NULL,                                          -- Option D
  correct_answer   TEXT NOT NULL,                                          -- 'A', 'B', 'C', 'D' or option text
  explanation      TEXT,                                                   -- Detailed conceptual explanation in Telugu (UTF-8)
  source_type      TEXT DEFAULT 'SCERT',                                   -- e.g., 'SCERT', 'Previous Papers', 'Standard GK'
  language         TEXT DEFAULT 'telugu',                                  -- e.g., 'telugu', 'te'
  tags             TEXT,                                                   -- Comma-separated tags (e.g. 'gk,current_affairs,andhra_pradesh')
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Auto-update updated_at timestamp ---------------------------

CREATE OR REPLACE FUNCTION set_gk_telugu_medium_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gk_telugu_medium_updated_at ON gk_telugu_medium;
CREATE TRIGGER trg_gk_telugu_medium_updated_at
  BEFORE UPDATE ON gk_telugu_medium
  FOR EACH ROW
  EXECUTE FUNCTION set_gk_telugu_medium_updated_at();

-- ---- Indexes for Fast Filtering & Practice Engine ---------------

CREATE INDEX IF NOT EXISTS idx_gk_tm_q_class_level ON gk_telugu_medium(class_level);
CREATE INDEX IF NOT EXISTS idx_gk_tm_q_chapter ON gk_telugu_medium(chapter);
CREATE INDEX IF NOT EXISTS idx_gk_tm_q_topic ON gk_telugu_medium(topic);
CREATE INDEX IF NOT EXISTS idx_gk_tm_q_difficulty ON gk_telugu_medium(difficulty);
CREATE INDEX IF NOT EXISTS idx_gk_tm_q_question_type ON gk_telugu_medium(question_type);
CREATE INDEX IF NOT EXISTS idx_gk_tm_q_source_type ON gk_telugu_medium(source_type);
CREATE INDEX IF NOT EXISTS idx_gk_tm_q_language ON gk_telugu_medium(language);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE gk_telugu_medium ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anon users (for taking exams/practice)
DROP POLICY IF EXISTS "Allow public read access to gk_telugu_medium" ON gk_telugu_medium;
CREATE POLICY "Allow public read access to gk_telugu_medium"
  ON gk_telugu_medium
  FOR SELECT
  USING (true);

-- Allow insert/update/delete only for service_role (Admin / CSV import backend)
DROP POLICY IF EXISTS "Allow service_role full management on gk_telugu_medium" ON gk_telugu_medium;
CREATE POLICY "Allow service_role full management on gk_telugu_medium"
  ON gk_telugu_medium
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE gk_telugu_medium IS 'Question repository for DSC General Knowledge & Current Affairs Telugu Medium containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON COLUMN gk_telugu_medium.question_id IS 'Unique identifier from CSV imports (e.g. GK_TM_001)';
COMMENT ON COLUMN gk_telugu_medium.correct_answer IS 'Indicates the correct choice (A, B, C, D or exact text matching an option)';
