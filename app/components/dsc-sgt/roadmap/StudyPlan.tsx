'use client'

// ============================================================
// app/components/dsc-sgt/roadmap/StudyPlan.tsx — The 90-day plan, per medium
// ============================================================
// Reads top to bottom: today's study, the daily habits, how the study days
// follow the exam's marks, then the schedule one week at a time. Weeks 1–8, 9–10 and 11–13 are exactly the three phases, so
// the week picker is grouped by phase. Text is kept to what a candidate acts on.
// Each day's main action is its study notes PDF in this medium (uploaded to
// Resources), read here in the same viewer as Resources; Pro notes ask free
// users to upgrade. Mock and review days link to Mock tests / Performance.
//
// Plan content: lib/study-plan.ts, one version per medium (only the topics
// differ; the rest is English in both). The start date and ticked days are a
// per-browser convenience kept in localStorage, separately for each medium;
// the page works without it.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Crown, Flame } from 'lucide-react'
import {
  DAILY_HABITS, PLAN_PHASES, ROUTINE_TASKS, SUBJECT_LABEL, getStudyPlan,
  type PlanAction, type PlanMedium, type PlanSubject, type StudyDay,
} from '@/lib/study-plan'
import { partSummary } from '@/lib/roadmap-summary'
import type { RoadmapNote } from '@/lib/resources/config'
import { requestLink } from '@/lib/resources/open-link'
import { usePremium } from '@/app/components/dsc-sgt/PremiumContext'
import PdfViewer from '@/app/components/dsc-sgt/resources/PdfViewer'

const DAY_MS = 86_400_000

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode): the plan still works, it just is not remembered.
  }
}

/** One colour per subject, shown as a dot beside its name. */
const SUBJECT_DOT: Record<PlanSubject, string> = {
  psychology: 'bg-violet-500', perspectives: 'bg-fuchsia-500', mathematics: 'bg-blue-500', telugu: 'bg-orange-500',
  science: 'bg-emerald-500', english: 'bg-sky-500', social: 'bg-amber-500', gk: 'bg-teal-500',
  test: 'bg-lime-600', mock: 'bg-rose-500', revision: 'bg-slate-400', rest: 'bg-zinc-300',
}

/** Mock and review days link to their page; study days have their notes instead. */
const ACTION: Partial<Record<PlanAction, { href: string; label: string }>> = {
  mock: { href: '/dsc-sgt/mock-tests', label: 'Mock tests' },
  performance: { href: '/dsc-sgt/performance', label: 'Performance' },
}

