// ============================================================
// lib/mock-tests/blueprints.ts — AP DSC SGT Exam Blueprints
// ============================================================
// Defines configurable blueprints for mock module generation.
//
// IMPORTANT: Blueprints are intentionally configurable data because
// official exam patterns change. Section counts, difficulty ratios and
// source tables are NEVER hard-coded into business logic or into React
// components — everything reads from the blueprint.
//
// MEDIUM SEPARATION
// -----------------
// Each section declares its source tables PER MEDIUM. This is the single
// authority on English/Telugu separation: an English module can only ever
// draw from English-medium tables, a Telugu module only from Telugu-medium
// tables. The two language papers (Telugu Language I, English Language II)
// are intentionally shared, because those papers are written in their own
// language regardless of the candidate's medium.
//
// Why not filter by a `subject` column? Because the live data makes that
// unreliable — `pedagogy_subject_questions.subject` is 'Educational
// Psychology' (not 'Pedagogy'), `telugu_medium_science.subject` is 'సైన్స్',
// and `english_medium_science.subject` is split across Physics / Biology /
// Chemistry / Astronomy / ... . The previous `ilike '%Science%'` style
// filter matched nothing in several tables. The table itself already
// encodes subject + medium, so the table is the filter.
// ============================================================

import type { ExamBlueprint, ExamSectionBlueprint } from '@/types/mock-tests'
import type { ExamMedium } from './question-bank'

// ---- Official AP DSC SGT Blueprint ---------------------------
// Total: 160 Questions | 80 Marks | 150 Minutes
// Marking: +0.5 per correct | 0 for incorrect (no negative)
//
// SECTION BREAKDOWN:
//   Section 1 — GK & Current Affairs       : 16 Q (8 M)
//   Section 2 — Perspectives in Education  :  8 Q (4 M)
//   Section 3 — Classroom Psychology       : 16 Q (8 M)
//   Section 4 — Telugu (Language I)        : 24 Q (12 M)
//   Section 5 — English (Language II)      : 24 Q (12 M)
//   Section 6 — Mathematics                : 24 Q (12 M)
//   Section 7 — Science                    : 24 Q (12 M)
//   Section 8 — Social Studies             : 24 Q (12 M)
//
// Total: 16 + 8 + 16 + 24 + 24 + 24 + 24 + 24 = 160
// Marks:  8 + 4 +  8 + 12 + 12 + 12 + 12 + 12 = 80

const OFFICIAL_SECTIONS: ExamSectionBlueprint[] = [
  {
    id: 'gk',
    name: 'General Knowledge & Current Affairs',
    total_questions: 16,
    total_marks: 8,
    tables: {
      english: ['gk_english_medium'],
      telugu: ['gk_telugu_medium'],
    },
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper', 'OFFICIAL_CURRENT_AFFAIRS', 'STATIC_GK'],
  },
  {
    id: 'perspectives',
    name: 'Perspectives in Education',
    total_questions: 8,
    total_marks: 4,
    tables: {
      english: ['pedagogy_english_medium'],
      telugu: ['pedagogy_subject_questions'],
    },
    // The English pedagogy table separates the two papers by subject;
    // the Telugu table does not, so it falls back to the whole pool.
    subject_in_by_medium: {
      english: ['Perspectives in Education'],
      telugu: [],
    },
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper', 'NEP 2020'],
  },
  {
    id: 'psychology',
    name: 'Classroom Psychology',
    total_questions: 16,
    total_marks: 8,
    tables: {
      english: ['pedagogy_english_medium'],
      telugu: ['pedagogy_subject_questions'],
    },
    subject_in_by_medium: {
      english: ['Educational Psychology'],
      telugu: [],
    },
    difficulty_distribution: { easy_pct: 0.30, medium_pct: 0.50, hard_pct: 0.20 },
    source_type_preference: ['Previous DSC Paper'],
  },
  {
    id: 'telugu',
    name: 'Telugu (Language I)',
    total_questions: 24,
    total_marks: 12,
    // Language I is a Telugu paper in BOTH mediums.
    tables: {
      english: ['telugu_subject_questions'],
      telugu: ['telugu_subject_questions'],
    },
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper'],
  },
  {
    id: 'english',
    name: 'English (Language II)',
    total_questions: 24,
    total_marks: 12,
    // Language II is an English paper in BOTH mediums.
    tables: {
      english: ['english_subject_questions'],
      telugu: ['english_subject_questions'],
    },
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper'],
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    total_questions: 24,
    total_marks: 12,
    tables: {
      english: ['math_english_medium'],
      telugu: ['telugu_medium_math'],
    },
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper'],
  },
  {
    id: 'science',
    name: 'Science',
    total_questions: 24,
    total_marks: 12,
    tables: {
      english: ['english_medium_science'],
      telugu: ['telugu_medium_science'],
    },
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper'],
  },
  {
    id: 'social',
    name: 'Social Studies',
    total_questions: 24,
    total_marks: 12,
    tables: {
      english: ['socal_english_medium'],
      telugu: ['socal_telugu_medimum'],
    },
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper'],
  },
]

