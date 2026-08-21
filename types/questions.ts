// ============================================================
// types/questions.ts — Types for English Subject Question Bank
// ============================================================

export interface EnglishQuestion {
  id: string
  question_id: string | null
  class_level: string | null
  subject: string
  chapter: string | null
  topic: string | null
  subtopic: string | null
  difficulty: 'Easy' | 'Medium' | 'Hard' | string | null
  question_type: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string | null
  source_type: string | null
  language: string
  tags: string | null
  created_at: string
  updated_at: string
}

export type EnglishQuestionInput = Omit<EnglishQuestion, 'id' | 'created_at' | 'updated_at'>
