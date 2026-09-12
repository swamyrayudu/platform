// ============================================================
// lib/mock-tests/series-generator.ts — N-Module Series Planner
// ============================================================
// Plans a whole series of modules (e.g. Module 01..100 for one medium)
// in a single in-memory pass over the shared question bank.
//
// WHY PLAN THE WHOLE SERIES AT ONCE
// ---------------------------------
// Generating modules one at a time means each run has to re-read the bank
// and re-derive "what has already been used". Planning the series together
// makes non-repetition a property of the data structure instead of a query:
// each pool is consumed, so Module 2 physically cannot see what Module 1 took
// until the pool wraps around.
//
// SELECTION PRIORITY (requirement order)
//   1. questions never used before          (usage_count = 0)
//   2. then the least-used questions        (lowest usage_count)
//   3. correct section/subject              (enforced by source table)
//   4. topic/chapter spread                 (round-robin across topics)
//   5. difficulty distribution              (blueprint ratios, clamped)
//   6. question type                        (carried through; not restricted)
//   7. correct medium                       (enforced by source table)
//   8. active/valid questions only          (is_active + content completeness)
//
// This is deliberately NOT `ORDER BY RANDOM()` over the whole table.
// Randomisation happens only at the end, to shuffle an already-compliant
// selection into an exam-like order.
// ============================================================

import type {
  ExamBlueprint,
  ExamSectionBlueprint,
  GenerationReport,
  SectionCoverageReport,
} from '@/types/mock-tests'
import {
  resolveSectionTables,
  resolveSectionSubjects,
  getBlueprintTotalQuestions,
} from './blueprints'
import {
  loadPool,
  DIFFICULTY_BUCKETS,
  type DifficultyBucket,
  type ExamMedium,
  type PoolQuestion,
} from './question-bank'

export const GENERATOR_VERSION = 'series-generator/1.0'

// ---- Deterministic RNG -------------------------------------------
// A seedable RNG keeps a generation run reproducible, which makes the
// coverage numbers in the report verifiable rather than anecdotal.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ---- Rotating least-used bucket -----------------------------------

/**
 * Weight applied to "this topic has already been drawn for the current module"
 * when choosing the next topic. Expressed in units of total draws, so for a
 * topic of size N one in-module use costs the same as this many prior draws.
 * Large enough to spread a module across topics, small enough that it never
 * overrides proportional weighting.
 */
const IN_MODULE_TOPIC_PENALTY = 3

/**
 * One (section, difficulty) bucket, internally split by topic.
 *
 * TWO MECHANISMS
 * --------------
 * 1. Per topic, a FIFO queue. Taking a question pops the head and pushes it to
 *    the tail, so a question only comes back around after every other question
 *    in its topic has been handed out. That gives "never-used first, then
 *    least-used" in O(1), with no re-sorting.
 *
 * 2. Across topics, PROPORTIONAL selection: the next topic is the one with the
 *    lowest draws-per-available-question ratio.
 *
 *    Uniform round-robin was wrong here. Topic sizes in this bank are extremely
 *    skewed — `telugu_subject_questions` has 37 topics ranging from 17 to 1,277
 *    questions. Visiting every topic equally drained the small topics ~75x
 *    faster than the large ones, so a handful of questions were reused up to 39
 *    times across 100 modules while thousands sat untouched. Weighting by pool
 *    size keeps every topic represented while drawing from each in proportion
 *    to what it can actually supply.
 *
 * A soft in-module preference also avoids stacking one module with questions
 * from a single topic, without ever making a module unfillable.
 */
class RotatingBucket {
  private readonly topics: string[]
  private readonly queues = new Map<string, PoolQuestion[]>()
  private readonly draws = new Map<string, number>()
  private cursor = 0
  readonly size: number

  constructor(questions: PoolQuestion[], rand: () => number) {
    const byTopic = new Map<string, PoolQuestion[]>()
    for (const q of questions) {
      const list = byTopic.get(q.topic) ?? []
      list.push(q)
      byTopic.set(q.topic, list)
    }

    for (const [topic, list] of byTopic) {
      // Shuffle first so equal-usage questions are not always in table order,
      // then order by existing usage so genuinely unused questions come first.
      shuffleInPlace(list, rand)
      list.sort((a, b) => a.usage_count - b.usage_count)
      this.queues.set(topic, list)
      this.draws.set(topic, 0)
    }

    this.topics = shuffleInPlace([...byTopic.keys()], rand)
    this.size = questions.length
  }

