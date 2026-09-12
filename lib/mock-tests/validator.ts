// ============================================================
// lib/mock-tests/validator.ts — Blueprint Distribution Validator
// ============================================================
// Validates that a proposed question mapping satisfies all
// blueprint rules before a Grand Mock is published.
// Used in: /api/admin/mock-tests/[id]/preview
//          /api/admin/mock-tests/[id]/publish
// ============================================================

import type { ExamBlueprint, BlueprintValidationResult, MockTestQuestionMapping } from '@/types/mock-tests'
import { getBlueprintTotalQuestions } from './blueprints'

export interface QuestionMappingWithMeta extends MockTestQuestionMapping {
  difficulty?: string
  is_active?: boolean
  question?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
}

/**
 * Validate that a set of question mappings satisfies blueprint constraints.
 *
 * Checks:
 *  1. Total count matches blueprint.total_questions (must be exactly right)
 *  2. Question numbers form a complete, gapless sequence from 1..N
 *  3. No duplicate question IDs (enforced by DB, but also validated here)
 *  4. No duplicate question numbers (enforced by DB, but also validated here)
 *  5. Per-section counts match blueprint section counts
 *  6. All questions have non-empty content (question text + 4 options)
 *  7. All questions are marked as active (is_active = true)
 */
export function validateBlueprint(
  blueprint: ExamBlueprint,
  mappings: QuestionMappingWithMeta[]
): BlueprintValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Total question count
  const expected = getBlueprintTotalQuestions(blueprint)
  if (mappings.length !== expected) {
    errors.push(
      `Total question count mismatch: blueprint expects ${expected}, got ${mappings.length}`
    )
  }

  // 2. Question numbers form a gapless sequence 1..N
  const questionNumbers = mappings.map((m) => m.question_number).sort((a, b) => a - b)
  for (let i = 0; i < questionNumbers.length; i++) {
    if (questionNumbers[i] !== i + 1) {
      errors.push(
        `Question number gap detected: expected position ${i + 1}, found ${questionNumbers[i]}`
      )
      break // Report first gap only
    }
  }

  // 3. No duplicate question IDs
  const questionIdSet = new Set<string>()
  const duplicateIds: string[] = []
  for (const m of mappings) {
    if (questionIdSet.has(m.question_id)) {
      duplicateIds.push(m.question_id)
    }
    questionIdSet.add(m.question_id)
  }
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate question IDs found: ${duplicateIds.slice(0, 5).join(', ')}${duplicateIds.length > 5 ? '...' : ''}`)
  }

  // 4. No duplicate question numbers
  const qNumSet = new Set<number>()
  const duplicateNums: number[] = []
  for (const m of mappings) {
    if (qNumSet.has(m.question_number)) {
      duplicateNums.push(m.question_number)
    }
    qNumSet.add(m.question_number)
  }
  if (duplicateNums.length > 0) {
    errors.push(`Duplicate question numbers found: ${duplicateNums.slice(0, 5).join(', ')}`)
  }

  // 5. Per-section counts
  const sectionCounts: Record<string, { expected: number; got: number; valid: boolean }> = {}
  for (const section of blueprint.sections) {
    const got = mappings.filter((m) => m.section_id === section.id).length
    const valid = got === section.total_questions
    sectionCounts[section.id] = { expected: section.total_questions, got, valid }
    if (!valid) {
      errors.push(
        `Section "${section.name}" (${section.id}): expected ${section.total_questions} questions, got ${got}`
      )
    }
  }

  // 6. Question content validation (only if metadata is provided)
  const incompleteQuestions: string[] = []
  for (const m of mappings) {
    if (m.question !== undefined) {
      // Metadata is available — validate content completeness
      if (!m.question || !m.option_a || !m.option_b || !m.option_c || !m.option_d) {
        incompleteQuestions.push(m.question_id)
      }
    }
  }
  if (incompleteQuestions.length > 0) {
    errors.push(
      `${incompleteQuestions.length} questions have incomplete content (missing question/options): ${incompleteQuestions.slice(0, 5).join(', ')}`
    )
  }

  // 7. Active status validation
  const inactiveQuestions: string[] = []
  for (const m of mappings) {
    if (m.is_active === false) {
      inactiveQuestions.push(m.question_id)
    }
  }
  if (inactiveQuestions.length > 0) {
    errors.push(
      `${inactiveQuestions.length} questions are inactive/unpublished: ${inactiveQuestions.slice(0, 5).join(', ')}`
    )
  }

  // Warn if metadata not available for content validation
  const hasMeta = mappings.some((m) => m.question !== undefined)
  if (!hasMeta && mappings.length > 0) {
    warnings.push('Question content validation skipped — metadata not loaded. Run a preview with full content to validate.')
  }

  return {
    valid: errors.length === 0,
    total_questions: mappings.length,
    errors,
    warnings,
    section_counts: sectionCounts,
  }
}
