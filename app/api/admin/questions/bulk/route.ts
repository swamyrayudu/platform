// ============================================================
// app/api/admin/questions/bulk/route.ts
// GET  /api/admin/questions/bulk — export a slice of one table as rows
// POST /api/admin/questions/bulk — preview or apply a pasted CSV
// ============================================================
// The question bank is ~37k rows written by several different generators, and
// the wording needs a human-in-the-loop pass a hundred at a time. This route
// is the two halves of that loop: hand out a slice, take the rewritten slice
// back.
//
// TWO RULES MAKE THIS SAFE:
//
// 1. ROWS ARE MATCHED BY question_id, NEVER BY POSITION. The "1-100" range
//    only decides which rows are handed out. Ranges are row offsets because
//    the ids are not uniformly sequential — english_medium_science uses
//    hashes, socal_english_medium mixes two schemes — so position means
//    nothing outside the one ordering used here, and pasting rows back
//    against a changed range would otherwise overwrite the wrong questions.
//
// 2. PREVIEW AND APPLY PARSE THE SAME BYTES. The client posts raw CSV both
//    times, so the diff an admin approves is computed by the same code that
//    performs the write. A client cannot preview one thing and apply another.
//
// Edits land in practice immediately (its providers read these tables live)
// and in mock tests as soon as the module cache is dropped, which this route
// does for every module mapping an edited question.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { invalidateMockTestCache } from '@/lib/mock-tests/cache'
import { parseCsv } from '@/lib/questions/csv'
import { getQuestionTable, buildQuestionUid } from '@/lib/questions/tables'
import { collectIds, diffPastedRows, presentEditableColumns } from '@/lib/questions/bulk-diff'
import { matchDifficulty } from '@/lib/mock-tests/question-bank'
import {
  BULK_CSV_COLUMNS,
  BULK_EDITABLE_COLUMNS,
  BULK_MAX_ROWS,
  BULK_TAXONOMY_CHECKED_COLUMNS,
  type BulkEditableColumn,
  type BulkExportRow,
} from '@/types/bulk-update'

/** Hard cap on the request body. 500 rows of Telugu is comfortably under this. */
const MAX_CSV_BYTES = 8 * 1024 * 1024

/**
 * Rows are ordered by question_id so that "row 1-100" means the same hundred
 * rows every time. Any stable ordering would do; this one is also the order an
 * admin sees everywhere else.
 */
const ORDER_COLUMN = 'question_id'

const SELECT_COLUMNS = ['question_id', ...BULK_EDITABLE_COLUMNS].join(', ')

/** Reject anything that is not a real question table before it reaches a query. */
function resolveTable(name: string | null): string | null {
  if (!name) return null
  const config = getQuestionTable(name)
  return config ? config.table : null
}

function rangeError(from: number, to: number): string | null {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return 'Range must be whole numbers with from ≤ to, starting at 1'
  }
  if (to - from + 1 > BULK_MAX_ROWS) {
    return `A range may cover at most ${BULK_MAX_ROWS} questions`
  }
  return null
}

/**
 * The question_ids occupying rows `from`..`to`.
 *
 * Shared by the export and the apply check on purpose: a paste is only allowed
 * to touch the rows that were handed out, and both halves have to agree on
 * which rows those are, down to the ordering.
 */
async function idsInRange(table: string, from: number, to: number): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('question_id')
    .order(ORDER_COLUMN, { ascending: true })
    .range(from - 1, to - 1)
  if (error) throw error
  return new Set((data ?? []).map((r) => String((r as { question_id: string }).question_id)))
}

// ---- GET: hand out a slice ---------------------------------------

