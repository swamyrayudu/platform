// ============================================================
// app/components/landing/HeroContent.tsx — Left Hero Column matching screenshot
// ============================================================
'use client'

import React from 'react'
import {
  FileText,
  FileSpreadsheet,
  BarChart3,
  Languages,
  BookOpen,
  Bot,
  Users,
  ClipboardCheck,
  Medal,
} from 'lucide-react'
import DashboardIllustration from './DashboardIllustration'

export default function HeroContent() {
  const featureBoxes = [
    {
      icon: FileText,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
      title: 'Mock Tests',
      desc: 'Exam-style practice',
    },
    {
      icon: FileSpreadsheet,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      title: 'PYQs',
      desc: 'Previous papers',
    },
    {
      icon: BarChart3,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/10 dark:bg-purple-500/15',
      title: 'Analytics',
      desc: 'Track performance',
    },
    {
      icon: Languages,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10 dark:bg-red-500/15',
      title: 'Telugu',
      desc: 'Telugu & English',
    },
    {
      icon: BookOpen,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
      title: 'Revision',
      desc: 'Focus on weak areas',
    },
    {
      icon: Bot,
      iconColor: 'text-indigo-500',
      iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
      title: 'AI Support',
      desc: 'Smart preparation',
    },
  ]

  return (
    <div className="lg:col-span-7">
      
      {/* Platform Badge */}
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground shadow-2xs">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        rsdeducation Platform
      </div>

      {/* Main Headline */}
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[3.25rem] lg:leading-[1.12]">
        Prepare smarter.
        <br />
        <span className="font-extrabold text-primary">
          Crack exams with confidence.
        </span>
      </h1>

      {/* Subheading */}
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        Practice syllabus-based questions, take realistic mock tests,
        revise previous papers and understand your performance — all in
        one preparation platform.
      </p>

      {/* Center Layout: 6 Feature Cards + 3D Laptop Mockup */}
      <div className="my-8 grid items-center gap-6 md:grid-cols-12">
        
        {/* 6 Feature Badges (6 cols on md) */}
        <div className="grid grid-cols-2 gap-3 md:col-span-6 sm:grid-cols-3 md:grid-cols-2">
          {featureBoxes.map((box, idx) => {
            const Icon = box.icon
            return (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-2xs transition-all hover:border-primary/40 hover:shadow-xs"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted text-primary">
                  <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-bold text-foreground">
                    {box.title}
                  </h4>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {box.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* 3D Dashboard Mockup (6 cols on md) */}
        <div className="md:col-span-6">
          <DashboardIllustration />
        </div>

      </div>

      {/* Bottom 3-Column Statistics Bar */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-2xs">
        <div className="grid grid-cols-3 divide-x divide-border/60">
          
          <div className="flex items-center justify-center gap-3 px-2 sm:px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground sm:text-lg">1L+</p>
              <p className="text-[10px] text-muted-foreground sm:text-[11px]">Students Preparing</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 px-2 sm:px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground sm:text-lg">50K+</p>
              <p className="text-[10px] text-muted-foreground sm:text-[11px]">Mock Tests Attempted</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 px-2 sm:px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
              <Medal className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground sm:text-lg">95%</p>
              <p className="text-[10px] text-muted-foreground sm:text-[11px]">Success Rate</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
