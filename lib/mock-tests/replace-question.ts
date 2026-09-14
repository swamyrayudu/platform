// ============================================================
// lib/mock-tests/replace-question.ts — Swap one question out of a module
// ============================================================
// The surgical alternative to regenerating a module.
//
// WHY NOT JUST REGENERATE:
// mock_test_questions has no version column. A module's 160 mappings are the
// only copy there is, so regenerating overwrites what every past attempt
// appears to have contained — the scores stay frozen but the reviews rebuild
// against questions the candidate never saw. That is why the generate route
// refuses a published test outright. Replacing one mapping changes one row
// and leaves the other 159 exactly where they were.
//
// WHAT IS PRESERVED, AND WHY IT MATTERS:
//   question_number   sections are contiguous blocks of it (gk 1-16,
//                     ... science 113-136), and the exam UI groups by them
//   section_id/name   the palette headings
//   marks             the module's total must stay at its published value
//   question_table    a science slot must be refilled from science, or the
//                     module silently stops matching its own blueprint
//
// So a replacement is: same slot, same section, same source table, different
// question. Nothing else moves.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { invalidateMockTestCache } from './cache'
import { buildQuestionUid } from '@/lib/questions/tables'
import { liveModuleIds } from './live-attempts'

export { liveModuleIds }

export interface ReplacementTarget {
  mappingId: string
  mockTestId: string
  moduleNumber: number | null
  moduleTitle: string
  questionNumber: number
  sectionName: string
  questionTable: string
  fromQuestionId: string
}

export interface ReplacementOutcome extends ReplacementTarget {
  toQuestionId: string | null
  status: 'replaced' | 'blocked_live' | 'no_candidate'
  detail?: string
}


/** Every slot in every module currently holding this question. */
export async function findSlotsUsing(
  questionTable: string,
  questionId: string
): Promise<ReplacementTarget[]> {
  const uid = buildQuestionUid(questionTable, questionId)

  const { data, error } = await supabaseAdmin
    .from('mock_test_questions')
    .select('id, mock_test_id, question_number, section_name, question_table, question_id, mock_tests(title, module_number)')
    .eq('question_uid', uid)
    .order('question_number', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => {
    const test = row.mock_tests as { title?: string; module_number?: number | null } | null
    return {
      mappingId: row.id as string,
      mockTestId: row.mock_test_id as string,
      moduleNumber: test?.module_number ?? null,
      moduleTitle: test?.title ?? '',
      questionNumber: row.question_number as number,
      sectionName: row.section_name as string,
      questionTable: row.question_table as string,
      fromQuestionId: row.question_id as string,
    }
  })
}

/** question_ids already present in a module, so a replacement cannot duplicate one. */
async function idsAlreadyIn(mockTestId: string, questionTable: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from('mock_test_questions')
    .select('question_id')
    .eq('mock_test_id', mockTestId)
    .eq('question_table', questionTable)
  return new Set((data ?? []).map((r) => r.question_id as string))
}

export interface CandidateRow {
  question_id: string
  question: string
  correct_answer: string
  topic: string | null
  difficulty: string | null
  inUse: boolean
}

export interface CandidatePage {
  candidates: CandidateRow[]
  page: number
  pageSize: number
  total: number
  unusedTotal: number
  totalPages: number
}

/** Every question_id of this table that some module already uses. */
async function loadInUse(questionTable: string): Promise<Set<string>> {
  const PAGE = 1000
  const inUse = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('mock_test_questions')
      .select('question_id')
      .eq('question_table', questionTable)
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = data ?? []
    for (const row of rows) inUse.add(row.question_id as string)
    if (rows.length < PAGE) break
  }
  return inUse
}

/**
 * The whole subject bank, one page at a time, unused questions first.
 *
 * Ordering by question_id alone is not enough, and the reason is worth
 * recording: APSGT-GKCA-EM-* sorts before GK-ENG-*, and after the import it is
 * exactly the APSGT ids that are already in circulation. Reading the first few
 * hundred rows therefore found zero spare questions while 1,544 sat just past
 * the end of the window.
 *
 * So the ids are listed first — cheap, one column — partitioned into unused
 * then used, and only the requested page is hydrated with question text. A
 * 2,000 row subject costs two light queries and one content query per page.
 */
