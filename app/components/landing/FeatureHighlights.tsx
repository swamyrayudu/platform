// ============================================================
// app/components/landing/FeatureHighlights.tsx — Bottom 3-Column Value Prop Bar
// ============================================================
'use client'

import React from 'react'
import { ShieldCheck, Lock, Headphones } from 'lucide-react'

export default function FeatureHighlights() {
  const features = [
    {
      icon: ShieldCheck,
      title: 'Trusted by thousands of aspirants',
      description: 'Reliable. Secure. Effective.',
    },
    {
      icon: Lock,
      title: 'Secure & Private',
      description: 'Your data is 100% secure with us.',
    },
    {
      icon: Headphones,
      title: '24/7 AI Support',
      description: 'Get help anytime, anywhere.',
    },
  ]

  return (
    <div className="my-10 rounded-2xl border border-border/80 bg-card p-6 shadow-2xs sm:p-7">
      <div className="grid gap-6 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
        {features.map((item, idx) => {
          const Icon = item.icon
          return (
            <div
              key={idx}
              className={`flex items-center gap-3.5 ${
                idx > 0 ? 'pt-4 sm:pt-0 sm:pl-6' : ''
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted text-primary">
                <Icon className="h-5 w-5 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground sm:text-sm">{item.title}</h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
