'use client'

// ============================================================
// app/components/dsc-sgt/roadmap/ExamOverview.tsx — Exam pattern & syllabus
// ============================================================
// The paper's pattern (mock blueprint + PATTERN_FACTS), marks by part, and the
// full official DSC-2026 SGT syllabus unit by unit (lib/exam-syllabus.ts), in
// the chosen medium: in Telugu medium the units and topics are in Telugu, the
// page around them stays English.
// ============================================================

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, ChevronDown } from 'lucide-react'
import { AP_DSC_SGT_OFFICIAL_BLUEPRINT as PATTERN } from '@/lib/mock-tests/blueprints'
import { EXAM_DATES, EXAM_DATES_UPDATED, SYLLABUS_SOURCE } from '@/lib/exam-roadmap'
import { PATTERN_FACTS, syllabusFor, type SyllabusMedium, type SyllabusUnitView } from '@/lib/exam-syllabus'

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
const q = (marks: number) => Math.round(marks / PATTERN.marks_per_question)

function Units({ heading, units }: { heading: string; units: SyllabusUnitView[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-primary">{heading}</p>
      <ol className="mt-2 space-y-3">
        {units.map((u, i) => (
          <li key={u.title} className="rounded-xl border border-border/70 bg-background p-3">
            <p className="text-sm font-semibold text-foreground"><span className="mr-1.5 text-muted-foreground">{i + 1}.</span>{u.title}</p>
            {u.topics.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-1 pl-6 text-[13px] leading-relaxed text-muted-foreground">
                {u.topics.map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function ExamOverview({ medium }: { medium: SyllabusMedium }) {
  const [open, setOpen] = useState<string | null>(null)
  const parts = syllabusFor(medium)
  const totalMarks = parts.reduce((sum, p) => sum + p.marks, 0)
  const contentMarks = parts.reduce((sum, p) => sum + (p.split?.content ?? 0), 0)
  const methodologyMarks = parts.reduce((sum, p) => sum + (p.split?.methodology ?? 0), 0)

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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          {/* ── Marks by part ── */}
          <section>
            <h2 className="text-base font-bold text-foreground">Marks by part</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold sm:px-4">Part</th>
                    <th className="px-3 py-2.5 text-right font-semibold sm:px-4">Marks</th>
                    <th className="px-3 py-2.5 text-right font-semibold sm:px-4">Questions</th>
                    <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell sm:px-4">Content + methodology</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-3 py-2.5 sm:px-4">
                        <span className="font-medium text-foreground">{p.name}</span>
                        {medium === 'telugu' && <span className="block text-[11px] text-muted-foreground">{p.teluguName}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-foreground sm:px-4">{p.marks}</td>
                      <td className="px-3 py-2.5 text-right text-foreground sm:px-4">{p.questions}</td>
                      <td className="hidden px-3 py-2.5 text-right text-muted-foreground sm:table-cell sm:px-4">
                        {p.split ? `${p.split.content} + ${p.split.methodology} marks (${q(p.split.content)} + ${q(p.split.methodology)} Qs)` : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/40 font-bold text-foreground">
                    <td className="px-3 py-2.5 sm:px-4">Total</td>
                    <td className="px-3 py-2.5 text-right sm:px-4">{totalMarks}</td>
                    <td className="px-3 py-2.5 text-right sm:px-4">{q(totalMarks)}</td>
                    <td className="hidden px-3 py-2.5 text-right font-normal text-muted-foreground sm:table-cell sm:px-4">{contentMarks} + {methodologyMarks} marks</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Syllabus ── */}
          <section>
            <h2 className="text-base font-bold text-foreground">Full syllabus</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Every unit and topic of the official syllabus{medium === 'telugu' ? ', in Telugu' : ''}. Open a part to see it.
            </p>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {parts.map((p) => {
                const expanded = open === p.id
                const unitCount = p.content.length + (p.methodology?.length ?? 0)
                return (
                  <div key={p.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : p.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{p.name}{medium === 'telugu' && <span className="font-normal text-muted-foreground"> · {p.teluguName}</span>}</span>
                        <span className="block text-xs text-muted-foreground">{p.marks} marks · {p.questions} questions · {unitCount} unit{unitCount === 1 ? '' : 's'}</span>
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && (
                      <div className="space-y-5 px-4 pb-5">
                        {p.note && <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{p.note}</p>}
                        <Units heading={p.split ? `Content · ${p.split.content} marks · ${q(p.split.content)} questions` : 'Units'} units={p.content} />
                        {p.methodology && p.split && (
                          <Units heading={`Teaching methodology · ${p.split.methodology} marks · ${q(p.split.methodology)} questions`} units={p.methodology} />
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

        <aside className="min-w-0 space-y-8">
          {/* ── Pattern details ── */}
          <section>
            <h2 className="text-base font-bold text-foreground">Pattern details</h2>
            <dl className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card text-sm">
              {PATTERN_FACTS.map((f) => (
                <div key={f.label} className="px-4 py-2.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 text-foreground">{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Dates ── */}
          <section>
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
          </section>
        </aside>
      </div>
    </div>
  )
}