/** Midnight today, local time. */
const todayStart = () => new Date(new Date().toDateString()).getTime()
const isoDate = (time: number) => {
  const d = new Date(time)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dayNumber = (startIso: string, today: number) =>
  Math.round((today - new Date(`${startIso}T00:00:00`).getTime()) / DAY_MS) + 1
const shortDate = (time: number) => new Date(time).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Remount with `key={medium}` when the medium changes: each medium keeps its
 * own start date and ticks.
 */
export default function StudyPlan({ medium }: { medium: PlanMedium }) {
  const plan = getStudyPlan(medium)
  const weeks = Array.from({ length: Math.ceil(plan.length / 7) }, (_, i) => plan.slice(i * 7, i * 7 + 7))
  const startKey = `rsd-study-plan-start-${medium}`
  const doneKey = `rsd-study-plan-done-${medium}`

  const [today] = useState(todayStart)
  // The dsc-sgt layout renders pages only in the browser, so localStorage is available here.
  const [start, setStart] = useState<string | null>(() => read<string | null>(startKey, null))
  const [done, setDone] = useState<Set<number>>(() => new Set(read<number[]>(doneKey, [])))

  const todayDay = start ? dayNumber(start, today) : null
  const currentDay = todayDay !== null && todayDay >= 1 && todayDay <= plan.length ? todayDay : null
  const [week, setWeek] = useState(() => (currentDay ? Math.ceil(currentDay / 7) : 1))

  // Each day's study notes, by day number; days without notes just show no button.
  const { isPremium, openModal } = usePremium()
  const [notes, setNotes] = useState<Record<number, RoadmapNote>>({})
  const [reading, setReading] = useState<RoadmapNote | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/dsc-sgt/resources?roadmap=${medium}`)
      .then((res) => res.json())
      .then((json) => { if (live && json?.success) setNotes(json.notes ?? {}) })
      .catch(() => { /* The plan works without notes. */ })
    return () => { live = false }
  }, [medium])
  const openNotes = (note: RoadmapNote) => (note.access === 'pro' && !isPremium ? openModal('roadmap_notes') : setReading(note))
  const readingId = reading?.id
  const getUrl = useCallback(() => requestLink(`/api/dsc-sgt/resources/${readingId}/link`), [readingId])
  const closeReader = useCallback(() => setReading(null), [])
  const notesFor = (d: StudyDay) => ({ note: notes[d.day], locked: notes[d.day]?.access === 'pro' && !isPremium, onNotes: openNotes })

  const startTime = start ? new Date(`${start}T00:00:00`).getTime() : null
  const dateOf = (day: number) => (startTime === null ? null : startTime + (day - 1) * DAY_MS)

  const chooseStart = (value: string) => {
    const next = value || null
    setStart(next)
    write(startKey, next)
    if (next) {
      const day = dayNumber(next, today)
      setWeek(day >= 1 && day <= plan.length ? Math.ceil(day / 7) : 1)
    }
  }
  const toggleDone = (day: number) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      write(doneKey, [...next])
      return next
    })
  }

  const days = weeks[week - 1]
  const firstDate = dateOf(days[0].day)
  const lastDate = dateOf(days[days.length - 1].day)

  return (
    <div className="space-y-6">
      <TodayCard
        plan={plan}
        start={start}
        todayDay={todayDay}
        currentDay={currentDay}
        today={today}
        done={done}
        onStart={chooseStart}
        onToggle={toggleDone}
        notesFor={notesFor}
      />

      {/* ── Every day ── */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1 font-semibold text-foreground">
          <Flame className="h-3.5 w-3.5 text-orange-500" /> Every day
        </span>
        {DAILY_HABITS.map((h, i) => (
          <span key={h}>{i > 0 && <span className="mr-3 text-border">·</span>}{h}</span>
        ))}
      </p>

      {/* ── Schedule ── */}
      <section>
        <h2 className="text-base font-bold text-foreground">Schedule</h2>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          Days by marks:
          {partSummary(plan).map((p) => (
            <span key={p.part} className="rounded-md border border-border bg-card px-2 py-0.5">
              <span className="font-semibold text-foreground">{p.label}</span> {p.marks} marks · {p.days} days{p.extra}
            </span>
          ))}
        </p>

        <div className="mt-3 flex gap-5 overflow-x-auto pb-2">
          {PLAN_PHASES.map((p) => (
            <div key={p.phase} className="shrink-0">
              <p className="mb-1.5 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">{p.title}</span> · {p.days}
              </p>
              <div className="flex gap-1.5">
                {weeks.map((w, i) => {
                  if (w[0].phase !== p.phase) return null
                  const n = i + 1
                  const doneCount = w.filter((d) => done.has(d.day)).length
                  const complete = doneCount === w.length
                  const selected = n === week
                  const isCurrent = currentDay !== null && Math.ceil(currentDay / 7) === n
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setWeek(n)}
                      aria-pressed={selected}
                      aria-label={`Week ${n}, ${doneCount} of ${w.length} days done${isCurrent ? ', this week' : ''}`}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition cursor-pointer ${
                        selected ? 'border-primary bg-primary text-primary-foreground'
                          : complete ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-border bg-card text-foreground hover:border-primary/50'
                      }`}
                    >
                      {complete && !selected ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
                      {isCurrent && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-orange-500" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <p className="text-sm font-bold text-foreground">
              Week {week}
              <span className="ml-2 font-normal text-muted-foreground">
                Days {days[0].day}–{days[days.length - 1].day}
                {firstDate !== null && lastDate !== null && ` · ${shortDate(firstDate)} – ${shortDate(lastDate)}`}
              </span>
            </p>
            <div className="flex shrink-0 gap-1">
              <button
                type="button" aria-label="Previous week" disabled={week === 1} onClick={() => setWeek(week - 1)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button" aria-label="Next week" disabled={week === weeks.length} onClick={() => setWeek(week + 1)}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer disabled:cursor-default"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ol className="divide-y divide-border">
            {days.map((d) => {
              const isToday = d.day === currentDay
              const date = dateOf(d.day)
              return (
                <li key={d.day} className={`flex gap-4 px-4 py-4 sm:px-5 ${isToday ? 'bg-primary/5' : ''}`}>
                  <div className="w-20 shrink-0">
                    <p className="text-sm font-bold text-foreground">Day {d.day}</p>
                    {date !== null && <p className="text-[11px] text-muted-foreground">{shortDate(date)}</p>}
                    {isToday && <span className="mt-1 inline-block rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">Today</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <DayDetails day={d} />
                    <DayActions day={d} done={done.has(d.day)} onToggle={toggleDone} {...notesFor(d)} />
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {reading && <PdfViewer title={reading.title} getUrl={getUrl} onClose={closeReader} />}
    </div>
  )
}

type NotesProps = { note?: RoadmapNote; locked: boolean; onNotes: (note: RoadmapNote) => void }

function TodayCard({ plan, start, todayDay, currentDay, today, done, onStart, onToggle, notesFor }: {
  plan: StudyDay[]
  start: string | null
  todayDay: number | null
  currentDay: number | null
  today: number
  done: Set<number>
  onStart: (iso: string) => void
  onToggle: (day: number) => void
  notesFor: (day: StudyDay) => NotesProps
}) {
  const dateInput = (
    <input
      type="date"
      value={start ?? ''}
      onChange={(e) => onStart(e.target.value)}
      aria-label="Start date"
      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
    />
  )

  if (!start || todayDay === null) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-foreground">Start your 90-day plan</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onStart(isoDate(today))}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
          >
            Start today
          </button>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">or {dateInput}</span>
        </div>
      </section>
    )
  }

  const percent = Math.round((done.size / plan.length) * 100)
  const footer = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border bg-muted/30 px-5 py-3 sm:px-6">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">Started {dateInput}</label>
      <div className="flex min-w-[180px] flex-1 items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-[11px] text-muted-foreground">{done.size}/{plan.length} done</span>
      </div>
    </div>
  )

  if (currentDay !== null) {
    const day = plan[currentDay - 1]
    return (
      <section className="overflow-hidden rounded-2xl border border-primary/40 bg-card">
        <div className="p-5 sm:p-6">
          <p className="mb-3 text-xs font-semibold text-primary">
            Today · {shortDate(today)} · Day {currentDay} of {plan.length}
          </p>
          <DayDetails day={day} large />
          <DayActions day={day} done={done.has(day.day)} onToggle={onToggle} {...notesFor(day)} large />
        </div>
        {footer}
      </section>
    )
  }

  const startsIn = 1 - todayDay
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <p className="p-5 text-lg font-bold text-foreground sm:p-6">
        {todayDay < 1 ? `Starts in ${startsIn} day${startsIn === 1 ? '' : 's'}` : '90 days complete'}
      </p>
      {footer}
    </section>
  )
}

function DayDetails({ day, large }: { day: StudyDay; large?: boolean }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className={`h-2 w-2 shrink-0 rounded-full ${SUBJECT_DOT[day.subject]}`} />
        {SUBJECT_LABEL[day.subject]}
      </p>
      <p className={large ? 'mt-1 text-xl font-bold text-foreground' : 'mt-0.5 text-sm font-semibold text-foreground'}>{day.title}</p>
      <ul className={`mt-1.5 space-y-0.5 text-muted-foreground ${large ? 'text-sm' : 'text-xs'}`}>
        {day.topics.map((t) => (
          <li key={t} className="flex gap-2">
            <span className={`shrink-0 rounded-full bg-muted-foreground/50 ${large ? 'mt-2 h-1.5 w-1.5' : 'mt-1.5 h-1 w-1'}`} />
            {t}
          </li>
        ))}
      </ul>
      {!ROUTINE_TASKS.has(day.task) && (
        <p className={`mt-2 font-medium text-foreground/80 ${large ? 'text-sm' : 'text-xs'}`}>{day.task}</p>
      )}
    </div>
  )
}

/** Study notes first and big; then Done, and the Mock tests / Performance link on those days. */
function DayActions({ day, done, onToggle, note, locked, onNotes, large }: NotesProps & {
  day: StudyDay
  done: boolean
  onToggle: (day: number) => void
  large?: boolean
}) {
  const link = ACTION[day.action]
  const small = large ? 'h-11 px-4 text-sm' : 'h-10 px-3.5 text-sm'
  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${large ? 'mt-5' : 'mt-3'}`}>
      {note && (
        <button
          type="button"
          onClick={() => onNotes(note)}
          title={note.title}
          aria-label={`Study notes for day ${day.day}${locked ? ', Pro' : ''}`}
          className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold shadow-sm transition cursor-pointer max-sm:w-full ${
            large ? 'h-12 px-6 text-base' : 'h-11 px-5 text-sm'
          } ${
            locked
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {locked ? <Crown className="h-4.5 w-4.5" /> : <BookOpen className="h-4.5 w-4.5" />}
          {locked ? 'Unlock study notes' : 'Read study notes'}
        </button>
      )}
      <button
        type="button"
        onClick={() => onToggle(day.day)}
        aria-pressed={done}
        aria-label={`Day ${day.day} done`}
        className={`inline-flex items-center gap-2 rounded-xl border font-semibold transition cursor-pointer ${small} ${
          done
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : 'border-border bg-background text-muted-foreground hover:text-foreground'
        }`}
      >
        <span className={`flex h-4 w-4 items-center justify-center rounded-[5px] border ${done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-muted-foreground/60'}`}>
          {done && <Check className="h-3 w-3" strokeWidth={4} />}
        </span>
        {done ? 'Done' : 'Mark done'}
      </button>
      {link && (
        <Link
          href={link.href}
          className={`inline-flex items-center gap-1.5 rounded-xl border border-primary/40 font-semibold text-primary transition hover:bg-primary/5 ${small}`}
        >
          {link.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}
