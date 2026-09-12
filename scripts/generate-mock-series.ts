// ============================================================
// scripts/generate-mock-series.ts — Generate the Module Series
// ============================================================
// Runs the REAL production generator (lib/mock-tests/*), not a copy, so a dry
// run verifies exactly what the API route will do.
//
// Usage (from the project root):
//
//   # Read-only: plan the series and print the coverage report. Writes nothing.
//   npx tsx scripts/generate-mock-series.ts --dry-run
//
//   # Plan + write + publish + warm cache for both mediums, modules 1..100
//   npx tsx scripts/generate-mock-series.ts
//
//   # One medium / a sub-range
//   npx tsx scripts/generate-mock-series.ts --medium english --from 1 --to 25
//
// Flags:
//   --dry-run            plan only; no database writes
//   --medium <m>         english | telugu | both        (default both)
//   --from <n>           first module number             (default 1)
//   --to <n>             last module number              (default 100)
//   --series <s>         series name                     (default grand_mock_v1)
//   --blueprint <id>     blueprint id                    (default ap_dsc_sgt_official)
//   --no-publish         write as draft instead of publishing
//   --seed <n>           RNG seed for a reproducible run
//   --json <path>        also write the full report as JSON
// ============================================================

import fs from 'node:fs'
import path from 'node:path'