  get topicCount(): number {
    return this.topics.length
  }

  /**
   * Pick the next topic to draw from: the lowest
   *
   *     (total draws + penalty for draws already made for THIS module) / topic size
   *
   * so large topics are visited proportionally more often, and a topic this
   * module has already used is mildly discouraged.
   *
   * The in-module term must be a PENALTY, never a hard filter. An earlier
   * version skipped any topic already used by the current module, and that
   * inverted the whole design: a section draws 24 questions across easy/medium/
   * hard buckets that share topic names, so by the time the last bucket was
   * drawn nearly every sizeable topic was excluded and the only candidates left
   * were the tiny ones. A topic holding a single hard question then won every
   * time and that one question landed in all 100 modules, while questions from
   * a 455-question topic went unused. Scoring keeps both properties without
   * ever making a topic unreachable.
   */
  private pickTopic(topicUsage: Map<string, number> | undefined): string | null {
    const n = this.topics.length
    if (n === 0) return null

    let best: string | null = null
    let bestScore = Number.POSITIVE_INFINITY

    for (let i = 0; i < n; i++) {
      // Rotate the scan start so equal scores do not always resolve to the same
      // topic, which would reintroduce a fixed ordering.
      const topic = this.topics[(this.cursor + i) % n]
      const queue = this.queues.get(topic)
      if (!queue || queue.length === 0) continue

      const usedInModule = topicUsage?.get(topic) ?? 0
      const score =
        ((this.draws.get(topic) ?? 0) + IN_MODULE_TOPIC_PENALTY * usedInModule) / queue.length

      if (score < bestScore) {
        bestScore = score
        best = topic
      }
    }

    this.cursor++
    return best
  }

  /**
   * Take up to `count` questions, skipping any uid already used by the module
   * being assembled.
   *
   * `topicUsage` is shared by all three difficulty buckets of one section for
   * one module, so topic spread is measured across the whole section.
   */
  take(
    count: number,
    excludeUids: Set<string>,
    topicUsage?: Map<string, number>
  ): PoolQuestion[] {
    const picked: PoolQuestion[] = []
    if (count <= 0 || this.topics.length === 0) return picked

    // Bound the work: worst case every question in the bucket is already used
    // by this module.
    const maxVisits = this.size + this.topics.length + count
    let visits = 0

    while (picked.length < count && visits < maxVisits) {
      visits++

      const topic = this.pickTopic(topicUsage)
      if (!topic) break

      const queue = this.queues.get(topic)
      if (!queue || queue.length === 0) continue

      const q = queue.shift() as PoolQuestion
      queue.push(q) // rotate to the back whether or not we use it
      this.draws.set(topic, (this.draws.get(topic) ?? 0) + 1)

      if (excludeUids.has(q.uid)) continue

      q.usage_count++
      excludeUids.add(q.uid)
      if (topicUsage) topicUsage.set(topic, (topicUsage.get(topic) ?? 0) + 1)
      picked.push(q)
    }

    return picked
  }
}

// ---- Difficulty allocation ---------------------------------------

/**
 * How many times, on average, a question may be reused within its own
 * difficulty bucket across the series before that bucket's share of each
 * module is trimmed.
 *
 * WHY THIS EXISTS
 *   The blueprint asks each section for ~25% hard questions, but the labels in
 *   the bank are wildly uneven. `english_subject_questions` holds 4,293 rows of
 *   which only 13 are hard-labelled. Honouring 25% hard literally would draw
 *   6 hard questions per module from a pool of 13 — about 46 uses of each
 *   question over 100 modules — while thousands of medium questions went
 *   untouched. Minimising repetition is the stated priority, so a bucket that
 *   thin gets trimmed and the remainder moves to buckets that can supply
 *   fresh questions. Every trim is reported.
 */
export const DEFAULT_REUSE_BUDGET = 2

/**
 * Per-module cap for one bucket such that the whole series draws at most
 * `reuseBudget x poolSize` questions from it.
 *
 * A bucket that still has questions is never trimmed below 1, so a thin bucket
 * stays represented in the paper rather than disappearing entirely.
 */
export function bucketPerModuleCap(
  poolSize: number,
  moduleCount: number,
  reuseBudget = DEFAULT_REUSE_BUDGET
): number {
  if (poolSize <= 0) return 0
  if (moduleCount <= 1) return poolSize
  return Math.max(1, Math.floor((reuseBudget * poolSize) / moduleCount))
}

