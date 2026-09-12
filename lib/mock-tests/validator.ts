// ============================================================
// lib/mock-tests/validator.ts — Module Validation
// ============================================================
// A module is validated BEFORE it can be published. If validation
// fails the module is not published and the admin is told why.
//
// Checks performed:
//   1. Exactly blueprint.total_questions questions
//   2. Question positions form a gapless 1..N sequence
//   3. No duplicate question (by globally unique question_uid)
//   4. No duplicate position
//   5. Correct medium — every question comes from a table the blueprint
//      allows for that medium (this is what stops English and Telugu
//      content being mixed into one paper)
//   6. Correct per-section / subject distribution
//   7. Difficulty distribution within tolerance of the blueprint
//   8. Topic spread — a section must not be one topic repeated
//   9. All questions resolved to real rows (content present)
//  10. All questions active
// ============================================================

import type {
  ExamBlueprint,
  BlueprintValidationResult,
  MockTestQuestionMapping,
} from '@/types/mock-tests'
import { getBlueprintTotalQuestions, resolveSectionTables } from './blueprints'
import { normalizeDifficulty, type ExamMedium, buildQuestionUid } from './question-bank'

export interface QuestionMappingWithMeta extends Partial<MockTestQuestionMapping> {
  question_id: string
  question_table: string
  question_number: number
  section_id: string
  section_name: string
  marks: number
  question_uid?: string

  difficulty?: string | null
  topic?: string | null
  subject?: string | null
  is_active?: boolean
  question?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  correct_answer?: string
}

/** How far the realised difficulty mix may drift from the blueprint, per section. */
const DIFFICULTY_TOLERANCE = 0.5 // 50% of the section's target for a bucket

function uidOf(m: QuestionMappingWithMeta): string {
  return m.question_uid ?? buildQuestionUid(m.question_table, m.question_id)
}

export interface ValidateOptions {
  /**
   * When given, every question must come from a table this blueprint allows
   * for that medium. Omit only for legacy bilingual tests.
   */
  medium?: ExamMedium
  /** Treat difficulty/topic drift as warnings instead of errors. Default true. */
  distributionAsWarning?: boolean
}

/**
 * Validate that a set of question mappings satisfies blueprint constraints.
 */
