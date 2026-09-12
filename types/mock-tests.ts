// ============================================================
// types/mock-tests.ts — AP DSC SGT Grand Mock Test System Types
// ============================================================

// ---- Core Mock Test Types ----------------------------------------

export type MockTestCategory = 'grand_mock' | 'practice_mock' | 'previous_paper' | 'subject_mock'
export type MockTestStatus = 'draft' | 'published' | 'archived'
export type MockTestMedium = 'telugu' | 'english' | 'bilingual'
export type AttemptStatus = 'in_progress' | 'submitted' | 'expired' | 'abandoned'
export type SelectedOption = 'A' | 'B' | 'C' | 'D' | null

export interface MockTest {
  id: string
  slug: string
  title: string
  description: string | null
  category: MockTestCategory
  medium: MockTestMedium
  duration_minutes: number
  total_questions: number
  total_marks: number
  marks_per_question: number
  negative_marks: number
  version: number
  status: MockTestStatus
  blueprint_id: string
  blueprint_snapshot: ExamBlueprint | null
  is_free: boolean
  created_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

/** Mapping row stored in mock_test_questions */
export interface MockTestQuestionMapping {
  id: string
  mock_test_id: string
  question_id: string
  question_table: string
  question_number: number
  section_id: string
  section_name: string
  marks: number
  created_at: string
}

/**
 * Client-safe question payload sent to the browser.
 *
 * SECURITY: correct_answer and explanation are OMITTED here.
 * They are added only in server-side grading after submission.
 */
export interface ClientSafeMockQuestion {
  question_id: string
  question_number: number
  section_id: string
  section_name: string
  subject: string
  chapter: string | null
  topic: string
  subtopic: string | null
  difficulty: string
  question_type: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  marks: number
  // Deliberately absent: correct_answer, explanation
}

/** Internal answer-key entry — server-side only, NEVER sent to the client */
export interface AnswerKeyEntry {
  question_id: string
  question_number: number
  correct_answer: string
  explanation: string | null
  marks: number
}

// ---- Blueprint Types ---------------------------------------------

export interface ExamSectionBlueprint {
  id: string                    // e.g. 'gk', 'telugu', 'mathematics'
  name: string                  // Display name
  total_questions: number
  total_marks: number
  question_tables: string[]     // Source tables for this section
  subject_filter?: string       // Subject value to filter by
  content_questions?: number    // Subject content questions
  methodology_questions?: number // Teaching methodology questions
  difficulty_distribution?: {
    easy_pct: number            // 0..1
    medium_pct: number
    hard_pct: number
  }
  source_type_preference?: string[] // e.g. ['Previous DSC Paper', 'SCERT Syllabus']
}

export interface ExamBlueprint {
  id: string
  name: string
  description: string
  total_questions: number
  duration_minutes: number
  total_marks: number
  marks_per_question: number
  negative_marks: number
  medium: MockTestMedium
  sections: ExamSectionBlueprint[]
}

export interface BlueprintValidationResult {
  valid: boolean
  total_questions: number
  errors: string[]
  warnings: string[]
  section_counts: Record<string, { expected: number; got: number; valid: boolean }>
}

// ---- Attempt Types -----------------------------------------------

export interface MockTestAttempt {
  id: string
  user_id: string
  mock_test_id: string
  test_version: number
  status: AttemptStatus
  duration_seconds: number
  time_spent_seconds: number
  score: number
  total_marks: number
  percentage: number
  total_questions: number
  correct_count: number
  incorrect_count: number
  unanswered_count: number
  section_scores: Record<string, SectionScore>
  rank: number | null
  percentile: number | null
  started_at: string
  submitted_at: string | null
  updated_at: string
}

export interface SectionScore {
  section_id: string
  section_name: string
  total: number
  correct: number
  incorrect: number
  score: number
  total_marks: number
}

export interface MockTestAnswerRecord {
  id: string
  attempt_id: string
  question_id: string
  question_number: number
  selected_option: SelectedOption
  marked_for_review: boolean
  is_correct: boolean | null  // null while in_progress
  time_taken_seconds: number
  answered_at: string
}

// ---- Result Types ------------------------------------------------

export interface MockTestResultSummary {
  attempt_id: string
  mock_test_id: string
  test_title: string
  total_questions: number
  correct_count: number
  incorrect_count: number
  unanswered_count: number
  score: number
  total_marks: number
  percentage: number
  total_time_seconds: number
  avg_time_per_question_seconds: number
  section_scores: SectionScore[]
  rank: number | null
  percentile: number | null
  questions_review: QuestionReviewItem[]
}

export interface QuestionReviewItem extends ClientSafeMockQuestion {
  user_answer: SelectedOption
  correct_answer: string        // Revealed ONLY after submission
  explanation: string | null    // Revealed ONLY after submission
  is_correct: boolean
  is_skipped: boolean
  is_marked: boolean
  time_taken_seconds: number
}

export interface MockTestLeaderboardEntry {
  rank: number
  attempt_id: string
  user_id: string
  user_name: string | null
  score: number
  percentage: number
  time_spent_seconds: number
  submitted_at: string
  is_current_user: boolean
}

// ---- API Response Types ------------------------------------------

export interface MockTestListItem {
  id: string
  slug: string
  title: string
  description: string | null
  category: MockTestCategory
  medium: MockTestMedium
  duration_minutes: number
  total_questions: number
  total_marks: number
  is_free: boolean
  status: MockTestStatus
  published_at: string | null
  user_attempt?: {
    attempt_id: string
    status: AttemptStatus
    score: number | null
    percentage: number | null
    submitted_at: string | null
  } | null
}

export interface StartAttemptResponse {
  attempt_id: string
  mock_test_id: string
  status: AttemptStatus
  duration_seconds: number
  time_spent_seconds: number
  started_at: string
  existing_answers: Record<string, { selected_option: SelectedOption; marked_for_review: boolean }>
}
