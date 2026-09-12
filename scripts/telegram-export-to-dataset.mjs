// ============================================================
// scripts/telegram-export-to-dataset.mjs
// ============================================================
// Turns a Telegram Desktop chat export into a reviewable question dataset.
//
// READ-ONLY WITH RESPECT TO THE DATABASE. This script never inserts, updates
// or deletes a single row. It only *reads* the live banks (optional) to tell
// you which extracted questions are already in your database.
//
//   node scripts/telegram-export-to-dataset.mjs <path-to-result.json>
//   node scripts/telegram-export-to-dataset.mjs <export.json> --no-db
//
// How to produce the input:
//   Telegram Desktop -> open the channel -> ⋮ -> Export chat history
//     Format: JSON      (machine readable — required)
//     Include: Photos   (only if you want the image list for OCR later)
//   It writes a folder containing `result.json`. Pass that file.
//
// WHY THIS IS NEEDED
//   t.me/s/<channel> serves a scrapeable feed only for channels that enable a
//   public web preview. AspirantsOfTetDsc does not: the /s/ URL answers 302
//   and redirects to a landing page with no messages in it. There is no public
//   HTML to parse, so the content has to come out through the app or the API.
//
// WHAT IT EXTRACTS
//   1. quiz / poll messages  -> question + options (answer key needs review,
//                               see the note on `answer_confidence` below)
//   2. text messages that    -> question + options + answer when the post
//      look like MCQs           states one ("Ans: B", "సమాధానం: 2", ...)
//   3. image-only messages   -> listed, not extracted (they would need OCR)
//
// OUTPUT (under data/telegram-dsc/)
//   questions.json / questions.csv   the dataset, in the project's bank shape
//   needs-review.csv                 rows a human must confirm before any use
//   skipped.csv                      every message that yielded nothing, with why
//   report.md                        counts, medium split, duplicate analysis
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

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

const INPUT = process.argv[2]
const CHECK_DB = !process.argv.includes('--no-db')
const OUT_DIR = path.resolve(process.cwd(), 'data/telegram-dsc')

if (!INPUT) {
  console.error('usage: node scripts/telegram-export-to-dataset.mjs <result.json> [--no-db]')
  process.exit(1)
}
if (!fs.existsSync(INPUT)) {
  console.error(`no such file: ${INPUT}`)
  console.error('Export it from Telegram Desktop: channel -> ⋮ -> Export chat history -> JSON')
  process.exit(1)
}

const LETTERS = ['A', 'B', 'C', 'D']

/** Telegram stores `text` as a string, or an array of strings and entity objects. */
function flattenText(t) {
  if (typeof t === 'string') return t
  if (!Array.isArray(t)) return ''
  return t.map((p) => (typeof p === 'string' ? p : (p && p.text) || '')).join('')
}

const normalise = (s) =>
  String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Telugu script present? Used to route a row to the right medium. */
const isTelugu = (s) => /[ఀ-౿]/.test(String(s ?? ''))

/**
 * Pull an MCQ out of a free-text post.
 * Handles the option and answer shapes these channels actually use:
 *   A) / A. / (A) / 1) / 1. / ఎ) , and  Ans / Answer / Key / సమాధానం / జవాబు
 */
function parseTextMcq(raw) {
  const text = raw.replace(/\r/g, '')
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) return null

  const optRe = /^[(\[]?\s*([A-Da-d1-4]|[ఀ-౿])\s*[)\].:-]\s*(.+)$/
  const ansRe = /^(?:ans(?:wer)?|key|correct(?:\s*answer)?|సమాధానం|జవాబు|ఆన్సర్)\s*[:\-–=]?\s*(.+)$/i

  const stem = []
  const options = []
  let answerRaw = null

  for (const line of lines) {
    const a = line.match(ansRe)
    if (a) { answerRaw = a[1].trim(); continue }
    const o = line.match(optRe)
    if (o && options.length < 8) { options.push({ label: o[1], text: o[2].trim() }); continue }
    if (!options.length) stem.push(line)
  }

  if (options.length < 4) return null
  const question = stem.join(' ')
    .replace(/^(?:Q\s*[.)\-:]?\s*|\d+\s*[.)]\s*|ప్రశ్న\s*[:.\-]?\s*)/i, '')
    .trim()
  if (!question) return null

  const four = options.slice(0, 4)
  const { answer, confidence } = resolveAnswer(answerRaw, four)

  return {
    question,
    options: four.map((o) => o.text),
    answer,
    answer_confidence: confidence,
  }
}

