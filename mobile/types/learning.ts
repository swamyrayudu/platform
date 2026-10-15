// Types for the Exam roadmap, My Tests and Resources APIs (see the website's
// app/api/dsc-sgt/roadmap, my-tests and resources routes).
export type PlanMedium = 'english' | 'telugu';
export type PlanSubject = 'psychology' | 'perspectives' | 'mathematics' | 'telugu' | 'science' | 'english' | 'social' | 'gk' | 'test' | 'mock' | 'revision' | 'rest';
export type PlanAction = 'practice' | 'mock' | 'performance' | 'none';

export interface RoadmapDay {
  day: number; week: number; phase: 1 | 2 | 3;
  subject: PlanSubject; subject_label: string;
  title: string; topics: string[];
  /** Null on everyday study days: the Practice button says it. */
  task: string | null;
  action: PlanAction; prompt: string;
}
export interface ExamPart {
  id: string; name: string; teluguName: string; marks: number;
  split?: { content: number; methodology: number };
  units: string[]; methodologyUnits?: string[]; note?: string;
}
export interface Roadmap {
  medium: PlanMedium;
  days: RoadmapDay[];
  phases: { phase: 1 | 2 | 3; days: string; title: string }[];
  habits: string[];
  parts: { part: string; label: string; marks: number; days: number; extra?: string }[];
  exam: {
    pattern: { total_questions: number; total_marks: number; duration_minutes: number; marks_per_question: number; negative_marks: number };
    parts: ExamPart[];
    dates: { label: string; date: string | null; note?: string }[];
    dates_updated: string; source: string;
  };
}

export type AnswerLetter = 'A' | 'B' | 'C' | 'D';
export interface MyTestQuestion {
  question: string; option_a: string; option_b: string; option_c: string; option_d: string;
  correct_answer: AnswerLetter; explanation: string; topic: string; difficulty: string;
}
export interface MyTestSummary {
  id: string; title: string; medium: PlanMedium; subject: string; topics: string[];
  question_count: number; duration_minutes: number; created_at: string; last_attempt_at: string | null;
}
/** In the list: best correct answers and attempt count. */
export interface MyTestListItem extends MyTestSummary { best_correct: number | null; attempts: number }
export interface MyTestDetail extends MyTestSummary { questions: MyTestQuestion[] }
export interface MyTestAttempt { id: string; answers: string; correct_count: number; total_questions: number; time_spent_seconds: number; submitted_at: string }
export interface PastedCheck { questions: MyTestQuestion[]; extra: number; problems: { row: number; message: string }[]; problem_count: number }

export type ResourceCategory = 'book' | 'study_material' | 'bit_bank' | 'previous_paper' | 'other';
export interface Resource {
  id: string; title: string; description: string; category: ResourceCategory;
  subject: string; medium: 'english' | 'telugu' | 'both'; access: 'free' | 'pro';
  file_name: string; size_bytes: number; created_at: string;
}
