// ============================================================
// lib/study-prompt.ts — An AI study prompt for each day of the 90-day plan
// ============================================================
// The candidate copies it into ChatGPT, Gemini or Claude to learn the day's
// topics in depth and then be quizzed on them. The prompt is in English, like
// the rest of the plan, and asks the AI to teach in the candidate's medium.
// Each kind of day (lib/study-plan.ts DayKind) gets the prompt that fits it.
// ============================================================

import { AP_DSC_SGT_OFFICIAL_BLUEPRINT as PATTERN } from './mock-tests/blueprints'
import { SUBJECT_LABEL, type PlanMedium, type PlanSubject, type StudyDay } from './study-plan'

const EXAM =
  `I am preparing for the Andhra Pradesh DSC 2026 SGT (Secondary Grade Teacher) exam: ${PATTERN.total_questions} ` +
  `multiple-choice questions in ${PATTERN.duration_minutes} minutes, on the official SCERT syllabus. School subjects ` +
  'are tested at Class 3–8 level, with difficulty up to Class 10.'
const TEACHER = `Act as an expert AP DSC SGT teacher. ${EXAM}`
const QUIZ = 'Wait for my answers, then explain each one.'
const PASTE_MISTAKES = '[Paste the questions you got wrong here, with your answer and the correct answer]'

/** What to make the candidate memorise, by subject. */
const KEY_FACTS: Record<PlanSubject, string> = {
  psychology: 'theories, psychologists, definitions and terms',
  perspectives: 'acts, committees, policies, years and terms',
  mathematics: 'formulas, shortcuts and definitions',
  telugu: 'rules, examples and exceptions',
  science: 'definitions, facts and examples',
  english: 'rules, examples and exceptions',
  social: 'facts, dates, names and places',
  gk: 'facts, names, dates and places',
  test: 'facts and terms',
  mock: 'facts and terms',
  revision: 'facts, definitions and terms',
  rest: 'facts',
}

function languageLine(day: StudyDay, medium: PlanMedium): string {
  if (day.subject === 'english') return 'Teach in simple English.'
  if (day.subject === 'telugu') {
    return medium === 'telugu'
      ? 'Teach in Telugu.'
      : 'Explain in simple English, but keep every rule, word and example in Telugu: this is the Telugu language paper.'
  }
  return medium === 'telugu'
    ? 'Teach in Telugu, as in AP Telugu-medium textbooks, with the English term in brackets for each key term.'
    : 'Teach in simple English.'
}

const bullets = (items: readonly string[]) => items.map((t) => `- ${t}`).join('\n')
const MOCK_MISTAKES = /^Mock \d+ mistakes$/

/** The prompt for one day. `plan` is that day's whole plan, for the weekly test. */
export function studyPrompt(day: StudyDay, plan: readonly StudyDay[], medium: PlanMedium): string {
  const lang = languageLine(day, medium)
  const subject = SUBJECT_LABEL[day.subject]

  switch (day.kind) {
    case 'study':
    case 'methodology':
      return [
        TEACHER,
        '',
        `Today's topic: ${subject} — ${day.title}`,
        ...(day.kind === 'methodology' ? ['This is the teaching methodology (pedagogy) part of the paper.'] : []),
        'Sub-topics:',
        bullets(day.topics),
        '',
        'Teach me this in depth:',
        '1. Explain each sub-topic step by step from the basics, with simple examples.',
        `2. List the key ${day.kind === 'methodology' ? 'methods, approaches, objectives and terms' : KEY_FACTS[day.subject]} I must remember.`,
        '3. Show what DSC exams usually ask on this, and the common traps.',
        '4. Give memory tricks and a one-page summary for revision.',
        `5. Then give me 15 DSC-style multiple-choice questions (4 options each). ${QUIZ}`,
        ...(day.subject === 'gk' ? ['', 'Use the most recent events. If you can search the web, use the latest news.'] : []),
        '',
        lang,
      ].join('\n')

    case 'section':
      return [
        TEACHER,
        '',
        `Today I revise the whole of ${subject}:`,
        bullets(day.topics),
        '',
        '1. Give me a one-page cheat sheet of the most important points from every unit.',
        '2. List the topics DSC asks most often.',
        `3. Then give me 24 DSC-style multiple-choice questions across all units. ${QUIZ} Tell me which units to revise again.`,
        '',
        lang,
      ].join('\n')

    case 'weekly': {
      const week = plan.filter((d) => d.week === day.week && d.day !== day.day)
      const gk = day.topics.find((t) => t.startsWith('GK: '))
      return [
        TEACHER,
        '',
        'This week I studied:',
        bullets(week.map((d) => `${SUBJECT_LABEL[d.subject]}: ${d.title} (${d.topics.join('; ')})`)),
        '',
        `1. Give me 30 mixed DSC-style multiple-choice questions on these topics, one subject after another. ${QUIZ} Tell me my weakest topic.`,
        ...(gk ? [`2. Then teach me this GK topic as short notes with the key facts: ${gk.slice(4)}`] : []),
        '',
        lang,
      ].join('\n')
    }

    case 'mock':
      return [
        TEACHER,
        '',
        `I have just taken a full mock test (${PATTERN.total_questions} questions). Below are the questions I got wrong. For each one:`,
        '1. Explain why the correct answer is right and why mine is wrong.',
        '2. Teach the concept behind it in a few lines, and ask me one similar question.',
        'Then list the topics I should revise, most important first.',
        '',
        PASTE_MISTAKES,
        '',
        lang,
      ].join('\n')

    case 'review': {
      const study = day.topics.filter((t) => !MOCK_MISTAKES.test(t))
      return [
        TEACHER,
        '',
        'Below are the questions I got wrong in my last mock test. For each one, explain the correct answer and the concept behind it.',
        '',
        PASTE_MISTAKES,
        '',
        ...(study.length
          ? ['Then revise these with me: a short summary of each, and 10 DSC-style multiple-choice questions.', bullets(study), '', QUIZ, '']
          : []),
        lang,
      ].join('\n')
    }

    case 'weak':
      return [
        TEACHER,
        '',
        'My weakest topics in practice are:',
        '- [Topic 1 from Performance]',
        '- [Topic 2]',
        '- [Topic 3]',
        '',
        'For each topic: explain the core ideas simply, list the facts to remember and the common traps,',
        `and give me 10 DSC-style multiple-choice questions. ${QUIZ}`,
        '',
        lang,
      ].join('\n')

    case 'mistakes':
      return [
        TEACHER,
        '',
        'Below are questions I got wrong in practice. For each one: explain the correct answer and the concept behind it,',
        'then ask me a similar new question to check I have understood.',
        '',
        PASTE_MISTAKES,
        '',
        lang,
      ].join('\n')

    case 'rest':
      return [
        TEACHER,
        '',
        'My exam is tomorrow. Please give me:',
        '1. An exam-day checklist: hall ticket, ID proof, what to carry, reaching the centre on time.',
        `2. How to attempt ${PATTERN.total_questions} questions in ${PATTERN.duration_minutes} minutes, and what to do with questions I am unsure of` +
          (PATTERN.negative_marks ? ` (each wrong answer costs ${PATTERN.negative_marks} marks).` : ' (there is no negative marking).'),
        '3. Five short, calm tips for tonight and the morning.',
        '',
        lang,
      ].join('\n')
  }
}
