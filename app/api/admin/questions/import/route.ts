// ============================================================
// app/api/admin/questions/import/route.ts
// GET  /api/admin/questions/import — what a table looks like before importing
// POST /api/admin/questions/import — preview or insert new questions
// ============================================================
// Adding questions, as opposed to rewriting them. The sibling of
// /api/admin/questions/bulk, and deliberately a separate route: an insert and
// an update fail in different ways and need different guards.
//
// WHY THIS TOUCHES NO MOCK TEST:
// A module is a fixed list of mappings chosen when it was generated. A row
// that did not exist then is in no module now, so nothing that has already
// been built changes, and there is no module cache to drop. New questions
// simply become eligible the next time a module is generated — and they are
// live in practice immediately, because practice reads these tables directly.
//
// The two things that make an import safe:
//   1. Nothing is inserted without a preview, computed by this same code from
//      the same bytes the apply will parse.
//   2. Duplicates are refused, by id and by question text. A bad edit can be
//      edited again; a duplicated row just sits there being served.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { parseCsv } from '@/lib/questions/csv'
import { getQuestionTable } from '@/lib/questions/tables'
import { formatId, mintIds, resolveIdFamily } from '@/lib/questions/id-generator'
import {
  IMPORT_COLUMNS,
  normaliseText,
  presentImportColumns,
  validateImportRows,
} from '@/lib/questions/bulk-insert'
import type { ImportPreviewResponse, ImportTableInfo } from '@/types/bulk-import'

/** One import at a time; keeps a mistake small and the request sane. */
const IMPORT_MAX_ROWS = 500

const MAX_CSV_BYTES = 8 * 1024 * 1024

/** PostgREST caps a response at 1000 rows, so every full-column scan pages. */
const PAGE = 1000

function resolveTable(name: string | null): string | null {
  if (!name) return null
  const config = getQuestionTable(name)
  return config ? config.table : null
}

/**
 * Every question_id and every question text in the table.
 *
 * Paged on purpose: these tables run to 5,255 rows and a single select would
 * silently stop at a thousand, which would make duplicate detection quietly
 * miss four fifths of the table — the exact failure this route exists to
 * prevent.
 */
async function loadExisting(
  table: string
): Promise<{ ids: Set<string>; text: Set<string> }> {
  const ids = new Set<string>()
  const text = new Set<string>()

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('question_id, question')
      .order('question_id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) throw error
    const rows = (data ?? []) as { question_id: string | null; question: string | null }[]
    for (const row of rows) {
      if (row.question_id) ids.add(row.question_id)
      if (row.question) text.add(normaliseText(row.question))
    }
    if (rows.length < PAGE) break
  }

  return { ids, text }
}

// ---- GET: describe the table -------------------------------------

export const GET = requireAdmin(async (request) => {
  try {
    const url = new URL(request.url)
    const table = resolveTable(url.searchParams.get('table'))
    if (!table) {
      return NextResponse.json({ success: false, error: 'Unknown question table' }, { status: 400 })
    }

    const { ids } = await loadExisting(table)
    const family = resolveIdFamily(table, [...ids])

    const info: ImportTableInfo = {
      success: true,
      table,
      total: ids.size,
      idPattern: formatId(family, family.highest + 1),
      idDerived: family.derived,
      idCoverage: Math.round(family.coverage * 100),
      columns: [...IMPORT_COLUMNS],
    }
    return NextResponse.json(info)
  } catch (err) {
    console.error('[AdminImport] describe failed:', err)
    return NextResponse.json({ success: false, error: 'Could not read that table' }, { status: 500 })
  }
})

// ---- POST: preview, or insert ------------------------------------

