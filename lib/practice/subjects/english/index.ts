// ============================================================
// lib/practice/subjects/english/index.ts — English Subject Provider
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { PracticeMedium, PracticeQuestion } from '@/types/practice'
import type { SubjectMetadata, SubjectProvider } from '../types'

export const EnglishMetadata: SubjectMetadata = {
  id: 'English',
  name: 'English',
  teluguName: 'ఇంగ్లీష్ (భాష II)',
  code: 'ENG',
  iconName: 'Languages',
  color: 'text-blue-600 dark:text-blue-400',
  bg: 'bg-blue-500/10 border-blue-500/30',
  tag: 'Grammar & Pedagogy',
  tableName: 'english_subject_questions',
  fallbackToUnifiedTable: true,
  supportedMediums: ['english', 'telugu'],
  defaultClasses: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'SGT'],
}

export class EnglishSubjectProvider implements SubjectProvider {
  readonly metadata = EnglishMetadata

  async fetchQuestions(medium?: PracticeMedium): Promise<PracticeQuestion[]> {
    const questions: PracticeQuestion[] = []

    try {
      // 1. Fetch from english_subject_questions table
      const { data: engData, error: engError } = await supabaseAdmin
        .from(this.metadata.tableName)
        .select('*')

      if (!engError && engData && engData.length > 0) {
        engData.forEach((row: any) => {
          const baseQ: PracticeQuestion = {
            id: row.id || row.question_id,
            question_id: row.question_id || row.id,
            medium: 'english',
            subject: 'English',
            class_level: row.class_level || 'Class 8',
            chapter: row.chapter || null,
            topic: row.topic || 'General',
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
          }

          // In DSC, English (Language II) is practiced in both English and Telugu mediums
          if (!medium || medium === 'english') {
            questions.push(baseQ)
          }

          if (!medium || medium === 'telugu') {
            questions.push({
              ...baseQ,
              id: `${baseQ.id}_tel`,
              medium: 'telugu',
            })
          }
        })
      }
    } catch (err) {
      console.warn('[EnglishSubjectProvider] Error reading english_subject_questions:', err)
    }

    return questions
  }
}
