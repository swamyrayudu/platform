// ============================================================
// lib/mock-tests/series-store.ts — Persist a Planned Module Series
// ============================================================
// Writes a SeriesPlan to PostgreSQL, validates each module, warms Redis
// and records the coverage report.
//
// BATCHING
//   A 100-module run is 16,000 question assignments. They are written in
//   chunked batch inserts (one request per ~1,000 rows), and usage counters
//   are merged in memory and upserted in chunks. There is no per-question
//   query anywhere in this path.
//
// FIXED MODULES
//   Once written, a module's 160 question_uids are permanent. Every user who
//   opens Module 01 gets exactly those 160 questions in exactly that order.
//   Regenerating requires an explicit new version.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  ExamBlueprint,
  GenerationReport,
  BlueprintValidationResult,
} from '@/types/mock-tests'
import type { ExamMedium } from './question-bank'
import type { PlannedModule, SeriesPlan } from './series-generator'
import { GENERATOR_VERSION } from './series-generator'
import { validateBlueprint, type QuestionMappingWithMeta } from './validator'
import { warmMockTestCache, invalidateMockTestCache } from './cache'
import { applyUsageIncrements, type UsageIncrement } from './usage'

export const DEFAULT_SERIES = 'grand_mock_v1'

/** Modules 1..FREE_MODULE_LIMIT are playable without a subscription. */
const FREE_MODULE_LIMIT = 3

const MAPPING_INSERT_CHUNK = 1000

// ---- Module identity ----------------------------------------------

export function mediumCode(medium: ExamMedium): 'em' | 'tm' {
  return medium === 'english' ? 'em' : 'tm'
}

export function buildModuleSlug(series: string, medium: ExamMedium, moduleNumber: number): string {
  return `${series.replace(/_/g, '-')}-${mediumCode(medium)}-${String(moduleNumber).padStart(3, '0')}`
}

export function buildModuleTitle(medium: ExamMedium, moduleNumber: number): string {
  const padded = String(moduleNumber).padStart(2, '0')
  return medium === 'telugu'
    ? `గ్రాండ్ మాక్ టెస్ట్ — మాడ్యూల్ ${padded} (తెలుగు మాధ్యమం)`
    : `Grand Mock Test — Module ${padded} (English Medium)`
}

export function buildModuleDescription(
  medium: ExamMedium,
  blueprint: ExamBlueprint
): string {
  return medium === 'telugu'
    ? `పూర్తి స్థాయి AP DSC SGT మాదిరి పరీక్ష — ${blueprint.total_questions} ప్రశ్నలు · ${blueprint.total_marks} మార్కులు · ${blueprint.duration_minutes} నిమిషాలు`
    : `Full-length AP DSC SGT examination — ${blueprint.total_questions} questions · ${blueprint.total_marks} marks · ${blueprint.duration_minutes} minutes`
}

// ---- Validation of a planned module -------------------------------

export function validatePlannedModule(
  blueprint: ExamBlueprint,
  medium: ExamMedium,
  planned: PlannedModule
): BlueprintValidationResult {
  const mappings: QuestionMappingWithMeta[] = planned.questions.map((q) => ({
    question_uid: q.question_uid,
    question_id: q.question_id,
    question_table: q.question_table,
    question_number: q.question_number,
    section_id: q.section_id,
    section_name: q.section_name,
    marks: q.marks,
    difficulty: q.difficulty,
    topic: q.topic,
    subject: q.subject,
    question: q.question,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_answer: q.correct_answer,
    is_active: true,
  }))

  return validateBlueprint(blueprint, mappings, { medium, distributionAsWarning: true })
}

// ---- Persist -------------------------------------------------------

export interface PersistOptions {
  blueprint: ExamBlueprint
  series?: string
  createdBy?: string | null
  /** Publish each module (and warm its cache) after it validates. Default true. */
  publish?: boolean
  /** Replace an existing module at the same (series, medium, module_number). */
  replaceExisting?: boolean
  onProgress?: (message: string) => void
}

export interface PersistedModuleResult {
  module_number: number
  mock_test_id: string | null
  slug: string
  version: number
  questions_written: number
  published: boolean
  cache_warmed: boolean
  validation: BlueprintValidationResult
  error: string | null
}

export interface PersistSeriesResult {
  medium: ExamMedium
  series: string
  modules: PersistedModuleResult[]
  report: GenerationReport
  report_id: string | null
  usage_rows_written: number
  failed: number
}

