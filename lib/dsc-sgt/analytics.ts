// ============================================================
// lib/dsc-sgt/analytics.ts — Overview & Performance analytics
// ============================================================
// Both the Overview and Performance pages were built on hard-coded arrays.
// This module derives the same shapes from real user data:
//
//   mock_test_attempts   submitted mock scores, section breakdown, rank
//   question_attempts    per-question practice history (subject, correctness)
//   practice_sessions    session counts and activity dates (study streak)
//   user_mock_test_progress  module completion
//
// Everything is scoped to one user, and every query is bounded — no unbounded
// scans, no per-row round trips.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getBlueprintById, AP_DSC_SGT_OFFICIAL_BLUEPRINT } from '@/lib/mock-tests/blueprints'

const PAGE_SIZE = 1000
/** Practice history is capped so analytics stays bounded for heavy users. */
const MAX_ATTEMPTS_SCANNED = 5000

// ---- Shared shapes -------------------------------------------------

export type ProficiencyStatus =
  | 'Strong'
  | 'Good'
  | 'Moderate'
  | 'Needs Practice'
  | 'Weak Area'
  | 'Not Started'

export interface SubjectProficiency {
  subject: string
  accuracy_pct: number
  attempted: number
  correct: number
  status: ProficiencyStatus
}

export interface RecentAttempt {
  attempt_id: string
  mock_test_id: string
  title: string
  module_number: number | null
  submitted_at: string | null
  score: number
  total_marks: number
  accuracy_pct: number
  correct_count: number
  total_questions: number
  rank: number | null
  percentile: number | null
}

export interface PerformanceSummary {
  has_data: boolean
  overall_accuracy_pct: number
  /** Change vs the preceding period of equal length. null when there is no history. */
  accuracy_delta_pct: number | null
  mocks_completed: number
  avg_mock_score: number
  mock_total_marks: number
  best_rank: number | null
  best_percentile: number | null
  questions_attempted: number
  subjects_covered: number
  subject_breakdown: SubjectProficiency[]
  recent_attempts: RecentAttempt[]
  weak_areas: SubjectProficiency[]
}

export interface OverviewSummary {
  study_streak_days: number
  questions_solved: number
  avg_accuracy_pct: number
  practice_sessions: number
  modules_completed: number
  modules_in_progress: number
  modules_total: number
  last_active_at: string | null
}

// ---- Helpers -------------------------------------------------------

/** Bucket an accuracy into the label the UI shows. */
export function proficiencyStatus(accuracyPct: number, attempted: number): ProficiencyStatus {
  if (attempted === 0) return 'Not Started'
  if (accuracyPct >= 85) return 'Strong'
  if (accuracyPct >= 75) return 'Good'
  if (accuracyPct >= 65) return 'Moderate'
  if (accuracyPct >= 55) return 'Needs Practice'
  return 'Weak Area'
}

function pct(correct: number, total: number): number {
  if (total <= 0) return 0
  return Number(((correct / total) * 100).toFixed(1))
}

/**
 * Practice tables and mock section names label the same subject differently
 * ('Educational Psychology' vs 'Classroom Psychology', 'సైన్స్' vs 'Science').
 * Collapse them so one subject does not appear as several rows.
 */
function canonicalSubject(raw: string | null | undefined): string {
  const v = (raw ?? '').trim()
  if (!v) return 'General'
  const k = v.toLowerCase()

  if (k.includes('psycholog') || k.includes('pedagog') || k.includes('సైకాలజీ')) {
    return 'Educational Psychology & Pedagogy'
  }
  if (k.includes('perspective') || k.includes('దృక్పథ')) return 'Perspectives in Education'
  if (k.includes('general knowledge') || k === 'gk' || k.includes('current affairs') || k.includes('సాధారణ జ్ఞానం')) {
    return 'GK & Current Affairs'
  }
  if (k.includes('telugu') || k.includes('తెలుగు') || k.includes('భాషాంశ')) return 'Telugu (Language I)'
  if (k.includes('english')) return 'English (Language II)'
  if (k.includes('math') || k.includes('గణిత')) return 'Mathematics'
  if (k.includes('social') || k.includes('సాంఘిక')) return 'Social Studies'
  if (
    k.includes('science') || k.includes('సైన్స') || k.includes('physic') ||
    k.includes('chem') || k.includes('bio') || k.includes('astronom') || k.includes('environment')
  ) {
    return 'Science'
  }
  return v
}

interface Tally {
  attempted: number
  correct: number
}

function addTally(map: Map<string, Tally>, subject: string, attempted: number, correct: number) {
  const key = canonicalSubject(subject)
  const t = map.get(key) ?? { attempted: 0, correct: 0 }
  t.attempted += attempted
  t.correct += correct
  map.set(key, t)
}

// ---- Data loading --------------------------------------------------

interface AttemptRow {
  subject: string | null
  is_correct: boolean | null
  attempted_at: string | null
}