export const GET = requireAdmin(async (request) => {
  try {
    const url = new URL(request.url)
    const table = resolveTable(url.searchParams.get('table'))
    if (!table) {
      return NextResponse.json({ success: false, error: 'Unknown question table' }, { status: 400 })
    }

    const from = Number(url.searchParams.get('from') ?? '1')
    const to = Number(url.searchParams.get('to') ?? '100')

    const badRange = rangeError(from, to)
    if (badRange) {
      return NextResponse.json({ success: false, error: badRange }, { status: 400 })
    }

    const { count, error: countError } = await supabaseAdmin
      .from(table)
      .select('question_id', { count: 'exact', head: true })

    if (countError) throw countError

    const { data, error } = await supabaseAdmin
      .from(table)
      .select(SELECT_COLUMNS)
      .order(ORDER_COLUMN, { ascending: true })
      // PostgREST range is inclusive and 0-based; the UI counts from 1.
      .range(from - 1, to - 1)

    if (error) throw error

    // Built from the column list, not written out field by field — see the
    // note on BulkExportRow for what hand-listing them cost.
    const rows: BulkExportRow[] = ((data ?? []) as unknown as Record<string, string | null>[]).map(
      (row) =>
        Object.fromEntries(
          BULK_CSV_COLUMNS.map((column) => [column, row[column] ?? ''])
        ) as BulkExportRow
    )

    return NextResponse.json({
      success: true,
      table,
      total: count ?? 0,
      from,
      to,
      rows,
    })
  } catch (err) {
    console.error('[AdminBulk] export failed:', err)
    return NextResponse.json({ success: false, error: 'Could not read that range' }, { status: 500 })
  }
})

/**
 * Of the given topic/subtopic values, the ones that appear nowhere else in the
 * table.
 *
 * A rewrite pass legitimately fixes a wrong topic, but it also happily invents
 * a near-miss spelling of an existing one. Practice filters on topic, so that
 * would quietly split one filter entry into two rather than correcting
 * anything. One tiny existence query per distinct value — a hundred rows
 * moving to three topics costs three queries, not a hundred.
 */
async function unknownTaxonomyValues(
  table: string,
  values: Map<string, Set<string>>
): Promise<string[]> {
  const unknown: string[] = []

  for (const [column, set] of values) {
    for (const value of set) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('question_id')
        .eq(column, value)
        .limit(1)
      if (error) throw error
      if (!data || data.length === 0) unknown.push(`${column}: ${value}`)
    }
  }

  return unknown
}

// ---- POST: preview, or apply -------------------------------------

/** Every mock module mapping any of these questions, deduped in one query. */
async function findModulesUsingAny(uids: string[]) {
  if (uids.length === 0) return []

  const testIds = new Set<string>()
  // Chunked so the generated `in.(...)` filter cannot outgrow the URL PostgREST
  // is given.
  for (let i = 0; i < uids.length; i += 100) {
    const { data } = await supabaseAdmin
      .from('mock_test_questions')
      .select('mock_test_id')
      .in('question_uid', uids.slice(i, i + 100))
    for (const row of data ?? []) testIds.add(row.mock_test_id as string)
  }

  if (testIds.size === 0) return []

  const { data: tests } = await supabaseAdmin
    .from('mock_tests')
    .select('id, version')
    .in('id', [...testIds])

  return (tests ?? []) as { id: string; version: number }[]
}

