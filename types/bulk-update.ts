// ============================================================
// types/bulk-update.ts — Contract for the bulk question editor
// ============================================================
// Shared by app/admin/bulk-update and app/api/admin/questions/bulk.
// ============================================================

/**
 * The only columns a paste may write.
 *
 * question_id is identity — a mock module maps to it, so reassigning one would
 * silently repoint an exam at different content.
 *
 * Classification columns are writable too, because a wrong topic or a wrong
 * difficulty is one of the things worth fixing during a rewrite pass. None of
 * them can disturb an existing mock module, which stores a fixed mapping. What
 * they do reach:
 *
 *   topic      a live practice filter, and the spread key for future mock
 *              generation — a spelling variant splits one filter into two
 *   subtopic   shown alongside topic, same fragmentation risk
 *   chapter    display only, plus a fallback for topic when topic is null
 *   difficulty a live practice filter AND the mock difficulty blueprint, where
 *              an unrecognised label silently falls back to "medium"
 *
 * So topic/subtopic are checked against values already in the table, and
 * difficulty is checked against the labels the normaliser understands.
 *
 * subject stays out: it decides which section of a module a question belongs
 * to, and nothing in a wording pass should move it.
 */
export const BULK_EDITABLE_COLUMNS = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'explanation',
  // Appended, not inserted: a CSV exported before these existed still parses,
  // and an 8-column paste is still a valid subset.
  'topic',
  'subtopic',
  'chapter',
  'difficulty',
] as const

/** The subset that classifies a question rather than wording it. */
export const BULK_TAXONOMY_COLUMNS = ['topic', 'subtopic', 'chapter', 'difficulty'] as const

/**
 * Classification columns worth checking against what the table already uses.
 *
 * chapter is left out because nothing filters on it, so a new value there is
 * harmless and a warning would be noise. difficulty is left out because it has
 * a stricter check of its own — a fixed alias list, not whatever happens to be
 * in the table already.
 */
export const BULK_TAXONOMY_CHECKED_COLUMNS = ['topic', 'subtopic'] as const

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
  /**
   * Changes an option or the answer key while somebody is sitting a module
   * that contains it — refused until they finish.
   */
  | 'live_locked'
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
  /** True when this row moves topic, subtopic, chapter or difficulty. */
  changesTaxonomy: boolean
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
  /** In-progress attempts on modules containing any of the pasted questions. */
  liveAttempts: number
  /**
   * Rows refused because they would move an option or the answer key out from
   * under someone mid-exam. A stored answer is only the letter they picked, so
   * changing what B says silently repoints it.
   */
  liveLocked: number
  /** Rows that move topic, subtopic, chapter or difficulty. */
  taxonomyChanges: number
  /**
   * Pasted difficulty labels the mock generator's normaliser does not know.
   * These do not fail — they quietly become "medium" — which is exactly why
   * they are worth seeing before the write.
   */
  unrecognisedDifficulty: string[]
  /**
   * topic/subtopic values in the paste that appear nowhere else in the table.
   * Usually a spelling variant of an existing one, which would split a practice
   * filter in two rather than fixing anything.
   */
  newTaxonomyValues: string[]
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

/**
 * One exported row, derived from BULK_CSV_COLUMNS rather than listed by hand.
 *
 * It was listed by hand once, and adding topic/subtopic/chapter/difficulty to
 * the column list left that literal behind: the query selected twelve columns,
 * the handler copied eight, and the type agreed with the handler — so the
 * export silently shipped four empty columns with nothing failing. Deriving it
 * means a new column cannot be added to the CSV without also being carried.
 */
export type BulkExportRow = Record<(typeof BULK_CSV_COLUMNS)[number], string>

export interface BulkExportResponse {
  success: true
  table: string
  total: number
  from: number
  to: number
  rows: BulkExportRow[]
}
