// ============================================================
// lib/my-tests/format.ts — User-made tests: format, checks, prompt
// ============================================================
// Shared by the browser (checking an uploaded file before saving) and the
// server (checking again before storing — the browser is never trusted).
//
// Users prepare questions with an AI chat tool from the prompt built here,
// then upload the Excel or CSV file it produces. Chat tools are loose about
// headers and answer keys ("Option A", "Answer", "(B)"), so reading is
// forgiving; what gets stored is strict.
// ============================================================

import { parseCsv, type CsvRow } from '@/lib/questions/csv'

export type AnswerLetter = 'A' | 'B' | 'C' | 'D'

export interface MyTestQuestion {
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: AnswerLetter
  explanation: string
  topic: string
  difficulty: string
}

export type MyTestMedium = 'english' | 'telugu'

export const MY_TEST_LIMITS = {
  maxQuestions: 160,
  /** Saved tests per user. Storage is cheap but not free, so there is a ceiling. */
  maxTestsFree: 2,
  maxTestsPro: 20,
  maxQuestionChars: 1500,
  maxOptionChars: 500,
  maxExplanationChars: 2000,
  maxShortChars: 120,
  maxDurationMinutes: 300,
} as const

export const MY_TEST_QUESTION_COUNTS = [50, 100, 160] as const

/** The real DSC paper: 160 questions in 150 minutes. Shorter tests scale from it. */
export function defaultDurationMinutes(questionCount: number): number {
  return Math.max(5, Math.round((questionCount * 150) / 160))
}

/** The columns the prompt asks for, in order. */
export const MY_TEST_COLUMNS = [
  'question', 'option_a', 'option_b', 'option_c', 'option_d',
  'correct_answer', 'explanation', 'topic', 'difficulty',
] as const

type Column = (typeof MY_TEST_COLUMNS)[number]

/** Header spellings chat tools produce, after normalising (lowercase, `_` for gaps). */
const HEADER_ALIASES: Record<string, Column> = {
  question: 'question', questions: 'question', question_text: 'question', q: 'question', ప్రశ్న: 'question',
  option_a: 'option_a', a: 'option_a', option_1: 'option_a', optiona: 'option_a', choice_a: 'option_a',
  option_b: 'option_b', b: 'option_b', option_2: 'option_b', optionb: 'option_b', choice_b: 'option_b',
  option_c: 'option_c', c: 'option_c', option_3: 'option_c', optionc: 'option_c', choice_c: 'option_c',
  option_d: 'option_d', d: 'option_d', option_4: 'option_d', optiond: 'option_d', choice_d: 'option_d',
  correct_answer: 'correct_answer', answer: 'correct_answer', correct: 'correct_answer',
  correct_option: 'correct_answer', ans: 'correct_answer', key: 'correct_answer', answer_key: 'correct_answer',
  explanation: 'explanation', explanations: 'explanation', reason: 'explanation', solution: 'explanation',
  topic: 'topic', topics: 'topic', chapter: 'topic',
  difficulty: 'difficulty', level: 'difficulty', difficulty_level: 'difficulty',
}

export function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s\-.()]+/g, '_').replace(/^_+|_+$/g, '')
}

/** Map a row whose keys are raw headers onto the expected columns. */
function columnsOf(row: CsvRow): Partial<Record<Column, string>> {
  const out: Partial<Record<Column, string>> = {}
  for (const [header, value] of Object.entries(row)) {
    const column = HEADER_ALIASES[normaliseHeader(header)]
    if (column && out[column] === undefined) out[column] = String(value ?? '').trim()
  }
  return out
}

/**
 * Read an answer key the way people and chat tools write it:
 * "B", "b", "(B)", "B.", "Option B", "2", or the text of the correct option.
 */
