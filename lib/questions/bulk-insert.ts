// ============================================================
// lib/questions/bulk-insert.ts — What an import CSV would add
// ============================================================
// The sibling of bulk-diff.ts, for new rows rather than edits, and pure for
// the same reason: this decides what gets written into the question bank, so
// it should be exercisable without a request or a database.
//
// The difference that matters: an edit that goes wrong can be corrected by
// editing again, but a bad import leaves rows behind that nothing points at
// and nobody notices. So this is stricter than the update path — a row with
// no answer, three options, or text already in the table is refused outright
// rather than warned about.
// ============================================================

import type { CsvRow } from './csv'

export const VALID_ANSWERS = ['A', 'B', 'C', 'D']

/** Columns an import may set. Everything else takes the table's default. */
export const IMPORT_COLUMNS = [
  'question_id',
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'explanation',
  'topic',
  'subtopic',
  'chapter',
  'difficulty',
  'class_level',
] as const

export type ImportColumn = (typeof IMPORT_COLUMNS)[number]

/** Without these a row is not a usable question. */
export const IMPORT_REQUIRED = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
] as const

export type ImportRowStatus =
  /** Valid and new — will be inserted. */
  | 'new'
  /** Its question_id already exists in the table. */
  | 'duplicate_id'
  /** Its question text already exists in the table. */
  | 'duplicate_text'
  /** Failed validation. */
  | 'invalid'

export interface ImportRowResult {
  /** Supplied by the CSV, or minted later for a row that had none. */
  questionId: string | null
  line: number
  status: ImportRowStatus
  errors: string[]
  warnings: string[]
  /** First 80 characters of the stem, for the preview list. */
  preview: string
}

export interface ImportValidateInput {
  rows: CsvRow[]
  rowLines: number[]
  /** question_id values already in the table. */
  existingIds: ReadonlySet<string>
  /** Normalised question text already in the table. */
  existingText: ReadonlySet<string>
  /** Import columns actually present in the paste's header. */
  presentColumns: readonly ImportColumn[]
}

export interface ImportValidateOutput {
  results: ImportRowResult[]
  /** Rows to insert, in paste order, without question_id — minted later. */
  inserts: { line: number; values: Record<string, string> }[]
}

/**
 * Compare question text the way a human would call two questions "the same":
 * whitespace collapsed, case folded, punctuation left alone because in Telugu
 * it carries meaning.
 */
export function normaliseText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function validateImportRows(input: ImportValidateInput): ImportValidateOutput {
  const { rows, rowLines, existingIds, existingText, presentColumns } = input

  const results: ImportRowResult[] = []
  const inserts: { line: number; values: Record<string, string> }[] = []

  // Collisions inside the paste itself, not just against the table.
  const seenIds = new Set<string>()
  const seenText = new Set<string>()

  rows.forEach((row, index) => {
    const line = rowLines[index] ?? index + 2
    const errors: string[] = []
    const warnings: string[] = []

    const values: Record<string, string> = {}
    for (const column of presentColumns) {
      const value = (row[column] ?? '').trim()
      // An empty cell here means "use the table's default", which is why it is
      // simply not sent rather than written as an empty string.
      if (value !== '') values[column] = value
    }

    const questionId = values.question_id ?? null
    const stem = values.question ?? ''
    const preview = stem.length > 80 ? stem.slice(0, 80) + '…' : stem

    for (const required of IMPORT_REQUIRED) {
      if (!values[required]) errors.push(`${required.replace('_', ' ')} is missing`)
    }

    if (values.correct_answer) {
      const normalised = values.correct_answer.toUpperCase()
      if (!VALID_ANSWERS.includes(normalised)) {
        errors.push(`correct_answer must be A, B, C or D (got "${values.correct_answer}")`)
      } else {
        values.correct_answer = normalised
      }
    }

    const options = ['option_a', 'option_b', 'option_c', 'option_d'].map((c) => values[c] ?? '')
    if (options.every(Boolean) && new Set(options).size < 4) {
      errors.push('Two or more options are identical')
    }

    if (errors.length > 0) {
      results.push({ questionId, line, status: 'invalid', errors, warnings, preview })
      return
    }

    // ---- Duplicates -------------------------------------------
    if (questionId) {
      if (existingIds.has(questionId)) {
        results.push({
          questionId,
          line,
          status: 'duplicate_id',
          errors: [`question_id "${questionId}" already exists — importing would be a second row`],
          warnings: [],
          preview,
        })
        return
      }
      if (seenIds.has(questionId)) {
        results.push({
          questionId,
          line,
          status: 'duplicate_id',
          errors: ['This question_id appears more than once in the paste'],
          warnings: [],
          preview,
        })
        return
      }
      seenIds.add(questionId)
    }

    const key = normaliseText(stem)
    if (existingText.has(key)) {
      results.push({
        questionId,
        line,
        status: 'duplicate_text',
        errors: ['This question is already in the table'],
        warnings: [],
        preview,
      })
      return
    }
    if (seenText.has(key)) {
      results.push({
        questionId,
        line,
        status: 'duplicate_text',
        errors: ['This question appears more than once in the paste'],
        warnings: [],
        preview,
      })
      return
    }
    seenText.add(key)

    if (!values.topic) {
      warnings.push('No topic — practice topic filters will not reach this question')
    }

    results.push({ questionId, line, status: 'new', errors, warnings, preview })
    inserts.push({ line, values })
  })

  return { results, inserts }
}

/** Import columns the paste's header actually carries. */
export function presentImportColumns(headers: readonly string[]): ImportColumn[] {
  return IMPORT_COLUMNS.filter((c) => headers.includes(c))
}
