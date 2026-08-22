// ============================================================
// lib/practice/subjects/social-studies/index.ts — Social Studies Subject Provider
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'
import {
  fetchTeluguMediumQuestions,
  fetchEnglishMediumQuestions,
  fetchQuestionsByMedium,
  generateSmartSocialSession,
  getSocialMediumAnalytics,
} from './fetch-algorithms'

export * from './fetch-algorithms'

export const SocialStudiesMetadata: SubjectMetadata = {
  id: 'Social Studies',
  name: 'Social Studies',
  teluguName: 'సాంఘిక శాస్త్రం',
  code: 'SOC',
  iconName: 'Globe',
  color: 'text-rose-600 dark:text-rose-400',
  bg: 'bg-rose-500/10 border-rose-500/30',
  tag: 'Geography & Polity',
  tableName: 'socal_english_medium',
  fallbackToUnifiedTable: true,
  supportedMediums: ['english', 'telugu'],
  defaultClasses: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'],
}

export class SocialStudiesSubjectProvider implements SubjectProvider {
  readonly metadata = SocialStudiesMetadata

  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    if (medium) {
      return fetchQuestionsByMedium(medium)
    }

    // When no medium specified, fetch both in parallel
    const [teluguQ, englishQ] = await Promise.all([
      fetchTeluguMediumQuestions(),
      fetchEnglishMediumQuestions(),
    ])

    return [...teluguQ, ...englishQ]
  }
}
