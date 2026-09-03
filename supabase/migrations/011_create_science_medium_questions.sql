-- ============================================================
-- DSC Platform — Migration 011: Telugu Medium & English Medium Science Tables
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Matches the CSV structure for direct import:
-- question_id, class_level, subject, chapter, topic, subtopic,
-- difficulty, question_type, question, option_a, option_b,
-- option_c, option_d, correct_answer, explanation, source_type,
-- language, tags
-- ============================================================

-- ============================================================
-- 1. TELUGU MEDIUM SCIENCE TABLE (`telugu_medium_science`)
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
  question         TEXT NOT NULL,                            -- Question statement in Telugu (UTF-8)
  option_a         TEXT NOT NULL,                            -- Option A
  option_b         TEXT NOT NULL,                            -- Option B
  option_c         TEXT NOT NULL,                            -- Option C
  option_d         TEXT NOT NULL,                            -- Option D
  correct_answer   TEXT NOT NULL,                            -- 'A', 'B', 'C', 'D' or option text
  explanation      TEXT,                                     -- Detailed conceptual explanation in Telugu
  source_type      TEXT DEFAULT 'SCERT',                     -- e.g., 'SCERT', 'Previous Papers', 'Model Test'
  language         TEXT DEFAULT 'telugu',                    -- e.g., 'telugu', 'te'
  tags             TEXT,                                     -- Comma-separated tags (e.g. 'science,biology,photosynthesis')
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at timestamp for telugu_medium_science
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

-- Indexes for Fast Filtering & Practice Engine (Telugu Medium)
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_class_level ON telugu_medium_science(class_level);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_chapter ON telugu_medium_science(chapter);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_topic ON telugu_medium_science(topic);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_difficulty ON telugu_medium_science(difficulty);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_question_type ON telugu_medium_science(question_type);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_source_type ON telugu_medium_science(source_type);
CREATE INDEX IF NOT EXISTS idx_sci_tm_q_language ON telugu_medium_science(language);

-- Row Level Security (RLS) for telugu_medium_science
ALTER TABLE telugu_medium_science ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to telugu_medium_science"
  ON telugu_medium_science
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service_role full management on telugu_medium_science"
  ON telugu_medium_science
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- Alias View for cross-compatibility with `science_telugu_medium`
CREATE OR REPLACE VIEW science_telugu_medium AS
  SELECT * FROM telugu_medium_science;


-- ============================================================
-- 2. ENGLISH MEDIUM SCIENCE TABLE (`english_medium_science`)
-- ============================================================

