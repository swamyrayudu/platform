// ============================================================
// lib/practice/subjects/telugu/index.ts — Telugu Subject Provider
// ============================================================

import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'
import {
  fetchTeluguQuestions,
  generateSmartTeluguSession,
  getTeluguAnalytics,
} from './fetch-algorithms'

export * from './fetch-algorithms'

export const TeluguMetadata: SubjectMetadata = {
  id: 'Telugu',
  name: 'Telugu',
  teluguName: 'తెలుగు (భాష I)',
  code: 'TEL',
  iconName: 'BookOpen',
  color: 'text-amber-600 dark:text-amber-400',
  bg: 'bg-amber-500/10 border-amber-500/30',
  tag: 'వ్యాకరణం & సాహిత్యం',
  tableName: 'telugu_subject_questions',
  fallbackToUnifiedTable: true,
  supportedMediums: ['telugu', 'english'],
  defaultClasses: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'],
}

export class TeluguSubjectProvider implements SubjectProvider {
  readonly metadata = TeluguMetadata

  /**
   * Fetches questions using optimized algorithmic DB retrieval.
   * Serves both Telugu Medium and English Medium candidates taking Telugu (Language I).
   */
  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    if (medium) {
      return fetchTeluguQuestions(medium)
    }

    // When no medium specified, fetch questions for both mediums
    const [teluguQ, englishQ] = await Promise.all([
      fetchTeluguQuestions('telugu'),
      fetchTeluguQuestions('english'),
    ])

    return [...teluguQ, ...englishQ]
  }
}
