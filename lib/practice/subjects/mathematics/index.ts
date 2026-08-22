// ============================================================
// lib/practice/subjects/mathematics/index.ts — Mathematics Subject Provider
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'

export const MathematicsMetadata: SubjectMetadata = {
  id: 'Mathematics',
  name: 'Mathematics',
  teluguName: 'గణితం',
  code: 'MATH',
  iconName: 'Calculator',
  color: 'text-emerald-600 dark:text-emerald-400',
  bg: 'bg-emerald-500/10 border-emerald-500/30',
  tag: 'Arithmetic & Geometry',
  tableName: 'mathematics_subject_questions',
  fallbackToUnifiedTable: true,
  supportedMediums: ['english', 'telugu'],
  defaultClasses: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'],
}

export class MathematicsSubjectProvider implements SubjectProvider {
  readonly metadata = MathematicsMetadata

  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    const questions: PracticeQuestion[] = []

    // 1. Try dedicated table
    try {
      const { data: mathData, error } = await supabaseAdmin
        .from(this.metadata.tableName)
        .select('*')

      if (!error && mathData && mathData.length > 0) {
        mathData.forEach((row: any) => {
          questions.push({
            id: row.id || row.question_id,
            question_id: row.question_id || row.id,
            medium: row.medium || 'english',
            subject: 'Mathematics',
            class_level: row.class_level || 'Class 8',
            chapter: row.chapter || null,
            topic: row.topic || 'General Math',
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

    // 2. Check unified table
    if (this.metadata.fallbackToUnifiedTable) {
      try {
        let query = supabaseAdmin
          .from('dsc_practice_questions')
          .select('*')
          .ilike('subject', 'Mathematics')
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
