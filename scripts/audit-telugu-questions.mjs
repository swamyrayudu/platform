// ============================================================
// scripts/audit-telugu-questions.mjs
// ============================================================
// Audits the Telugu-medium question bank for OBJECTIVELY broken rows and
// either repairs or flags them.
//
// Usage:
//   node scripts/audit-telugu-questions.mjs              # report only (default)
//   node scripts/audit-telugu-questions.mjs --apply      # repair + flag
//   node scripts/audit-telugu-questions.mjs --json out.json
//
// WHAT THIS CAN AND CANNOT DO
//   It detects defects that are decidable from the data itself: lost bytes,
//   answers that cannot be graded, options that make a question unanswerable,
//   and duplicate stems whose "correct" answers contradict each other.
//
//   It does NOT judge whether a well-formed question is factually right, or
//   whether the answer is the best of four plausible options. That needs a
//   Telugu subject expert; nothing here should be read as certifying it.
//
// DELIBERATELY NOT FLAGGED (verified as false positives)
//   • short options  — "[5] [10] [1] [0]" is a valid remainder question
//   • no Telugu script — "x^3 × x^5 = ?" is valid algebra
//   Flagging those would have destroyed ~1,600 perfectly good rows.
// ============================================================

import fs from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const full = path.resolve(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim()
    }
  }
}
loadEnv()

const APPLY = process.argv.includes('--apply')
const jsonIdx = process.argv.indexOf('--json')
const JSON_OUT = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : null

const TABLES = [
  'telugu_subject_questions',
  'gk_telugu_medium',
  'pedagogy_subject_questions',
  'telugu_medium_math',
  'telugu_medium_science',
  'socal_telugu_medimum',
]

const REPLACEMENT_CHAR = '�'
const LETTERS = ['A', 'B', 'C', 'D']

const norm = (v) => String(v ?? '').trim()
const hasLostBytes = (v) => norm(v).includes(REPLACEMENT_CHAR)

/** Text of the option a row points at, or null when unresolvable. */
function correctOptionText(row) {
  const letter = norm(row.correct_answer).toUpperCase()
  if (!LETTERS.includes(letter)) return null
  return norm(row[`option_${letter.toLowerCase()}`])
}

/**
 * Formulaic stems produced by the question generator, e.g.
 *   "SGT పరీక్షలో కవులు–రచనలు గురించి అడిగితే సరైన సమాధానం ఏది?"
 *   ("In the SGT exam, if asked about poets-works, which is the correct answer?")
 *
 * These name only the TOPIC and never the item being asked about, so the four
 * options cannot be reasoned between and the keyed answer is arbitrary. Proof
 * from the live data: APSGT-TEL-00002 and APSGT-TEL-00034 carry the same four
 * works as options in a different order and key DIFFERENT letters that both
 * resolve to ఆంధ్ర మహాభారతం.
 *
 * Found by reading a random sample — every structural check passes on them.
 */
const FORMULAIC_STEM = /సరైన ఎంపికను ఎంచుకోండి|సరైన సమాధానం ఏది|ఉత్తమ సమాధానం ఏది|సరైన ఎంపిక ఏది|సరైన భావాన్ని/

/**
 * Does the stem quote a specific target term?
 *
 * A SHORT quoted run is a real target ('అడవి'). A quoted full sentence is just
 * the generic stem wrapped in quotes, so length is what separates them.
 * Questions WITH a target are answerable and are deliberately kept.
 */
const TARGET_MAX_LEN = 30
function hasQuotedTarget(question) {
  const quoted = String(question ?? '').match(/'[^']+'/g)
  if (!quoted) return false
  // m includes both quote characters, so the inner term is m.length - 2.
  return quoted.some((m) => m.length - 2 <= TARGET_MAX_LEN)
}

/** Unanswerable: formulaic phrasing with no specific term to reason about. */
function isUnanswerableStem(question) {
  const q = String(question ?? '')
  return FORMULAIC_STEM.test(q) && !hasQuotedTarget(q)
}

