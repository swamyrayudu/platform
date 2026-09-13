// ============================================================
// types/bulk-update.ts — Contract for the bulk question editor
// ============================================================
// Shared by app/admin/bulk-update and app/api/admin/questions/bulk.
// ============================================================

/**
 * The only columns a paste may write.
 *
 * question_id is identity — a mock module maps to it, so reassigning one would
 * silently repoint an exam at different content. Taxonomy columns (subject,
 * chapter, topic, difficulty) are excluded too: mock generation picks
 * questions by them, so a reworded chapter name would quietly change which
 * module a question is eligible for. Wording is what this tool edits.
 */
export const BULK_EDITABLE_COLUMNS = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'explanation',
] as const

export type BulkEditableColumn = (typeof BULK_EDITABLE_COLUMNS)[number]

/** Column order used for both export and the backup file. */
export const BULK_CSV_COLUMNS = ['question_id', ...BULK_EDITABLE_COLUMNS] as const

/** Hard ceiling on one paste. Keeps a mistake small and the request sane. */
export const BULK_MAX_ROWS = 500

export type BulkRowStatus =
  /** Matched a row and at least one field differs — will be written. */
  | 'changed'
  /** Matched a row but every field is identical — skipped. */
  | 'unchanged'
  /** No row in this table carries that question_id — skipped. */
  | 'not_found'
  /** Real row, but outside the range that was loaded — refused. */
  | 'out_of_range'
  /** Failed validation — skipped, and blocks apply. */
  | 'invalid'

export interface BulkFieldDiff {
  column: BulkEditableColumn
  before: string
  after: string
}

export interface BulkRowResult {
  questionId: string
  /** 1-based line in the pasted CSV, for pointing at the offending row. */
  line: number
  status: BulkRowStatus
  diffs: BulkFieldDiff[]
  /** Why this row is invalid, or what to look at before applying. */
  errors: string[]
  warnings: string[]
  /** True when this row moves the answer key. Drives the red highlight. */
  changesAnswer: boolean
}

export interface BulkPreviewSummary {
  parsed: number
  changed: number
  unchanged: number
  notFound: number
  invalid: number
  answerChanges: number
  /**
   * Pasted rows whose question_id is not part of the range that was loaded.
   * Any of these means the paste belongs to a different slice of the table,
   * and nothing may be written until they are gone.
   */
  outOfRange: number
  /** Rows in the loaded range the paste did not mention. Informational. */
  missing: number
  /** Present only on an applied run. */
  written?: number
  modulesInvalidated?: number
}

export interface BulkPreviewResponse {
  success: true
  table: string
  applied: boolean
  /** The range this paste was checked against — echoed back for the UI. */
  rangeFrom: number
  rangeTo: number
  summary: BulkPreviewSummary
  rows: BulkRowResult[]
  /** Problems with the paste as a whole, not with one row. */
  fileErrors: string[]
}

export interface BulkExportRow {
  question_id: string
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string
}

export interface BulkExportResponse {
  success: true
  table: string
  total: number
  from: number
  to: number
  rows: BulkExportRow[]
}
