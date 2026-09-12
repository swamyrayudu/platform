// ============================================================
// scripts/apply-migration.mjs — Apply ONE migration file
// ============================================================
// Applies a single SQL migration inside a transaction, so it either lands
// completely or not at all.
//
// Deliberately NOT `supabase db push`: migrations 001-018 were applied by hand
// through the SQL editor, so the remote `supabase_migrations.schema_migrations`
// history is empty and `db push` would try to replay all of them.
//
// Usage:
//   node scripts/apply-migration.mjs supabase/migrations/019_mock_module_series.sql
//   node scripts/apply-migration.mjs <file> --check      # connect + verify only
//
// Requires SUPABASE_DB_URL in .env (or the environment):
//   SUPABASE_DB_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
//
// The value is read from .env and never printed.
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
      if (!m) continue
      let value = m[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = value
    }
  }
}
loadEnv()

const args = process.argv.slice(2)
const CHECK_ONLY = args.includes('--check')
const file = args.find((a) => !a.startsWith('--'))

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
if (!dbUrl) {
  console.error(
    'SUPABASE_DB_URL is not set.\n\n' +
      'Add this line to .env (it is gitignored):\n' +
      '  SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres\n\n' +
      'Supabase Dashboard -> Project Settings -> Database -> Connection string -> URI.\n' +
      'If the password contains @ : / ? # or %, percent-encode it.'
  )
  process.exit(1)
}

if (!CHECK_ONLY && !file) {
  console.error('Usage: node scripts/apply-migration.mjs <path-to-sql> [--check]')
  process.exit(1)
}

// Redact everything but the host so logs never leak the password.
function safeTarget(url) {
  try {
    const u = new URL(url)
    return `${u.hostname}:${u.port || 5432}${u.pathname}`
  } catch {
    return '(unparseable connection string)'
  }
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  // A migration that adds columns and indexes to 13 tables needs headroom.
  statement_timeout: 15 * 60 * 1000,
})

async function main() {
  console.log(`Connecting to ${safeTarget(dbUrl)} ...`)
  await client.connect()

  const who = await client.query(
    'select current_database() as db, current_user as usr, version() as v'
  )
  console.log(`Connected: db=${who.rows[0].db} user=${who.rows[0].usr}`)
  console.log(`Server: ${String(who.rows[0].v).split(',')[0]}`)

  // Confirm this really is the DSC project before touching anything.
  const probe = await client.query(`
    select
      (select count(*) from information_schema.tables
        where table_schema='public' and table_name='mock_tests') as has_mock_tests,
      (select count(*) from information_schema.tables
        where table_schema='public' and table_name='english_subject_questions') as has_questions
  `)
  const { has_mock_tests, has_questions } = probe.rows[0]
  console.log(`Sanity: mock_tests=${has_mock_tests} english_subject_questions=${has_questions}`)

  if (Number(has_mock_tests) === 0 || Number(has_questions) === 0) {
    throw new Error(
      'This database does not look like the DSC project (mock_tests / english_subject_questions missing). Refusing to apply.'
    )
  }

  if (CHECK_ONLY) {
    const counts = await client.query(`
      select
        (select count(*) from mock_tests) as mock_tests,
        (select count(*) from mock_test_questions) as mappings,
        (select count(*) from mock_test_attempts) as attempts
    `)
    console.log('Current row counts:', counts.rows[0])
    console.log('Check passed. Nothing was modified.')
    return
  }

  const full = path.resolve(process.cwd(), file)
  if (!fs.existsSync(full)) throw new Error(`Migration file not found: ${full}`)
  const sql = fs.readFileSync(full, 'utf8')
  console.log(`Applying ${file} (${sql.length} bytes) in a transaction ...`)

  const started = Date.now()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  }

  console.log(`Applied successfully in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  // Report what now exists, so success is verified rather than assumed.
  const verify = await client.query(`
    select
      (select count(*) from information_schema.columns
        where table_schema='public' and table_name='mock_tests'
          and column_name in ('module_number','series','generated_at','generation_meta')) as mock_tests_cols,
      (select count(*) from information_schema.columns
        where table_schema='public' and table_name='mock_test_questions'
          and column_name='question_uid') as has_question_uid,
      (select count(*) from information_schema.tables
        where table_schema='public' and table_name='mock_question_usage') as usage_table,
      (select count(*) from information_schema.tables
        where table_schema='public' and table_name='user_mock_test_progress') as progress_table,
      (select count(*) from information_schema.tables
        where table_schema='public' and table_name='mock_generation_reports') as reports_table,
      (select count(*) from information_schema.columns
        where table_schema='public' and column_name='is_active'
          and table_name in ('english_subject_questions','telugu_subject_questions',
            'pedagogy_subject_questions','pedagogy_english_medium','telugu_medium_math',
            'math_english_medium','telugu_medium_science','english_medium_science',
            'socal_telugu_medimum','socal_english_medium','gk_english_medium',
            'gk_telugu_medium','dsc_practice_questions')) as is_active_cols,
      (select count(*) from pg_constraint
        where conname='uq_mock_test_question_uid') as uid_constraint
  `)
  console.log('Verification:', verify.rows[0])

  const v = verify.rows[0]
  const ok =
    Number(v.mock_tests_cols) === 4 &&
    Number(v.has_question_uid) === 1 &&
    Number(v.usage_table) === 1 &&
    Number(v.progress_table) === 1 &&
    Number(v.reports_table) === 1 &&
    Number(v.uid_constraint) === 1

  console.log(ok ? 'MIGRATION VERIFIED' : 'MIGRATION INCOMPLETE — inspect the output above')
  if (!ok) process.exitCode = 1
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message)
    process.exitCode = 1
  })
  .finally(() => client.end().catch(() => {}))
