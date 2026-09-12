// ============================================================
// lib/mock-tests/generator.ts — Single-Module Question Generator
// ============================================================
// Generates the fixed question set for ONE mock module.
//
// This is a thin wrapper over `series-generator.ts`, which plans N modules
// at once. A single module is just a series of length 1, so both paths share
// exactly the same selection rules:
//
//   • medium separation enforced by source table
//   • lowest global usage first (never-used before least-used)
//   • topic round-robin for chapter/topic spread
//   • blueprint difficulty ratios, clamped to what the pool can supply
//   • randomisation applied only after every distribution rule is satisfied
//
// Called ONCE when a module is generated. After that the mapping in
// `mock_test_questions` is fixed and every user sees the same paper.
// ============================================================

import type { ExamBlueprint, BlueprintValidationResult } from '@/types/mock-tests'
import { planModuleSeries, type PlannedModule } from './series-generator'
import { validateBlueprint, type QuestionMappingWithMeta } from './validator'
import { loadUsageCounts } from './usage'
import type { ExamMedium } from './question-bank'
import { isExamMedium } from './question-bank'

/**
 * One resolved question slot, carrying enough content to warm the cache
 * without re-reading the database.
 */
export interface GeneratedMapping {
  /** Globally unique identity: `question_table:question_id`. */
  question_uid: string
  question_id: string
  question_table: string
  question_number: number
  section_id: string
  section_name: string
  marks: number

  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string | null
  difficulty: string | null
  subject: string | null
  chapter: string | null
  topic: string | null
  subtopic: string | null
  question_type: string
}

function toMappings(planned: PlannedModule): GeneratedMapping[] {
  return planned.questions.map((q) => ({
    question_uid: q.question_uid,
    question_id: q.question_id,
    question_table: q.question_table,
    question_number: q.question_number,
    section_id: q.section_id,
    section_name: q.section_name,
    marks: q.marks,
    question: q.question,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_answer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    subject: q.subject,
    chapter: q.chapter,
    topic: q.topic,
    subtopic: q.subtopic,
    question_type: q.question_type,
  }))
}

/**
 * Resolve a stored `mock_tests.medium` value to a generation medium.
 * Legacy rows may say 'bilingual'; a paper must be generated in one medium,
 * so those default to Telugu (the medium the legacy series was seeded in).
 */
export function resolveGenerationMedium(medium: string): ExamMedium {
  return isExamMedium(medium) ? medium : 'telugu'
}

export interface GenerateOneOptions {
  /** Module number used for usage bookkeeping. Defaults to 1. */
  moduleNumber?: number
  series?: string
  /** Skip reading existing usage counters (used by dry runs). */
  skipUsageLookup?: boolean
  seed?: number
}

/**
 * Generate the complete fixed question mapping for a single module.
 *
 * Returns the ordered mappings plus the validation result. The caller decides
 * whether to persist; nothing is written here.
 */
export async function generateGrandMockQuestions(
  blueprint: ExamBlueprint,
  medium: ExamMedium | string = 'telugu',
  options: GenerateOneOptions = {}
): Promise<{
  mappings: GeneratedMapping[]
  validation: BlueprintValidationResult
  warnings: string[]
}> {
  const resolvedMedium = resolveGenerationMedium(String(medium))
  const {
    moduleNumber = 1,
    series = 'adhoc',
    skipUsageLookup = false,
    seed = Date.now() & 0xffffffff,
  } = options

  const existingUsage = skipUsageLookup ? undefined : await loadUsageCounts(resolvedMedium)

  const plan = await planModuleSeries({
    blueprint,
    medium: resolvedMedium,
    moduleFrom: moduleNumber,
    moduleTo: moduleNumber,
    series,
    existingUsage,
    seed,
  })

  const planned = plan.modules[0]
  if (!planned) {
    return {
      mappings: [],
      validation: {
        valid: false,
        total_questions: 0,
        errors: ['Generator produced no module'],
        warnings: [],
        section_counts: {},
      },
      warnings: plan.report.warnings,
    }
  }

  const mappings = toMappings(planned)

  const forValidation: QuestionMappingWithMeta[] = mappings.map((m) => ({
    question_uid: m.question_uid,
    question_id: m.question_id,
    question_table: m.question_table,
    question_number: m.question_number,
    section_id: m.section_id,
    section_name: m.section_name,
    marks: m.marks,
    difficulty: m.difficulty,
    topic: m.topic,
    subject: m.subject,
    question: m.question,
    option_a: m.option_a,
    option_b: m.option_b,
    option_c: m.option_c,
    option_d: m.option_d,
    correct_answer: m.correct_answer,
    is_active: true,
  }))

  const validation = validateBlueprint(blueprint, forValidation, {
    medium: resolvedMedium,
    distributionAsWarning: true,
  })

  return { mappings, validation, warnings: plan.report.warnings }
}