/**
 * Turn blueprint percentages into concrete per-bucket counts.
 *
 * Clamped twice:
 *   • by `capacity`  — a question cannot repeat inside a single module
 *   • by `perModuleCap` — the repetition budget above, so a tiny bucket is not
 *     hammered across the series while large buckets sit unused
 *
 * Several tables have no questions at all in some buckets
 * (`math_english_medium` has no Easy, `gk_english_medium` is entirely Easy),
 * so any shortfall is redistributed to buckets that do have room instead of
 * failing the module.
 */
export function allocateDifficultyTargets(
  need: number,
  dist: { easy_pct: number; medium_pct: number; hard_pct: number },
  capacity: Record<DifficultyBucket, number>,
  perModuleCap?: Record<DifficultyBucket, number>
): {
  targets: Record<DifficultyBucket, number>
  shortfall: number
  trimmed: Record<DifficultyBucket, number>
} {
  const easy = Math.round(need * dist.easy_pct)
  const hard = Math.round(need * dist.hard_pct)
  const desired: Record<DifficultyBucket, number> = {
    easy,
    hard,
    medium: Math.max(0, need - easy - hard),
  }

  // Effective ceiling per bucket: in-module capacity AND the reuse budget.
  const ceiling: Record<DifficultyBucket, number> = {
    easy: Math.min(capacity.easy, perModuleCap?.easy ?? capacity.easy),
    medium: Math.min(capacity.medium, perModuleCap?.medium ?? capacity.medium),
    hard: Math.min(capacity.hard, perModuleCap?.hard ?? capacity.hard),
  }

  const targets: Record<DifficultyBucket, number> = { easy: 0, medium: 0, hard: 0 }
  const trimmed: Record<DifficultyBucket, number> = { easy: 0, medium: 0, hard: 0 }
  let remaining = 0

  for (const bucket of DIFFICULTY_BUCKETS) {
    const granted = Math.min(desired[bucket], ceiling[bucket])
    targets[bucket] = granted
    const short = desired[bucket] - granted
    trimmed[bucket] = short
    remaining += short
  }

  // Redistribute the shortfall. First pass respects the reuse budget so we
  // prefer buckets that can still offer fresh questions.
  const fill = (limit: Record<DifficultyBucket, number>) => {
    while (remaining > 0) {
      const spare = DIFFICULTY_BUCKETS.filter((b) => limit[b] - targets[b] > 0).sort(
        (a, b) => limit[b] - targets[b] - (limit[a] - targets[a])
      )
      if (spare.length === 0) return
      let progressed = false
      for (const bucket of spare) {
        if (remaining === 0) break
        targets[bucket]++
        remaining--
        progressed = true
      }
      if (!progressed) return
    }
  }

  fill(ceiling)
  // Only if the budget-respecting ceiling cannot fill the module do we fall
  // back to raw in-module capacity — a module must always have 160 questions.
  fill(capacity)

  return { targets, shortfall: remaining, trimmed }
}

// ---- Section plan -------------------------------------------------

interface SectionPlan {
  section: ExamSectionBlueprint
  buckets: Record<DifficultyBucket, RotatingBucket>
  capacity: Record<DifficultyBucket, number>
  /** Per-module ceiling per bucket, derived from the repetition budget. */
  perModuleCap: Record<DifficultyBucket, number>
  poolSize: number
  topicCount: number
  warnings: string[]
  /** uid -> number of modules that used it (for the report) */
  usageTally: Map<string, number>
  difficultyTally: Record<string, number>
}

// ---- Output shapes -----------------------------------------------

/** One assigned question slot in a generated module. */
export interface PlannedQuestion {
  question_uid: string
  question_id: string
  question_table: string
  question_number: number
  section_id: string
  section_name: string
  marks: number

  // Content carried through so publishing can warm the cache without re-reading
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  explanation: string | null
  difficulty: string
  subject: string | null
  chapter: string | null
  topic: string
  subtopic: string | null
  question_type: string
}

export interface PlannedModule {
  module_number: number
  medium: ExamMedium
  questions: PlannedQuestion[]
  fresh_questions: number
  reused_questions: number
  difficulty_counts: Record<string, number>
  section_topic_spread: Record<string, number>
  warnings: string[]
}