export const POST = requireAdmin(async (request) => {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const { table: tableInput, csv, apply } = body as Record<string, unknown>

    const table = resolveTable(typeof tableInput === 'string' ? tableInput : null)
    if (!table) {
      return NextResponse.json({ success: false, error: 'Unknown question table' }, { status: 400 })
    }
    if (typeof csv !== 'string' || !csv.trim()) {
      return NextResponse.json({ success: false, error: 'Paste some CSV first' }, { status: 400 })
    }
    if (csv.length > MAX_CSV_BYTES) {
      return NextResponse.json({ success: false, error: 'That paste is too large' }, { status: 413 })
    }

    const shouldApply = apply === true

    // ---- Parse ---------------------------------------------------
    const parsed = parseCsv(csv)
    const fileErrors: string[] = []

    if (parsed.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No data rows found' }, { status: 400 })
    }
    if (parsed.rows.length > IMPORT_MAX_ROWS) {
      return NextResponse.json(
        { success: false, error: `At most ${IMPORT_MAX_ROWS} rows per import` },
        { status: 400 }
      )
    }

    const presentColumns = presentImportColumns(parsed.headers)
    const missingRequired = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']
      .filter((c) => !parsed.headers.includes(c))
    if (missingRequired.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `The CSV is missing required column(s): ${missingRequired.join(', ')}`,
        },
        { status: 400 }
      )
    }

    const ignored = parsed.headers.filter(
      (h) => !(IMPORT_COLUMNS as readonly string[]).includes(h)
    )
    if (ignored.length > 0) {
      fileErrors.push(
        `Ignored ${ignored.length} column(s) an import does not set: ${ignored.join(', ')}`
      )
    }

    // ---- Validate against what is already there -------------------
    const { ids: existingIds, text: existingText } = await loadExisting(table)
    const { results, inserts } = validateImportRows({
      rows: parsed.rows,
      rowLines: parsed.rowLines,
      existingIds,
      existingText,
      presentColumns,
    })

    // ---- Number the rows that arrived without an id ---------------
    const family = resolveIdFamily(table, [...existingIds])
    const supplied = new Set(
      results.filter((r) => r.questionId).map((r) => r.questionId as string)
    )
    const needIds = inserts.filter((i) => !i.values.question_id)
    const minted = mintIds(family, needIds.length, new Set([...existingIds, ...supplied]))
    needIds.forEach((insert, index) => {
      insert.values.question_id = minted[index]!
    })
    // Reflect the minted ids back so the preview shows what will be written.
    for (const insert of inserts) {
      const target = results.find((r) => r.line === insert.line)
      if (target) target.questionId = insert.values.question_id ?? null
    }

    const summary = {
      parsed: parsed.rows.length,
      toInsert: results.filter((r) => r.status === 'new').length,
      duplicateId: results.filter((r) => r.status === 'duplicate_id').length,
      duplicateText: results.filter((r) => r.status === 'duplicate_text').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
      generatedIds: minted.length,
    }

    const response: ImportPreviewResponse = {
      success: true,
      table,
      applied: false,
      idPattern: formatId(family, family.highest + 1),
      idDerived: family.derived,
      summary,
      rows: results,
      fileErrors,
    }

    if (!shouldApply) return NextResponse.json(response)

    // A refused row blocks the batch. Importing most of a file and reporting
    // the rest leaves an admin unsure which questions now exist.
    if (summary.invalid + summary.duplicateId + summary.duplicateText > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${summary.invalid + summary.duplicateId + summary.duplicateText} row(s) cannot be imported. Fix or remove them and preview again — nothing was written.`,
        },
        { status: 400 }
      )
    }
    if (inserts.length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to import' }, { status: 400 })
    }

    // ---- Insert ---------------------------------------------------
    // Chunked, and each chunk is one statement. The unique constraint on
    // question_id is the backstop: if anything slipped past the checks above,
    // the insert fails rather than duplicating a question.
    let inserted = 0
    for (let i = 0; i < inserts.length; i += 100) {
      const chunk = inserts.slice(i, i + 100).map((row) => row.values)
      const { data, error } = await supabaseAdmin.from(table).insert(chunk).select('question_id')
      if (error) {
        console.error('[AdminImport] insert failed:', error)
        return NextResponse.json(
          {
            success: false,
            error:
              error.code === '23505'
                ? `A question_id collided with an existing row. ${inserted} row(s) were imported before this; re-preview to see what is left.`
                : `Import failed after ${inserted} row(s). ${error.message}`,
          },
          { status: 409 }
        )
      }
      inserted += data?.length ?? 0
    }

    return NextResponse.json({
      ...response,
      applied: true,
      summary: { ...summary, inserted },
    })
  } catch (err) {
    console.error('[AdminImport] apply failed:', err)
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 })
  }
})
