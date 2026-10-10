export interface Proficiency { subject: string; accuracy_pct: number; attempted: number; correct: number; status: string }
export interface RecentAttempt { attempt_id: string; mock_test_id: string; title: string; submitted_at: string | null; score: number; total_marks: number; accuracy_pct: number; rank: number | null; percentile: number | null }
export interface Performance {
  has_data: boolean; overall_accuracy_pct: number; accuracy_delta_pct: number | null;
  mocks_completed: number; avg_mock_score: number; mock_total_marks: number;
  best_rank: number | null; best_percentile: number | null; questions_attempted: number;
  subjects_covered: number; subject_breakdown: Proficiency[]; recent_attempts: RecentAttempt[]; weak_areas: Proficiency[];
}
export interface Overview {
  summary: { study_streak_days: number; questions_solved: number; avg_accuracy_pct: number; practice_sessions: number; modules_completed: number; modules_in_progress: number; modules_total: number; last_active_at: string | null };
  syllabus: { sections: {id: string; name: string; questions: number; marks: number}[]; total_questions: number; total_marks: number; duration_minutes: number };
}
