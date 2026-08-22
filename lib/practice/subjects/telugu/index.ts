// ============================================================
// lib/practice/subjects/telugu/index.ts — Telugu Subject Provider
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'

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

  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    const questions: PracticeQuestion[] = []

    // 1. Try fetching from dedicated telugu_subject_questions table
    try {
      const { data: telData, error: telError } = await supabaseAdmin
        .from(this.metadata.tableName)
        .select('*')

      if (!telError && telData && telData.length > 0) {
        telData.forEach((row: any) => {
          questions.push({
            id: row.id || row.question_id,
            question_id: row.question_id || row.id,
            medium: row.medium || 'telugu',
            subject: 'Telugu',
            class_level: row.class_level || 'Class 8',
            chapter: row.chapter || null,
            topic: row.topic || 'వ్యాకరణం',
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
            language: row.language || 'telugu',
            tags: row.tags,
            created_at: row.created_at,
            updated_at: row.updated_at,
          })
        })
      }
    } catch (err) {
      // Ignore if table does not yet exist
    }

    // 2. Fallback / check unified dsc_practice_questions table for Telugu
    if (this.metadata.fallbackToUnifiedTable) {
      try {
        let query = supabaseAdmin
          .from('dsc_practice_questions')
          .select('*')
          .ilike('subject', 'Telugu')
          .eq('is_active', true)

        if (medium) {
          query = query.eq('medium', medium)
        }

        const { data: dscData, error: dscError } = await query
        if (!dscError && dscData && dscData.length > 0) {
          const existingIds = new Set(questions.map((q) => q.question_id || q.id))
          dscData.forEach((row: any) => {
            const id = row.question_id || row.id
            if (!existingIds.has(id)) {
              questions.push(row as PracticeQuestion)
            }
          })
        }
      } catch (err) {
        console.warn('[TeluguSubjectProvider] Error reading dsc_practice_questions:', err)
      }
    }

    if (medium) {
      return questions.filter((q) => q.medium.toLowerCase() === medium.toLowerCase())
    }

    return questions
  }
}
