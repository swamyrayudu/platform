// ============================================================
// lib/practice/subjects/mathematics/index.ts — Mathematics Subject Provider
// ============================================================

import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'
import {
  fetchTeluguMediumMathQuestions,
  fetchEnglishMediumMathQuestions,
  fetchMathQuestionsByMedium,
  generateSmartMathSession,
  getMathAnalytics,
} from './fetch-algorithms'

export * from './fetch-algorithms'

export const MathematicsMetadata: SubjectMetadata = {
  id: 'Mathematics',
  name: 'Mathematics',
  teluguName: 'గణితం',
  code: 'MATH',
  iconName: 'Calculator',
  color: 'text-emerald-600 dark:text-emerald-400',
  bg: 'bg-emerald-500/10 border-emerald-500/30',
  tag: 'Arithmetic & Geometry',
  tableName: 'telugu_medium_math',
  fallbackToUnifiedTable: true,
  supportedMediums: ['english', 'telugu'],
  defaultClasses: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'],
}

export class MathematicsSubjectProvider implements SubjectProvider {
  readonly metadata = MathematicsMetadata

  /**
   * Fetches questions using dedicated algorithms for Telugu Medium (`telugu_medium_math`)
   * and English Medium (`mathematics_subject_questions`).
   */
  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    if (medium) {
      return fetchMathQuestionsByMedium(medium)
    }

    // When no medium specified, fetch both in parallel and merge uniquely
    const [teluguQ, englishQ] = await Promise.all([
      fetchTeluguMediumMathQuestions(),
      fetchEnglishMediumMathQuestions(),
    ])

    const seenIds = new Set<string>()
    const merged: PracticeQuestion[] = []
    ;[...teluguQ, ...englishQ].forEach((q) => {
      const qId = q.question_id || q.id
      if (!seenIds.has(qId)) {
        seenIds.add(qId)
        merged.push(q)
      }
    })

    return merged
  }
}