/** Page through a user's practice attempts, newest first, up to the cap. */
async function loadPracticeAttempts(userId: string): Promise<AttemptRow[]> {
  const out: AttemptRow[] = []
  let from = 0

  while (out.length < MAX_ATTEMPTS_SCANNED) {
    const { data, error } = await supabaseAdmin
      .from('question_attempts')
      .select('subject, is_correct, attempted_at')
      .eq('user_id', userId)
      .order('attempted_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.warn('[Analytics] question_attempts read failed:', error.message)
      break
    }
    if (!data || data.length === 0) break
    out.push(...(data as AttemptRow[]))
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return out
}

interface MockAttemptRow {
  id: string
  mock_test_id: string
  score: number
  total_marks: number
  percentage: number
  correct_count: number
  total_questions: number
  rank: number | null
  percentile: number | null
  submitted_at: string | null
  section_scores: Record<string, { section_name?: string; total?: number; correct?: number }> | null
  mock_tests?: { title?: string; module_number?: number | null } | null
}

async function loadMockAttempts(userId: string, limit = 100): Promise<MockAttemptRow[]> {
  const { data, error } = await supabaseAdmin
    .from('mock_test_attempts')
    .select(
      'id, mock_test_id, score, total_marks, percentage, correct_count, total_questions, ' +
        'rank, percentile, submitted_at, section_scores, mock_tests(title, module_number)'
    )
    .eq('user_id', userId)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[Analytics] mock_test_attempts read failed:', error.message)
    return []
  }
  return (data ?? []) as unknown as MockAttemptRow[]
}

// ---- Performance ---------------------------------------------------

export async function getPerformanceSummary(userId: string): Promise<PerformanceSummary> {
  const [practice, mocks] = await Promise.all([
    loadPracticeAttempts(userId),
    loadMockAttempts(userId),
  ])

  // --- Subject proficiency: practice attempts + mock section scores ---
  const bySubject = new Map<string, Tally>()

  for (const a of practice) {
    addTally(bySubject, a.subject ?? 'General', 1, a.is_correct ? 1 : 0)
  }

  for (const m of mocks) {
    const sections = m.section_scores ?? {}
    for (const s of Object.values(sections)) {
      if (!s || typeof s.total !== 'number') continue
      addTally(bySubject, s.section_name ?? '', s.total, s.correct ?? 0)
    }
  }

  const subjectBreakdown: SubjectProficiency[] = [...bySubject.entries()]
    .map(([subject, t]) => {
      const accuracy = pct(t.correct, t.attempted)
      return {
        subject,
        accuracy_pct: accuracy,
        attempted: t.attempted,
        correct: t.correct,
        status: proficiencyStatus(accuracy, t.attempted),
      }
    })
    .sort((a, b) => b.accuracy_pct - a.accuracy_pct)

  // --- Overall accuracy, and the trend vs the preceding period ---
  const totalAttempted = [...bySubject.values()].reduce((n, t) => n + t.attempted, 0)
  const totalCorrect = [...bySubject.values()].reduce((n, t) => n + t.correct, 0)
  const overallAccuracy = pct(totalCorrect, totalAttempted)

  // Practice rows are newest-first; compare the most recent half against the
  // half before it. Needs a meaningful sample or the number is just noise.
  let accuracyDelta: number | null = null
  if (practice.length >= 20) {
    const half = Math.floor(practice.length / 2)
    const recent = practice.slice(0, half)
    const older = practice.slice(half)
    const recentPct = pct(recent.filter((a) => a.is_correct).length, recent.length)
    const olderPct = pct(older.filter((a) => a.is_correct).length, older.length)
    accuracyDelta = Number((recentPct - olderPct).toFixed(1))
  }

  // --- Mock aggregates ---
  const avgMockScore =
    mocks.length > 0
      ? Number((mocks.reduce((n, m) => n + Number(m.score ?? 0), 0) / mocks.length).toFixed(1))
      : 0
  const mockTotalMarks = mocks[0]?.total_marks
    ? Number(mocks[0].total_marks)
    : AP_DSC_SGT_OFFICIAL_BLUEPRINT.total_marks

  const ranked = mocks.filter((m) => typeof m.rank === 'number')
  const bestRank = ranked.length ? Math.min(...ranked.map((m) => m.rank as number)) : null
  const bestPercentile = mocks.reduce<number | null>((best, m) => {
    if (typeof m.percentile !== 'number') return best
    return best === null || m.percentile > best ? m.percentile : best
  }, null)

  const recentAttempts: RecentAttempt[] = mocks.slice(0, 5).map((m) => ({
    attempt_id: m.id,
    mock_test_id: m.mock_test_id,
    title: m.mock_tests?.title ?? 'Mock Test',
    module_number: m.mock_tests?.module_number ?? null,
    submitted_at: m.submitted_at,
    score: Number(m.score ?? 0),
    total_marks: Number(m.total_marks ?? mockTotalMarks),
    accuracy_pct: pct(m.correct_count ?? 0, m.total_questions ?? 0),
    correct_count: m.correct_count ?? 0,
    total_questions: m.total_questions ?? 0,
    rank: m.rank,
    percentile: m.percentile,
  }))

  // Weak areas need enough attempts to be a real signal, not one bad question.
  const weakAreas = subjectBreakdown
    .filter((s) => s.attempted >= 5 && s.accuracy_pct < 65)
    .sort((a, b) => a.accuracy_pct - b.accuracy_pct)
    .slice(0, 3)

  return {
    has_data: totalAttempted > 0 || mocks.length > 0,
    overall_accuracy_pct: overallAccuracy,
    accuracy_delta_pct: accuracyDelta,
    mocks_completed: mocks.length,
    avg_mock_score: avgMockScore,
    mock_total_marks: mockTotalMarks,
    best_rank: bestRank,
    best_percentile: bestPercentile,
    questions_attempted: totalAttempted,
    subjects_covered: subjectBreakdown.filter((s) => s.attempted > 0).length,
    subject_breakdown: subjectBreakdown,
    recent_attempts: recentAttempts,
    weak_areas: weakAreas,
  }
}

