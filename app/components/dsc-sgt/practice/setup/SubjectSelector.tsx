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
  HelpCircle,
  LucideIcon,
} from 'lucide-react'
import type { DynamicFilterOptions } from '@/types/practice'

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
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/30',
    tag: 'Grammar & Pedagogy',
  },
  {
    id: 'Telugu',
    name: 'Telugu',
    teluguName: 'తెలుగు (భాష I)',
    icon: BookOpen,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    tag: 'వ్యాకరణం & సాహిత్యం',
  },
  {
    id: 'Mathematics',
    name: 'Mathematics',
    teluguName: 'గణితం',
    icon: Calculator,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    tag: 'Arithmetic & Geometry',
  },
  {
    id: 'Science',
    name: 'Science',
    teluguName: 'సాధారణ సైన్స్',
    icon: FlaskConical,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/30',
    tag: 'Biology & Physics',
  },
  {
    id: 'Social Studies',
    name: 'Social Studies',
    teluguName: 'సాంఘిక శాస్త్రం',
    icon: Globe,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
    tag: 'Geography & Polity',
  },
  {
    id: 'Pedagogy',
    name: 'Pedagogy',
    teluguName: 'సైకాలజీ & బోధన',
    icon: Brain,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/30',
    tag: 'Child Development',
  },
]

interface SubjectSelectorProps {
  selectedSubject: string
  onSelectSubject: (subjectName: string) => void
  dynamicOptions: DynamicFilterOptions | null
  totalAvailable: number
}

export default function SubjectSelector({
  selectedSubject,
  onSelectSubject,
  dynamicOptions,
  totalAvailable,
}: SubjectSelectorProps) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card p-5 sm:p-7 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
            1
          </span>
          <h2 className="text-sm sm:text-base font-bold text-foreground">Choose Subject</h2>
        </div>
        <span className="text-xs font-semibold text-primary">{selectedSubject}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {SUBJECT_LIST.map((sub) => {
          const isSelected = selectedSubject.toLowerCase() === sub.name.toLowerCase()
          const Icon = sub.icon
          const serverSubj = dynamicOptions?.available_subjects?.find(
            (s) => s.name.toLowerCase() === sub.name.toLowerCase()
          )
          const qCount = serverSubj ? serverSubj.question_count : sub.name === 'English' ? 50 : 0
          const hasQuestions = qCount > 0

          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelectSubject(sub.name)}
              className={`flex flex-col items-start p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground font-bold shadow-xs'
                  : hasQuestions
                  ? 'border-border/70 bg-card hover:border-border text-muted-foreground hover:text-foreground'
                  : 'border-border/40 bg-muted/20 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${sub.bg} ${sub.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                {hasQuestions ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400">
                    Live Bank
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    No Data Yet
                  </span>
                )}
              </div>

              <span className="text-xs sm:text-sm font-bold truncate w-full text-foreground">
                {sub.name}
              </span>
              <span className="text-[10px] text-muted-foreground truncate w-full mt-0.5">
                {sub.teluguName}
              </span>
            </button>
          )
        })}
      </div>

      {/* Notice when current selected subject has 0 questions */}
      {totalAvailable === 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in-50">
          <HelpCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
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
