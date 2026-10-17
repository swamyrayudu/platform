// ============================================================
// scripts/add-gk-telugu-topic.mts
// ============================================================
// Adds one file of questions (a CSV from data/gk-telugu-*/build-csv.mjs,
// every row in one topic, new or existing) to gk_telugu_medium and puts them into the
// existing Telugu mock modules.
//
//   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/add-gk-telugu-topic.mts <csv>           # dry run
//   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/add-gk-telugu-topic.mts <csv> --apply
//
// Used for: data/gk-telugu-awards (2026-10-17), data/gk-telugu-science-tech.
//
// 1. IMPORT goes through the same code and RPC as /admin/import-questions
//    (validateImportRows, mintIds, capture_admin_question_import), so the batch
//    is in Import history and can be undone there. Recorded under ADMIN_ID.
//
// 2. MOCKS: modules are fixed lists, so new questions reach only modules
//    generated later unless slots are swapped. Each module with no attempts
//    gets one question of the new topic (its share of 16 GK slots) in place of
//    an Easy question that another module also uses, so nothing drops out of
//    the series and the Easy-heavy GK sections move toward the blueprint's
//    25/50/25. Modules someone has attempted are left as they are: a result
//    review re-reads the module's questions. Changed modules get a version
//    bump so the cached paper is rebuilt; usage counters are recomputed.
// ============================================================

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin as db } from '@/lib/supabase-admin'
import { parseCsv } from '@/lib/questions/csv'
import { normaliseText, presentImportColumns, validateImportRows } from '@/lib/questions/bulk-insert'
import { mintIds, resolveIdFamily } from '@/lib/questions/id-generator'
import { importFingerprint } from '@/lib/questions/import-history'
import { normalizeDifficulty } from '@/lib/mock-tests/question-bank'

const APPLY = process.argv.includes('--apply')
const T = 'gk_telugu_medium'
const CSV = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!CSV) throw new Error('usage: add-gk-telugu-topic.mts <csv> [--apply]')
const ADMIN_ID = '763f3c0e-caf1-40d0-8f16-22704aa6be3a' // the RSD Education admin account