/**
 * Work out which option a stated answer refers to.
 *
 * Order matters. A bare spelled-out answer must NOT be read as a letter label:
 * "Answer: Citric acid" means the option whose text is "Citric acid", not
 * option C. So a label is only accepted when the whole field is the label, or
 * when a label is followed by a delimiter and text that agrees with it.
 */
function resolveAnswer(answerRaw, four) {
  if (!answerRaw) return { answer: '', confidence: 'missing' }
  const head = String(answerRaw).trim().replace(/[.\s]+$/, '')
  const labelToLetter = (tok) => (/^[1-4]$/.test(tok)
    ? LETTERS[Number(tok) - 1]
    : tok.toUpperCase())

  // 1. the field is nothing but a label: "B", "(a)", "2.", "[C]"
  const bare = head.match(/^[(\[]?\s*([A-Da-d1-4])\s*[)\]:.\-]?$/)
  if (bare) return { answer: labelToLetter(bare[1]), confidence: 'stated' }

  // 2. the field is the option's text, spelled out
  const byText = four.findIndex((o) => normalise(o.text) === normalise(head))
  if (byText >= 0) return { answer: LETTERS[byText], confidence: 'stated' }

  // 3. a label, a real delimiter, then text: "C) Saturn", "B - Ambedkar"
  const labelled = head.match(/^[(\[]?\s*([A-Da-d1-4])\s*[)\]:.\-–]\s*(.+)$/)
  if (labelled) {
    const letter = labelToLetter(labelled[1])
    const rest = labelled[2].trim()
    const restHit = four.findIndex((o) => normalise(o.text) === normalise(rest))
    // If the spelled-out half names a different option, trust neither blindly.
    if (restHit >= 0 && LETTERS[restHit] !== letter) {
      return { answer: LETTERS[restHit], confidence: 'label_text_mismatch' }
    }
    return { answer: letter, confidence: 'stated' }
  }

  // 4. the text is a recognisable prefix of exactly one option
  const n = normalise(head)
  if (n.length >= 3) {
    const partial = four
      .map((o, i) => ({ i, t: normalise(o.text) }))
      .filter((o) => o.t.startsWith(n) || n.startsWith(o.t))
    if (partial.length === 1) {
      return { answer: LETTERS[partial[0].i], confidence: 'partial_text_match' }
    }
  }

  return { answer: '', confidence: 'unparsed_answer' }
}

/**
 * Quiz polls: the export carries the options and their vote counts but NOT a
 * flag for the correct one, so the key cannot be read off reliably. The
 * most-voted option is recorded as a candidate and marked for review — it is
 * a crowd guess, not an answer key.
 */
function parsePoll(poll) {
  const answers = Array.isArray(poll.answers) ? poll.answers : []
  if (answers.length < 4) return null
  const question = flattenText(poll.question).trim()
  if (!question) return null
  const four = answers.slice(0, 4)
  const explicit = four.findIndex((a) => a.correct === true)
  if (explicit >= 0) {
    return {
      question,
      options: four.map((a) => flattenText(a.text).trim()),
      answer: LETTERS[explicit],
      answer_confidence: 'stated',
    }
  }
  let best = -1, bestVotes = -1
  four.forEach((a, i) => {
    const v = Number(a.voters ?? 0)
    if (v > bestVotes) { bestVotes = v; best = i }
  })
  return {
    question,
    options: four.map((a) => flattenText(a.text).trim()),
    answer: bestVotes > 0 ? LETTERS[best] : '',
    answer_confidence: bestVotes > 0 ? 'most_voted_guess' : 'missing',
  }
}

