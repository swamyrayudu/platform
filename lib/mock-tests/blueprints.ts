// ============================================================
// lib/mock-tests/blueprints.ts — AP DSC SGT Exam Blueprints
// ============================================================
// Defines configurable blueprints for Grand Mock test generation.
// The official AP DSC SGT blueprint is based on the current
// official examination pattern.
//
// IMPORTANT: Blueprints are intentionally configurable because
// official exam patterns can change. Do NOT hard-code section
// counts into business logic — always read from the blueprint.
// ============================================================

import type { ExamBlueprint, ExamSectionBlueprint } from '@/types/mock-tests'

// ---- Official AP DSC SGT Blueprint (2024-2026) ---------------
// Total: 160 Questions | 80 Marks | 150 Minutes
// Marking: +0.5 per correct | 0 for incorrect (no negative)
//
// SECTION BREAKDOWN:
//   Section 1 — GK & Current Affairs       : 16 Q (8 M)
//   Section 2 — Perspectives in Education  :  8 Q (4 M)
//   Section 3 — Classroom Psychology       : 16 Q (8 M)
//   Section 4 — Telugu (Language I)        : 24 Q (12 M) [20 Content + 4 Methodology]
//   Section 5 — English (Language II)      : 24 Q (12 M) [20 Content + 4 Methodology]
//   Section 6 — Mathematics                : 24 Q (12 M) [20 Content + 4 Methodology]
//   Section 7 — Science                    : 24 Q (12 M) [20 Content + 4 Methodology]
//   Section 8 — Social Studies             : 24 Q (12 M) [20 Content + 4 Methodology]
//
// Total: 16 + 8 + 16 + 24 + 24 + 24 + 24 + 24 = 160 ✓
// Marks: 8 + 4 + 8 + 12 + 12 + 12 + 12 + 12 = 80 ✓

const OFFICIAL_SECTIONS: ExamSectionBlueprint[] = [
  {
    id: 'gk',
    name: 'General Knowledge & Current Affairs',
    total_questions: 16,
    total_marks: 8,
    question_tables: ['gk_english_medium', 'gk_telugu_medium', 'dsc_practice_questions'],
    subject_filter: 'GK & Current Affairs',
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper', 'SCERT Syllabus', 'Current Affairs'],
  },
  {
    id: 'perspectives',
    name: 'Perspectives in Education',
    total_questions: 8,
    total_marks: 4,
    question_tables: ['pedagogy_subject_questions', 'pedagogy_english_medium', 'dsc_practice_questions'],
    subject_filter: 'Pedagogy',
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper', 'NEP 2020', 'SCERT Syllabus'],
  },
  {
    id: 'psychology',
    name: 'Classroom Psychology',
    total_questions: 16,
    total_marks: 8,
    question_tables: ['pedagogy_subject_questions', 'pedagogy_english_medium', 'dsc_practice_questions'],
    subject_filter: 'Pedagogy',
    difficulty_distribution: { easy_pct: 0.30, medium_pct: 0.50, hard_pct: 0.20 },
    source_type_preference: ['Previous DSC Paper', 'SCERT Syllabus'],
  },
  {
    id: 'telugu',
    name: 'Telugu (Language I)',
    total_questions: 24,
    total_marks: 12,
    question_tables: ['telugu_subject_questions', 'dsc_practice_questions'],
    subject_filter: 'Telugu',
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper', 'SCERT Syllabus', 'Telugu Literature'],
  },
  {
    id: 'english',
    name: 'English (Language II)',
    total_questions: 24,
    total_marks: 12,
    question_tables: ['english_subject_questions', 'dsc_practice_questions'],
    subject_filter: 'English',
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper', 'SCERT Syllabus'],
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    total_questions: 24,
    total_marks: 12,
    question_tables: ['telugu_medium_math', 'math_english_medium', 'dsc_practice_questions'],
    subject_filter: 'Mathematics',
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper', 'SCERT Syllabus'],
  },
  {
    id: 'science',
    name: 'Science',
    total_questions: 24,
    total_marks: 12,
    question_tables: ['telugu_medium_science', 'english_medium_science', 'dsc_practice_questions'],
    subject_filter: 'Science',
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper', 'SCERT Syllabus'],
  },
  {
    id: 'social',
    name: 'Social Studies',
    total_questions: 24,
    total_marks: 12,
    question_tables: ['socal_telugu_medimum', 'socal_english_medium', 'dsc_practice_questions'],
    subject_filter: 'Social Studies',
    content_questions: 20,
    methodology_questions: 4,
    difficulty_distribution: { easy_pct: 0.25, medium_pct: 0.50, hard_pct: 0.25 },
    source_type_preference: ['Previous DSC Paper', 'SCERT Syllabus'],
  },
]

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
  sections: OFFICIAL_SECTIONS,
}

// ---- High-Yield Focused Blueprint --------------------------------
// Same structure, skewed toward Medium/Hard questions

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
  sections: OFFICIAL_SECTIONS.map((s) => ({
    ...s,
    difficulty_distribution: { easy_pct: 0.15, medium_pct: 0.55, hard_pct: 0.30 },
    source_type_preference: ['Previous DSC Paper', ...(s.source_type_preference || [])],
  })),
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
  sections: OFFICIAL_SECTIONS.map((s) => ({
    ...s,
    difficulty_distribution: { easy_pct: 0.40, medium_pct: 0.45, hard_pct: 0.15 },
  })),
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

/** Total expected questions from blueprint sections */
export function getBlueprintTotalQuestions(blueprint: ExamBlueprint): number {
  return blueprint.sections.reduce((sum, s) => sum + s.total_questions, 0)
}

/** Map section_id → section blueprint for O(1) lookup */
export function buildSectionMap(blueprint: ExamBlueprint): Map<string, ExamSectionBlueprint> {
  const map = new Map<string, ExamSectionBlueprint>()
  blueprint.sections.forEach((s) => map.set(s.id, s))
  return map
}