async function all<R>(query: () => any): Promise<R[]> {
  const out: R[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

// ---------------------------------------------------------- 1. import
const csv = readFileSync(CSV, 'utf8')
const parsed = parseCsv(csv)
const topics = [...new Set(parsed.rows.map((r) => r.topic))]
if (topics.length !== 1 || !topics[0]) throw new Error(`The CSV must hold exactly one topic (found: ${topics.join(', ') || 'none'})`)
const TOPIC = topics[0]
const bank = await all<{ question_id: string; question: string; topic: string; difficulty: string }>(
  () => db.from(T).select('question_id, question, topic, difficulty').order('question_id'))
const remembered = await all<{ question_id: string }>(
  () => db.from('admin_question_import_ids').select('question_id').eq('question_table', T).order('question_id'))
const existingIds = new Set([...bank.map((r) => r.question_id), ...remembered.map((r) => r.question_id)])
const existingText = new Set(bank.map((r) => normaliseText(r.question)))
const presentColumns = presentImportColumns(parsed.headers)
const { results, inserts } = validateImportRows({ rows: parsed.rows, rowLines: parsed.rowLines, existingIds, existingText, presentColumns })
const refused = results.filter((r) => r.status !== 'new')
// "Already imported" means this file's questions are in the bank, matched by
// text, so the topic itself may hold older rows (adding to an existing topic).
const fileText = new Set(parsed.rows.map((r) => normaliseText(r.question)))
const imported = bank.filter((r) => fileText.has(normaliseText(r.question)))
const already = imported.length
console.log(`bank: ${bank.length} rows, ${bank.filter((r) => r.topic === TOPIC).length} in "${TOPIC}"; ${already} of this file's ${parsed.rows.length} already there`)
console.log(`import preview: ${inserts.length} new, ${refused.length} refused`)

let topicIds: string[]
if (already) {
  if (already !== parsed.rows.length) throw new Error('Some of this file is in the bank and some is not — check Import history first.')
  topicIds = imported.map((r) => r.question_id)
  console.log('  already imported: skipping to the mock update')
} else {
  if (refused.length || inserts.length !== parsed.rows.length) {
    refused.forEach((r) => console.error(`  line ${r.line}: ${r.status} ${r.errors.join('; ')}`))
    throw new Error('Refusing to import: fix the rows above')
  }
  const family = resolveIdFamily(T, [...existingIds])
  const minted = mintIds(family, inserts.length, existingIds)
  inserts.forEach((row, i) => { row.values.question_id = minted[i]! })
  topicIds = minted
  console.log(`  ids: ${minted[0]} … ${minted.at(-1)}`)
}
const difficultyOf = new Map(bank.map((r) => [r.question_id, normalizeDifficulty(r.difficulty)]))
const topicDifficulty = new Map(already
  ? imported.map((r) => [r.question_id, normalizeDifficulty(r.difficulty)])
  : inserts.map((row) => [row.values.question_id!, normalizeDifficulty(row.values.difficulty)]))

// ---------------------------------------------------------- 2. plan the mocks
type Slot = { id: string; mock_test_id: string; question_id: string; question_number: number; section_id: string; section_name: string; marks: number; question_uid: string }
const slots = await all<Slot>(() => db.from('mock_test_questions')
  .select('id, mock_test_id, question_id, question_number, section_id, section_name, marks, question_uid')
  .eq('question_table', T).order('id'))
const tests = await all<{ id: string; status: string; module_number: number | null; version: number; medium: string }>(
  () => db.from('mock_tests').select('id, status, module_number, version, medium').order('id'))
const attempted = new Set((await all<{ mock_test_id: string }>(
  () => db.from('mock_test_attempts').select('mock_test_id').order('id'))).map((a) => a.mock_test_id))

const testById = new Map(tests.map((t) => [t.id, t]))
const byTest = new Map<string, Slot[]>()
for (const s of slots) byTest.set(s.mock_test_id, [...(byTest.get(s.mock_test_id) ?? []), s])
const uses = new Map<string, number>()
for (const s of slots) uses.set(s.question_id, (uses.get(s.question_id) ?? 0) + 1)

const eligible = [...byTest.keys()].filter((id) => !attempted.has(id))
  .sort((a, b) => (testById.get(a)?.module_number ?? 0) - (testById.get(b)?.module_number ?? 0))
const topicUses = new Map(topicIds.map((id) => [id, 0]))
const rank = { hard: 0, medium: 1, easy: 2 } as const
const changes: (Slot & { from: string })[] = []
let skipped = 0

for (const testId of eligible) {
  const mine = byTest.get(testId)!
  if (mine.some((s) => topicUses.has(s.question_id))) continue // already has one
  // An Easy question another module also serves, so it stays in the series.
  const out = mine.filter((s) => difficultyOf.get(s.question_id) === 'easy' && (uses.get(s.question_id) ?? 0) >= 2)
    .sort((a, b) => (uses.get(b.question_id)! - uses.get(a.question_id)!) || a.question_number - b.question_number)[0]
  if (!out) { skipped++; continue }
  const pick = [...topicUses].sort((a, b) => (a[1] - b[1])
    || (rank[topicDifficulty.get(a[0])!] - rank[topicDifficulty.get(b[0])!]))[0]![0]
  topicUses.set(pick, topicUses.get(pick)! + 1)
  uses.set(out.question_id, uses.get(out.question_id)! - 1)
  changes.push({ ...out, from: out.question_id, question_id: pick, question_uid: `${T}:${pick}` })
}

const n = [...topicUses.values()]
console.log(`\nmocks with GK Telugu slots: ${byTest.size}; attempted (left as is): ${byTest.size - eligible.length}`)
console.log(`slots to swap: ${changes.length} (1 per mock)${skipped ? `; ${skipped} mocks had no Easy slot to give up` : ''}`)
console.log(`new topic's questions in mocks: ${n.filter((x) => x > 0).length} of ${n.length}, each in at most ${Math.max(...n)} mocks`)
const mix = { easy: 0, medium: 0, hard: 0 }
for (const c of changes) mix[topicDifficulty.get(c.question_id)!]++
console.log(`swapped in by difficulty: ${JSON.stringify(mix)} (all replace Easy questions)`)

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Re-run with --apply.')
  process.exit(0)
}

// ---------------------------------------------------------- apply
if (!already) {
  const batchId = randomUUID()
  const summary = { parsed: parsed.rows.length, toInsert: inserts.length, duplicateId: 0, duplicateText: 0, invalid: 0, generatedIds: inserts.length }
  const { error } = await db.rpc('capture_admin_question_import', {
    p_request_id: batchId, p_fingerprint: importFingerprint(T, csv, undefined), p_actor_id: ADMIN_ID,
    p_table: T, p_rows: inserts.map((r) => r.values), p_origin: 'import',
    p_result: { success: true, table: T, applied: true, summary: { ...summary, inserted: inserts.length }, rows: results, fileErrors: [] },
  })
  if (error) throw error
  console.log(`\nimported ${inserts.length} questions (Import history batch ${batchId})`)
}

for (let i = 0; i < changes.length; i += 200) {
  const rows = changes.slice(i, i + 200).map(({ from: _from, ...s }) => ({ ...s, question_table: T }))
  const { error } = await db.from('mock_test_questions').upsert(rows, { onConflict: 'id' })
  if (error) throw error
}
console.log(`swapped ${changes.length} mock slots`)

// mock_test_questions is the source of truth; recompute this table's usage.
const fresh = await all<Slot>(() => db.from('mock_test_questions')
  .select('id, mock_test_id, question_id, question_number, section_id, section_name, marks, question_uid')
  .eq('question_table', T).order('id'))
const usage = new Map<string, any>()
for (const s of fresh) {
  const t = testById.get(s.mock_test_id)
  if (!t) continue
  const key = `${s.question_uid}|${t.medium}`
  const cur = usage.get(key) ?? { question_uid: s.question_uid, question_id: s.question_id, question_table: T, medium: t.medium,
    section_id: s.section_id, usage_count: 0, last_module_number: null, last_mock_test_id: null }
  cur.usage_count += 1
  if (cur.last_module_number === null || (t.module_number ?? 0) >= cur.last_module_number) {
    cur.last_module_number = t.module_number ?? null
    cur.last_mock_test_id = s.mock_test_id
  }
  usage.set(key, cur)
}
{
  const { error } = await db.from('mock_question_usage').delete().eq('question_table', T)
  if (error) throw error
  const rows = [...usage.values()]
  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await db.from('mock_question_usage').insert(rows.slice(i, i + 500))
    if (e) throw e
  }
  console.log(`usage rebuilt: ${rows.length} rows`)
}

for (const testId of new Set(changes.map((c) => c.mock_test_id))) {
  const t = testById.get(testId)!
  const { error } = await db.from('mock_tests').update({ version: t.version + 1, updated_at: new Date().toISOString() }).eq('id', testId)
  if (error) throw error
}
console.log(`bumped ${new Set(changes.map((c) => c.mock_test_id)).size} module versions`)

// ---------------------------------------------------------- verify
const present = new Set((await all<{ question_id: string }>(() => db.from(T).select('question_id').order('question_id'))).map((r) => r.question_id))
const dangling = fresh.filter((s) => !present.has(s.question_id)).length
const counts = new Map<string, string[]>()
for (const s of fresh) counts.set(s.mock_test_id, [...(counts.get(s.mock_test_id) ?? []), s.question_id])
const repeated = [...counts.values()].filter((ids) => new Set(ids).size !== ids.length).length
const notSixteen = [...counts.values()].filter((ids) => ids.length !== 16).length
console.log(`\nverify: ${present.size} questions, ${dangling} dangling slots, ${repeated} modules with a repeat, ${notSixteen} modules without 16 GK slots`)
console.log(dangling || repeated || notSixteen ? 'CHECK FAILED' : 'done.')
