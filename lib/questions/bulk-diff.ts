// ============================================================
// lib/questions/bulk-diff.ts — What a pasted CSV would do
// ============================================================
// Pulled out of the route handler so it can be exercised on its own: this is
// the part that decides which exam questions get overwritten, and it should be
// testable without a session, a request or a database.
//
// It is pure. Give it the parsed paste and the rows currently in the table,
// and it returns the per-row verdict plus the exact column updates to write.
// The route does auth, I/O and cache invalidation around it, and calls it
// again — on the same bytes — when applying, so the diff an admin approved is
// the diff that runs.
// ============================================================

import type { CsvRow } from './csv'
import {
  BULK_EDITABLE_COLUMNS,
  BULK_TAXONOMY_COLUMNS,
  type BulkEditableColumn,
  type BulkFieldDiff,
  type BulkRowResult,
  type BulkRowStatus,
} from '@/types/bulk-update'

export const VALID_ANSWERS = ['A', 'B', 'C', 'D']

const REQUIRED_COLUMNS = ['question', 'option_a', 'option_b', 'option_c', 'option_d'] as const
const OPTION_COLUMNS = ['option_a', 'option_b', 'option_c', 'option_d'] as const

export interface BulkDiffInput {
  /** Rows from parseCsv, question_id already normalised to a bare id. */
  rows: CsvRow[]
  /** 1-based source line per row, same length as `rows`. */
  rowLines: number[]
  /** Current database rows, keyed by question_id. */
  current: Map<string, Record<string, string | null>>
  /** Editable columns actually present in the paste's header. */
  presentColumns: readonly BulkEditableColumn[]
  /** Which question_ids appeared more than once, and where first seen. */
  duplicates: Set<string>
  firstIndexById: Map<string, number>
  /** False keeps the database's correct_answer no matter what was pasted. */
  allowAnswerChange: boolean
  /** Only used in the "no row with this id" message. */
  tableName: string
}

export interface BulkDiffOutput {
  results: BulkRowResult[]
  /** Rows to write, with only the columns that actually differ. */
  writes: { id: string; update: Record<string, string> }[]
}

export function diffPastedRows(input: BulkDiffInput): BulkDiffOutput {
  const {
    rows,
    rowLines,
    current,
    presentColumns,
    duplicates,
    firstIndexById,
    allowAnswerChange,
    tableName,
  } = input

  const results: BulkRowResult[] = []
  const writes: { id: string; update: Record<string, string> }[] = []

  rows.forEach((row, index) => {
    const line = rowLines[index] ?? index + 2
    const questionId = (row.question_id ?? '').trim()
    const errors: string[] = []
    const warnings: string[] = []
    const diffs: BulkFieldDiff[] = []
    let changesAnswer = false
    let changesTaxonomy = false

    if (!questionId) {
      results.push({
        questionId: '',
        line,
        status: 'invalid',
        diffs: [],
        errors: ['Missing question_id'],
        warnings: [],
        changesAnswer: false,
        changesTaxonomy: false,
      })
      return
    }

    // The first occurrence is treated as the real one; later ones are refused
    // rather than silently letting the last write win.
    if (duplicates.has(questionId) && firstIndexById.get(questionId) !== index) {
      results.push({
        questionId,
        line,
        status: 'invalid',
        diffs: [],
        errors: ['This question_id appears more than once in the paste'],
        warnings: [],
        changesAnswer: false,
        changesTaxonomy: false,
      })
      return
    }

    const existing = current.get(questionId)
    if (!existing) {
      results.push({
        questionId,
        line,
        status: 'not_found',
        diffs: [],
        errors: [],
        warnings: [`No question with this id in ${tableName}`],
        changesAnswer: false,
        changesTaxonomy: false,
      })
      return
    }

    const update: Record<string, string> = {}

    for (const column of presentColumns) {
      const incoming = (row[column] ?? '').trim()
      const before = (existing[column] ?? '').trim()

      // An empty cell means "leave it alone", not "erase it". A chat tool that
      // returns only the columns it rewrote must not blank the rest.
      if (incoming === '') continue

      if (column === 'correct_answer') {
        const normalised = incoming.toUpperCase()
        if (!VALID_ANSWERS.includes(normalised)) {
          errors.push(`correct_answer must be A, B, C or D (got "${incoming}")`)
          continue
        }
        if (normalised !== before.toUpperCase()) {
          if (!allowAnswerChange) {
            warnings.push(`Answer change ${before || '—'} → ${normalised} skipped (not allowed)`)
            continue
          }
          changesAnswer = true
          diffs.push({ column, before, after: normalised })
          update[column] = normalised
        }
        continue
      }

      if (incoming !== before) {
        if ((BULK_TAXONOMY_COLUMNS as readonly string[]).includes(column)) {
          changesTaxonomy = true
        }
        diffs.push({ column, before, after: incoming })
        update[column] = incoming
      }
    }

    // Sanity is checked against the row as it would be AFTER the edit, not
    // against the paste alone — a paste that only rewrites option_a must still
    // leave a question with four distinct, non-empty options.
    const merged = (column: BulkEditableColumn): string =>
      update[column] ?? (existing[column] ?? '').trim()

    for (const required of REQUIRED_COLUMNS) {
      if (!merged(required)) errors.push(`${required.replace('_', ' ')} would be empty`)
    }

    const options = OPTION_COLUMNS.map(merged)
    if (options.some((value, i) => value && options.indexOf(value) !== i)) {
      warnings.push('Two options have identical text')
    }

    const answer = merged('correct_answer').toUpperCase()
    if (answer && !VALID_ANSWERS.includes(answer)) {
      errors.push(`correct_answer is "${answer}" — must be A, B, C or D`)
    }

    let status: BulkRowStatus
    if (errors.length > 0) status = 'invalid'
    else if (diffs.length === 0) status = 'unchanged'
    else status = 'changed'

    if (status === 'changed') writes.push({ id: questionId, update })

    results.push({
      questionId, line, status, diffs, errors, warnings, changesAnswer, changesTaxonomy,
    })
  })

  return { results, writes }
}

/**
 * Normalise the question_id column in place and report duplicates.
 *
 * A `table:id` uid is accepted too — that is the form the rest of the admin
 * uses, so it is an easy thing to paste by mistake.
 */
export function collectIds(
  rows: CsvRow[],
  tableName: string
): { ids: string[]; duplicates: Set<string>; firstIndexById: Map<string, number> } {
  const firstIndexById = new Map<string, number>()
  const duplicates = new Set<string>()
  const ids: string[] = []
  const prefix = `${tableName}:`

  rows.forEach((row, index) => {
    const raw = (row.question_id ?? '').trim()
    const id = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw
    row.question_id = id
    if (!id) return
    if (firstIndexById.has(id)) {
      duplicates.add(id)
      return
    }
    firstIndexById.set(id, index)
    ids.push(id)
  })

  return { ids, duplicates, firstIndexById }
}

/** Editable columns the paste's header actually carries. */
export function presentEditableColumns(headers: readonly string[]): BulkEditableColumn[] {
  return BULK_EDITABLE_COLUMNS.filter((c) => headers.includes(c))
}
