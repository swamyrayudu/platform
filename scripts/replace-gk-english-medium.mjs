// ============================================================
// scripts/replace-gk-english-medium.mjs
// ============================================================
// Replace the contents of gk_english_medium with a generated CSV, without
// breaking the mock modules that point into it.
//
// WHAT THIS OPERATION ACTUALLY IS:
// The incoming file is not a fresh bank. 456 of the 457 rows already in the
// table appear in it with byte-identical question text and answer keys, so
// "delete everything and insert 2000" is really "add ~1544, and drop one".
// The one that disappears is APSGT-GKCA-EM-000179, which three mock mappings
// point at. A mapping whose row no longer exists does not error — the loader
// does `.in('question_id', ids)` and simply gets fewer rows back — so those
// three modules would quietly serve 159 questions instead of 160. They are
// repointed here rather than left dangling.
//
// subject is forced to the value already in the table. The CSV says
// "GK & Current Affairs" where every existing row says "General Knowledge &
// Current Affairs"; inserting the CSV's spelling verbatim would split one
// practice subject into two.
//
// Usage:
//   node scripts/replace-gk-english-medium.mjs            # survey + backup only
//   node scripts/replace-gk-english-medium.mjs --execute  # do it
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const CSV = 'C:/Users/rayud/OneDrive/Documents/ChatGPT/New project/outputs/dsc_practice_gk_english_medium_2000_final_2026-09-13.csv'
const TABLE = 'gk_english_medium'
const CANONICAL_SUBJECT = 'General Knowledge & Current Affairs'
const CANONICAL_LANGUAGE = 'English'
const BACKUP_DIR = 'C:/Users/rayud/Downloads'

const EXECUTE = process.argv.includes('--execute')

// ---- Minimal RFC 4180 parser (quoted fields, escaped quotes, newlines) ----
function parseCsv(input) {
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1)
  const records = []
  let field = '', fields = [], inQuotes = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { fields.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') {
      fields.push(field); field = ''
      if (!(fields.length === 1 && fields[0].trim() === '')) records.push(fields)
      fields = []
      continue
    }
    field += ch
  }
  if (field !== '' || fields.length) {
    fields.push(field)
    if (!(fields.length === 1 && fields[0].trim() === '')) records.push(fields)
  }
  const headers = records[0].map((h) => h.trim().toLowerCase())
  return records.slice(1).map((r) => {
    const row = {}
    headers.forEach((h, i) => { row[h] = (r[i] ?? '').trim() })
    return row
  })
}

function toCsv(columns, rows) {
  const enc = (v) => {
    const t = v == null ? '' : String(v)
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => enc(r[c])).join(','))].join('\r\n')
}

// ---- Connect ----
const env = fs.readFileSync('.env', 'utf8')
const url = env.split(/\r?\n/).find((l) => l.startsWith('SUPABASE_DB_URL=')).slice('SUPABASE_DB_URL='.length).trim()
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')

