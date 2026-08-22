// ============================================================
// lib/practice/subjects/types.ts — Practice Subject Interface
// ============================================================

import type { PracticeMedium, PracticeQuestion } from '@/types/practice'

export type SubjectId =
  | 'English'
  | 'Telugu'
  | 'Mathematics'
  | 'Science'
  | 'Social Studies'
  | 'Pedagogy'
  | string

export interface SubjectMetadata {
  id: SubjectId
  name: string
  teluguName: string
  code: string
  iconName: 'Languages' | 'BookOpen' | 'Calculator' | 'FlaskConical' | 'Globe' | 'Brain'
  color: string
  bg: string
  tag: string
  tableName: string
  fallbackToUnifiedTable?: boolean
  supportedMediums: PracticeMedium[]
  defaultClasses?: string[]
}

export interface SubjectProvider {
  readonly metadata: SubjectMetadata

  /**
   * Fetch questions specifically for this subject.
   * Medium can be 'english', 'telugu', or undefined for all mediums.
   */
  fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]>
}
