// ============================================================
// app/api/dsc-sgt/roadmap/route.ts — The exam roadmap, for the mobile app
// ============================================================
// GET ?medium=telugu|english → the 90-day plan with each day's AI prompt,
// the phases, daily habits and days-by-marks, plus the exam pattern,
// syllabus and dates. The website renders the same modules directly; serving
// them here keeps one source, so the app shows plan changes without a release.
// Each day also carries its study-notes PDF in this medium (`notes`, or null),
// which the app downloads into its private storage to read offline.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { AP_DSC_SGT_OFFICIAL_BLUEPRINT as PATTERN } from '@/lib/mock-tests/blueprints'
import { EXAM_DATES, EXAM_DATES_UPDATED, EXAM_PARTS, SYLLABUS_SOURCE } from '@/lib/exam-roadmap'
import { DAILY_HABITS, PLAN_PHASES, ROUTINE_TASKS, SUBJECT_LABEL, getStudyPlan } from '@/lib/study-plan'
import { studyPrompt } from '@/lib/study-prompt'
import { partSummary } from '@/lib/roadmap-summary'
import { PATTERN_FACTS, syllabusFor } from '@/lib/exam-syllabus'
import { roadmapNotes, type RoadmapNote } from '@/lib/resources/store'

export const GET = requireAuth(async (request) => {
  const medium = new URL(request.url).searchParams.get('medium') === 'telugu' ? 'telugu' : 'english'
  const plan = getStudyPlan(medium)
  // The plan still loads if the notes cannot be read; the days just have none.
  const notes = await roadmapNotes(medium).catch((err) => {
    console.error('[roadmap] notes', err)
    return new Map<number, RoadmapNote>()
  })
  return NextResponse.json({
    success: true,
    medium,
    days: plan.map((d) => ({
      ...d,
      subject_label: SUBJECT_LABEL[d.subject],
      // The everyday task is implied by the Practice button, as on the website.
      task: ROUTINE_TASKS.has(d.task) ? null : d.task,
      prompt: studyPrompt(d, plan, medium),
      notes: notes.get(d.day) ?? null,
    })),
    phases: PLAN_PHASES,
    habits: DAILY_HABITS,
    parts: partSummary(plan),
    exam: {
      pattern: {
        total_questions: PATTERN.total_questions,
        total_marks: PATTERN.total_marks,
        duration_minutes: PATTERN.duration_minutes,
        marks_per_question: PATTERN.marks_per_question,
        negative_marks: PATTERN.negative_marks,
      },
      parts: EXAM_PARTS,
      dates: EXAM_DATES,
      dates_updated: EXAM_DATES_UPDATED,
      source: SYLLABUS_SOURCE,
      // The full syllabus in this medium (app 1.0.3+). `parts` stays for older apps.
      syllabus: syllabusFor(medium),
      facts: PATTERN_FACTS,
    },
  })
})
