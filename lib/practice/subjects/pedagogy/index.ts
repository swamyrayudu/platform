// ============================================================
// lib/practice/subjects/pedagogy/index.ts — Pedagogy Subject Provider
// ============================================================

import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'
import {
  fetchPedagogyQuestions,
  generateSmartPedagogySession,
  getPedagogyAnalytics,
} from './fetch-algorithms'

export * from './fetch-algorithms'

export const PedagogyMetadata: SubjectMetadata = {
  id: 'Pedagogy',
  name: 'Pedagogy',
  teluguName: 'సైకాలజీ & బోధన',
  code: 'CDP',
  iconName: 'Brain',
  color: 'text-purple-600 dark:text-purple-400',
  bg: 'bg-purple-500/10 border-purple-500/30',
  tag: 'Child Development',
  tableName: 'pedagogy_subject_questions',
  fallbackToUnifiedTable: true,
  supportedMediums: ['telugu', 'english'],
  defaultClasses: ['SGT', 'School Assistant', 'All'],
}

export class PedagogySubjectProvider implements SubjectProvider {
  readonly metadata = PedagogyMetadata

  /**
   * Fetches questions using optimized algorithmic DB retrieval.
   * Serves both Telugu Medium and English Medium candidates taking Pedagogy / CDP.
   */
  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    if (medium) {
      return fetchPedagogyQuestions(medium)
    }

    // When no medium specified, fetch questions across mediums
    const [teluguQ, englishQ] = await Promise.all([
      fetchPedagogyQuestions('telugu'),
      fetchPedagogyQuestions('english'),
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
