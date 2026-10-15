'use client'

// ============================================================
// app/components/dsc-sgt/roadmap/ExamOverview.tsx — Exam pattern & syllabus
// ============================================================
// lib/exam-roadmap.ts (official DSC-2026 SGT syllabus) plus the mock
// blueprint (question count, time, marking). The same for both mediums.
// ============================================================

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, ChevronDown } from 'lucide-react'
import { AP_DSC_SGT_OFFICIAL_BLUEPRINT as PATTERN } from '@/lib/mock-tests/blueprints'
import { EXAM_DATES, EXAM_DATES_UPDATED, EXAM_PARTS, SYLLABUS_SOURCE } from '@/lib/exam-roadmap'

const questionsFor = (marks: number) => Math.round(marks / PATTERN.marks_per_question)
const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

export default function ExamOverview() {
  const [open, setOpen] = useState<string | null>(null)
  const totalMarks = EXAM_PARTS.reduce((sum, p) => sum + p.marks, 0)
  const contentMarks = EXAM_PARTS.reduce((sum, p) => sum + (p.split?.content ?? 0), 0)
  const methodologyMarks = EXAM_PARTS.reduce((sum, p) => sum + (p.split?.methodology ?? 0), 0)

  const stats = [
    { value: String(PATTERN.total_questions), label: 'questions' },
    { value: String(PATTERN.total_marks), label: 'marks' },
    { value: String(PATTERN.duration_minutes), label: 'minutes' },
    {
      value: PATTERN.marks_per_question === 0.5 ? '½' : String(PATTERN.marks_per_question),
      label: PATTERN.negative_marks ? `mark each · −${PATTERN.negative_marks} if wrong` : 'mark each · no negative',
    },
  ]

  return (
    <div className="space-y-8">
      {/* ── Pattern ── */}
      <section aria-label="Exam pattern" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card px-4 py-4">
            <p className="text-2xl font-black text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-8">
          {/* ── Marks by part ── */}
          <section>
            <h2 className="text-base font-bold text-foreground">Marks by part</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 sm:px-4 font-semibold">Part</th>
                    <th className="px-3 py-2.5 sm:px-4 text-right font-semibold">Marks</th>
                    <th className="px-3 py-2.5 sm:px-4 text-right font-semibold">Questions</th>
                    <th className="hidden px-3 py-2.5 sm:px-4 text-right font-semibold sm:table-cell">Content + methodology</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {EXAM_PARTS.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2.5 sm:px-4 font-medium text-foreground">{p.name}</td>
                      <td className="px-3 py-2.5 sm:px-4 text-right font-semibold text-foreground">{p.marks}</td>
                      <td className="px-3 py-2.5 sm:px-4 text-right text-foreground">{questionsFor(p.marks)}</td>
                      <td className="hidden px-3 py-2.5 sm:px-4 text-right text-muted-foreground sm:table-cell">{p.split ? `${p.split.content} + ${p.split.methodology}` : '—'}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40 font-bold text-foreground">
                    <td className="px-3 py-2.5 sm:px-4">Total</td>
                    <td className="px-3 py-2.5 sm:px-4 text-right">{totalMarks}</td>
                    <td className="px-3 py-2.5 sm:px-4 text-right">{questionsFor(totalMarks)}</td>
                    <td className="hidden px-3 py-2.5 sm:px-4 text-right font-normal text-muted-foreground sm:table-cell">{contentMarks} + {methodologyMarks}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Syllabus ── */}
          <section>
            <h2 className="text-base font-bold text-foreground">Syllabus</h2>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {EXAM_PARTS.map((p) => {
                const expanded = open === p.id
                return (
                  <div key={p.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : p.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.marks} marks · {questionsFor(p.marks)} questions</span>
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && (
                      <div className="space-y-3 px-4 pb-4 text-sm">
                        {p.note && <p className="text-muted-foreground">{p.note}</p>}
                        {p.units.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-foreground">{p.split ? `Content · ${p.split.content} marks` : 'Units'}</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                              {p.units.map((u) => <li key={u}>{u}</li>)}
                            </ul>
                          </div>
                        )}
                        {p.methodologyUnits && (
                          <div>
                            <p className="text-xs font-semibold text-foreground">Methodology{p.split && ` · ${p.split.methodology} marks`}</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                              {p.methodologyUnits.map((u) => <li key={u}>{u}</li>)}
                            </ul>
                          </div>
                        )}
                        <Link href="/dsc-sgt/practice" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                          Practice <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Source: {SYLLABUS_SOURCE}.</p>
          </section>
        </div>

        {/* ── Dates ── */}
        <aside className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" /> Important dates
          </h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card text-sm">
            {EXAM_DATES.map((d) => (
              <li key={d.label} className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
                <span className="font-medium text-foreground">{d.label}</span>
                <span className={`shrink-0 whitespace-nowrap text-right text-xs ${d.date ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {d.date ? formatDate(d.date) : 'To be announced'}
                  {d.note && <span className="block text-[11px] text-muted-foreground">{d.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Updated {formatDate(EXAM_DATES_UPDATED)}. Confirm in the official notification.
          </p>
        </aside>
      </div>
    </div>
  )
}
