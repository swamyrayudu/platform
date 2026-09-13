// ============================================================
// app/components/home/HeroBanner.tsx — Dashboard hero
// ============================================================
// Deliberately the same construction as the landing hero — bloom field,
// sparkle mark, centred display type — so signing in does not feel like
// arriving at a different product.
'use client'

import React from 'react'
import BloomField from '@/app/components/landing/BloomField'
import { BloomMark } from '@/app/components/landing/LandingHeader'

interface HeroBannerProps {
  /** Full name of the signed-in candidate, if we have one. */
  name?: string | null
}

export default function HeroBanner({ name }: HeroBannerProps) {
  const firstName = name?.trim().split(/\s+/)[0]

  return (
    <section className="relative overflow-hidden rounded-3xl">
      <BloomField />

      <div className="relative flex min-h-[340px] flex-col items-center px-6 pb-32 pt-14 text-center sm:min-h-[420px] sm:pb-40 sm:pt-18">
        <BloomMark className="h-5 w-5 text-bloom-indigo" />

        <p className="mt-5 text-[11px] font-medium tracking-wide text-bloom-ink/60">
          {firstName ? `Welcome back, ${firstName}` : 'Your preparation hub'}
        </p>

        <h1 className="mt-2 max-w-2xl text-[1.75rem] font-medium leading-[1.12] text-bloom-ink sm:text-4xl lg:text-[2.75rem]">
          Choose your exam
        </h1>

        <p className="mt-4 max-w-md text-[13px] leading-relaxed text-bloom-ink/70 sm:text-sm">
          Pick a category to open its practice sets, mock tests and previous
          papers. Progress in each one is tracked separately.
        </p>
      </div>
    </section>
  )
}