export function validateBlueprint(
  blueprint: ExamBlueprint,
  mappings: QuestionMappingWithMeta[],
  options: ValidateOptions = {}
): BlueprintValidationResult {
  const { medium, distributionAsWarning = true } = options
  const errors: string[] = []
  const warnings: string[] = []

  // ---- 1. Total question count ----------------------------------
  const expected = getBlueprintTotalQuestions(blueprint)
  if (mappings.length !== expected) {
    errors.push(
      `Total question count mismatch: blueprint expects ${expected}, got ${mappings.length}`
    )
  }

  // ---- 2. Gapless 1..N positions --------------------------------
  const questionNumbers = mappings.map((m) => m.question_number).sort((a, b) => a - b)
  for (let i = 0; i < questionNumbers.length; i++) {
    if (questionNumbers[i] !== i + 1) {
      errors.push(
        `Question number gap detected: expected position ${i + 1}, found ${questionNumbers[i]}`
      )
      break // report the first gap only
    }
  }

  // ---- 3. No duplicate question (by uid) ------------------------
  const seenUids = new Set<string>()
  const duplicateUids: string[] = []
  for (const m of mappings) {
    const uid = uidOf(m)
    if (seenUids.has(uid)) duplicateUids.push(uid)
    seenUids.add(uid)
  }
  if (duplicateUids.length > 0) {
    errors.push(
      `Duplicate questions found: ${duplicateUids.slice(0, 5).join(', ')}${
        duplicateUids.length > 5 ? ` (+${duplicateUids.length - 5} more)` : ''
      }`
    )
  }

  // ---- 4. No duplicate positions --------------------------------
  const qNumSet = new Set<number>()
  const duplicateNums: number[] = []
  for (const m of mappings) {
    if (qNumSet.has(m.question_number)) duplicateNums.push(m.question_number)
    qNumSet.add(m.question_number)
  }
  if (duplicateNums.length > 0) {
    errors.push(`Duplicate question numbers found: ${duplicateNums.slice(0, 5).join(', ')}`)
  }

  // ---- 5/6. Section counts, medium correctness, distributions ----
  const sectionCounts: Record<string, { expected: number; got: number; valid: boolean }> = {}

  for (const section of blueprint.sections) {
    const inSection = mappings.filter((m) => m.section_id === section.id)
    const got = inSection.length
    const valid = got === section.total_questions
    sectionCounts[section.id] = { expected: section.total_questions, got, valid }

    if (!valid) {
      errors.push(
        `Section "${section.name}" (${section.id}): expected ${section.total_questions} questions, got ${got}`
      )
    }

    // --- 5. Medium correctness ---
    if (medium) {
      const allowed = new Set(resolveSectionTables(section, medium))
      const wrongTables = new Set(
        inSection.filter((m) => !allowed.has(m.question_table)).map((m) => m.question_table)
      )
      if (wrongTables.size > 0) {
        errors.push(
          `Section "${section.name}": questions drawn from table(s) not allowed for ${medium} medium: ${[
            ...wrongTables,
          ].join(', ')}`
        )
      }
    }

    if (got === 0) continue

    // --- 7. Difficulty distribution ---
    const dist = section.difficulty_distribution
    const haveDifficultyMeta = inSection.some((m) => m.difficulty !== undefined)
    if (dist && haveDifficultyMeta) {
      const actual = { easy: 0, medium: 0, hard: 0 }
      for (const m of inSection) actual[normalizeDifficulty(m.difficulty)]++

      const targets = {
        easy: section.total_questions * dist.easy_pct,
        medium: section.total_questions * dist.medium_pct,
        hard: section.total_questions * dist.hard_pct,
      }

      for (const bucket of ['easy', 'medium', 'hard'] as const) {
        const target = targets[bucket]
        if (target < 1) continue
        const drift = Math.abs(actual[bucket] - target)
        if (drift > Math.max(1, target * DIFFICULTY_TOLERANCE)) {
          const msg =
            `Section "${section.name}": ${bucket} difficulty is ${actual[bucket]}, ` +
            `blueprint targets ~${target.toFixed(1)} — the source pool may not contain enough ${bucket} questions.`
          if (distributionAsWarning) warnings.push(msg)
          else errors.push(msg)
        }
      }
    }

    // --- 8. Topic spread ---
    const haveTopicMeta = inSection.some((m) => m.topic !== undefined && m.topic !== null)
    if (haveTopicMeta && section.total_questions >= 8) {
      const topics = new Set(inSection.map((m) => m.topic ?? 'General'))
      if (topics.size < 2) {
        const msg = `Section "${section.name}": all ${got} questions come from a single topic ("${
          [...topics][0]
        }").`
        if (distributionAsWarning) warnings.push(msg)
        else errors.push(msg)
      }
    }
  }

  // Questions assigned to a section the blueprint does not define
  const knownSections = new Set(blueprint.sections.map((s) => s.id))
  const strays = new Set(mappings.filter((m) => !knownSections.has(m.section_id)).map((m) => m.section_id))
  if (strays.size > 0) {
    errors.push(`Questions assigned to unknown section(s): ${[...strays].join(', ')}`)
  }

  // ---- 9. Content completeness ----------------------------------
  const incompleteQuestions: string[] = []
  for (const m of mappings) {
    if (m.question !== undefined) {
      if (!m.question || !m.option_a || !m.option_b || !m.option_c || !m.option_d) {
        incompleteQuestions.push(uidOf(m))
      }
    }
  }
  if (incompleteQuestions.length > 0) {
    errors.push(
      `${incompleteQuestions.length} questions have incomplete content (missing question/options): ${incompleteQuestions
        .slice(0, 5)
        .join(', ')}`
    )
  }

  // Missing answer keys would make grading impossible
  const missingAnswer = mappings.filter((m) => m.correct_answer !== undefined && !m.correct_answer)
  if (missingAnswer.length > 0) {
    errors.push(`${missingAnswer.length} questions have no correct_answer and cannot be graded.`)
  }

  // ---- 10. Active status ----------------------------------------
  const inactiveQuestions = mappings.filter((m) => m.is_active === false).map(uidOf)
  if (inactiveQuestions.length > 0) {
    errors.push(
      `${inactiveQuestions.length} questions are inactive/unpublished: ${inactiveQuestions
        .slice(0, 5)
        .join(', ')}`
    )
  }

  const hasMeta = mappings.some((m) => m.question !== undefined)
  if (!hasMeta && mappings.length > 0) {
    warnings.push(
      'Question content validation skipped — metadata not loaded. Run a preview with full content to validate.'
    )
  }

  return {
    valid: errors.length === 0,
    total_questions: mappings.length,
    errors,
    warnings,
    section_counts: sectionCounts,
  }
}
