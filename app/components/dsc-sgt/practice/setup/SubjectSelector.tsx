'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/SubjectSelector.tsx
// ============================================================

import React from 'react'
import {
  Languages,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe,
  Brain,
  Newspaper,
  HelpCircle,
  Check,
  LucideIcon,
} from 'lucide-react'

interface SubjectConfig {
  id: string
  name: string
  teluguName: string
  icon: LucideIcon
  color: string
  bg: string
  tag: string
}

export const SUBJECT_LIST: SubjectConfig[] = [
  {
    id: 'English',
    name: 'English',
    teluguName: 'ఇంగ్లీష్ (భాష II)',
    icon: Languages,
    color: 'text-subject-5',
    bg: 'bg-subject-5/10 border-subject-5/30',
    tag: 'Grammar & Pedagogy',
  },
  {
    id: 'Telugu',
    name: 'Telugu',
    teluguName: 'తెలుగు (భాష I)',
    icon: BookOpen,
    color: 'text-subject-4',
    bg: 'bg-subject-4/10 border-subject-4/30',
    tag: 'వ్యాకరణం & సాహిత్యం',
  },
  {
    id: 'Mathematics',
    name: 'Mathematics',
    teluguName: 'గణితం',
    icon: Calculator,
    color: 'text-subject-2',
    bg: 'bg-subject-2/10 border-subject-2/30',
    tag: 'Arithmetic & Geometry',
  },
  {
    id: 'Science',
    name: 'Science',
    teluguName: 'సాధారణ సైన్స్',
    icon: FlaskConical,
    color: 'text-subject-7',
    bg: 'bg-subject-7/10 border-subject-7/30',
    tag: 'Biology & Physics',
  },
  {
    id: 'Social Studies',
    name: 'Social Studies',
    teluguName: 'సాంఘిక శాస్త్రం',
    icon: Globe,
    color: 'text-subject-8',
    bg: 'bg-subject-8/10 border-subject-8/30',
    tag: 'Geography & Polity',
  },
  {
    id: 'Educational Psychology + Perspectives in Education',
    name: 'Educational Psychology + Perspectives in Education',
    teluguName: 'విద్యా మనోవిజ్ఞాన శాస్త్రం & విద్యా దృక్పథాలు',
    icon: Brain,
    color: 'text-subject-3',
    bg: 'bg-subject-3/10 border-subject-3/30',
    tag: 'Psychology & Perspectives',
  },
  {
    id: 'GK & Current Affairs',
    name: 'GK & Current Affairs',
    teluguName: 'సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు',
    icon: Newspaper,
    color: 'text-subject-6',
    bg: 'bg-subject-6/10 border-subject-6/30',
    tag: 'Current Affairs & Static GK',
  },
]

interface SubjectSelectorProps {
  selectedSubject: string
  onSelectSubject: (subjectName: string) => void
  /** Server truth for the SELECTED subject only — drives the notice below. */
  totalAvailable: number
}

export default function SubjectSelector({
  selectedSubject,
  onSelectSubject,
  totalAvailable,
}: SubjectSelectorProps) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            1
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Choose Subject</h2>
        </div>
        <span className="text-xs font-semibold text-primary">{selectedSubject}</span>
      </div>

      {/* A list on phones, a grid once there is width for one.
          Two cramped columns clipped the longest subject to two lines and
          left a candidate guessing at "Educational Psychology + Perspec…";
          a row has the whole name and the Telugu below it. */}
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {SUBJECT_LIST.map((sub) => {
          const isSelected = selectedSubject.toLowerCase() === sub.name.toLowerCase()
          const Icon = sub.icon

          // There is no per-card availability state any more, and the reason is
          // that it could not be computed honestly. It matched the server's
          // subject name against the English label here, but the `subject`
          // column is not in English for several Telugu-medium tables —
          // telugu_medium_science stores "సైన్స్", gk_telugu_medium stores
          // "సాధారణ జ్ఞానం మరియు ప్రస్తుత వ్యవహారాలు". Nothing matched, so every
          // subject except English read "Coming soon" on Telugu medium while
          // sitting on thousands of questions.
          //
          // The hardcoded `sub.name === 'English' ? 50 : 0` fallback underneath
          // it dated from when English was the only bank that existed. All
          // twelve tables have questions now, so the state it guarded is gone.
          // A subject that genuinely has none is still caught downstream: the
          // Start button reads the real count for the chosen subject and
          // refuses with "No Questions Available Currently".
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelectSubject(sub.name)}
              aria-pressed={isSelected}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:bg-accent/40'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${sub.bg} ${sub.color}`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-foreground">
                  {sub.name}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {sub.teluguName}
                </span>
              </span>

              {isSelected && (
                <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      {/* Notice when current selected subject has 0 questions */}
      {totalAvailable === 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-primary/30 bg-secondary p-3.5 text-xs text-primary animate-in fade-in-50">
          <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">No questions available currently for {selectedSubject}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
              Questions for {selectedSubject} have not been uploaded yet. Please select <strong>English</strong> to practice from your live question bank.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
