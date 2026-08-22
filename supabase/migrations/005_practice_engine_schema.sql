-- ============================================================
-- DSC Platform — Migration 005: Practice Engine & Question Bank
-- ============================================================
-- Supports English & Telugu Medium, progressive filtering,
-- session tracking, question attempts, and mastery progress.
-- ============================================================

-- 1. Unified DSC Practice Question Bank
CREATE TABLE IF NOT EXISTS dsc_practice_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      TEXT UNIQUE,                     -- Custom identifier (e.g., ENG_TNS_001, TEL_SAN_001)
  medium           TEXT NOT NULL DEFAULT 'english', -- 'english' | 'telugu'
  subject          TEXT NOT NULL,                   -- 'English', 'Telugu', 'Mathematics', 'Science', 'Social Studies', 'Pedagogy'
  class_level      TEXT NOT NULL DEFAULT 'Class 6', -- 'Class 3' to 'Class 10', 'SGT', 'All'
  chapter          TEXT,                            -- e.g. 'Grammar', 'Vyakaranam', 'Arithmetic'
  topic            TEXT NOT NULL,                   -- e.g. 'Tenses', 'Prepositions', 'సంధులు'
  subtopic         TEXT,                            -- e.g. 'Present Perfect', 'సవర్ణదీర్ఘ సంధి'
  difficulty       TEXT NOT NULL DEFAULT 'Medium',  -- 'Easy', 'Medium', 'Hard'
  question_type    TEXT NOT NULL DEFAULT 'MCQ',     -- 'MCQ'
  question         TEXT NOT NULL,                   -- Question statement
  option_a         TEXT NOT NULL,
  option_b         TEXT NOT NULL,
  option_c         TEXT NOT NULL,
  option_d         TEXT NOT NULL,
  correct_answer   TEXT NOT NULL,                   -- 'A', 'B', 'C', 'D'
  explanation      TEXT,                            -- Conceptual explanation
  source_type      TEXT DEFAULT 'SCERT Syllabus',   -- 'SCERT', 'Previous DSC Paper', 'Model Paper'
  language         TEXT NOT NULL DEFAULT 'english', -- 'english' | 'telugu'
  tags             TEXT,                            -- Comma separated tags
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Practice Sessions Table
CREATE TABLE IF NOT EXISTS practice_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  medium              TEXT NOT NULL DEFAULT 'english',
  subject             TEXT NOT NULL,
  class_levels        TEXT[] NOT NULL DEFAULT '{}',
  topics              TEXT[] NOT NULL DEFAULT '{}',
  subtopics           TEXT[] NOT NULL DEFAULT '{}',
  difficulty          TEXT[] NOT NULL DEFAULT '{}',
  mode                TEXT NOT NULL DEFAULT 'balanced', -- 'balanced', 'random', 'weak_areas', 'previously_incorrect', 'new_questions'
  feedback_mode       TEXT NOT NULL DEFAULT 'instant',  -- 'instant', 'end'
  has_timer           BOOLEAN NOT NULL DEFAULT false,
  duration_seconds    INTEGER DEFAULT 0,
  question_count      INTEGER NOT NULL DEFAULT 25,
  question_ids        TEXT[] NOT NULL DEFAULT '{}',
  user_answers        JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_spent_seconds  INTEGER NOT NULL DEFAULT 0,
  score               INTEGER NOT NULL DEFAULT 0,
  accuracy_pct        NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  status              TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

-- 3. Individual Question Attempts
CREATE TABLE IF NOT EXISTS question_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID REFERENCES practice_sessions(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id         TEXT NOT NULL,
  subject             TEXT NOT NULL,
  topic               TEXT NOT NULL,
  subtopic            TEXT,
  difficulty          TEXT NOT NULL DEFAULT 'Medium',
  selected_answer     TEXT,
  is_correct          BOOLEAN NOT NULL DEFAULT false,
  time_taken_seconds  INTEGER NOT NULL DEFAULT 0,
  attempted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Question Progress & Mastery Aggregates
CREATE TABLE IF NOT EXISTS question_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id         TEXT NOT NULL,
  subject             TEXT NOT NULL,
  topic               TEXT NOT NULL,
  subtopic            TEXT,
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  correct_count       INTEGER NOT NULL DEFAULT 0,
  incorrect_count     INTEGER NOT NULL DEFAULT 0,
  last_attempted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_correct_at     TIMESTAMPTZ,
  mastery_score       NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT uq_user_question UNIQUE (user_id, question_id)
);

-- ---- Indexes for Fast Filtering & Smart Queries -----------------

CREATE INDEX IF NOT EXISTS idx_dsc_pq_medium_subj ON dsc_practice_questions(medium, subject);
CREATE INDEX IF NOT EXISTS idx_dsc_pq_class ON dsc_practice_questions(class_level);
CREATE INDEX IF NOT EXISTS idx_dsc_pq_topic ON dsc_practice_questions(topic);
CREATE INDEX IF NOT EXISTS idx_dsc_pq_subtopic ON dsc_practice_questions(subtopic);
CREATE INDEX IF NOT EXISTS idx_dsc_pq_difficulty ON dsc_practice_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_dsc_pq_composite ON dsc_practice_questions(medium, subject, class_level, topic, subtopic, difficulty);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_attempts_user ON question_attempts(user_id, topic, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_progress_user ON question_progress(user_id, subject, topic);

-- ---- Row Level Security (RLS) -----------------------------------

ALTER TABLE dsc_practice_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read on dsc practice questions"
  ON dsc_practice_questions FOR SELECT USING (true);

CREATE POLICY "Users can manage their practice sessions"
  ON practice_sessions FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can manage their attempts"
  ON question_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view and update their progress"
  ON question_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