export interface SeriesPlan {
  medium: ExamMedium
  blueprint_id: string
  modules: PlannedModule[]
  report: GenerationReport
}

export interface GenerateSeriesOptions {
  blueprint: ExamBlueprint
  medium: ExamMedium
  /** Inclusive module numbers to plan, e.g. 1..100 */
  moduleFrom: number
  moduleTo: number
  series: string
  /** Pre-existing global usage counts per uid for this medium. */
  existingUsage?: Map<string, number>
  /** Fixed seed keeps a run reproducible. */
  seed?: number
  /**
   * Average times a question may be reused within its difficulty bucket before
   * that bucket's per-module share is trimmed. Lower = less repetition, looser
   * difficulty ratios. Defaults to DEFAULT_REUSE_BUDGET.
   */
  reuseBudget?: number
}

// ---- Generator ----------------------------------------------------

/**
 * Plan every module in the requested range for one medium.
 *
 * Nothing is written here — the caller persists the result. That keeps the
 * selection logic pure and makes a read-only dry run possible.
 */
export async function planModuleSeries(options: GenerateSeriesOptions): Promise<SeriesPlan> {
  const {
    blueprint,
    medium,
    moduleFrom,
    moduleTo,
    series,
    existingUsage,
    seed = 0x5c7,
    reuseBudget = DEFAULT_REUSE_BUDGET,
  } = options

  if (moduleTo < moduleFrom) throw new Error('moduleTo must be >= moduleFrom')
  const moduleCount = moduleTo - moduleFrom + 1
  const rand = mulberry32(seed)
  const globalWarnings: string[] = []

  // ---- 1. Load every section pool once, in parallel -----------------
  // One paged read per source table for the whole series, not per module.
  const sectionPools = await Promise.all(
    blueprint.sections.map(async (section) => {
      const tables = resolveSectionTables(section, medium)
      const subjects = resolveSectionSubjects(section, medium)

      if (tables.length === 0) {
        return { section, pool: [] as PoolQuestion[], tables, subjects }
      }

      let pool = await loadPool(tables, {
        subjectIn: subjects.length > 0 ? subjects : undefined,
        requireActive: true,
      })

      // If a subject whitelist matched nothing, the data does not carry that
      // split — fall back to the unfiltered pool rather than emitting zero.
      if (pool.length === 0 && subjects.length > 0) {
        pool = await loadPool(tables, { requireActive: true })
        globalWarnings.push(
          `Section "${section.name}": subject filter [${subjects.join(', ')}] matched no rows in ${tables.join(', ')}; used the full table pool instead.`
        )
      }

      return { section, pool, tables, subjects }
    })
  )

  // ---- 2. Seed usage counts and build rotating buckets --------------
  const plans: SectionPlan[] = sectionPools.map(({ section, pool, tables }) => {
    const warnings: string[] = []

    if (existingUsage) {
      for (const q of pool) q.usage_count = existingUsage.get(q.uid) ?? 0
    }

    const byBucket: Record<DifficultyBucket, PoolQuestion[]> = { easy: [], medium: [], hard: [] }
    for (const q of pool) byBucket[q.difficulty].push(q)

    const capacity: Record<DifficultyBucket, number> = {
      easy: byBucket.easy.length,
      medium: byBucket.medium.length,
      hard: byBucket.hard.length,
    }

    const buckets: Record<DifficultyBucket, RotatingBucket> = {
      easy: new RotatingBucket(byBucket.easy, rand),
      medium: new RotatingBucket(byBucket.medium, rand),
      hard: new RotatingBucket(byBucket.hard, rand),
    }

    // Cap each bucket's per-module share so a thin bucket is not reused far
    // more often than the section average.
    const perModuleCap: Record<DifficultyBucket, number> = {
      easy: bucketPerModuleCap(capacity.easy, moduleCount, reuseBudget),
      medium: bucketPerModuleCap(capacity.medium, moduleCount, reuseBudget),
      hard: bucketPerModuleCap(capacity.hard, moduleCount, reuseBudget),
    }

    const slots = section.total_questions * moduleCount
    if (pool.length === 0) {
      warnings.push(
        `No eligible questions found for "${section.name}" in ${medium} medium (tables: ${tables.join(', ')}).`
      )
    } else if (pool.length < section.total_questions) {
      warnings.push(
        `Pool for "${section.name}" (${pool.length}) is smaller than one module needs (${section.total_questions}).`
      )
    } else if (pool.length < slots) {
      const reuse = (slots / pool.length).toFixed(2)
      warnings.push(
        `"${section.name}": ${slots} slots across ${moduleCount} modules but only ${pool.length} eligible questions — controlled reuse of about ${reuse}x per question is unavoidable.`
      )
    }

    const dist =
      section.difficulty_distribution ?? { easy_pct: 0.25, medium_pct: 0.5, hard_pct: 0.25 }
    const desiredPerModule: Record<DifficultyBucket, number> = {
      easy: Math.round(section.total_questions * dist.easy_pct),
      hard: Math.round(section.total_questions * dist.hard_pct),
      medium: 0,
    }
    desiredPerModule.medium = Math.max(
      0,
      section.total_questions - desiredPerModule.easy - desiredPerModule.hard
    )

    for (const bucket of DIFFICULTY_BUCKETS) {
      if (capacity[bucket] === 0) {
        warnings.push(
          `"${section.name}": no '${bucket}' questions exist in ${medium} medium — that share is redistributed across the other difficulty levels.`
        )
      } else if (perModuleCap[bucket] < desiredPerModule[bucket]) {
        warnings.push(
          `"${section.name}": only ${capacity[bucket]} '${bucket}' questions exist, so the blueprint's ` +
            `${desiredPerModule[bucket]}/module share was trimmed to ${perModuleCap[bucket]}/module to avoid ` +
            `reusing them across all ${moduleCount} modules. The remainder is drawn from the other difficulty levels.`
        )
      }
    }

    return {
      section,
      buckets,
      capacity,
      perModuleCap,
      poolSize: pool.length,
      topicCount: new Set(pool.map((q) => q.topic)).size,
      warnings,
      usageTally: new Map<string, number>(),
      difficultyTally: { easy: 0, medium: 0, hard: 0 },
    }
  })

  // ---- 3. Plan each module ----------------------------------------
  const modules: PlannedModule[] = []

  for (let moduleNumber = moduleFrom; moduleNumber <= moduleTo; moduleNumber++) {
    // Shared across sections so a question is never assigned twice in one
    // module — required because in Telugu medium 'perspectives' and
    // 'psychology' read the same table.
    const usedInModule = new Set<string>()
    const moduleWarnings: string[] = []
    const questions: PlannedQuestion[] = []
    const difficultyCounts: Record<string, number> = { easy: 0, medium: 0, hard: 0 }
    const sectionTopicSpread: Record<string, number> = {}
    let fresh = 0
    let reused = 0

    for (const plan of plans) {
      const { section } = plan
      const need = section.total_questions
      const dist =
        section.difficulty_distribution ?? { easy_pct: 0.25, medium_pct: 0.5, hard_pct: 0.25 }

      // Clamped by in-module capacity AND the series repetition budget.
      const { targets } = allocateDifficultyTargets(
        need,
        dist,
        plan.capacity,
        plan.perModuleCap
      )

      // Shared across the section's three difficulty buckets so topic spread
      // is measured over the whole section, not per difficulty.
      const topicUsage = new Map<string, number>()

      const selected: PoolQuestion[] = []
      for (const bucket of DIFFICULTY_BUCKETS) {
        const got = plan.buckets[bucket].take(targets[bucket], usedInModule, topicUsage)
        selected.push(...got)
      }

      // Top up from any bucket with room if a target could not be met.
      if (selected.length < need) {
        for (const bucket of DIFFICULTY_BUCKETS) {
          if (selected.length >= need) break
          const got = plan.buckets[bucket].take(need - selected.length, usedInModule, topicUsage)
          selected.push(...got)
        }
      }

      if (selected.length < need) {
        moduleWarnings.push(
          `Module ${moduleNumber}: section "${section.name}" could only be filled with ${selected.length}/${need} questions.`
        )
      }

      // Randomise order ONLY after all distribution rules are satisfied.
      shuffleInPlace(selected, rand)

      sectionTopicSpread[section.id] = new Set(selected.map((q) => q.topic)).size

      for (const q of selected) {
        // take() already incremented usage_count, so a value of 1 means this
        // is the first time the question has ever been assigned to a module
        // of this medium (counting prior series runs seeded from the DB).
        const priorUses = plan.usageTally.get(q.uid) ?? 0
        if (q.usage_count === 1) fresh++
        else reused++
        plan.usageTally.set(q.uid, priorUses + 1)
        plan.difficultyTally[q.difficulty]++
        difficultyCounts[q.difficulty]++

        questions.push({
          question_uid: q.uid,
          question_id: q.question_id,
          question_table: q.question_table,
          question_number: 0, // assigned below, after all sections
          section_id: section.id,
          section_name: section.name,
          marks: blueprint.marks_per_question,
          question: q.question,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          difficulty: q.raw_difficulty ?? q.difficulty,
          subject: q.subject,
          chapter: q.chapter,
          topic: q.topic,
          subtopic: q.subtopic,
          question_type: q.question_type,
        })
      }
    }

    // Sections stay in blueprint order (an exam paper is sectioned);
    // positions are a gapless 1..N sequence.
    questions.forEach((q, i) => {
      q.question_number = i + 1
    })

    modules.push({
      module_number: moduleNumber,
      medium,
      questions,
      fresh_questions: fresh,
      reused_questions: reused,
      difficulty_counts: difficultyCounts,
      section_topic_spread: sectionTopicSpread,
      warnings: moduleWarnings,
    })
  }

  // ---- 4. Build the coverage report -------------------------------
  const perSection: SectionCoverageReport[] = plans.map((plan) => {
    const slots = plan.section.total_questions * moduleCount
    const uniqueUsed = plan.usageTally.size
    const usages = [...plan.usageTally.values()]
    const repeated = usages.reduce((sum, n) => sum + Math.max(0, n - 1), 0)

    return {
      section_id: plan.section.id,
      section_name: plan.section.name,
      questions_per_module: plan.section.total_questions,
      slots,
      eligible_pool: plan.poolSize,
      unique_used: uniqueUsed,
      repeated_assignments: repeated,
      coverage_pct: plan.poolSize > 0 ? Number(((uniqueUsed / plan.poolSize) * 100).toFixed(2)) : 0,
      min_usage: usages.length ? Math.min(...usages) : 0,
      max_usage: usages.length ? Math.max(...usages) : 0,
      difficulty_counts: { ...plan.difficultyTally },
      warnings: plan.warnings,
    }
  })

  const allUsed = new Set<string>()
  let totalSlots = 0
  let repeatedAssignments = 0
  for (const plan of plans) {
    for (const [uid, count] of plan.usageTally) {
      allUsed.add(uid)
      repeatedAssignments += Math.max(0, count - 1)
    }
  }
  for (const m of modules) totalSlots += m.questions.length

  // Distinct questions reachable for this medium (a table shared by two
  // sections must not be double-counted).
  const eligiblePoolSize = (() => {
    // Sections that share a table without a subject split would otherwise be
    // double counted (Telugu 'perspectives' and 'psychology' read one table),
    // so group by table key and take the largest pool seen for that key.
    const perTable = new Map<string, number>()
    plans.forEach((plan) => {
      const key = resolveSectionTables(plan.section, medium).slice().sort().join('|')
      const subjects = resolveSectionSubjects(plan.section, medium)
      const mapKey = subjects.length > 0 ? `${key}#${subjects.join(',')}` : key
      perTable.set(mapKey, Math.max(perTable.get(mapKey) ?? 0, plan.poolSize))
    })
    return [...perTable.values()].reduce((a, b) => a + b, 0)
  })()

  const report: GenerationReport = {
    series,
    medium,
    blueprint_id: blueprint.id,
    modules_generated: moduleCount,
    module_from: moduleFrom,
    module_to: moduleTo,
    total_slots: totalSlots,
    unique_questions_used: allUsed.size,
    repeated_assignments: repeatedAssignments,
    eligible_pool_size: eligiblePoolSize,
    coverage_pct:
      eligiblePoolSize > 0 ? Number(((allUsed.size / eligiblePoolSize) * 100).toFixed(2)) : 0,
    per_section: perSection,
    warnings: [
      ...globalWarnings,
      ...perSection.flatMap((s) => s.warnings),
      ...modules.flatMap((m) => m.warnings),
    ],
  }

  const expected = getBlueprintTotalQuestions(blueprint)
  for (const m of modules) {
    if (m.questions.length !== expected) {
      report.warnings.push(
        `Module ${m.module_number} has ${m.questions.length} questions, blueprint expects ${expected}.`
      )
    }
  }

  return { medium, blueprint_id: blueprint.id, modules, report }
}
