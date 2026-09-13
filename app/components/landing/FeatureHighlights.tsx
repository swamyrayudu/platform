// ============================================================
// app/components/landing/FeatureHighlights.tsx — Closing value-prop band
// ============================================================
'use client'

import React from 'react'
import { ShieldCheck, Lock, Headphones } from 'lucide-react'

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Trusted by thousands of aspirants',
    description: 'Reliable, current and built around the official pattern.',
  },
  {
    icon: Lock,
    title: 'Secure and private',
    description: 'Your attempts and scores stay yours alone.',
  },
  {
    icon: Headphones,
    title: 'Support whenever you study',
    description: 'Answers at 6am or midnight, whichever you keep.',
  },
]

export default function FeatureHighlights() {
  return (
    <section className="mt-14 overflow-hidden rounded-3xl bg-bloom-indigo p-8 sm:p-10 lg:mt-20">
      <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
        {FEATURES.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.title} className="flex flex-col">
              <Icon
                className="h-5 w-5 text-[color:var(--primary-foreground)]"
                strokeWidth={1.6}
              />
              <h3 className="mt-4 text-base font-medium leading-snug text-[color:var(--primary-foreground)]">
                {item.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--primary-foreground)]/65">
                {item.description}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
