// ============================================================
// app/components/landing/HeroContent.tsx — Hero, intro & bento sections
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
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react'
import BloomField from './BloomField'
import DashboardIllustration from './DashboardIllustration'
import { BloomMark } from './LandingHeader'

const FEATURE_BOXES = [
  { icon: FileText, title: 'Mock Tests', desc: 'Full-length, exam-style papers under real timing.' },
  { icon: FileSpreadsheet, title: 'Previous Papers', desc: 'Every past paper, solved and explained.' },
  { icon: BarChart3, title: 'Analytics', desc: 'See exactly which topics are costing you marks.' },
  { icon: Languages, title: 'Telugu & English', desc: 'Every question available in both media.' },
  { icon: BookOpen, title: 'Smart Revision', desc: 'Weak areas resurface until they stop being weak.' },
  { icon: Bot, title: 'AI Support', desc: 'Ask about any question, any time.' },
]

// These were "1L+ students preparing", "50K+ mock tests attempted" and
// "95% report score gains". None of it was true — the platform had nine
// registered users and two submitted attempts when this was written, and no
// survey exists behind the 95%. Invented traction on a page that takes money
// is not a design decision anyone gets to make, so these are now counts of
// what actually exists, which is genuinely the strongest thing the product
// can say about itself.
const STATS = [
  { icon: BookOpen, value: '39,181', label: 'Questions in the bank' },
  { icon: ClipboardCheck, value: '200', label: 'Full-length mock papers' },
  { icon: Languages, value: '2', label: 'Media — Telugu & English' },
]

interface HeroContentProps {
  /** Slot for Google's own button. Null when sign-in is not configured. */
  heroGsiRef?: React.RefObject<HTMLDivElement | null>
  googleEnabled?: boolean
}

