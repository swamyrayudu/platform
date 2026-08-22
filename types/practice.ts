// ============================================================
// types/practice.ts — DSC Smart Practice Engine Types
// ============================================================

export type PracticeMedium = 'english' | 'telugu'

export type PracticeMode =
  | 'balanced'             // Balanced across topic, difficulty & performance
  | 'random'               // Random within selected filters
  | 'weak_areas'           // Prioritizes weaker topics (< 65% accuracy)
  | 'previously_incorrect' // Prioritizes questions previously answered wrong
  | 'new_questions'        // Questions never attempted by the user

export type PracticeFeedbackMode = 'instant' | 'end'

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard'

export interface PracticeQuestion {
  id: string
  question_id: string
  medium: PracticeMedium
  subject: string
  class_level: string
  chapter: string | null
  topic: string
  subtopic: string | null
  difficulty: DifficultyLevel | string
  question_type: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer?: string // Redacted in exam mode until submitted / verified
  explanation?: string | null // Redacted in exam mode until submitted / verified
  source_type?: string | null
  language: string
  tags?: string | null
  created_at?: string
  updated_at?: string
}

export interface PracticeFilterState {
  medium: PracticeMedium
  subject: string
  class_levels: string[]     // Empty or ['All'] means all classes
  topics: string[]           // Empty or ['All'] means all topics
  subtopics: string[]        // Empty or ['All'] means all subtopics
  difficulty: string[]       // e.g. ['Easy', 'Medium', 'Hard'] or ['All']
  question_count: number     // 10, 20, 25, 50, 100, or custom
  mode: PracticeMode
  feedback_mode: PracticeFeedbackMode
  has_timer: boolean
  duration_minutes: number
}

export interface UserAnswerRecord {
  question_id: string
  selected_answer: 'A' | 'B' | 'C' | 'D' | null
  is_correct?: boolean
  time_taken_seconds?: number
  marked_for_review?: boolean
  answered_at?: string
  correct_answer?: string
  explanation?: string | null
}

export interface PracticeSession {
  id: string
  user_id: string | null
  medium: PracticeMedium
  subject: string
  class_levels: string[]
  topics: string[]
  subtopics: string[]
  difficulty: string[]
  mode: PracticeMode
  feedback_mode: PracticeFeedbackMode
  has_timer: boolean
  duration_seconds: number
  question_count: number
  question_ids: string[]
  questions: PracticeQuestion[]
  user_answers: Record<string, UserAnswerRecord>
  time_spent_seconds: number
  score: number
  accuracy_pct: number
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  completed_at?: string | null
}

export interface TopicPerformance {
  topic: string
  subtopic?: string | null
  total_questions: number
  attempted: number
  correct: number
  incorrect: number
  accuracy_pct: number
  is_weak: boolean // accuracy < 65%
  is_mastered: boolean // accuracy >= 85%
}

export interface WeakAreaRecommendation {
  subject: string
  topic: string
  subtopic?: string | null
  total_attempted: number
  accuracy_pct: number
  incorrect_count: number
  recommended_question_count: number
  action_label: string
}

export interface PracticeResultSummary {
  session_id: string
  subject: string
  medium: PracticeMedium
  mode: PracticeMode
  total_questions: number
  attempted_count: number
  correct_count: number
  incorrect_count: number
  skipped_count: number
  score: number
  accuracy_pct: number
  total_time_seconds: number
  avg_time_per_question_seconds: number
  topic_breakdown: TopicPerformance[]
  weak_recommendations: WeakAreaRecommendation[]
  questions_review: (PracticeQuestion & {
    user_answer: 'A' | 'B' | 'C' | 'D' | null
    is_correct: boolean
    is_skipped: boolean
    is_marked: boolean
    correct_answer: string
    explanation: string | null
    time_taken_seconds: number
  })[]
}

export interface PracticeHistoryItem {
  id: string
  medium: PracticeMedium
  subject: string
  mode: PracticeMode
  topics: string[]
  question_count: number
  score: number
  accuracy_pct: number
  time_spent_seconds: number
  started_at: string
  completed_at: string | null
  status: string
}

export interface DynamicFilterOptions {
  medium: PracticeMedium
  available_subjects: {
    id: string
    name: string
    teluguName: string
    code: string
    question_count: number
  }[]
  available_classes: string[]
  available_topics: {
    name: string
    count: number
    subtopics: string[]
  }[]
  available_difficulties: {
    name: string
    count: number
  }[]
  total_matching_questions: number
}
