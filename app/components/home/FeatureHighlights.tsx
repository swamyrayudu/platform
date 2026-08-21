// ============================================================
// app/components/home/FeatureHighlights.tsx — Bottom value prop bar (Pure Shadcn Tokens)
// ============================================================
'use client'

import React from 'react'
import { Target, ShieldCheck, BarChart3, Trophy } from 'lucide-react'

export default function FeatureHighlights() {
  const features = [
    {
      icon: Target,
      title: 'Exam Specific',
      description: 'Focused content for better preparation',
    },
    {
      icon: ShieldCheck,
      title: 'Trusted Content',
      description: 'Updated syllabus & previous papers',
    },
    {
      icon: BarChart3,
      title: 'Track Progress',
      description: 'Monitor your performance and improvement',
    },
    {
      icon: Trophy,
      title: 'Achieve Goal',
      description: 'Stay consistent and crack your exam',
    },
  ]

  return (
    <div className="mb-10 rounded-2xl border border-border/80 bg-card p-6 shadow-2xs transition-colors sm:p-7">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, idx) => {
          const Icon = feature.icon
          return (
            <div key={idx} className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted text-primary">
                <Icon className="h-5 w-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-foreground sm:text-sm">
                  {feature.title}
                </h4>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
