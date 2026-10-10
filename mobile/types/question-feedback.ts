// ============================================================
// types/question-feedback.ts — Candidate reports on question quality
// ============================================================
// The queue is keyed on the QUESTION, not on the report. Each question carries
// one snapshot and a running count; individual reporters live in a child table
// and carry no question text.
// ============================================================

export type FeedbackReason =
  | 'wrong_answer'
  | 'wrong_question'
  | 'wrong_option'
  | 'wrong_explanation'
  | 'typo'
  | 'duplicate'
  | 'other'

export type FeedbackStatus = 'open' | 'resolved' | 'dismissed'

export const FEEDBACK_REASONS: { id: FeedbackReason; label: string; hint: string }[] = [
  { id: 'wrong_answer', label: 'Answer key is wrong', hint: 'The marked correct option is not correct' },
  { id: 'wrong_question', label: 'Question is wrong', hint: 'Unclear, incomplete or factually wrong' },
  { id: 'wrong_option', label: 'An option is wrong', hint: 'An option is broken, blank or repeated' },
  { id: 'wrong_explanation', label: 'Explanation is wrong', hint: 'The explanation does not match the answer' },
  { id: 'typo', label: 'Spelling or formatting', hint: 'A typo or broken text' },
  { id: 'duplicate', label: 'Duplicate question', hint: 'This has appeared before' },
  { id: 'other', label: 'Something else', hint: 'Describe it below' },
]

export const FEEDBACK_REASON_LABEL: Record<FeedbackReason, string> = Object.fromEntries(
  FEEDBACK_REASONS.map((r) => [r.id, r.label])
) as Record<FeedbackReason, string>

/** Where the report was raised, so an admin can reproduce it. */
export type FeedbackSource =
  | 'mock_result'
  | 'practice_result'
  | 'mock_exam'
  | 'practice_exam'
  | 'unknown'

/** One QUESTION in the queue — the snapshot is stored here, once. */
export interface QuestionFeedbackRow {
  id: string
  question_uid: string
  question_table: string
  question_id: string
  reported_question: string | null
  report_count: number
  /** How many reporters chose each reason, e.g. { wrong_answer: 3, typo: 1 }. */
  reason_counts: Partial<Record<FeedbackReason, number>>
  status: FeedbackStatus
  admin_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  first_reported_at: string | null
  last_reported_at: string | null
  created_at: string
  updated_at: string
}

/** One REPORTER on a question. Carries no question text. */
export interface QuestionFeedbackReport {
  id: string
  feedback_id: string
  question_uid: string
  user_id: string
  reason: FeedbackReason
  details: string | null
  source: FeedbackSource
  mock_test_id: string | null
  created_at: string
  reporter: { name: string | null; email: string } | null
}

export interface AdminFeedbackItem extends QuestionFeedbackRow {
  subject_label: string | null
  medium: 'english' | 'telugu' | null
  /** The most recent few reporters, for the collapsed row. */
  recent_reports: QuestionFeedbackReport[]
}

export interface AdminFeedbackListResponse {
  success: boolean
  items: AdminFeedbackItem[]
  page: number
  page_size: number
  total: number
  total_pages: number
  counts: Record<FeedbackStatus, number>
  error?: string
}

/** The editable shape of one question, shared by every question table. */
export interface EditableQuestion {
  question_uid: string
  question_table: string
  question_id: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string | null
  difficulty: string | null
  subject: string | null
  chapter: string | null
  topic: string | null
  subtopic: string | null
  question_type: string | null
  source_type: string | null
}

export interface AdminQuestionResponse {
  success: boolean
  question?: EditableQuestion
  used_in_modules?: { id: string; title: string; module_number: number | null }[]
  error?: string
}