// ------------------------------------------------------------------ read
const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'))
const messages = Array.isArray(raw.messages) ? raw.messages : []
console.log(`export: "${raw.name ?? '(unnamed)'}" type=${raw.type ?? '?'} messages=${messages.length}`)

const rows = []
const skipped = []
const seen = new Map()

for (const m of messages) {
  const id = m.id
  const date = (m.date || '').slice(0, 10)
  const text = flattenText(m.text)
  const hasPhoto = Boolean(m.photo || (m.file && /\.(jpg|jpeg|png|webp)$/i.test(m.file)))

  let parsed = null
  let kind = ''
  if (m.poll) { parsed = parsePoll(m.poll); kind = 'poll' }
  if (!parsed && text) { parsed = parseTextMcq(text); kind = parsed ? 'text' : kind }

  if (!parsed) {
    skipped.push({
      message_id: id,
      date,
      reason: m.poll ? 'poll with fewer than 4 options'
        : hasPhoto && !text ? 'image only — would need OCR'
        : hasPhoto ? 'image with caption, no parseable MCQ'
        : !text ? 'no text content (sticker/service/media)'
        : 'text did not match an MCQ shape',
      preview: text.replace(/\s+/g, ' ').slice(0, 90),
    })
    continue
  }

  if (new Set(parsed.options.map(normalise)).size !== 4 || parsed.options.some((o) => !o)) {
    skipped.push({ message_id: id, date, reason: 'blank or duplicate options',
      preview: parsed.question.slice(0, 90) })
    continue
  }

  const key = normalise(parsed.question)
  if (seen.has(key)) {
    skipped.push({ message_id: id, date, reason: `duplicate of message ${seen.get(key)}`,
      preview: parsed.question.slice(0, 90) })
    continue
  }
  seen.set(key, id)

  const telugu = isTelugu(parsed.question + parsed.options.join(' '))
  rows.push({
    source_message_id: id,
    source_date: date,
    source_kind: kind,
    language: telugu ? 'Telugu' : 'English',
    medium: telugu ? 'telugu' : 'english',
    question: parsed.question,
    option_a: parsed.options[0],
    option_b: parsed.options[1],
    option_c: parsed.options[2],
    option_d: parsed.options[3],
    correct_answer: parsed.answer,
    answer_confidence: parsed.answer_confidence,
    explanation: '',
    subject: '',
    chapter: '',
    topic: '',
    difficulty: '',
    source_type: 'Telegram @AspirantsOfTetDsc',
    needs_review: parsed.answer_confidence === 'stated' ? 'no' : 'yes',
  })
}

console.log(`parsed ${rows.length} questions, skipped ${skipped.length} messages`)

// ------------------------------------------------- optional duplicate check
let dbDupes = 0
if (CHECK_DB && rows.length) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!U || !KEY) {
    console.log('skipping database duplicate check (no credentials in env)')
  } else {
    const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
    const TABLES = ['gk_english_medium', 'gk_telugu_medium', 'english_subject_questions',
      'telugu_subject_questions', 'math_english_medium', 'telugu_medium_math',
      'english_medium_science', 'telugu_medium_science', 'socal_english_medium',
      'socal_telugu_medimum', 'pedagogy_english_medium', 'pedagogy_subject_questions']
    const existing = new Set()
    for (const t of TABLES) {
      try {
        for (let from = 0; ; from += 1000) {
          const r = await fetch(`${U}/rest/v1/${t}?select=question`,
            { headers: { ...H, Range: `${from}-${from + 999}` } })
          const b = await r.json()
          if (!Array.isArray(b)) break
          for (const row of b) existing.add(normalise(row.question))
          if (b.length < 1000) break
        }
      } catch { /* a missing table must not stop the export */ }
    }
    console.log(`compared against ${existing.size} questions already in the database`)
    for (const row of rows) {
      if (existing.has(normalise(row.question))) { row.already_in_db = 'yes'; dbDupes++ }
      else row.already_in_db = 'no'
    }
  }
}