async function main() {
  if (!process.env.SUPABASE_DB_URL) {
    console.error('SUPABASE_DB_URL is not set in .env')
    process.exit(1)
  }

  const c = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const report = { generated_at: new Date().toISOString(), applied: APPLY, tables: {} }
  /** table -> question_ids planned for flagging (used for impact BEFORE applying) */
  const plannedFlags = new Map()

  for (const table of TABLES) {
    const { rows } = await c.query(
      `select id, question_id, question, option_a, option_b, option_c, option_d,
              correct_answer, explanation, topic, is_active
         from ${table}`
    )

    // uuid -> { reasons[], repair }
    const verdict = new Map()
    const mark = (row, reason) => {
      const v = verdict.get(row.id) ?? { reasons: [], repair: null, question_id: row.question_id }
      if (!v.reasons.includes(reason)) v.reasons.push(reason)
      verdict.set(row.id, v)
    }

    // ---- R1 lost bytes (unrecoverable: the original text is gone) ----
    for (const r of rows) {
      if (
        hasLostBytes(r.question) || hasLostBytes(r.option_a) || hasLostBytes(r.option_b) ||
        hasLostBytes(r.option_c) || hasLostBytes(r.option_d) || hasLostBytes(r.explanation)
      ) {
        mark(r, 'CORRUPTED_TEXT')
      }
    }

    // ---- R2 answer not gradeable ----
    for (const r of rows) {
      const letter = norm(r.correct_answer).toUpperCase()
      if (LETTERS.includes(letter)) continue

      const opts = { A: norm(r.option_a), B: norm(r.option_b), C: norm(r.option_c), D: norm(r.option_d) }
      const match = Object.entries(opts).filter(([, text]) => text === norm(r.correct_answer))

      if (match.length === 1) {
        // The answer holds the option TEXT rather than its letter. That is a
        // deterministic repair, not a guess: exactly one option matches.
        const v = verdict.get(r.id) ?? { reasons: [], repair: null, question_id: r.question_id }
        v.repair = { ...(v.repair ?? {}), correct_answer: match[0][0] }
        v.reasons.push('ANSWER_TEXT_NOT_LETTER')
        verdict.set(r.id, v)
      } else {
        mark(r, 'ANSWER_UNGRADEABLE')
      }
    }

    // ---- R3 duplicate options: two identical choices => ambiguous ----
    for (const r of rows) {
      const opts = [norm(r.option_a), norm(r.option_b), norm(r.option_c), norm(r.option_d)]
      if (new Set(opts).size !== opts.length) mark(r, 'DUPLICATE_OPTIONS')
    }

    // ---- R4/R5 duplicate stems ----
    const byQuestion = new Map()
    for (const r of rows) {
      const key = norm(r.question)
      if (!key) continue
      const list = byQuestion.get(key) ?? []
      list.push(r)
      byQuestion.set(key, list)
    }

    for (const [, group] of byQuestion) {
      if (group.length < 2) continue

      const answerTexts = new Set(group.map((r) => correctOptionText(r) ?? '<unresolved>'))

      if (answerTexts.size > 1) {
        // Same question, contradictory answers. At most one can be right and
        // there is no way to tell which, so the whole group is unusable.
        group.forEach((r) => mark(r, 'CONFLICTING_DUPLICATE'))
      } else {
        // Genuinely the same item repeated: keep the first, retire the rest.
        const ordered = [...group].sort((a, b) =>
          String(a.question_id ?? a.id).localeCompare(String(b.question_id ?? b.id))
        )
        ordered.slice(1).forEach((r) => mark(r, 'EXACT_DUPLICATE'))
      }
    }

    // ---- R6 formulaic stem with no target term (unanswerable) ----
    // Applied to the Telugu language bank, where this generation artefact lives.
    if (table === 'telugu_subject_questions') {
      for (const r of rows) {
        if (isUnanswerableStem(r.question)) mark(r, 'GENERIC_STEM_NO_TARGET')
      }
    }

    // ---- Split into repairs vs flags ----
    const repairs = []
    const flags = []
    for (const [id, v] of verdict) {
      const flagReasons = v.reasons.filter((x) => x !== 'ANSWER_TEXT_NOT_LETTER')
      if (v.repair && flagReasons.length === 0) repairs.push({ id, ...v.repair, reasons: v.reasons })
      else flags.push({ id, question_id: v.question_id, reasons: flagReasons })
    }

    const byReason = {}
    for (const f of flags) for (const r of f.reasons) byReason[r] = (byReason[r] ?? 0) + 1

    report.tables[table] = {
      total_rows: rows.length,
      repairable: repairs.length,
      to_flag: flags.length,
      flag_reasons: byReason,
      healthy: rows.length - repairs.length - flags.length,
    }

    plannedFlags.set(
      table,
      flags.map((f) => f.question_id).filter((q) => q !== null && q !== undefined)
    )

    console.log(`\n=== ${table} (${rows.length} rows) ===`)
    console.log(`  repairable (answer text -> letter): ${repairs.length}`)
    console.log(`  to flag inactive                  : ${flags.length}`)
    for (const [reason, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
      console.log(`      ${reason.padEnd(24)} ${n}`)
    }
    console.log(`  healthy (no detectable defect)    : ${rows.length - repairs.length - flags.length}`)

    if (APPLY) {
      // Repairs: rewrite the answer as its letter, and give rows that lack a
      // question_id a stable one so they can be referenced at all.
      for (const r of repairs) {
        await c.query(
          `update ${table}
              set correct_answer = $1,
                  question_id = coalesce(question_id, $2)
            where id = $3`,
          [r.correct_answer, `${table.toUpperCase().slice(0, 6)}-FIX-${String(r.id).slice(0, 8)}`, r.id]
        )
      }

      // Flags: retire rather than delete, so nothing is lost and the rows can
      // be reviewed by a Telugu expert later.
      const ids = flags.map((f) => f.id)
      for (let i = 0; i < ids.length; i += 500) {
        await c.query(`update ${table} set is_active = false where id = any($1)`, [ids.slice(i, i + 500)])
      }
      console.log(`  APPLIED: ${repairs.length} repaired, ${ids.length} flagged inactive`)
    }
  }

  // ---- How much of the live module content is affected? ----
  // Computed from the PLANNED flag list, not from is_active — otherwise a
  // report-only run always reports none, because nothing has been flagged yet.
  console.log('')
  console.log('=== published modules containing questions planned for flagging ===')
  const impactRows = []
  for (const [table, qids] of plannedFlags) {
    if (qids.length === 0) continue
    const r = await c.query(
      `select count(*)::int mappings, count(distinct q.mock_test_id)::int modules
         from mock_test_questions q
         join mock_tests t on t.id = q.mock_test_id
        where t.status = 'published'
          and q.question_table = $1
          and q.question_id = any($2)`,
      [table, qids]
    )
    if (r.rows[0].mappings > 0) impactRows.push({ question_table: table, ...r.rows[0] })
  }
  const impact = { rows: impactRows }
  if (impactRows.length === 0) {
    console.log('  none')
  } else {
    console.table(impactRows)
    const totalMappings = impactRows.reduce((n, x) => n + x.mappings, 0)
    console.log('  -> ' + totalMappings + ' question slots in live modules point at a row planned for retirement.')
    console.log('     Those slots must be replaced, otherwise students keep seeing the broken question.')
  }

  report.module_impact = impact.rows

  if (JSON_OUT) {
    fs.writeFileSync(path.resolve(process.cwd(), JSON_OUT), JSON.stringify(report, null, 2))
    console.log(`\nreport written to ${JSON_OUT}`)
  }

  console.log(
    APPLY
      ? '\nApplied. Re-run scripts/generate-mock-series.ts for affected modules to swap out retired questions.'
      : '\nReport only — nothing was changed. Re-run with --apply to repair and flag.'
  )
  await c.end()
}

main().catch((err) => {
  console.error('Audit failed:', err.message)
  process.exitCode = 1
})
