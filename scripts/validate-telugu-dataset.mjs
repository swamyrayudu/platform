// ============================================================
// scripts/validate-telugu-dataset.mjs
// ============================================================
// Validates a Telugu question dataset against the production rules, and emits
// a CSV alongside the JSON so both always agree.
//
//   node scripts/validate-telugu-dataset.mjs data/telugu-questions-v1.json
//   node scripts/validate-telugu-dataset.mjs data/telugu-questions-v1.json --csv
//
// Exits non-zero if ANY question fails, so it can gate an import.
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || 'data/telugu-questions-v1.json'
const WRITE_CSV = process.argv.includes('--csv')

const REQUIRED = [
  'question_id', 'medium', 'subject', 'class_level', 'chapter', 'topic', 'subtopic',
  'difficulty', 'question_type', 'question', 'option_a', 'option_b', 'option_c',
  'option_d', 'correct_answer', 'explanation',
]

const LETTERS = ['A', 'B', 'C', 'D']
const TELUGU = /[ఀ-౿]/
const REPLACEMENT = '�'
// Stems that name no specific item — the defect that made the old bank unusable.
const GENERIC_STEM =
  /^(కింది వాటిలో సరైనది ఏది|సరైన సమాధానం ఏది|సరైన ఎంపిక ఏది|ఉత్తమ సమాధానం ఏది)[\s?.]*$/

const rows = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
const errors = []
const warn = []
const seenIds = new Set()
const seenQuestions = new Set()

rows.forEach((r, i) => {
  const at = `[${i + 1}] ${r.question_id ?? '(no id)'}`
  const fail = (m) => errors.push(`${at}: ${m}`)

  for (const f of REQUIRED) {
    if (r[f] === undefined || String(r[f]).trim() === '') fail(`missing field "${f}"`)
  }
  if (errors.some((e) => e.startsWith(at))) return

  if (seenIds.has(r.question_id)) fail('duplicate question_id')
  seenIds.add(r.question_id)

  const qKey = r.question.trim()
  if (seenQuestions.has(qKey)) fail('duplicate question text')
  seenQuestions.add(qKey)

  if (r.medium !== 'Telugu') fail(`medium must be "Telugu", got "${r.medium}"`)
  if (r.subject !== 'Telugu') fail(`subject must be "Telugu", got "${r.subject}"`)
  if (!['Easy', 'Medium', 'Hard'].includes(r.difficulty)) fail(`bad difficulty "${r.difficulty}"`)

  if (!LETTERS.includes(r.correct_answer)) fail(`correct_answer must be A/B/C/D, got "${r.correct_answer}"`)

  const opts = [r.option_a, r.option_b, r.option_c, r.option_d].map((o) => String(o).trim())
  if (new Set(opts).size !== 4) fail('duplicate options')
  if (opts.some((o) => o.length === 0)) fail('empty option')
  if (opts.some((o) => o === r.question.trim())) fail('an option repeats the question')

  // Script + corruption
  const all = [r.question, ...opts, r.explanation].join(' ')
  if (all.includes(REPLACEMENT)) fail('contains U+FFFD replacement character')
  if (!TELUGU.test(r.question)) fail('question has no Telugu script')

  // Answerability: the stem must name what is being asked.
  if (GENERIC_STEM.test(r.question.trim())) fail('generic stem names no specific item')
  if (r.question.trim().length < 15) fail('stem too short to be answerable')
  if (!r.question.includes('?') && !/ఏది|ఏవి|ఏమిటి|ఎవరు|ఎన్ని|గుర్తించండి|ఎంచుకోండి/.test(r.question)) {
    warn.push(`${at}: stem may not be phrased as a question`)
  }

  // The explanation should justify the keyed answer, not restate the stem.
  const keyed = opts[LETTERS.indexOf(r.correct_answer)]
  if (String(r.explanation).trim().length < 20) fail('explanation too short to justify the answer')
  if (!TELUGU.test(r.explanation)) fail('explanation has no Telugu script')
  if (keyed && keyed.length > 3 && !r.explanation.includes(keyed.slice(0, 6))) {
    warn.push(`${at}: explanation may not reference the keyed option ("${keyed}")`)
  }
})

// ---- Coverage summary ----
const by = (f) =>
  rows.reduce((m, r) => {
    m[r[f]] = (m[r[f]] ?? 0) + 1
    return m
  }, {})

console.log(`Dataset: ${file}`)
console.log(`Questions: ${rows.length}`)
console.log(`\nDifficulty:`, by('difficulty'))
console.log(`Question types:`, by('question_type'))
console.log(`\nTopics (${Object.keys(by('topic')).length}):`)
Object.entries(by('topic'))
  .sort((a, b) => b[1] - a[1])
  .forEach(([t, n]) => console.log(`   ${String(n).padStart(3)}  ${t}`))

const answerDist = by('correct_answer')
console.log(`\nAnswer key distribution:`, answerDist)
const maxShare = Math.max(...Object.values(answerDist)) / rows.length
if (maxShare > 0.4) warn.push(`answer keys are skewed — one letter is ${(maxShare * 100).toFixed(0)}%`)

// ---- Result ----
if (warn.length) {
  console.log(`\nWarnings (${warn.length}):`)
  warn.forEach((w) => console.log('  ! ' + w))
}

if (errors.length) {
  console.log(`\nFAILED — ${errors.length} error(s):`)
  errors.forEach((e) => console.log('  x ' + e))
  process.exitCode = 1
} else {
  console.log(`\nPASSED — all ${rows.length} questions satisfy every rule.`)
}

// ---- CSV ----
if (WRITE_CSV && errors.length === 0) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const csv = [
    REQUIRED.join(','),
    ...rows.map((r) => REQUIRED.map((f) => esc(r[f])).join(',')),
  ].join('\r\n')
  const out = file.replace(/\.json$/, '.csv')
  // UTF-8 BOM so Excel opens Telugu correctly instead of mojibake.
  fs.writeFileSync(out, '﻿' + csv, 'utf8')
  console.log(`\nCSV written: ${out} (UTF-8 with BOM)`)
}
