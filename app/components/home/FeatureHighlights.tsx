// ============================================================
// app/components/home/FeatureHighlights.tsx — Bottom value-prop band
// ============================================================
'use client'

import React from 'react'
import { Target, ShieldCheck, BarChart3, Trophy } from 'lucide-react'

const FEATURES = [
  {
    icon: Target,
    title: 'Exam specific',
    description: 'Focused content for better preparation.',
  },
  {
    icon: ShieldCheck,
    title: 'Trusted content',
    description: 'Updated syllabus and previous papers.',
  },
  {
    icon: BarChart3,
    title: 'Track progress',
    description: 'Monitor performance and improvement.',
  },
  {
    icon: Trophy,
    title: 'Achieve your goal',
    description: 'Stay consistent and crack your exam.',
  },
]

export default function FeatureHighlights() {
  return (
    <section className="mt-14 overflow-hidden rounded-3xl bg-bloom-indigo p-8 sm:mt-20 sm:p-10">
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <div key={feature.title} className="flex flex-col">
              <Icon
                className="h-5 w-5 text-[color:var(--primary-foreground)]"
                strokeWidth={1.6}
              />
              <h3 className="mt-4 text-base font-medium text-[color:var(--primary-foreground)]">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--primary-foreground)]/65">
                {feature.description}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