export function normaliseAnswer(raw: string, options: readonly string[]): AnswerLetter | null {
  const value = raw.trim()
  if (!value) return null
  const letter = value.toUpperCase().replace(/^OPTION\s*/, '').replace(/[()[\].:\s]/g, '')
  if (/^[ABCD]$/.test(letter)) return letter as AnswerLetter
  if (/^[1-4]$/.test(letter)) return 'ABCD'[Number(letter) - 1] as AnswerLetter
  const byText = options.findIndex((o) => o.trim().toLowerCase() === value.toLowerCase())
  return byText >= 0 ? ('ABCD'[byText] as AnswerLetter) : null
}

export interface RowProblem {
  /** 1-based row number as the user sees it in their file (header is row 1). */
  row: number
  file?: string
  message: string
}

export interface ReadResult {
  questions: MyTestQuestion[]
  problems: RowProblem[]
}

/**
 * Turn uploaded rows into questions. Rows with problems are reported, not
 * guessed at; duplicates of an earlier question are reported too.
 */
export function rowsToQuestions(
  rows: readonly CsvRow[],
  rowNumbers?: readonly number[],
  file?: string,
  seen: Set<string> = new Set()
): ReadResult {
  const questions: MyTestQuestion[] = []
  const problems: RowProblem[] = []
  rows.forEach((raw, i) => {
    const row = rowNumbers?.[i] ?? i + 2
    const c = columnsOf(raw)
    const options = [c.option_a ?? '', c.option_b ?? '', c.option_c ?? '', c.option_d ?? '']
    const problem = (message: string) => problems.push({ row, file, message })

    if (!c.question) return problem('The question is empty.')
    if (options.some((o) => !o)) return problem('All four options (A–D) are needed.')
    const answer = normaliseAnswer(c.correct_answer ?? '', options)
    if (!answer) return problem(`The correct answer "${c.correct_answer ?? ''}" is not A, B, C or D.`)
    const tooLong = lengthProblem(c.question, options, c.explanation ?? '', c.topic ?? '', c.difficulty ?? '')
    if (tooLong) return problem(tooLong)
    const key = c.question.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) return problem('The same question appears earlier.')
    seen.add(key)

    questions.push({
      question: c.question,
      option_a: options[0], option_b: options[1], option_c: options[2], option_d: options[3],
      correct_answer: answer,
      explanation: c.explanation ?? '',
      topic: c.topic ?? '',
      difficulty: c.difficulty ?? '',
    })
  })
  return { questions, problems }
}

function lengthProblem(question: string, options: string[], explanation: string, topic: string, difficulty: string): string | null {
  const L = MY_TEST_LIMITS
  if (question.length > L.maxQuestionChars) return `The question is longer than ${L.maxQuestionChars} characters.`
  if (options.some((o) => o.length > L.maxOptionChars)) return `An option is longer than ${L.maxOptionChars} characters.`
  if (explanation.length > L.maxExplanationChars) return `The explanation is longer than ${L.maxExplanationChars} characters.`
  if (topic.length > L.maxShortChars || difficulty.length > L.maxShortChars) return `Topic or difficulty is longer than ${L.maxShortChars} characters.`
  return null
}

/** Server-side check of what the browser sent. Returns an error message, or the clean questions. */
export function checkQuestions(input: unknown): { questions: MyTestQuestion[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) return { error: 'Add at least one question.' }
  if (input.length > MY_TEST_LIMITS.maxQuestions) return { error: `A test can have at most ${MY_TEST_LIMITS.maxQuestions} questions.` }
  const rows = input.map((q) => {
    const o = (q ?? {}) as Record<string, unknown>
    return Object.fromEntries(MY_TEST_COLUMNS.map((col) => [col, typeof o[col] === 'string' ? (o[col] as string) : ''])) as CsvRow
  })
  const { questions, problems } = rowsToQuestions(rows, rows.map((_, i) => i + 1))
  if (problems.length) return { error: `Question ${problems[0].row}: ${problems[0].message}` }
  return { questions }
}

