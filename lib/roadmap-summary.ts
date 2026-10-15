// ============================================================
// lib/roadmap-summary.ts — How the plan's study days follow the exam's marks
// ============================================================
// Shown on the website's plan and sent to the mobile app by
// /api/dsc-sgt/roadmap, so both read the marks from lib/exam-roadmap.ts.
// ============================================================

import { EXAM_PARTS } from './exam-roadmap'
import type { PlanPart, StudyDay } from './study-plan'

export interface PartSummary { part: PlanPart; label: string; marks: number; days: number; extra?: string }

const marksOf = (id: string) => EXAM_PARTS.find((p) => p.id === id)?.marks ?? 0

const PART_MARKS: Omit<PartSummary, 'days'>[] = [
  { part: 'content', label: 'Content', marks: EXAM_PARTS.reduce((sum, p) => sum + (p.split?.content ?? 0), 0) },
  { part: 'methodology', label: 'Methodology', marks: EXAM_PARTS.reduce((sum, p) => sum + (p.split?.methodology ?? 0), 0) },
  { part: 'psychology', label: 'Psychology', marks: marksOf('psychology') },
  { part: 'gk', label: 'GK', marks: marksOf('gk'), extra: ' + weekly' },
  { part: 'perspectives', label: 'Perspectives', marks: marksOf('perspectives') },
]

export function partSummary(plan: readonly StudyDay[]): PartSummary[] {
  return PART_MARKS.map((p) => ({ ...p, days: plan.filter((d) => d.part === p.part).length }))
}
