// ============================================================
// lib/questions/tables.ts — The question-bank table allowlist
// ============================================================
// The question bank is spread across one table per subject+medium. Every one
// of them shares the same column set, which is what lets a single admin editor
// work across all of them.
//
// WHY AN ALLOWLIST: a question is addressed as `table:question_id`, and that
// string arrives from the client — in a feedback report, or in an admin edit.
// Feeding it to `supabaseAdmin.from()` unchecked would let a caller name any
// table in the database, including `users` and `sessions`. Nothing may reach
// a query unless it resolves through this map.
// ============================================================

export type QuestionSubjectKey =
  | 'english'
  | 'telugu'
  | 'mathematics'
  | 'science'
  | 'social_studies'
  | 'pedagogy'
  | 'gk'

export type QuestionMedium = 'english' | 'telugu'

export interface QuestionTableConfig {
  table: string
  subjectKey: QuestionSubjectKey | null
  subjectDisplayName: string
  subjectTeluguName: string
  /** null for the unified/legacy tables, which hold more than one medium. */
  medium: QuestionMedium | null
  /**
   * Legacy or unified tables. Practice still reads them as fallbacks, so a
   * report can legitimately point at one — but no mock module maps to them,
   * which is why an edit there never needs a mock cache flush.
   */
  legacy?: boolean
}

export const QUESTION_TABLES: QuestionTableConfig[] = [
  {
    table: 'english_subject_questions',
    subjectKey: 'english',
    subjectDisplayName: 'English',
    subjectTeluguName: 'ఇంగ్లీష్ (భాష II)',
    medium: 'english',
  },
  {
    table: 'telugu_subject_questions',
    subjectKey: 'telugu',
    subjectDisplayName: 'Telugu',
    subjectTeluguName: 'తెలుగు (భాష I)',
    medium: 'telugu',
  },
  {
    table: 'math_english_medium',
    subjectKey: 'mathematics',
    subjectDisplayName: 'Mathematics',
    subjectTeluguName: 'గణితం',
    medium: 'english',
  },
  {
    table: 'telugu_medium_math',
    subjectKey: 'mathematics',
    subjectDisplayName: 'Mathematics',
    subjectTeluguName: 'గణితం',
    medium: 'telugu',
  },
  {
    table: 'english_medium_science',
    subjectKey: 'science',
    subjectDisplayName: 'Science',
    subjectTeluguName: 'సాధారణ సైన్స్',
    medium: 'english',
  },
  {
    table: 'telugu_medium_science',
    subjectKey: 'science',
    subjectDisplayName: 'Science',
    subjectTeluguName: 'సాధారణ సైన్స్',
    medium: 'telugu',
  },
  {
    table: 'socal_english_medium',
    subjectKey: 'social_studies',
    subjectDisplayName: 'Social Studies',
    subjectTeluguName: 'సాంఘిక శాస్త్రం',
    medium: 'english',
  },
  {
    // Spelling preserved from the live schema — renaming is a migration, not
    // a constant edit.
    table: 'socal_telugu_medimum',
    subjectKey: 'social_studies',
    subjectDisplayName: 'Social Studies',
    subjectTeluguName: 'సాంఘిక శాస్త్రం',
    medium: 'telugu',
  },
  {
    table: 'pedagogy_english_medium',
    subjectKey: 'pedagogy',
    subjectDisplayName: 'Educational Psychology + Perspectives',
    subjectTeluguName: 'విద్యా మనోవిజ్ఞాన శాస్త్రం & విద్యా దృక్పథాలు',
    medium: 'english',
  },
  {
    table: 'pedagogy_subject_questions',
    subjectKey: 'pedagogy',
    subjectDisplayName: 'Educational Psychology + Perspectives',
    subjectTeluguName: 'విద్యా మనోవిజ్ఞాన శాస్త్రం & విద్యా దృక్పథాలు',
    medium: 'telugu',
  },
  {
    table: 'gk_english_medium',
    subjectKey: 'gk',
    subjectDisplayName: 'GK & Current Affairs',
    subjectTeluguName: 'సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు',
    medium: 'english',
  },
  {
    table: 'gk_telugu_medium',
    subjectKey: 'gk',
    subjectDisplayName: 'GK & Current Affairs',
    subjectTeluguName: 'సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు',
    medium: 'telugu',
  },

  // ---- Legacy and unified tables --------------------------------
  // Not used by mock generation, but practice providers still fall back to
  // them, so a candidate can report a question that lives here.
  {
    table: 'dsc_practice_questions',
    subjectKey: null,
    subjectDisplayName: 'Practice bank (unified)',
    subjectTeluguName: 'ప్రాక్టీస్ బ్యాంక్',
    medium: null,
    legacy: true,
  },
  {
    table: 'mathematics_subject_questions',
    subjectKey: 'mathematics',
    subjectDisplayName: 'Mathematics (legacy)',
    subjectTeluguName: 'గణితం',
    medium: null,
    legacy: true,
  },
  {
    table: 'social_subject_questions',
    subjectKey: 'social_studies',
    subjectDisplayName: 'Social Studies (legacy)',
    subjectTeluguName: 'సాంఘిక శాస్త్రం',
    medium: null,
    legacy: true,
  },
]

const BY_TABLE = new Map(QUESTION_TABLES.map((t) => [t.table, t]))

/** True only for a table that is part of the question bank. */
export function isQuestionTable(name: string): boolean {
  return BY_TABLE.has(name)
}

export function getQuestionTable(name: string): QuestionTableConfig | null {
  return BY_TABLE.get(name) ?? null
}

/** The editable columns every question table shares. */
export const QUESTION_EDITABLE_COLUMNS = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'explanation',
  'difficulty',
  'subject',
  'chapter',
  'topic',
  'subtopic',
] as const

export type QuestionEditableColumn = (typeof QUESTION_EDITABLE_COLUMNS)[number]

/** Everything the admin editor reads back for one question. */
export const QUESTION_READ_COLUMNS = [
  'question_id',
  ...QUESTION_EDITABLE_COLUMNS,
  'question_type',
  'source_type',
].join(', ')

/**
 * Split a `table:question_id` uid, rejecting anything whose table is not part
 * of the question bank. Returns null rather than throwing so callers can map
 * it straight onto a 400.
 */
export function parseQuestionUid(
  uid: string
): { questionTable: string; questionId: string } | null {
  const idx = uid.indexOf(':')
  if (idx <= 0) return null

  const questionTable = uid.slice(0, idx)
  const questionId = uid.slice(idx + 1)

  if (!questionId || !isQuestionTable(questionTable)) return null
  return { questionTable, questionId }
}

export function buildQuestionUid(questionTable: string, questionId: string): string {
  return `${questionTable}:${questionId}`
}
