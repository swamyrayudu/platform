// ============================================================
// scripts/archive-incomplete-mocks.mjs
// ============================================================
// Archives PUBLISHED mock tests whose stored question mapping is incomplete
// (fewer rows in mock_test_questions than total_questions).
//
// Such a test is broken from a student's point of view: the questions endpoint
// returns 503 because the module has no fixed question set. Archiving hides it
// from the list without deleting anything, so it can be regenerated later.
//
// Uses the service-role key over PostgREST — no schema changes, DML only, so it
// works before or after migration 019.
//
// Usage:
//   node scripts/archive-incomplete-mocks.mjs            # dry run (default)
//   node scripts/archive-incomplete-mocks.mjs --apply    # perform the update
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

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function getAll(pathAndQuery) {
  const out = []
  let from = 0
  for (;;) {
    const res = await fetch(`${URL_BASE}/rest/v1/${pathAndQuery}`, {
      headers: { ...H, Range: `${from}-${from + 999}` },
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < 1000) break
    from += 1000
  }
  return out
}

async function main() {
  const tests = await getAll(
    'mock_tests?select=id,slug,title,medium,category,status,total_questions&order=slug'
  )
  const mappings = await getAll('mock_test_questions?select=mock_test_id')

  const counts = new Map()
  for (const m of mappings) counts.set(m.mock_test_id, (counts.get(m.mock_test_id) ?? 0) + 1)

  const broken = tests.filter((t) => {
    if (t.status !== 'published') return false
    return (counts.get(t.id) ?? 0) < (t.total_questions ?? 0)
  })

  console.log(`Total mock_tests: ${tests.length}`)
  console.log(`Published with an incomplete question set: ${broken.length}\n`)

  if (broken.length === 0) {
    console.log('Nothing to archive.')
    return
  }

  console.log('  mapped/expected  medium   slug')
  for (const t of broken) {
    const have = counts.get(t.id) ?? 0
    console.log(
      `  ${String(have).padStart(5)}/${String(t.total_questions).padEnd(5)}  ` +
        `${t.medium.padEnd(8)} ${t.slug}`
    )
  }

  // Safety: never archive something a user has actually attempted.
  const attempts = await getAll('mock_test_attempts?select=mock_test_id')
  const attemptedIds = new Set(attempts.map((a) => a.mock_test_id))
  const withAttempts = broken.filter((t) => attemptedIds.has(t.id))

  if (withAttempts.length > 0) {
    console.log(
      `\nSkipping ${withAttempts.length} test(s) that already have user attempts: ` +
        withAttempts.map((t) => t.slug).join(', ')
    )
  }

  const toArchive = broken.filter((t) => !attemptedIds.has(t.id))

  if (!APPLY) {
    console.log(`\nDRY RUN — would archive ${toArchive.length} test(s). Re-run with --apply.`)
    return
  }

  let archived = 0
  for (const t of toArchive) {
    const res = await fetch(`${URL_BASE}/rest/v1/mock_tests?id=eq.${t.id}`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'archived', updated_at: new Date().toISOString() }),
    })
    if (res.ok) {
      archived++
      console.log(`  archived ${t.slug}`)
    } else {
      console.log(`  FAILED  ${t.slug}: ${res.status} ${await res.text()}`)
    }
  }

  console.log(`\nArchived ${archived}/${toArchive.length} test(s).`)

  const after = await getAll('mock_tests?select=medium,status')
  const summary = {}
  for (const t of after) {
    const key = `${t.medium}/${t.status}`
    summary[key] = (summary[key] ?? 0) + 1
  }
  console.log('Now:', summary)
}

main().catch((err) => {
  console.error('Failed:', err.message)
  process.exitCode = 1
})
