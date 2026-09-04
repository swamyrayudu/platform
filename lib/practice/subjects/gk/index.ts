// ============================================================
// lib/practice/subjects/gk/index.ts — GK & Current Affairs Provider
// ============================================================

import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'
import {
  fetchTeluguMediumGKQuestions,
  fetchEnglishMediumGKQuestions,
  fetchGKQuestionsByMedium,
  generateSmartGKSession,
  getGKMediumAnalytics,
} from './fetch-algorithms'

export * from './fetch-algorithms'

export const GKMetadata: SubjectMetadata = {
  id: 'GK & Current Affairs',
  name: 'GK & Current Affairs',
  teluguName: 'సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు',
  code: 'GK',
  iconName: 'Newspaper',
  color: 'text-indigo-600 dark:text-indigo-400',
  bg: 'bg-indigo-500/10 border-indigo-500/30',
  tag: 'Current Affairs & Static GK',
  tableName: 'gk_english_medium',
  fallbackToUnifiedTable: true,
  supportedMediums: ['english', 'telugu'],
  defaultClasses: ['SGT', 'School Assistant', 'General', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'],
}

export class GKSubjectProvider implements SubjectProvider {
  readonly metadata = GKMetadata

  /**
   * Fetches questions using dedicated algorithms for:
   *  - English Medium (`gk_english_medium`)
   *  - Telugu Medium (`gk_telugu_medium`)
   */
  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    if (medium) {
      return fetchGKQuestionsByMedium(medium)
    }

    // When no medium specified, fetch both in parallel and merge uniquely
    const [teluguQ, englishQ] = await Promise.all([
      fetchTeluguMediumGKQuestions(),
      fetchEnglishMediumGKQuestions(),
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