/**
 * Write a planned series: mock_tests rows, fixed question mappings, usage
 * counters, Redis warm-up and the coverage report.
 */
export async function persistModuleSeries(
  plan: SeriesPlan,
  options: PersistOptions
): Promise<PersistSeriesResult> {
  const {
    blueprint,
    series = DEFAULT_SERIES,
    createdBy = null,
    publish = true,
    replaceExisting = true,
    onProgress,
  } = options

  const medium = plan.medium
  const log = (m: string) => onProgress?.(m)
  const results: PersistedModuleResult[] = []

  // Usage increments accumulated across the whole run, applied once at the end.
  const usageByUid = new Map<string, UsageIncrement>()

  for (const planned of plan.modules) {
    const slug = buildModuleSlug(series, medium, planned.module_number)
    const validation = validatePlannedModule(blueprint, medium, planned)

    // Do NOT publish a module that fails validation.
    if (!validation.valid) {
      results.push({
        module_number: planned.module_number,
        mock_test_id: null,
        slug,
        version: 1,
        questions_written: 0,
        published: false,
        cache_warmed: false,
        validation,
        error: `Validation failed: ${validation.errors.join(' | ')}`,
      })
      log(`Module ${planned.module_number}: SKIPPED — ${validation.errors[0]}`)
      continue
    }

    // ---- Find or create the mock_tests row ----------------------
    const { data: existing } = await supabaseAdmin
      .from('mock_tests')
      .select('id, version, status')
      .eq('series', series)
      .eq('medium', medium)
      .eq('module_number', planned.module_number)
      .maybeSingle()

    let mockTestId: string
    // Replacing a module's questions is a content change, so the version is
    // bumped. Active attempts pin test_version at start, and Redis keys carry
    // the version, so an in-flight attempt keeps the exact paper it began.
    let version = 1

    if (existing) {
      if (!replaceExisting) {
        results.push({
          module_number: planned.module_number,
          mock_test_id: existing.id,
          slug,
          version: existing.version,
          questions_written: 0,
          published: existing.status === 'published',
          cache_warmed: false,
          validation,
          error: 'Module already exists and replaceExisting is false',
        })
        continue
      }

      mockTestId = existing.id
      version = (existing.version ?? 1) + 1

      await invalidateMockTestCache(mockTestId, existing.version ?? 1)
      await supabaseAdmin.from('mock_test_questions').delete().eq('mock_test_id', mockTestId)
    } else {
      const { data: created, error: createErr } = await supabaseAdmin
        .from('mock_tests')
        .insert({
          slug,
          title: buildModuleTitle(medium, planned.module_number),
          description: buildModuleDescription(medium, blueprint),
          category: 'grand_mock',
          medium,
          series,
          module_number: planned.module_number,
          duration_minutes: blueprint.duration_minutes,
          total_questions: blueprint.total_questions,
          total_marks: blueprint.total_marks,
          marks_per_question: blueprint.marks_per_question,
          negative_marks: blueprint.negative_marks,
          blueprint_id: blueprint.id,
          is_free: planned.module_number <= FREE_MODULE_LIMIT,
          created_by: createdBy,
          status: 'draft',
          version: 1,
        })
        .select('id, version')
        .single()

      if (createErr || !created) {
        results.push({
          module_number: planned.module_number,
          mock_test_id: null,
          slug,
          version: 1,
          questions_written: 0,
          published: false,
          cache_warmed: false,
          validation,
          error: `Failed to create module row: ${createErr?.message}`,
        })
        log(`Module ${planned.module_number}: create failed — ${createErr?.message}`)
        continue
      }

      mockTestId = created.id
      version = created.version ?? 1
    }

    // ---- Batch insert the fixed question mapping ---------------
    const rows = planned.questions.map((q) => ({
      mock_test_id: mockTestId,
      question_uid: q.question_uid,
      question_id: q.question_id,
      question_table: q.question_table,
      question_number: q.question_number,
      section_id: q.section_id,
      section_name: q.section_name,
      marks: q.marks,
    }))

    let insertError: string | null = null
    for (let i = 0; i < rows.length; i += MAPPING_INSERT_CHUNK) {
      const { error } = await supabaseAdmin
        .from('mock_test_questions')
        .insert(rows.slice(i, i + MAPPING_INSERT_CHUNK))
      if (error) {
        insertError = error.message
        break
      }
    }

    if (insertError) {
      results.push({
        module_number: planned.module_number,
        mock_test_id: mockTestId,
        slug,
        version,
        questions_written: 0,
        published: false,
        cache_warmed: false,
        validation,
        error: `Failed to store question mappings: ${insertError}`,
      })
      log(`Module ${planned.module_number}: mapping insert failed — ${insertError}`)
      continue
    }

    // ---- Warm cache + publish ----------------------------------
    let cacheWarmed = false
    let published = false

    if (publish) {
      // Cache warming happens at publish time so the first student never pays
      // for the cold DB read.
      cacheWarmed = await warmMockTestCache(
        mockTestId,
        version,
        planned.questions.map((q) => ({
          question_uid: q.question_uid,
          question_id: q.question_id,
          question_table: q.question_table,
          question_number: q.question_number,
          section_id: q.section_id,
          section_name: q.section_name,
          marks: q.marks,
          question: q.question,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          subject: q.subject,
          chapter: q.chapter,
          topic: q.topic,
          subtopic: q.subtopic,
          question_type: q.question_type,
        }))
      )

      const { error: pubErr } = await supabaseAdmin
        .from('mock_tests')
        .update({
          status: 'published',
          version,
          published_at: new Date().toISOString(),
          generated_at: new Date().toISOString(),
          blueprint_snapshot: blueprint,
          generation_meta: {
            generator_version: GENERATOR_VERSION,
            medium,
            fresh_questions: planned.fresh_questions,
            reused_questions: planned.reused_questions,
            difficulty_counts: planned.difficulty_counts,
            section_topic_spread: planned.section_topic_spread,
            warnings: planned.warnings,
          },
        })
        .eq('id', mockTestId)

      published = !pubErr
      if (pubErr) log(`Module ${planned.module_number}: publish update failed — ${pubErr.message}`)
    } else {
      await supabaseAdmin
        .from('mock_tests')
        .update({
          version,
          generated_at: new Date().toISOString(),
          blueprint_snapshot: blueprint,
        })
        .eq('id', mockTestId)
    }

    // ---- Accumulate usage increments ---------------------------
    for (const q of planned.questions) {
      const entry = usageByUid.get(q.question_uid)
      if (entry) {
        entry.increment++
        entry.last_module_number = planned.module_number
        entry.last_mock_test_id = mockTestId
        entry.section_id = q.section_id
      } else {
        usageByUid.set(q.question_uid, {
          question_uid: q.question_uid,
          question_id: q.question_id,
          question_table: q.question_table,
          section_id: q.section_id,
          increment: 1,
          last_module_number: planned.module_number,
          last_mock_test_id: mockTestId,
        })
      }
    }

    results.push({
      module_number: planned.module_number,
      mock_test_id: mockTestId,
      slug,
      version,
      questions_written: rows.length,
      published,
      cache_warmed: cacheWarmed,
      validation,
      error: null,
    })

    if (planned.module_number % 10 === 0) {
      log(`Wrote ${medium} modules up to ${planned.module_number}`)
    }
  }

  // ---- Apply usage counters once for the whole run ---------------
  const usageResult = await applyUsageIncrements(medium, [...usageByUid.values()])
  if (usageResult.error) {
    log(`Usage tracking write failed: ${usageResult.error}`)
    plan.report.warnings.push(`Usage tracking write failed: ${usageResult.error}`)
  }

  // ---- Store the coverage report --------------------------------
  const { data: reportRow, error: reportErr } = await supabaseAdmin
    .from('mock_generation_reports')
    .insert({
      series,
      medium,
      blueprint_id: plan.report.blueprint_id,
      modules_generated: plan.report.modules_generated,
      module_from: plan.report.module_from,
      module_to: plan.report.module_to,
      total_slots: plan.report.total_slots,
      unique_questions_used: plan.report.unique_questions_used,
      repeated_assignments: plan.report.repeated_assignments,
      eligible_pool_size: plan.report.eligible_pool_size,
      coverage_pct: plan.report.coverage_pct,
      per_section: plan.report.per_section,
      warnings: plan.report.warnings.slice(0, 200),
      created_by: createdBy,
    })
    .select('id')
    .single()

  if (reportErr) log(`Could not store generation report: ${reportErr.message}`)

  return {
    medium,
    series,
    modules: results,
    report: plan.report,
    report_id: reportRow?.id ?? null,
    usage_rows_written: usageResult.rows,
    failed: results.filter((r) => r.error !== null).length,
  }
}
