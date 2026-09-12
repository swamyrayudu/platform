// ============================================================
// scripts/rebalance-answer-keys.mjs
// ============================================================
// Evens out the A/B/C/D distribution of a dataset by permuting each question's
// options and recomputing correct_answer.
//
// WHY THIS MATTERS
//   An authored set drifts toward whichever position the writer put the right
//   answer in. If one letter is never correct (or is correct far too often),
//   a candidate can score above chance without knowing the subject — the key
//   itself leaks information.
//
// SAFE BECAUSE
//   Only the ORDER of the four options changes. The correct option travels with
//   its new letter, so the factual content and its explanation stay intact.
//   Explanations in this dataset cite option TEXT, never "option A", so they
//   remain accurate after a permutation. The script asserts that.
//
//   node scripts/rebalance-answer-keys.mjs data/telugu-questions-v1.json --apply
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2] || 'data/telugu-questions-v1.json'
const APPLY = process.argv.includes('--apply')
const LETTERS = ['A', 'B', 'C', 'D']

const full = path.resolve(file)
const rows = JSON.parse(fs.readFileSync(full, 'utf8'))

// Refuse to run if any explanation names a letter position — permuting would
// make it wrong.
const positional = rows.filter((r) =>
  /(option|ఎంపిక)\s*[ABCD]\b|['"‘’]?[ABCD]['"‘’]?\s*(ఎంపిక|option)/i.test(String(r.explanation))
)
if (positional.length > 0) {
  console.error('Refusing: these explanations reference a letter position and would break:')
  positional.forEach((r) => console.error('  ' + r.question_id))
  process.exit(1)
}

const before = rows.reduce((m, r) => ((m[r.correct_answer] = (m[r.correct_answer] ?? 0) + 1), m), {})
console.log('before:', before)

// Deterministic RNG so a rerun reproduces the same dataset.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260912)

// Target letter for each question: a shuffled, evenly-sized pool.
const target = []
for (let i = 0; i < rows.length; i++) target.push(LETTERS[i % 4])
for (let i = target.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1))
  ;[target[i], target[j]] = [target[j], target[i]]
}

rows.forEach((r, i) => {
  const opts = { A: r.option_a, B: r.option_b, C: r.option_c, D: r.option_d }
  const correctText = opts[r.correct_answer]
  const others = LETTERS.filter((l) => l !== r.correct_answer).map((l) => opts[l])

  // Shuffle the distractors so their order is not preserved either.
  for (let k = others.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1))
    ;[others[k], others[j]] = [others[j], others[k]]
  }

  const want = target[i]
  const next = {}
  let d = 0
  for (const l of LETTERS) next[l] = l === want ? correctText : others[d++]

  r.option_a = next.A
  r.option_b = next.B
  r.option_c = next.C
  r.option_d = next.D
  r.correct_answer = want

  // Invariant: the keyed option must still hold the original correct text.
  if (next[want] !== correctText) {
    throw new Error(`permutation lost the correct answer for ${r.question_id}`)
  }
})

const after = rows.reduce((m, r) => ((m[r.correct_answer] = (m[r.correct_answer] ?? 0) + 1), m), {})
console.log('after :', after)

if (APPLY) {
  fs.writeFileSync(full, JSON.stringify(rows, null, 2) + '\n', 'utf8')
  console.log(`\nwritten: ${file}`)
} else {
  console.log('\nDry run — re-run with --apply.')
}
