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
import { createHash, randomUUID } from 'node:crypto'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { invalidateMockTestCache } from '@/lib/mock-tests/cache'
import { parseCsv } from '@/lib/questions/csv'
import { getQuestionTable, buildQuestionUid } from '@/lib/questions/tables'
import { collectIds, diffPastedRows, presentEditableColumns } from '@/lib/questions/bulk-diff'
import { sortTopicsByCount } from '@/lib/questions/topic-order'
import { sharedReviewedIds, sharedTopicOptions } from '@/lib/questions/topic-tracking'
import { validateTopicBatch } from '@/lib/questions/topic-batch'
import { findLiveAttempts } from '@/lib/mock-tests/live-attempts'
import { matchDifficulty } from '@/lib/mock-tests/question-bank'
import {
  BULK_CSV_COLUMNS,
  BULK_EDITABLE_COLUMNS,
  BULK_MAX_ROWS,
  BULK_TAXONOMY_CHECKED_COLUMNS,
  TOPIC_BATCH_MAX_QUESTIONS,
  type BulkEditableColumn,
  type BulkExportRow,
  type BulkTopicOption,
  type BulkPreviewResponse,
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

/** undefined is a table range, null is an unassigned topic, '' is an empty topic. */
function topicQuery(table: string, columns: string, topic: string | null | undefined) {
  const query = supabaseAdmin.from(table).select(columns)
  if (topic === undefined) return query
  return topic === null ? query.is('topic', null) : query.eq('topic', topic)
}

async function listTopics(table: string): Promise<BulkTopicOption[]> {
  const questions: { question_id: string; topic: string | null }[] = []
  // Paginate: PostgREST caps responses, so one select can miss later topics.
  let offset = 0
  while (true) {
    const { data, error } = await supabaseAdmin.from(table)
      .select('question_id, topic')
      .order(ORDER_COLUMN, { ascending: true })
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    questions.push(...data as { question_id: string; topic: string | null }[])
    offset += data.length
  }
  return sortTopicsByCount(await sharedTopicOptions(table, questions))
}

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

async function exportCombinedTopics(table: string, batchTopics: unknown) {
  if (!validateTopicBatch(batchTopics)) {
    return NextResponse.json({ success: false, error: 'Choose two or more distinct topics containing at most 100 questions in total.' }, { status: 400 })
  }
  const combined: { question_id: string; topic: string | null }[] = []
  for (const chosen of batchTopics) {
    let query = supabaseAdmin.from(table).select('question_id', { count: 'exact', head: true })
    query = chosen === null ? query.is('topic', null) : query.eq('topic', chosen)
    const { count, error } = await query
    if (error) throw error
    if (!count) return NextResponse.json({ success: false, error: 'A selected topic no longer has questions. Refresh the topics.' }, { status: 409 })
    if (combined.length + count > TOPIC_BATCH_MAX_QUESTIONS) {
      return NextResponse.json({ success: false, error: 'Combined topics must contain at most 100 questions. Remove a topic and try again.' }, { status: 400 })
    }
    let offset = 0
    while (true) {
      const { data, error } = await topicQuery(table, SELECT_COLUMNS, chosen).order(ORDER_COLUMN)
        .range(offset, offset + TOPIC_BATCH_MAX_QUESTIONS)
      if (error) throw error
      if (!data?.length) break
      combined.push(...data as unknown as { question_id: string; topic: string | null }[])
      offset += data.length
      if (combined.length > TOPIC_BATCH_MAX_QUESTIONS) {
        return NextResponse.json({ success: false, error: 'Questions were added while loading. The combined batch exceeds 100; refresh the topics.' }, { status: 409 })
      }
    }
    if (offset !== count) return NextResponse.json({ success: false, error: 'The selected topics changed while loading. Please reload the batch.' }, { status: 409 })
  }
  const questionTopics = Object.fromEntries(combined.map((row) => [row.question_id, row.topic]))
  const rows = combined.map((row) => Object.fromEntries(BULK_CSV_COLUMNS.map((column) =>
    [column, (row as unknown as Record<string, string | null>)[column] ?? ''])))
  return NextResponse.json({ success: true, table, total: rows.length, from: 1, to: rows.length,
    rows, topics: batchTopics, questionTopics, reviewedIds: await sharedReviewedIds(table, combined) },
  { headers: { 'Cache-Control': 'private, no-store' } })
}

// ---- GET: hand out a slice ---------------------------------------

export const GET = requireAdmin(async (request) => {
  try {
    const url = new URL(request.url)
    const table = resolveTable(url.searchParams.get('table'))
    if (!table) {
      return NextResponse.json({ success: false, error: 'Unknown question table' }, { status: 400 })
    }

    if (url.searchParams.get('topics') === '1') {
      const topics = await listTopics(table)
      return NextResponse.json({ success: true, table, topics,
        total: topics.reduce((total, entry) => total + entry.count, 0) }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    if (url.searchParams.has('batchTopics')) {
      let batchTopics: unknown
      try { batchTopics = JSON.parse(url.searchParams.get('batchTopics')!) } catch { batchTopics = undefined }
      if (url.searchParams.has('topic') || url.searchParams.has('topicMissing')) {
        return NextResponse.json({ success: false, error: 'Choose a single topic or a combined batch.' }, { status: 400 })
      }
      return await exportCombinedTopics(table, batchTopics)
    }

    const topic = url.searchParams.get('topicMissing') === '1'
      ? null : url.searchParams.has('topic') ? url.searchParams.get('topic')! : undefined
    if (typeof topic === 'string' && topic.length > 1000) {
      return NextResponse.json({ success: false, error: 'Topic is too long' }, { status: 400 })
    }

    const from = Number(url.searchParams.get('from') ?? '1')
    const to = Number(url.searchParams.get('to') ?? '100')

    const badRange = rangeError(from, to)
    if (badRange) {
      return NextResponse.json({ success: false, error: badRange }, { status: 400 })
    }

    let countQuery = supabaseAdmin
      .from(table)
      .select('question_id', { count: 'exact', head: true })
    if (topic !== undefined) {
      countQuery = topic === null ? countQuery.is('topic', null) : countQuery.eq('topic', topic)
    }
    const { count, error: countError } = await countQuery

    if (countError) throw countError

    const { data, error } = await topicQuery(table, SELECT_COLUMNS, topic)
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
      ...(topic !== undefined ? { topic } : {}),
      ...(topic !== undefined ? { reviewedIds: await sharedReviewedIds(table,
        (data ?? []) as unknown as { question_id: string; topic: string | null }[]) } : {}),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
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

/** Columns whose change makes a stored answer mean something different. */
const ANSWER_AFFECTING = ['option_a', 'option_b', 'option_c', 'option_d', 'correct_answer']

/**
 * Which of these questions sit in a module somebody is sitting right now, and
 * how many such attempts there are.
 *
 * A candidate's answer is stored as nothing but the letter they tapped. Reword
 * option B underneath them and that letter now points at a different
 * statement — they are marked on an answer they never gave. Wording the stem
 * is survivable; the options and the key are not.
 */
async function liveAttemptScope(
  uids: string[]
): Promise<{ lockedUids: Set<string>; attempts: number }> {
  const lockedUids = new Set<string>()
  if (uids.length === 0) return { lockedUids, attempts: 0 }

  // uid -> the modules that contain it
  const modulesByUid = new Map<string, string[]>()
  const allModules = new Set<string>()
  for (let i = 0; i < uids.length; i += 100) {
    const { data } = await supabaseAdmin
      .from('mock_test_questions')
      .select('question_uid, mock_test_id')
      .in('question_uid', uids.slice(i, i + 100))
    for (const row of data ?? []) {
      const uid = row.question_uid as string
      const testId = row.mock_test_id as string
      modulesByUid.set(uid, [...(modulesByUid.get(uid) ?? []), testId])
      allModules.add(testId)
    }
  }
  if (allModules.size === 0) return { lockedUids, attempts: 0 }

  // Only attempts still inside their exam window. A closed tab leaves a row at
  // in_progress indefinitely, and counting those would block edits for ever.
  const liveList = await findLiveAttempts([...allModules])
  const liveModules = new Set(liveList.map((a) => a.mockTestId))
  const attempts = liveList.length

  for (const [uid, testIds] of modulesByUid) {
    if (testIds.some((id) => liveModules.has(id))) lockedUids.add(uid)
  }

  return { lockedUids, attempts }
}

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
    const {
      table: tableInput,
      csv,
      apply,
      allowAnswerChange,
      from: fromInput,
      to: toInput,
      topic,
      questionIds,
      requestId: requestIdInput,
      batchTopics,
      questionTopics,
      action,
    } = body as Record<string, unknown>

    const table = resolveTable(typeof tableInput === 'string' ? tableInput : null)
    if (!table) {
      return NextResponse.json({ success: false, error: 'Unknown question table' }, { status: 400 })
    }

    // Body-based exports support many long Unicode topic names without URL limits.
    if (action === 'export') return await exportCombinedTopics(table, batchTopics)

    if (topic !== undefined && topic !== null &&
      (typeof topic !== 'string' || topic.length > 1000)) {
      return NextResponse.json({ success: false, error: 'Invalid topic' }, { status: 400 })
    }
    const selectedTopic = topic as string | null | undefined
    const combined = batchTopics !== undefined
    if (combined && (!validateTopicBatch(batchTopics) || selectedTopic !== undefined)) {
      return NextResponse.json({ success: false, error: 'Choose two or more distinct topics containing at most 100 questions in total.' }, { status: 400 })
    }
    const topicScoped = combined || selectedTopic !== undefined
    if (topicScoped && (!Array.isArray(questionIds) ||
      questionIds.length === 0 || questionIds.length > BULK_MAX_ROWS ||
      questionIds.some((id) => typeof id !== 'string' || !id.trim()) ||
      new Set(questionIds).size !== questionIds.length)) {
      return NextResponse.json(
        { success: false, error: 'Load a topic batch first — its original question IDs are required' },
        { status: 400 }
      )
    }

    let originalTopics: Record<string, string | null> | undefined
    if (combined) {
      const loaded = questionIds as string[]
      if (loaded.length > TOPIC_BATCH_MAX_QUESTIONS || !questionTopics || typeof questionTopics !== 'object' || Array.isArray(questionTopics) ||
        Object.keys(questionTopics).length !== loaded.length || loaded.some((id) => !Object.hasOwn(questionTopics, id) ||
          !(batchTopics as (string | null)[]).includes((questionTopics as Record<string, string | null>)[id]!))) {
        return NextResponse.json({ success: false, error: 'Load a combined batch of at most 100 questions first, keeping its original IDs and topic mapping.' }, { status: 400 })
      }
      originalTopics = questionTopics as Record<string, string | null>
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
    if (combined && (from !== 1 || to !== (questionIds as string[]).length)) {
      return NextResponse.json({ success: false, error: 'Keep the original combined batch range.' }, { status: 400 })
    }
    if (typeof csv !== 'string' || !csv.trim()) {
      return NextResponse.json({ success: false, error: 'Paste some CSV first' }, { status: 400 })
    }
    if (csv.length > MAX_CSV_BYTES) {
      return NextResponse.json({ success: false, error: 'That paste is too large' }, { status: 413 })
    }

    const shouldApply = apply === true
    const answersAllowed = allowAnswerChange !== false
    const requestId = typeof requestIdInput === 'string' ? requestIdInput : randomUUID()
    if (shouldApply && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
      return NextResponse.json({ success: false, error: 'Invalid update request ID' }, { status: 400 })
    }
    const fingerprint = createHash('sha256').update(JSON.stringify({ table, csv, from, to, selectedTopic, batchTopics,
      questionTopics: originalTopics ? Object.fromEntries(Object.entries(originalTopics).sort(([a], [b]) => a.localeCompare(b))) : undefined,
      questionIds: Array.isArray(questionIds) ? [...questionIds].sort() : undefined, answersAllowed })).digest('hex')
    if (shouldApply) {
      const { data: previous, error } = await supabaseAdmin.from('admin_question_update_batches')
        .select('fingerprint, actor_id, result').eq('request_id', requestId).maybeSingle()
      if (error) throw error
      if (previous) {
        if (previous.fingerprint !== fingerprint || previous.actor_id !== user.id) {
          return NextResponse.json({ success: false, error: 'This update request ID belongs to another batch. Preview again.' }, { status: 409 })
        }
        const receipt = previous.result as BulkPreviewResponse
        const modules = await findModulesUsingAny(receipt.rows.map((row) => buildQuestionUid(table, row.questionId)))
        await Promise.all(modules.map((module) => invalidateMockTestCache(module.id, module.version)))
        return NextResponse.json({ ...receipt, summary: { ...receipt.summary, modulesInvalidated: modules.length } })
      }
    }

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
    if (parsed.rows.length > (combined ? TOPIC_BATCH_MAX_QUESTIONS : BULK_MAX_ROWS)) {
      return NextResponse.json(
        { success: false, error: `At most ${combined ? TOPIC_BATCH_MAX_QUESTIONS : BULK_MAX_ROWS} rows per paste` },
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
    // Topic offsets can shift when earlier rows are reclassified. Keep the
    // exact exported IDs, and recheck that they still belong to this topic.
    let allowedIds: Set<string>
    if (topicScoped) {
      const loadedIds = questionIds as string[]
      allowedIds = new Set<string>()
      for (let i = 0; i < loadedIds.length; i += 200) {
        let offset = 0
        while (true) {
          const { data, error } = await topicQuery(table, 'question_id, topic', combined ? undefined : selectedTopic)
            .in('question_id', loadedIds.slice(i, i + 200)).order(ORDER_COLUMN).range(offset, offset + 199)
          if (error) throw error
          if (!data?.length) break
          for (const row of data as unknown as { question_id: string; topic: string | null }[]) {
            if (!combined || row.topic === originalTopics![row.question_id]) allowedIds.add(String(row.question_id))
          }
          offset += data.length
        }
      }
      if (allowedIds.size !== loadedIds.length) {
        return NextResponse.json(
          { success: false, error: 'Some loaded questions were removed or moved to another topic. Reload the batch and preview again — nothing was written.' },
          { status: 409 }
        )
      }
    } else {
      allowedIds = await idsInRange(table, from, to)
    }
    const pastedInRange = new Set(ids.filter((id) => allowedIds.has(id)))
    const outOfRangeIds = new Set(ids.filter((id) => !allowedIds.has(id)))

    // ---- Read the current rows -----------------------------------
    const current = new Map<string, Record<string, string | null>>()
    for (let i = 0; i < ids.length; i += 200) {
      let offset = 0
      while (true) {
        const { data, error } = await supabaseAdmin.from(table).select(SELECT_COLUMNS)
          .in('question_id', ids.slice(i, i + 200)).order(ORDER_COLUMN).range(offset, offset + 199)
        if (error) throw error
        if (!data?.length) break
        for (const row of data as unknown as Record<string, string | null>[]) current.set(String(row.question_id), row)
        offset += data.length
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
        result.errors = [topicScoped
          ? 'Not part of the loaded topic batch — keep the original question IDs'
          : `Not part of rows ${from}–${to} — this row came from a different range`]
        result.warnings = []
        result.changesAnswer = false
      }
    }
    // ---- Refuse edits that move the ground under a live exam ------
    const changedUids = results
      .filter((r) => r.status === 'changed')
      .map((r) => buildQuestionUid(table, r.questionId))
    const { lockedUids, attempts: liveAttempts } = await liveAttemptScope(changedUids)

    let liveLocked = 0
    if (lockedUids.size > 0) {
      const writeByeId = new Map(writes.map((w) => [w.id, w.update]))
      for (const result of results) {
        if (result.status !== 'changed') continue
        if (!lockedUids.has(buildQuestionUid(table, result.questionId))) continue

        const update = writeByeId.get(result.questionId) ?? {}
        const touchesAnswer = ANSWER_AFFECTING.some((column) => column in update)

        if (touchesAnswer) {
          result.status = 'live_locked'
          result.errors.push(
            'Someone is sitting a module with this question right now — changing an option or the answer would mark them on an answer they never gave'
          )
          liveLocked++
        } else {
          result.warnings.push(
            'A module with this question has a live attempt; wording-only changes are safe'
          )
        }
      }
    }

    const blockedByRange = outOfRangeIds.size > 0
    const lockedIds = new Set(
      results.filter((r) => r.status === 'live_locked').map((r) => r.questionId)
    )
    const writable =
      blockedByRange || liveLocked > 0
        ? []
        : writes.filter(({ id }) => pastedInRange.has(id) && !lockedIds.has(id))

    const summary = {
      parsed: parsed.rows.length,
      changed: results.filter((r) => r.status === 'changed').length,
      unchanged: results.filter((r) => r.status === 'unchanged').length,
      notFound: results.filter((r) => r.status === 'not_found').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
      answerChanges: results.filter((r) => r.changesAnswer).length,
      outOfRange: outOfRangeIds.size,
      liveAttempts,
      liveLocked,
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

    if (liveLocked > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${liveLocked} row(s) change an option or the answer key while ${liveAttempts} candidate(s) are mid-exam on a module containing them. Nothing was written — apply these once those attempts finish, or edit only the wording for now.`,
        },
        { status: 409 }
      )
    }

    if (blockedByRange) {
      return NextResponse.json(
        {
          success: false,
          error: `${outOfRangeIds.size} pasted row(s) are not part of the loaded ${topicScoped ? 'topic batch' : `rows ${from}–${to}`}. Re-copy this batch and keep its original IDs — nothing was written.`,
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
    if (writable.length === 0 && (!topicScoped || summary.unchanged === 0)) {
      return NextResponse.json(
        { success: false, error: 'Nothing to write — every row already matches the database.' },
        { status: 400 }
      )
    }

    // ---- Write ---------------------------------------------------
    // One database transaction includes the writes, shared counters and review
    // coverage. The request receipt prevents a retried save from counting twice.
    const { data: saved, error: saveError } = await supabaseAdmin.rpc(combined ? 'apply_admin_combined_topic_updates' : 'apply_admin_question_updates', {
      p_request_id: requestId, p_fingerprint: fingerprint, p_actor_id: user.id, p_table: table,
      ...(combined ? { p_expected_topics: originalTopics } : { p_topic_scoped: selectedTopic !== undefined, p_topic: selectedTopic ?? null }), p_writes: writable,
      p_reviewed_ids: results.filter((row) => row.status === 'changed' || row.status === 'unchanged').map((row) => row.questionId),
      p_response: { success: true, table, applied: true, rangeFrom: from, rangeTo: to,
        summary: { ...summary, written: writable.length, modulesInvalidated: 0 },
        rows: results.map((row) => ({ ...row, diffs: [] })), fileErrors },
    })
    if (saveError) {
      console.error('[AdminBulk] atomic save failed:', saveError)
      return NextResponse.json({ success: false, error: 'The batch could not be saved. Nothing was written; reload and preview again.' },
        { status: saveError.code === '40001' ? 409 : 500 })
    }
    const written = (saved as BulkPreviewResponse).summary.written ?? 0

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
