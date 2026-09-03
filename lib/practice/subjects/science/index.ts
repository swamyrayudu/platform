// ============================================================
// lib/practice/subjects/science/index.ts — Science Subject Provider
// ============================================================

import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'
import {
  fetchTeluguMediumScienceQuestions,
  fetchEnglishMediumScienceQuestions,
  fetchScienceQuestionsByMedium,
  generateSmartScienceSession,
  getScienceMediumAnalytics,
} from './fetch-algorithms'

export * from './fetch-algorithms'

export const ScienceMetadata: SubjectMetadata = {
  id: 'Science',
  name: 'Science',
  teluguName: 'సాధారణ సైన్స్',
  code: 'SCI',
  iconName: 'FlaskConical',
  color: 'text-cyan-600 dark:text-cyan-400',
  bg: 'bg-cyan-500/10 border-cyan-500/30',
  tag: 'Biology & Physical Science',
  tableName: 'english_medium_science',
  fallbackToUnifiedTable: true,
  supportedMediums: ['english', 'telugu'],
  defaultClasses: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'],
}

export class ScienceSubjectProvider implements SubjectProvider {
  readonly metadata = ScienceMetadata

  /**
   * Fetches questions using dedicated algorithms for Telugu Medium (`telugu_medium_science`)
   * and English Medium (`english_medium_science`).
   */
  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    if (medium) {
      return fetchScienceQuestionsByMedium(medium)
    }

    // When no medium specified, fetch both in parallel and merge uniquely
    const [teluguQ, englishQ] = await Promise.all([
      fetchTeluguMediumScienceQuestions(),
      fetchEnglishMediumScienceQuestions(),
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