export async function findCandidates(
  questionTable: string,
  opts: {
    search?: string
    excludeIds?: ReadonlySet<string>
    page?: number
    pageSize?: number
    unusedOnly?: boolean
  } = {}
): Promise<CandidatePage> {
  const PAGE = 1000
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 100)
  const page = Math.max(opts.page ?? 1, 1)

  const inUse = await loadInUse(questionTable)
  const safeSearch = opts.search?.replace(/[%,()*]/g, '').trim()

  // ---- List matching ids, one column wide ------------------------
  const unusedIds: string[] = []
  const usedIds: string[] = []

  for (let from = 0; ; from += PAGE) {
    let query = supabaseAdmin
      .from(questionTable)
      .select('question_id')
      .order('question_id', { ascending: true })
      .range(from, from + PAGE - 1)
    // ilike filters on a column that is not selected — PostgREST allows it.
    if (safeSearch) query = query.ilike('question', `%${safeSearch}%`)

    const { data, error } = await query
    if (error) throw error
    const rows = (data ?? []) as { question_id: string }[]

    for (const row of rows) {
      if (opts.excludeIds?.has(row.question_id)) continue
      if (inUse.has(row.question_id)) usedIds.push(row.question_id)
      else unusedIds.push(row.question_id)
    }
    if (rows.length < PAGE) break
  }

  const ordered = opts.unusedOnly ? unusedIds : [...unusedIds, ...usedIds]
  const total = ordered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const slice = ordered.slice((page - 1) * pageSize, page * pageSize)

  // ---- Hydrate only what this page shows -------------------------
  const content = new Map<string, CandidateRow>()
  if (slice.length > 0) {
    const { data, error } = await supabaseAdmin
      .from(questionTable)
      .select('question_id, question, correct_answer, topic, difficulty')
      .in('question_id', slice)
    if (error) throw error
    for (const row of (data ?? []) as Omit<CandidateRow, 'inUse'>[]) {
      content.set(row.question_id, { ...row, inUse: inUse.has(row.question_id) })
    }
  }

  return {
    // Map over `slice`, not over the query result, so the page keeps the
    // unused-first order the ids were partitioned into.
    candidates: slice.map((id) => content.get(id)).filter(Boolean) as CandidateRow[],
    page: Math.min(page, totalPages),
    pageSize,
    total,
    unusedTotal: unusedIds.length,
    totalPages,
  }
}

/**
 * Perform the swaps.
 *
 * `chosenId` fills every slot when given; otherwise each slot gets its own
 * unused candidate, because the same replacement cannot go into two slots of
 * the same module.
 *
 * A module with an attempt in progress is skipped, never forced: the candidate
 * has that question on screen, and their answer is stored as nothing but the
 * letter they tapped.
 */
export async function replaceSlots(
  targets: ReplacementTarget[],
  chosenId: string | null
): Promise<ReplacementOutcome[]> {
  const live = await liveModuleIds([...new Set(targets.map((t) => t.mockTestId))])
  const outcomes: ReplacementOutcome[] = []
  const touched = new Map<string, string>()

  for (const target of targets) {
    if (live.has(target.mockTestId)) {
      outcomes.push({
        ...target,
        toQuestionId: null,
        status: 'blocked_live',
        detail: 'A candidate is sitting this module right now',
      })
      continue
    }

    const taken = await idsAlreadyIn(target.mockTestId, target.questionTable)
    let replacement = chosenId

    if (!replacement || taken.has(replacement)) {
      const pick = await findCandidates(target.questionTable, {
        excludeIds: taken,
        pageSize: 1,
        unusedOnly: true,
      })
      replacement = pick.candidates[0]?.question_id ?? null
    }

    if (!replacement) {
      outcomes.push({
        ...target,
        toQuestionId: null,
        status: 'no_candidate',
        detail: 'No unused question left in this subject that the module does not already have',
      })
      continue
    }

    const { error } = await supabaseAdmin
      .from('mock_test_questions')
      .update({
        question_id: replacement,
        question_uid: buildQuestionUid(target.questionTable, replacement),
      })
      .eq('id', target.mappingId)

    if (error) {
      outcomes.push({ ...target, toQuestionId: null, status: 'no_candidate', detail: error.message })
      continue
    }

    touched.set(target.mockTestId, target.mockTestId)
    outcomes.push({ ...target, toQuestionId: replacement, status: 'replaced' })
  }

  // ---- Drop the cache for every module that actually changed --------
  if (touched.size > 0) {
    const { data: tests } = await supabaseAdmin
      .from('mock_tests')
      .select('id, version')
      .in('id', [...touched.keys()])
    await Promise.all(
      (tests ?? []).map((t) => invalidateMockTestCache(t.id as string, t.version as number))
    )
  }

  return outcomes
}
