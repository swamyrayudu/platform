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
      <BloomField compact />

      {/* Light type, because the field behind it is now deep indigo. This
          block still carried bloom-ink from when the sky was a pale lavender
          wash, which left the heading all but invisible against it.

          Half the height it was, too. This is a signed-in dashboard, not a
          landing page: the thing a candidate came for is the exam list below,
          and a 420px banner pushed the first card off the screen. */}
      <div className="relative flex min-h-[168px] flex-col items-center px-6 pb-16 pt-8 text-center sm:min-h-[200px] sm:pb-20 sm:pt-10">
        <BloomMark className="h-5 w-5 text-bloom-lavender" />

        <p className="mt-3 text-[11px] font-medium tracking-wide text-white/65">
          {firstName ? `Welcome back, ${firstName}` : 'Your preparation hub'}
        </p>

        <h1 className="mt-1.5 max-w-2xl text-[1.5rem] font-semibold leading-[1.12] text-white sm:text-3xl lg:text-[2.25rem]">
          Choose your exam
        </h1>

        <p className="mt-2.5 max-w-md text-[12px] leading-relaxed text-white/70 sm:text-[13px]">
          Pick a category to open its practice sets, mock tests and previous
          papers. Progress in each one is tracked separately.
        </p>
      </div>
    </section>
  )
}
