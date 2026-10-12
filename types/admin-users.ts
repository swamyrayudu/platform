import type { PublicUser } from '@/lib/auth/types'

export interface AdminUser extends PublicUser {
  createdAt: string
  updatedAt: string
  subscriptionStartedAt: string | null
  lastActivityAt: string | null
  isPremium: boolean
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AdminUsersResponse {
  success: true
  users: AdminUser[]
  pagination: Pagination
}

export interface AdminUserSummary {
  success: true
  user: AdminUser
  usage: {
    practiceSessions: number
    practiceCompleted: number
    questionsAnswered: number
    correctAnswers: number
    practiceAccuracy: number | null
    mockAttempts: number
    mockSubmitted: number
    devices: number
    activeSessions: number
    activityEvents: number
  }
  payments: {
    orders: number
    paid: number
    failed: number
    pending: number
    totals: { currency: string; amount: number }[]
  }
}

export const USER_HISTORY_SECTIONS = ['activity', 'practice', 'questions', 'mocks', 'payments', 'devices'] as const
export type UserHistorySection = typeof USER_HISTORY_SECTIONS[number]

export interface UserActivity {
  id: string; event_type: string; created_at: string
}
export interface UserPractice {
  id: string; subject: string; medium: string; topics: string[]; mode: string
  question_count: number; score: number; accuracy_pct: number; status: string
  time_spent_seconds: number; started_at: string; completed_at: string | null
}
export interface UserQuestionAttempt {
  id: string; question_id: string; subject: string; topic: string; difficulty: string
  selected_answer: string | null; is_correct: boolean; time_taken_seconds: number; attempted_at: string
}
export interface UserMockAttempt {
  id: string; status: string; score: number; total_marks: number; percentage: number
  correct_count: number; incorrect_count: number; unanswered_count: number
  time_spent_seconds: number; rank: number | null; percentile: number | null
  started_at: string; submitted_at: string | null
  mock_tests: { title: string; module_number: number | null } | null
}
export interface UserPayment {
  id: string; plan_id: string; amount: number; currency: string; status: string
  coupon_code: string | null; discount_percent: number; failure_reason: string | null
  confirmed_via: string | null; razorpay_order_id: string; razorpay_payment_id: string | null
  paid_at: string | null; created_at: string
}
export interface UserDevice {
  id: string; platform: string; user_agent: string | null
  first_login_at: string; last_login_at: string; login_count: number
}
export interface HistoryRows {
  activity: UserActivity
  practice: UserPractice
  questions: UserQuestionAttempt
  mocks: UserMockAttempt
  payments: UserPayment
  devices: UserDevice
}
export type AdminUserHistoryResponse = {
  [Section in UserHistorySection]: {
    success: true; section: Section; rows: HistoryRows[Section][]; pagination: Pagination
  }
}[UserHistorySection]
