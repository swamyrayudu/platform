// ============================================================
// lib/practice/subjects/social-studies/index.ts — Social Studies Subject Provider
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'

export const SocialStudiesMetadata: SubjectMetadata = {
  id: 'Social Studies',
  name: 'Social Studies',
  teluguName: 'సాంఘిక శాస్త్రం',
  code: 'SOC',
  iconName: 'Globe',
  color: 'text-rose-600 dark:text-rose-400',
  bg: 'bg-rose-500/10 border-rose-500/30',
  tag: 'Geography & Polity',
  tableName: 'social_subject_questions',
  fallbackToUnifiedTable: true,
  supportedMediums: ['english', 'telugu'],
  defaultClasses: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'],
}

export class SocialStudiesSubjectProvider implements SubjectProvider {
  readonly metadata = SocialStudiesMetadata

  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    const questions: PracticeQuestion[] = []

    try {
      const { data: socData, error } = await supabaseAdmin
        .from(this.metadata.tableName)
        .select('*')

      if (!error && socData && socData.length > 0) {
        socData.forEach((row: any) => {
          questions.push({
            id: row.id || row.question_id,
            question_id: row.question_id || row.id,
            medium: row.medium || 'english',
            subject: 'Social Studies',
            class_level: row.class_level || 'Class 8',
            chapter: row.chapter || null,
            topic: row.topic || 'Social Studies',
            subtopic: row.subtopic || null,
            difficulty: row.difficulty || 'Medium',
            question_type: row.question_type || 'MCQ',
            question: row.question,
            option_a: row.option_a,
            option_b: row.option_b,
            option_c: row.option_c,
            option_d: row.option_d,
            correct_answer: row.correct_answer,
            explanation: row.explanation,
            source_type: row.source_type,
            language: row.language || 'english',
            tags: row.tags,
            created_at: row.created_at,
            updated_at: row.updated_at,
          })
        })
      }
    } catch (err) {}

    if (this.metadata.fallbackToUnifiedTable) {
      try {
        let query = supabaseAdmin
          .from('dsc_practice_questions')
          .select('*')
          .ilike('subject', 'Social Studies')
          .eq('is_active', true)

        if (medium) {
          query = query.eq('medium', medium)
        }

        const { data: dscData, error } = await query
        if (!error && dscData && dscData.length > 0) {
          const existingIds = new Set(questions.map((q) => q.question_id || q.id))
          dscData.forEach((row: any) => {
            const id = row.question_id || row.id
            if (!existingIds.has(id)) {
              questions.push(row as PracticeQuestion)
            }
          })
        }
      } catch (err) {}
    }

    if (medium) {
      return questions.filter((q) => q.medium.toLowerCase() === medium.toLowerCase())
    }

    return questions
  }
}