export const POST = requireAdmin(async (request) => {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const {
      table: tableInput,
      csv,
      apply,
      allowAnswerChange,
      from: fromInput,
      to: toInput,
    } = body as Record<string, unknown>

    const table = resolveTable(typeof tableInput === 'string' ? tableInput : null)
    if (!table) {
      return NextResponse.json({ success: false, error: 'Unknown question table' }, { status: 400 })
    }

    // A paste is only ever checked against a range that was actually loaded.
    // Requiring it here rather than trusting the UI is what makes "you can only
    // update the hundred you loaded" a rule instead of a hidden button.
    const from = Number(fromInput)
    const to = Number(toInput)
    const badRange = rangeError(from, to)
    if (badRange) {
      return NextResponse.json(
        { success: false, error: `Load a range first — ${badRange.toLowerCase()}` },
        { status: 400 }
      )
    }
    if (typeof csv !== 'string' || !csv.trim()) {
      return NextResponse.json({ success: false, error: 'Paste some CSV first' }, { status: 400 })
    }
    if (csv.length > MAX_CSV_BYTES) {
      return NextResponse.json({ success: false, error: 'That paste is too large' }, { status: 413 })
    }

    const shouldApply = apply === true
    const answersAllowed = allowAnswerChange !== false

    // ---- Parse ---------------------------------------------------
    const parsed = parseCsv(csv)
    const fileErrors: string[] = []

    if (!parsed.headers.includes('question_id')) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The CSV needs a question_id column — that is what each row is matched on. Re-copy the range and keep the header row.',
        },
        { status: 400 }
      )
    }
    if (parsed.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No data rows found' }, { status: 400 })
    }
    if (parsed.rows.length > BULK_MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `At most ${BULK_MAX_ROWS} rows per paste` },
        { status: 400 }
      )
    }

    const presentColumns = presentEditableColumns(parsed.headers)
    if (presentColumns.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `None of the editable columns are present. Expected at least one of: ${BULK_EDITABLE_COLUMNS.join(', ')}`,
        },
        { status: 400 }
      )
    }

    const ignored = parsed.headers.filter(
      (h) => h !== 'question_id' && !BULK_EDITABLE_COLUMNS.includes(h as BulkEditableColumn)
    )
    if (ignored.length > 0) {
      fileErrors.push(
        `Ignored ${ignored.length} column(s) this tool never writes: ${ignored.join(', ')}`
      )
    }

    // ---- Match by id, never by position --------------------------
    const { ids, duplicates, firstIndexById } = collectIds(parsed.rows, table)

    // ---- The paste must belong to the range that was loaded ------
    // Without this, loading rows 1-100 and pasting the file from 101-200
    // would quietly update a hundred questions the admin never looked at.
    const allowedIds = await idsInRange(table, from, to)
    const pastedInRange = new Set(ids.filter((id) => allowedIds.has(id)))
    const outOfRangeIds = new Set(ids.filter((id) => !allowedIds.has(id)))

    // ---- Read the current rows -----------------------------------
    const current = new Map<string, Record<string, string | null>>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select(SELECT_COLUMNS)
        .in('question_id', ids.slice(i, i + 200))
      if (error) throw error
      for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
        current.set(String(row.question_id), row)
      }
    }

    // ---- Diff ----------------------------------------------------
    const { results, writes } = diffPastedRows({
      rows: parsed.rows,
      rowLines: parsed.rowLines,
      current,
      presentColumns,
      duplicates,
      firstIndexById,
      allowAnswerChange: answersAllowed,
      tableName: table,
    })

    // ---- Flag topic/subtopic values that are new to this table ---
    const proposedTaxonomy = new Map<string, Set<string>>()
    for (const result of results) {
      for (const diff of result.diffs) {
        if ((BULK_TAXONOMY_CHECKED_COLUMNS as readonly string[]).includes(diff.column)) {
          const set = proposedTaxonomy.get(diff.column) ?? new Set<string>()
          set.add(diff.after)
          proposedTaxonomy.set(diff.column, set)
        }
      }
    }
    const newTaxonomyValues = await unknownTaxonomyValues(table, proposedTaxonomy)
    if (newTaxonomyValues.length > 0) {
      const unknownSet = new Set(newTaxonomyValues)
      for (const result of results) {
        for (const diff of result.diffs) {
          if (unknownSet.has(`${diff.column}: ${diff.after}`)) {
            result.warnings.push(
              `"${diff.after}" is a new ${diff.column} — nothing else in this table uses it`
            )
          }
        }
      }
    }

    // ---- Flag difficulty labels the generator cannot read ---------
    // An unknown label is not an error anywhere downstream; it just becomes
    // "medium" without saying so. Surfacing it here is the only chance to
    // notice.
    const unrecognisedDifficulty: string[] = []
    for (const result of results) {
      for (const diff of result.diffs) {
        if (diff.column !== 'difficulty') continue
        if (matchDifficulty(diff.after) === null) {
          if (!unrecognisedDifficulty.includes(diff.after)) {
            unrecognisedDifficulty.push(diff.after)
          }
          result.warnings.push(
            `"${diff.after}" is not a difficulty the mock generator recognises — it would be treated as Medium`
          )
        }
      }
    }

    // A row outside the loaded range is refused whatever else it says, and it
    // reports as its own thing so the UI can explain the real problem rather
    // than showing a generic validation failure.
    for (const result of results) {
      if (outOfRangeIds.has(result.questionId)) {
        result.status = 'out_of_range'
        result.diffs = []
        result.errors = [`Not part of rows ${from}–${to} — this row came from a different range`]
        result.warnings = []
        result.changesAnswer = false
      }
    }
    const blockedByRange = outOfRangeIds.size > 0
    const writable = blockedByRange
      ? []
      : writes.filter(({ id }) => pastedInRange.has(id))

    const summary = {
      parsed: parsed.rows.length,
      changed: results.filter((r) => r.status === 'changed').length,
      unchanged: results.filter((r) => r.status === 'unchanged').length,
      notFound: results.filter((r) => r.status === 'not_found').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
      answerChanges: results.filter((r) => r.changesAnswer).length,
      outOfRange: outOfRangeIds.size,
      missing: allowedIds.size - pastedInRange.size,
      taxonomyChanges: results.filter((r) => r.changesTaxonomy).length,
      newTaxonomyValues,
      unrecognisedDifficulty,
    }

    // ---- Preview stops here --------------------------------------
    if (!shouldApply) {
      return NextResponse.json({
        success: true,
        table,
        applied: false,
        rangeFrom: from,
        rangeTo: to,
        summary,
        rows: results,
        fileErrors,
      })
    }

    if (blockedByRange) {
      return NextResponse.json(
        {
          success: false,
          error: `${outOfRangeIds.size} pasted row(s) are not part of rows ${from}–${to}. Load the range those rows came from, or re-copy this one — nothing was written.`,
        },
        { status: 400 }
      )
    }

    // A single bad row blocks the whole paste: applying most of a batch and
    // reporting the rest leaves the admin with no clear idea of what landed.
    if (summary.invalid > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${summary.invalid} row(s) would not be valid. Fix them and preview again — nothing was written.`,
        },
        { status: 400 }
      )
    }
    if (writable.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nothing to write — every row already matches the database.' },
        { status: 400 }
      )
    }

    // ---- Write ---------------------------------------------------
    // One statement per row: only the columns that actually differ are sent,
    // which an upsert could not express. Chunked so a hundred rows is a few
    // parallel batches rather than a hundred serial round trips.
    let written = 0
    for (let i = 0; i < writable.length; i += 20) {
      const chunk = writable.slice(i, i + 20)
      const outcomes = await Promise.all(
        chunk.map(({ id, update }) =>
          supabaseAdmin.from(table).update(update).eq('question_id', id).select('question_id')
        )
      )
      outcomes.forEach((outcome, index) => {
        if (outcome.error) {
          console.error('[AdminBulk] write failed for', chunk[index]!.id, outcome.error)
          const target = results.find((r) => r.questionId === chunk[index]!.id)
          if (target) {
            target.status = 'invalid'
            target.errors.push('Database rejected this write')
          }
        } else {
          written += outcome.data?.length ?? 0
        }
      })
    }

    // ---- Make it visible to mock candidates ----------------------
    // Practice needs nothing: its providers read the table on every request.
    const modules = await findModulesUsingAny(
      writable.map(({ id }) => buildQuestionUid(table, id))
    )
    await Promise.all(modules.map((m) => invalidateMockTestCache(m.id, m.version)))

    return NextResponse.json({
      success: true,
      table,
      applied: true,
      rangeFrom: from,
      rangeTo: to,
      summary: { ...summary, written, modulesInvalidated: modules.length },
      rows: results,
      fileErrors,
    })
  } catch (err) {
    console.error('[AdminBulk] apply failed:', err)
    return NextResponse.json({ success: false, error: 'Bulk update failed' }, { status: 500 })
  }
})