try {
  // ---- Read the incoming file ----
  const incoming = parseCsv(fs.readFileSync(CSV, 'utf8'))
  const incomingIds = new Set(incoming.map((r) => r['question id']))
  if (incomingIds.size !== incoming.length) throw new Error('Duplicate question_id inside the CSV')
  console.log(`incoming: ${incoming.length} rows, ${incomingIds.size} distinct ids`)

  // ---- Back up what is there now ----
  const current = (await client.query(`SELECT * FROM ${TABLE} ORDER BY question_id`)).rows
  const mappings = (await client.query(
    `SELECT q.id, q.mock_test_id, t.module_number, q.question_id, q.question_uid, q.question_number
     FROM mock_test_questions q JOIN mock_tests t ON t.id = q.mock_test_id
     WHERE q.question_table = $1 ORDER BY t.module_number, q.question_number`, [TABLE])).rows

  const rowsBackup = path.join(BACKUP_DIR, `${TABLE}_BACKUP_${stamp}.csv`)
  const mapBackup = path.join(BACKUP_DIR, `${TABLE}_MAPPINGS_BACKUP_${stamp}.csv`)
  fs.writeFileSync(rowsBackup, '\ufeff' + toCsv(Object.keys(current[0]), current), 'utf8')
  fs.writeFileSync(mapBackup, '\ufeff' + toCsv(Object.keys(mappings[0]), mappings), 'utf8')
  console.log(`backed up ${current.length} rows  -> ${rowsBackup}`)
  console.log(`backed up ${mappings.length} mappings -> ${mapBackup}`)

  // ---- Which mappings would dangle, and what replaces them ----
  const vanishing = current.map((r) => r.question_id).filter((id) => !incomingIds.has(id))
  console.log(`\nids disappearing: ${vanishing.length}`, vanishing)

  const repoints = []
  for (const goneId of vanishing) {
    const users = mappings.filter((m) => m.question_id === goneId)
    for (const m of users) {
      // A question already in that module would create a duplicate slot, which
      // the uq_mock_test_question constraint refuses.
      const inModule = new Set(
        (await client.query(
          `SELECT question_id FROM mock_test_questions WHERE mock_test_id = $1 AND question_table = $2`,
          [m.mock_test_id, TABLE])).rows.map((r) => r.question_id))
      const replacement = incoming.find((r) => !inModule.has(r['question id']))
      if (!replacement) throw new Error(`No replacement available for module ${m.module_number}`)
      inModule.add(replacement['question id'])
      repoints.push({
        mappingId: m.id,
        moduleNumber: m.module_number,
        mockTestId: m.mock_test_id,
        questionNumber: m.question_number,
        from: goneId,
        to: replacement['question id'],
      })
    }
  }
  for (const r of repoints) {
    console.log(`  module ${r.moduleNumber} Q${r.questionNumber}: ${r.from} -> ${r.to}`)
  }

  if (!EXECUTE) {
    console.log('\nSurvey only. Re-run with --execute to apply.')
    await client.end()
    process.exit(0)
  }

  // ---- Swap, atomically ----
  await client.query('BEGIN')

  const del = await client.query(`DELETE FROM ${TABLE}`)
  console.log(`\ndeleted ${del.rowCount} rows`)

  const COLS = ['question_id', 'class_level', 'chapter', 'topic', 'subtopic', 'difficulty',
    'question_type', 'question', 'option_a', 'option_b', 'option_c', 'option_d',
    'correct_answer', 'explanation', 'source_type', 'tags', 'subject', 'language']

  let inserted = 0
  for (let i = 0; i < incoming.length; i += 200) {
    const chunk = incoming.slice(i, i + 200)
    const values = []
    const params = []
    chunk.forEach((r, n) => {
      const base = n * COLS.length
      values.push('(' + COLS.map((_, k) => `$${base + k + 1}`).join(',') + ')')
      params.push(
        r['question id'], r['class level'] || null, r.chapter || null, r.topic || null,
        r.subtopic || null, r.difficulty || 'Medium', r['question type'] || 'MCQ',
        r.question, r['option a'], r['option b'], r['option c'], r['option d'],
        (r['correct answer'] || '').toUpperCase(), r.explanation || null,
        r['source type'] || 'STATIC_GK', r.tags || null,
        // Forced, not taken from the file — see the note at the top.
        CANONICAL_SUBJECT, CANONICAL_LANGUAGE)
    })
    const res = await client.query(
      `INSERT INTO ${TABLE} (${COLS.join(',')}) VALUES ${values.join(',')}`, params)
    inserted += res.rowCount
  }
  console.log(`inserted ${inserted} rows`)

  for (const r of repoints) {
    await client.query(
      `UPDATE mock_test_questions SET question_id = $1, question_uid = $2 WHERE id = $3`,
      [r.to, `${TABLE}:${r.to}`, r.mappingId])
  }
  console.log(`repointed ${repoints.length} mapping(s)`)

  await client.query('COMMIT')

  // ---- Verify ----
  const after = (await client.query(`SELECT count(*)::int n FROM ${TABLE}`)).rows[0].n
  const dangling = (await client.query(`
    SELECT count(*)::int n FROM mock_test_questions q
    LEFT JOIN ${TABLE} t ON t.question_id = q.question_id
    WHERE q.question_table = $1 AND t.question_id IS NULL`, [TABLE])).rows[0].n
  const shortModules = (await client.query(`
    SELECT t.module_number, count(*)::int n FROM mock_test_questions q
    JOIN mock_tests t ON t.id = q.mock_test_id
    GROUP BY t.module_number HAVING count(*) <> 160 ORDER BY t.module_number LIMIT 5`)).rows

  console.log(`\nVERIFY  rows: ${after}  dangling mappings: ${dangling}`)
  console.log('modules not at 160 questions:', shortModules.length ? shortModules : 'none')
  console.log('\nCache: invalidate the repointed modules ->',
    [...new Set(repoints.map((r) => r.mockTestId))].join(', ') || 'none')
} catch (err) {
  try { await client.query('ROLLBACK') } catch {}
  console.error('\nFAILED, rolled back:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