// ---- Load .env before anything imports supabase-admin -------------
function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const full = path.resolve(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
      if (!m) continue
      const key = m[1]
      let value = m[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
}
loadEnv()

// ---- CLI ---------------------------------------------------------
const argv = process.argv.slice(2)

function flag(name: string): boolean {
  return argv.includes(`--${name}`)
}
function opt(name: string, fallback?: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}

const DRY_RUN = flag('dry-run')
const PUBLISH = !flag('no-publish')
const MODULE_FROM = Math.max(1, Number(opt('from', '1')))
const MODULE_TO = Math.max(MODULE_FROM, Number(opt('to', '100')))
const SERIES_NAME = opt('series', 'grand_mock_v1') as string
const BLUEPRINT_ID = opt('blueprint', 'ap_dsc_sgt_official') as string
const SEED_OPT = opt('seed')
const JSON_OUT = opt('json')
const MEDIUM_OPT = (opt('medium', 'both') as string).toLowerCase()

async function main() {
  // Imported after loadEnv() so supabase-admin sees the credentials.
  const { getBlueprintById } = await import('../lib/mock-tests/blueprints')
  const { planModuleSeries } = await import('../lib/mock-tests/series-generator')
  const { persistModuleSeries } = await import('../lib/mock-tests/series-store')
  const { loadUsageCounts } = await import('../lib/mock-tests/usage')
  const { EXAM_MEDIUMS, isExamMedium } = await import('../lib/mock-tests/question-bank')
  type ExamMediumT = (typeof EXAM_MEDIUMS)[number]

  const blueprint = getBlueprintById(BLUEPRINT_ID)
  if (!blueprint) {
    console.error(`Blueprint not found: ${BLUEPRINT_ID}`)
    process.exit(1)
  }

  const mediums: ExamMediumT[] =
    MEDIUM_OPT === 'both'
      ? [...EXAM_MEDIUMS]
      : isExamMedium(MEDIUM_OPT)
        ? [MEDIUM_OPT]
        : []

  if (mediums.length === 0) {
    console.error(`--medium must be english, telugu or both (got "${MEDIUM_OPT}")`)
    process.exit(1)
  }

  const moduleCount = MODULE_TO - MODULE_FROM + 1

  console.log('='.repeat(72))
  console.log(DRY_RUN ? 'DRY RUN — no database writes' : 'GENERATING AND WRITING MODULES')
  console.log('='.repeat(72))
  console.log(`Blueprint : ${blueprint.name} (${blueprint.id})`)
  console.log(`Series    : ${SERIES_NAME}`)
  console.log(`Modules   : ${MODULE_FROM}..${MODULE_TO}  (${moduleCount} per medium)`)
  console.log(`Mediums   : ${mediums.join(', ')}`)
  console.log(`Per module: ${blueprint.total_questions} questions / ${blueprint.total_marks} marks / ${blueprint.duration_minutes} min`)
  if (!DRY_RUN) console.log(`Publish   : ${PUBLISH ? 'yes (cache warmed)' : 'no (draft)'}`)
  console.log('')

  const collected: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    dry_run: DRY_RUN,
    blueprint_id: blueprint.id,
    series: SERIES_NAME,
    module_from: MODULE_FROM,
    module_to: MODULE_TO,
    runs: [] as unknown[],
  }

  for (const medium of mediums) {
    const label = medium.toUpperCase()
    console.log('-'.repeat(72))
    console.log(`${label} MEDIUM`)
    console.log('-'.repeat(72))

    const t0 = Date.now()
    const existingUsage = await loadUsageCounts(medium)
    if (existingUsage.size > 0) {
      console.log(`Seeded prior usage for ${existingUsage.size} questions.`)
    }

    const plan = await planModuleSeries({
      blueprint,
      medium,
      moduleFrom: MODULE_FROM,
      moduleTo: MODULE_TO,
      series: SERIES_NAME,
      existingUsage,
      ...(SEED_OPT !== undefined ? { seed: Number(SEED_OPT) } : {}),
    })

    const r = plan.report
    const planSeconds = ((Date.now() - t0) / 1000).toFixed(1)

    console.log(`Planned ${plan.modules.length} modules in ${planSeconds}s`)
    console.log('')
    console.log(`  Total question slots    : ${r.total_slots}`)
    console.log(`  Unique questions used   : ${r.unique_questions_used}`)
    console.log(`  Repeated assignments    : ${r.repeated_assignments}`)
    console.log(`  Eligible pool           : ${r.eligible_pool_size}`)
    console.log(`  Pool coverage           : ${r.coverage_pct}%`)
    const uniqueRate = r.total_slots
      ? ((r.unique_questions_used / r.total_slots) * 100).toFixed(2)
      : '0'
    console.log(`  Slots filled uniquely   : ${uniqueRate}%`)
    console.log('')
    console.log('  Per section:')
    console.log(
      '    ' +
        'section'.padEnd(24) +
        'q/mod'.padStart(6) +
        'slots'.padStart(7) +
        'pool'.padStart(7) +
        'unique'.padStart(8) +
        'repeat'.padStart(8) +
        'cover%'.padStart(8) +
        'maxUse'.padStart(8)
    )
    for (const sec of r.per_section) {
      console.log(
        '    ' +
          sec.section_name.slice(0, 23).padEnd(24) +
          String(sec.questions_per_module).padStart(6) +
          String(sec.slots).padStart(7) +
          String(sec.eligible_pool).padStart(7) +
          String(sec.unique_used).padStart(8) +
          String(sec.repeated_assignments).padStart(8) +
          String(sec.coverage_pct).padStart(8) +
          String(sec.max_usage).padStart(8)
      )
    }

    const uniqueWarnings = [...new Set(r.warnings)]
    if (uniqueWarnings.length > 0) {
      console.log('')
      console.log(`  Warnings (${uniqueWarnings.length}):`)
      for (const w of uniqueWarnings.slice(0, 25)) console.log(`    - ${w}`)
      if (uniqueWarnings.length > 25) {
        console.log(`    ... and ${uniqueWarnings.length - 25} more`)
      }
    }

    // Integrity checks on the planned modules themselves.
    let badCount = 0
    let dupInModule = 0
    let badPositions = 0
    for (const m of plan.modules) {
      if (m.questions.length !== blueprint.total_questions) badCount++
      const uids = new Set(m.questions.map((q) => q.question_uid))
      if (uids.size !== m.questions.length) dupInModule++
      const positions = m.questions.map((q) => q.question_number).sort((a, b) => a - b)
      if (positions.some((pos, i) => pos !== i + 1)) badPositions++
    }
    console.log('')
    console.log('  Integrity:')
    console.log(`    modules with wrong question count : ${badCount}`)
    console.log(`    modules with a duplicate question : ${dupInModule}`)
    console.log(`    modules with a position gap       : ${badPositions}`)

    const runRecord: Record<string, unknown> = {
      medium,
      plan_seconds: Number(planSeconds),
      report: r,
      integrity: {
        modules_with_wrong_count: badCount,
        modules_with_duplicate_question: dupInModule,
        modules_with_position_gap: badPositions,
      },
    }

    if (!DRY_RUN) {
      console.log('')
      console.log('  Writing to PostgreSQL...')
      const w0 = Date.now()
      const result = await persistModuleSeries(plan, {
        blueprint,
        series: SERIES_NAME,
        publish: PUBLISH,
        replaceExisting: true,
        onProgress: (msg) => console.log(`    ${msg}`),
      })
      const written = result.modules.filter((m) => m.error === null).length
      console.log(
        `  Wrote ${written}/${plan.modules.length} modules in ${((Date.now() - w0) / 1000).toFixed(1)}s ` +
          `(${result.failed} failed, ${result.usage_rows_written} usage rows)`
      )
      if (result.failed > 0) {
        for (const f of result.modules.filter((m) => m.error).slice(0, 10)) {
          console.log(`    Module ${f.module_number}: ${f.error}`)
        }
      }
      runRecord.written = written
      runRecord.failed = result.failed
      runRecord.report_id = result.report_id
    }

    ;(collected.runs as unknown[]).push(runRecord)
    console.log('')
  }

  if (JSON_OUT) {
    fs.writeFileSync(path.resolve(process.cwd(), JSON_OUT), JSON.stringify(collected, null, 2))
    console.log(`Full report written to ${JSON_OUT}`)
  }

  console.log('='.repeat(72))
  console.log(DRY_RUN ? 'Dry run complete — nothing was written.' : 'Generation complete.')
  console.log('='.repeat(72))
}

main().catch((err) => {
  console.error('Generation failed:', err)
  process.exit(1)
})