// ---- Overview ------------------------------------------------------

/**
 * Consecutive days ending today (or yesterday) on which the user did something.
 * Dates are compared in UTC; a streak is broken by a full missed day.
 */
export function computeStreak(activityDates: string[]): number {
  const days = new Set(activityDates.filter(Boolean).map((d) => d.slice(0, 10)))
  if (days.size === 0) return 0

  const dayMs = 86_400_000
  const todayKey = new Date().toISOString().slice(0, 10)
  const yesterdayKey = new Date(Date.now() - dayMs).toISOString().slice(0, 10)

  // Allow the streak to be "alive" if they were active yesterday but not yet today.
  let cursor: Date
  if (days.has(todayKey)) cursor = new Date(`${todayKey}T00:00:00.000Z`)
  else if (days.has(yesterdayKey)) cursor = new Date(`${yesterdayKey}T00:00:00.000Z`)
  else return 0

  let streak = 0
  for (;;) {
    const key = cursor.toISOString().slice(0, 10)
    if (!days.has(key)) break
    streak++
    cursor = new Date(cursor.getTime() - dayMs)
  }
  return streak
}

export async function getOverviewSummary(userId: string): Promise<OverviewSummary> {
  const [practice, mocks, sessions, progress, moduleCount] = await Promise.all([
    loadPracticeAttempts(userId),
    loadMockAttempts(userId),
    supabaseAdmin
      .from('practice_sessions')
      .select('started_at, completed_at')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(500),
    supabaseAdmin
      .from('user_mock_test_progress')
      .select('status')
      .eq('user_id', userId),
    supabaseAdmin
      .from('mock_tests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .not('module_number', 'is', null),
  ])

  const practiceCorrect = practice.filter((a) => a.is_correct).length
  const mockCorrect = mocks.reduce((n, m) => n + (m.correct_count ?? 0), 0)
  const mockAnswered = mocks.reduce((n, m) => n + (m.total_questions ?? 0), 0)

  const solved = practice.length + mockAnswered
  const correct = practiceCorrect + mockCorrect

  const activityDates = [
    ...practice.map((a) => a.attempted_at ?? ''),
    ...mocks.map((m) => m.submitted_at ?? ''),
    ...((sessions.data ?? []) as { started_at: string | null }[]).map((s) => s.started_at ?? ''),
  ].filter(Boolean)

  const progressRows = (progress.data ?? []) as { status: string }[]

  return {
    study_streak_days: computeStreak(activityDates),
    questions_solved: solved,
    avg_accuracy_pct: pct(correct, solved),
    practice_sessions: (sessions.data ?? []).length,
    modules_completed: progressRows.filter((p) => p.status === 'completed').length,
    modules_in_progress: progressRows.filter((p) => p.status === 'in_progress').length,
    modules_total: moduleCount.count ?? 0,
    last_active_at: activityDates.sort().reverse()[0] ?? null,
  }
}

// ---- Blueprint-derived syllabus ------------------------------------

export interface SyllabusSection {
  id: string
  name: string
  questions: number
  marks: number
}

/**
 * The exam structure shown on the Overview page, read from the blueprint.
 *
 * It was previously a hard-coded array that had drifted out of step with the
 * real exam: it advertised "20 Qs / 10 Marks" per section and a 150-mark paper,
 * while the blueprint the modules are actually generated from is 160 questions
 * and 80 marks. Deriving it here means the page cannot drift again.
 */
export function getSyllabusSections(blueprintId?: string): {
  sections: SyllabusSection[]
  total_questions: number
  total_marks: number
  duration_minutes: number
} {
  const blueprint = (blueprintId && getBlueprintById(blueprintId)) || AP_DSC_SGT_OFFICIAL_BLUEPRINT

  return {
    sections: blueprint.sections.map((s) => ({
      id: s.id,
      name: s.name,
      questions: s.total_questions,
      marks: s.total_marks,
    })),
    total_questions: blueprint.total_questions,
    total_marks: blueprint.total_marks,
    duration_minutes: blueprint.duration_minutes,
  }
}