/** Legacy `question_tables` (union across mediums) kept for backward compatibility. */
function withLegacyTables(sections: ExamSectionBlueprint[]): ExamSectionBlueprint[] {
  return sections.map((s) => ({
    ...s,
    question_tables: Array.from(new Set([...s.tables.english, ...s.tables.telugu])),
  }))
}

export const AP_DSC_SGT_OFFICIAL_BLUEPRINT: ExamBlueprint = {
  id: 'ap_dsc_sgt_official',
  name: 'AP DSC SGT Official Blueprint',
  description: 'Official AP DSC SGT examination pattern — 160 Questions / 80 Marks / 150 Minutes',
  total_questions: 160,
  duration_minutes: 150,
  total_marks: 80,
  marks_per_question: 0.5,
  negative_marks: 0,
  medium: 'bilingual',
  sections: withLegacyTables(OFFICIAL_SECTIONS),
}

// ---- High-Yield Focused Blueprint --------------------------------
// Same structure, skewed toward Medium/Hard questions.

export const HIGH_YIELD_BLUEPRINT: ExamBlueprint = {
  id: 'ap_dsc_sgt_high_yield',
  name: 'High-Yield Expected Questions Blueprint',
  description: 'More expected / high-difficulty questions — 160 Questions / 80 Marks / 150 Minutes',
  total_questions: 160,
  duration_minutes: 150,
  total_marks: 80,
  marks_per_question: 0.5,
  negative_marks: 0,
  medium: 'bilingual',
  sections: withLegacyTables(
    OFFICIAL_SECTIONS.map((s) => ({
      ...s,
      difficulty_distribution: { easy_pct: 0.15, medium_pct: 0.55, hard_pct: 0.30 },
    }))
  ),
}

// ---- Practice/Revision Focused Blueprint -------------------------

export const PRACTICE_BLUEPRINT: ExamBlueprint = {
  id: 'ap_dsc_sgt_practice',
  name: 'Practice & Revision Blueprint',
  description: 'Revision-focused with easier questions — 160 Questions / 80 Marks / 150 Minutes',
  total_questions: 160,
  duration_minutes: 150,
  total_marks: 80,
  marks_per_question: 0.5,
  negative_marks: 0,
  medium: 'bilingual',
  sections: withLegacyTables(
    OFFICIAL_SECTIONS.map((s) => ({
      ...s,
      difficulty_distribution: { easy_pct: 0.40, medium_pct: 0.45, hard_pct: 0.15 },
    }))
  ),
}

// ---- Blueprint Registry ------------------------------------------

const BLUEPRINT_REGISTRY: Record<string, ExamBlueprint> = {
  [AP_DSC_SGT_OFFICIAL_BLUEPRINT.id]: AP_DSC_SGT_OFFICIAL_BLUEPRINT,
  [HIGH_YIELD_BLUEPRINT.id]: HIGH_YIELD_BLUEPRINT,
  [PRACTICE_BLUEPRINT.id]: PRACTICE_BLUEPRINT,
}

export function getBlueprintById(id: string): ExamBlueprint | null {
  return BLUEPRINT_REGISTRY[id] || null
}

export function getAllBlueprints(): ExamBlueprint[] {
  return Object.values(BLUEPRINT_REGISTRY)
}

/** Total expected questions from blueprint sections. */
export function getBlueprintTotalQuestions(blueprint: ExamBlueprint): number {
  return blueprint.sections.reduce((sum, s) => sum + s.total_questions, 0)
}

/** Map section_id -> section blueprint for O(1) lookup. */
export function buildSectionMap(blueprint: ExamBlueprint): Map<string, ExamSectionBlueprint> {
  const map = new Map<string, ExamSectionBlueprint>()
  blueprint.sections.forEach((s) => map.set(s.id, s))
  return map
}

// ---- Medium resolution -------------------------------------------

/** Source tables a section must use for the given medium. */
export function resolveSectionTables(
  section: ExamSectionBlueprint,
  medium: ExamMedium
): string[] {
  const tables = section.tables?.[medium]
  if (tables && tables.length > 0) return tables
  // Fall back to the legacy union only if a blueprint predates `tables`.
  return section.question_tables ?? []
}

/** Optional subject whitelist a section applies for the given medium. */
export function resolveSectionSubjects(
  section: ExamSectionBlueprint,
  medium: ExamMedium
): string[] {
  return section.subject_in_by_medium?.[medium] ?? []
}

/**
 * Sections that share a source pool for a medium. Used by the generator to
 * guarantee a question is never assigned twice within one module: in Telugu
 * medium, 'perspectives' and 'psychology' both read
 * `pedagogy_subject_questions`.
 */
export function groupSectionsBySharedPool(
  blueprint: ExamBlueprint,
  medium: ExamMedium
): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const section of blueprint.sections) {
    const key = resolveSectionTables(section, medium).slice().sort().join('|')
    const list = groups.get(key) ?? []
    list.push(section.id)
    groups.set(key, list)
  }
  return groups
}
