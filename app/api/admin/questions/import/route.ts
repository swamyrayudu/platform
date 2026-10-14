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
import { randomUUID } from 'node:crypto'
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
import { importFingerprint, importReceipt, UUID_PATTERN } from '@/lib/questions/import-history'

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
): Promise<{ ids: Set<string>; text: Set<string>; total: number }> {
  const ids = new Set<string>()
  const text = new Set<string>()

  let from = 0
  while (true) {
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
    if (rows.length === 0) break
    from += rows.length
  }

  const total = ids.size
  from = 0
  while (true) {
    const { data, error } = await supabaseAdmin.from('admin_question_import_ids').select('question_id')
      .eq('question_table', table).order('question_id').range(from, from + PAGE - 1)
    if (error) throw error
    for (const row of data ?? []) ids.add(row.question_id)
    if (!data?.length) break
    from += data.length
  }
  return { ids, text, total }
}

// ---- GET: describe the table -------------------------------------

export const GET = requireAdmin(async (request) => {
  try {
    const url = new URL(request.url)
    const table = resolveTable(url.searchParams.get('table'))
    if (!table) {
      return NextResponse.json({ success: false, error: 'Unknown question table' }, { status: 400 })
    }

    const { ids, total } = await loadExisting(table)
    const family = resolveIdFamily(table, [...ids])

    const info: ImportTableInfo = {
      success: true,
      table,
      total,
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

export const POST = requireAdmin(async (request, _context, { user }) => {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }
    const { table: tableInput, csv, apply, topic, requestId } = body as Record<string, unknown>
    const topicImport = topic !== undefined
    if (topicImport && topic !== null && (typeof topic !== 'string' || topic.length > 1000)) {
      return NextResponse.json({ success: false, error: 'Invalid topic' }, { status: 400 })
    }
    const selectedTopic = topic as string | null | undefined

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
    if (requestId !== undefined && (typeof requestId !== 'string' || !UUID_PATTERN.test(requestId))) {
      return NextResponse.json({ success: false, error: 'Invalid import request ID' }, { status: 400 })
    }
    const batchId = typeof requestId === 'string' ? requestId : randomUUID()
    const fingerprint = importFingerprint(table, csv, selectedTopic)
    if (shouldApply) {
      const receipt = await importReceipt(batchId, table, fingerprint)
      if (receipt) return receipt.status === 'applied' ? NextResponse.json(receipt.result)
        : NextResponse.json({ success: false, error: 'This import was undone. Use Restore in import history.' }, { status: 409 })
    }

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
    if (topicImport) {
      // This entry point always creates new identities. A copied update CSV
      // must not accidentally become an import of existing questions.
      if (parsed.rows.some((row) => row.question_id?.trim())) {
        return NextResponse.json(
          { success: false, error: 'Leave question_id empty or remove that column. New IDs are generated automatically when adding questions to a topic.' },
          { status: 400 }
        )
      }
      if (!presentColumns.includes('topic')) presentColumns.push('topic')
      for (const row of parsed.rows) row.topic = selectedTopic ?? ''
    }
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

    // All rows and their backups commit together. Failed or retried requests
    // cannot leave a partial import or create a second copy.
    const newRows = inserts.map((row) => ({
        ...row.values,
        ...(topicImport ? { topic: selectedTopic } : {}),
    }))
    const { data, error } = await supabaseAdmin.rpc('capture_admin_question_import', {
      p_request_id: batchId, p_fingerprint: fingerprint, p_actor_id: user.id,
      p_table: table, p_rows: newRows, p_origin: 'import',
      p_result: { ...response, applied: true, summary: { ...summary, inserted: newRows.length } },
    })
    if (error) {
      return NextResponse.json({ success: false, error: `Nothing was imported. ${error.message || 'Preview again; another admin may have added these questions.'}` }, { status: 409 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[AdminImport] apply failed:', err)
    return NextResponse.json({ success: false, error: 'Import failed' }, { status: 500 })
  }
})