CREATE TABLE IF NOT EXISTS english_medium_science (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                              -- Custom identifier from CSV (e.g., SCI_EM_001)
  class_level      TEXT,                                     -- e.g., 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'
  subject          TEXT NOT NULL DEFAULT 'Science',          -- e.g., 'Science', 'General Science'
  chapter          TEXT,                                     -- e.g., 'Biology', 'Physics', 'Chemistry', 'Environmental Science'
  topic            TEXT,                                     -- e.g., 'Photosynthesis', 'Cell Biology', 'Light & Optics', 'Acids, Bases & Salts'
  subtopic         TEXT,                                     -- e.g., 'Chloroplasts', 'Reflection of Light', 'pH Scale'
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
  tags             TEXT,                                     -- Comma-separated tags (e.g. 'science,biology,cell')
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at timestamp for english_medium_science
CREATE OR REPLACE FUNCTION set_english_medium_science_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_english_medium_science_updated_at ON english_medium_science;
CREATE TRIGGER trg_english_medium_science_updated_at
  BEFORE UPDATE ON english_medium_science
  FOR EACH ROW
  EXECUTE FUNCTION set_english_medium_science_updated_at();

-- Indexes for Fast Filtering & Practice Engine (English Medium)
CREATE INDEX IF NOT EXISTS idx_sci_em_q_class_level ON english_medium_science(class_level);
CREATE INDEX IF NOT EXISTS idx_sci_em_q_chapter ON english_medium_science(chapter);
CREATE INDEX IF NOT EXISTS idx_sci_em_q_topic ON english_medium_science(topic);
CREATE INDEX IF NOT EXISTS idx_sci_em_q_difficulty ON english_medium_science(difficulty);
CREATE INDEX IF NOT EXISTS idx_sci_em_q_question_type ON english_medium_science(question_type);
CREATE INDEX IF NOT EXISTS idx_sci_em_q_source_type ON english_medium_science(source_type);
CREATE INDEX IF NOT EXISTS idx_sci_em_q_language ON english_medium_science(language);

-- Row Level Security (RLS) for english_medium_science
ALTER TABLE english_medium_science ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to english_medium_science"
  ON english_medium_science
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service_role full management on english_medium_science"
  ON english_medium_science
  FOR ALL
  USING (current_setting('role', true) = 'service_role')
  WITH CHECK (current_setting('role', true) = 'service_role');

-- Alias View for cross-compatibility with `science_english_medium` & `science_subject_questions`
CREATE OR REPLACE VIEW science_english_medium AS
  SELECT * FROM english_medium_science;

CREATE OR REPLACE VIEW science_subject_questions AS
  SELECT * FROM english_medium_science;


-- ============================================================
-- 3. SEED SAMPLE QUESTIONS (SCERT Syllabus)
-- ============================================================

-- Telugu Medium Sample Questions
INSERT INTO telugu_medium_science (
  question_id, class_level, subject, chapter, topic, subtopic,
  difficulty, question_type, question,
  option_a, option_b, option_c, option_d,
  correct_answer, explanation, source_type, language, tags
) VALUES
(
  'SCI_TM_001',
  'Class 7',
  'Science',
  'జీవ శాస్త్రం',
  'కిరణజన్య సంయోగక్రియ',
  'హరితరేణువు',
  'Easy',
  'MCQ',
  'మొక్కలలో కిరణజన్య సంయోగక్రియ ప్రధానంగా ఏ భాగంలో జరుగుతుంది?',
  'వేర్లు',
  'ఆకులు (పత్రాలు)',
  'కాండం',
  'పువ్వులు',
  'B',
  'మొక్కలలో హరితరేణువులు అధికంగా ఉండే ఆకులలో (పత్రాలలో) సూర్యకాంతి సమక్షంలో కిరణజన్య సంయోగక్రియ జరుగుతుంది.',
  'SCERT 7th Science',
  'telugu',
  'science,biology,photosynthesis'
),
(
  'SCI_TM_002',
  'Class 8',
  'Science',
  'భౌతిక శాస్త్రం',
  'ధ్వని',
  'ధ్వని ప్రసారం',
  'Medium',
  'MCQ',
  'కింది వాటిలో ధ్వని దేని ద్వారా ప్రసరించలేదు?',
  'నీరు (ద్రవాలు)',
  'గాలి (వాయువులు)',
  'శూన్యం (వ్యాక్యూమ్)',
  'ఉక్కు (ఘనపదార్థాలు)',
  'C',
  'ధ్వని తరంగాలు ప్రసరించడానికి యానకం (ఘన, ద్రవ లేదా వాయు) తప్పనిసరి. శూన్యంలో కణాలు ఉండవు కాబట్టి ధ్వని ప్రసరించదు.',
  'SCERT 8th Physical Science',
  'telugu',
  'science,physics,sound'
),
(
  'SCI_TM_003',
  'Class 7',
  'Science',
  'రసాయన శాస్త్రం',
  'ఆమ్లాలు మరియు క్షారాలు',
  'సూచికలు',
  'Medium',
  'MCQ',
  'నీలి లిట్మస్ కాగితాన్ని ఎరుపు రంగులోకి మార్చే ద్రావణం ఏది?',
  'ఆమ్ల ద్రావణం (Acid)',
  'క్షార ద్రావణం (Base)',
  'తటస్థ ద్రావణం (Neutral)',
  'లవణ ద్రావణం (Salt)',
  'A',
  'ఆమ్లాలు నీలి లిట్మస్ కాగితాన్ని ఎరుపు రంగులోకి మారుస్తాయి. క్షారాలు ఎరుపు లిట్మస్ ను నీలి రంగులోకి మారుస్తాయి.',
  'SCERT 7th Science',
  'telugu',
  'science,chemistry,acids_bases'
)
ON CONFLICT (question_id) DO NOTHING;

-- English Medium Sample Questions
INSERT INTO english_medium_science (
  question_id, class_level, subject, chapter, topic, subtopic,
  difficulty, question_type, question,
  option_a, option_b, option_c, option_d,
  correct_answer, explanation, source_type, language, tags
) VALUES
(
  'SCI_EM_001',
  'Class 7',
  'Science',
  'Biology',
  'Nutrition in Plants',
  'Photosynthesis',
  'Easy',
  'MCQ',
  'Which green pigment present in leaves traps solar energy for photosynthesis?',
  'Hemoglobin',
  'Chlorophyll',
  'Carotene',
  'Xanthophyll',
  'B',
  'Chlorophyll is the green pigment in plant leaves that absorbs sunlight required for synthesizing food through photosynthesis.',
  'SCERT 7th Science',
  'english',
  'science,biology,chlorophyll'
),
(
  'SCI_EM_002',
  'Class 8',
  'Science',
  'Physics',
  'Sound',
  'Propagation of Sound',
  'Medium',
  'MCQ',
  'Sound cannot travel through which of the following media?',
  'Water',
  'Air',
  'Vacuum',
  'Iron Rod',
  'C',
  'Sound requires a material medium (solid, liquid, or gas) to propagate. It cannot travel through a vacuum because there are no particles to vibrate.',
  'SCERT 8th Physical Science',
  'english',
  'science,physics,sound'
),
(
  'SCI_EM_003',
  'Class 7',
  'Science',
  'Chemistry',
  'Acids, Bases and Salts',
  'Indicators',
  'Medium',
  'MCQ',
  'Which of the following substances turns blue litmus paper red?',
  'Sodium Hydroxide solution',
  'Hydrochloric Acid solution',
  'Pure Distilled Water',
  'Baking Soda solution',
  'B',
  'Acids (such as Hydrochloric Acid) turn blue litmus paper red, while bases turn red litmus paper blue.',
  'SCERT 7th Science',
  'english',
  'science,chemistry,acids_bases'
)
ON CONFLICT (question_id) DO NOTHING;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE telugu_medium_science IS 'Question repository for DSC Science Telugu Medium containing chapter-wise questions, options, explanations, and metadata.';
COMMENT ON TABLE english_medium_science IS 'Question repository for DSC Science English Medium containing chapter-wise questions, options, explanations, and metadata.';