export interface PromptOptions {
  subject: string
  medium: MyTestMedium
  topics: string[]
  questionCount: number
  difficulty: 'mixed' | 'easy' | 'medium' | 'hard'
  /** 'file' asks for an Excel download (website upload); 'text' for CSV text to paste (mobile app). */
  output?: 'file' | 'text'
}

const DIFFICULTY_TEXT: Record<PromptOptions['difficulty'], string> = {
  mixed: 'a mix — about 30% Easy, 50% Medium and 20% Hard',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

/** The prompt users paste into an AI chat tool to prepare their questions. */
export function buildPrompt({ subject, medium, topics, questionCount, difficulty, output = 'file' }: PromptOptions): string {
  const language = medium === 'telugu' ? 'Telugu (తెలుగు)' : 'English'
  const topicLine = topics.length
    ? topics.join(', ')
    : 'cover the whole syllabus of this subject evenly'
  return [
    'You are an expert question setter for the Andhra Pradesh DSC SGT (Secondary Grade Teacher) recruitment exam.',
    '',
    `Create ${questionCount} multiple-choice questions.`,
    `- Subject: ${subject}`,
    `- Topics: ${topicLine}`,
    `- Language: write every question, option and explanation in ${language}.`,
    `- Difficulty: ${DIFFICULTY_TEXT[difficulty]}.`,
    '- Standard: AP DSC SGT exam level, based on the AP SCERT school syllabus.',
    '',
    'Rules:',
    '1. Each question has exactly one correct option; the other three are plausible but clearly wrong.',
    '2. Every fact and answer must be accurate. Do not repeat a question.',
    '3. Do not number the questions or options inside the text.',
    '4. Keep each explanation to one or two sentences.',
    '',
    output === 'text'
      ? 'Output: CSV text only, inside one code block. Put any field that contains a comma in double quotes.'
      : 'Output: give me a downloadable Excel file (.xlsx). If you cannot create a file, give CSV text instead.',
    `Use exactly these ${MY_TEST_COLUMNS.length} columns, in this order, with this header row:`,
    MY_TEST_COLUMNS.join(', '),
    '- correct_answer: only the letter A, B, C or D.',
    '- difficulty: Easy, Medium or Hard.',
    '- One question per row. No extra columns, notes or blank rows.',
    '',
    `If ${questionCount} questions are too many for one reply, create them in parts of 40 with the same columns. I will ${output === 'text' ? 'paste' : 'upload'} all the parts together.`,
  ].join('\n')
}

/**
 * Read CSV text pasted from an AI chat (the mobile app's way in). Code fences
 * are ignored, and so are repeated header rows, because a long test arrives
 * in parts that each start with the header.
 */
export function readPastedCsv(text: string): ReadResult {
  const lines = text.split(/\r?\n/)
  // Chat tools put the CSV in code blocks and talk around them ("Part 2:").
  // With code blocks, only their contents count.
  const fenced: string[] = []
  let inside = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) inside = !inside
    else if (inside) fenced.push(line)
  }
  const csvLines = fenced.length ? fenced : lines
  const first = csvLines.findIndex((line) => line.split(',').some((cell) => HEADER_ALIASES[normaliseHeader(cell.replace(/"/g, ''))] === 'question'))
  const { rows, rowLines } = parseCsv(csvLines.slice(Math.max(0, first)).join('\n'))
  const keep = rows.map((row) => !Object.entries(row).every(([header, value]) => normaliseHeader(value) === normaliseHeader(header)))
  return rowsToQuestions(rows.filter((_, i) => keep[i]), rowLines.filter((_, i) => keep[i]))
}

/** Grade an attempt: one character per question, A–D or '-' for unanswered. */
export function gradeAttempt(answers: string, questions: readonly MyTestQuestion[]): number {
  let correct = 0
  questions.forEach((q, i) => {
    if (answers[i] === q.correct_answer) correct++
  })
  return correct
}