export default function HeroContent({ heroGsiRef, googleEnabled = false }: HeroContentProps) {
  return (
    <>
      {/* ══════════════ 1. Hero card ══════════════ */}
      <section className="relative overflow-hidden rounded-3xl">
        <BloomField />

        <div className="relative flex min-h-[380px] flex-col items-center px-6 pb-44 pt-14 text-center sm:min-h-[460px] sm:pb-56 sm:pt-20 lg:min-h-[520px]">
          {/* Say which exam, before anything else. A candidate scanning for
              three seconds needs to know this is theirs — the old hero opened
              with a metaphor and never named the paper at all. */}
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-bloom-lavender backdrop-blur-sm">
            <BloomMark className="h-3 w-3" />
            AP DSC · SGT
          </span>

          <h1 className="mt-5 max-w-3xl text-[2rem] font-semibold leading-[1.12] text-white sm:text-5xl lg:text-[3.4rem]">
            The whole SGT syllabus,
            <br className="hidden sm:block" />{' '}
            <span className="text-bloom-lavender">practised properly.</span>
          </h1>

          {/* Telugu carries equal weight, not a footnote: half the published
              papers are Telugu medium and most candidates sit it. */}
          <p className="mt-4 max-w-md text-[15px] font-medium leading-relaxed text-white/85 sm:text-base">
            ఏపీ డీఎస్సీ – ఎస్‌జీటీ కోసం పూర్తి సిలబస్ ప్రాక్టీస్, తెలుగు మరియు
            ఇంగ్లీష్ మాధ్యమాల్లో.
          </p>

          <p className="mt-2.5 max-w-md text-[13px] leading-relaxed text-white/60">
            160 questions, 150 minutes, the official paper pattern — the same
            exam you will sit, as often as you need it.
          </p>

          {/* Google's own button, not a lookalike that calls a function.
              Their terms require the rendered widget, and a custom control
              that opens the popup is exactly what gets a client id pulled.
              The promise that used to be the button label now sits under it,
              where it still does its job. */}
          {googleEnabled ? (
            <div className="mt-7 flex flex-col items-center gap-2.5">
              <div ref={heroGsiRef} className="min-h-[44px]" />
              <span className="text-[11px] font-medium text-white/55">
                Free to start · no card needed
              </span>
            </div>
          ) : (
            <a
              href="#sign-in"
              className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-bloom-lavender px-7 text-sm font-semibold text-bloom-ink transition hover:brightness-105"
            >
              Start free — no card needed
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </section>

      {/* ══════════════ 2. What is rsdeducation? ══════════════ */}
      <section className="mt-14 grid gap-8 lg:mt-20 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-3xl font-medium leading-tight text-foreground sm:text-[2.5rem]">
            What is rsdeducation?
          </h2>
          <a href="#features" className="bloom-pill bloom-pill-dark mt-6 px-4 py-2 text-[13px]">
            Explore now
          </a>
        </div>

        <p className="max-w-md text-base leading-relaxed text-foreground sm:text-lg lg:justify-self-end">
          rsdeducation is a preparation platform that turns the official
          syllabus into daily practice — so your score grows while the exam
          pattern stays exactly as it will be on the day.
        </p>
      </section>

      {/* ══════════════ 3. Bento: one tinted card + two dark cards ══════════════ */}
      <section id="features" className="mt-10 grid gap-4 lg:grid-cols-12">

        {/* Wide tinted card */}
        <article className="bloom-tint relative flex min-h-[280px] flex-col overflow-hidden rounded-2xl p-6 lg:col-span-6">
          <h3 className="text-lg font-medium text-bloom-ink sm:max-w-[60%]">
            Practice that grows with you
          </h3>

          <p className="relative mt-3 text-xs leading-relaxed text-bloom-ink/75 sm:mt-auto sm:max-w-[52%]">
            Every answer feeds your topic map. Weak areas come back more often,
            solved ones fade out — so revision time goes where it earns marks.
          </p>

          {/* Sits in the flow on phones, where an absolute mockup would land on
              top of the copy; from sm up it bleeds off the bottom-right corner
              the way the reference's 3D render does. */}
          <div className="pointer-events-none mx-auto mt-6 w-44 sm:absolute sm:-bottom-8 sm:-right-10 sm:mt-0 sm:w-72">
            <DashboardIllustration />
          </div>
        </article>

        {/* Dark card 1 */}
        <DarkBentoCard
          className="lg:col-span-3"
          title={<>Always exam-real,<br />never approximate</>}
          body="Timing, negative marking, question mix and paper structure follow the official pattern — no surprises on exam day."
        />

        {/* Dark card 2 */}
        <DarkBentoCard
          className="lg:col-span-3"
          title={<>100%<br />syllabus-mapped</>}
          body="Every question is tagged to a syllabus unit, so you can see your coverage rather than guess at it."
        />
      </section>

      {/* ══════════════ 4. Trust strip ══════════════ */}
      <section className="mt-12 flex flex-col gap-6 border-t border-border/70 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="bloom-eyebrow max-w-[14rem] leading-relaxed">
          Built with teachers and toppers across Andhra Pradesh &amp; Telangana.
        </p>

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:items-center sm:gap-x-8">
          {STATS.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.value} className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{stat.value}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ══════════════ 5. Use cases grid ══════════════ */}
      <section className="mt-14 lg:mt-20">
        <p className="bloom-eyebrow">rsdeducation in action</p>
        <h2 className="mt-2 text-3xl font-medium text-foreground sm:text-[2.5rem]">
          Use cases
        </h2>
        <p className="mt-3 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Six ways aspirants use the platform between now and the notification
          date.
        </p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_BOXES.map((box) => {
            const Icon = box.icon
            return (
              <article
                key={box.title}
                className="group flex flex-col rounded-2xl border border-border/70 bg-card p-5 transition-colors hover:border-border"
              >
                <Icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
                <h3 className="mt-4 text-base font-medium text-foreground">{box.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {box.desc}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Learn more
                </span>
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}

/* ── Dark indigo bento card ── */

function DarkBentoCard({
  title,
  body,
  className = '',
}: {
  title: React.ReactNode
  body: string
  className?: string
}) {
  return (
    <article
      className={`flex min-h-[280px] flex-col justify-between rounded-2xl bg-bloom-indigo p-6 ${className}`}
    >
      <h3 className="text-lg font-medium leading-snug text-[color:var(--primary-foreground)]">
        {title}
      </h3>
      <p className="mt-auto text-xs leading-relaxed text-[color:var(--primary-foreground)]/70">
        {body}
      </p>
    </article>
  )
}