// ------------------------------------------------------------------ write
fs.mkdirSync(OUT_DIR, { recursive: true })
const COLS = ['source_message_id', 'source_date', 'source_kind', 'medium', 'language',
  'subject', 'chapter', 'topic', 'difficulty', 'question', 'option_a', 'option_b',
  'option_c', 'option_d', 'correct_answer', 'answer_confidence', 'explanation',
  'source_type', 'needs_review', 'already_in_db']
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const toCsv = (data, cols) =>
  '﻿' + [cols.map(esc).join(','), ...data.map((r) => cols.map((c) => esc(r[c])).join(','))]
    .join('\r\n')

fs.writeFileSync(path.join(OUT_DIR, 'questions.json'), JSON.stringify(rows, null, 1))
fs.writeFileSync(path.join(OUT_DIR, 'questions.csv'), toCsv(rows, COLS))
fs.writeFileSync(path.join(OUT_DIR, 'needs-review.csv'),
  toCsv(rows.filter((r) => r.needs_review === 'yes'), COLS))
fs.writeFileSync(path.join(OUT_DIR, 'skipped.csv'),
  toCsv(skipped, ['message_id', 'date', 'reason', 'preview']))

const tally = (arr, k) => arr.reduce((a, r) => (a[r[k]] = (a[r[k]] || 0) + 1, a), {})
const skipReasons = tally(skipped, 'reason')
const report = `# Telegram export -> dataset

Source export: \`${path.basename(INPUT)}\` — channel "${raw.name ?? '(unnamed)'}"
Messages in export: **${messages.length}**

## Result

| | |
|---|---|
| questions extracted | **${rows.length}** |
| messages skipped | ${skipped.length} |
| from quiz/polls | ${tally(rows, 'source_kind').poll ?? 0} |
| from text posts | ${tally(rows, 'source_kind').text ?? 0} |
| Telugu / English | ${tally(rows, 'language').Telugu ?? 0} / ${tally(rows, 'language').English ?? 0} |
| **need human review** | **${rows.filter((r) => r.needs_review === 'yes').length}** |
| already present in your database | ${dbDupes} |

## How the answer key was obtained

| \`answer_confidence\` | rows | meaning |
|---|---|---|
${Object.entries(tally(rows, 'answer_confidence')).sort((a, b) => b[1] - a[1])
  .map(([k, n]) => `| \`${k}\` | ${n} | ${({
    stated: 'the post labelled the answer — trustworthy',
    most_voted_guess: 'poll crowd favourite — NOT an answer key',
    partial_text_match: 'matched one option by prefix — verify',
    label_text_mismatch: 'post\'s letter and spelled-out answer disagree — verify',
    unparsed_answer: 'an answer line was present but unreadable',
    missing: 'the post stated no answer at all',
  })[k] ?? 'unknown'} |`).join('\n')}

## Why messages were skipped

${Object.entries(skipReasons).sort((a, b) => b[1] - a[1])
  .map(([r, n]) => `- ${n} — ${r}`).join('\n') || '- none'}

## Before any of this reaches the live banks

1. **Answer keys.** Telegram's JSON export does not record which option of a quiz
   poll is correct. Rows marked \`most_voted_guess\` carry the option the crowd
   picked most, which is not an answer key — a wrong crowd is common on hard items.
   Every \`needs_review = yes\` row needs a human to set the key.
2. **No subject/chapter yet.** Those columns are deliberately blank; nothing in the
   post says which blueprint section a question belongs to.
3. **Provenance.** These are someone else's posts. Previous-paper questions are
   government material, but explanations and original items written by the channel
   are not yours to resell. Confirm you have the right to use them before they go
   into a paid product.
4. **Duplicates.** \`already_in_db = yes\` rows are already in your banks; importing
   them would create the exact duplication the recent cleanups removed.

Nothing in this run touched the database.
`
fs.writeFileSync(path.join(OUT_DIR, 'report.md'), report)

console.log(`\nwrote -> ${path.relative(process.cwd(), OUT_DIR)}/`)
console.log('  questions.json / questions.csv')
console.log('  needs-review.csv  (' + rows.filter((r) => r.needs_review === 'yes').length + ' rows)')
console.log('  skipped.csv       (' + skipped.length + ' rows)')
console.log('  report.md')
console.log('\nNo database rows were read for writing and none were modified.')
