'use client'

// ============================================================
// app/components/legal/LegalPage.tsx — Shell for Privacy and Terms
// ============================================================
// Both documents exist in English and Telugu, and the switch is at the top
// rather than in a footer: most candidates sitting this exam read Telugu
// first, and a legal page nobody can read in their own language protects
// nobody.
//
// Only one language is in the DOM at a time. That is deliberate — a screen
// reader or a Ctrl+F should not walk through the same clause twice — and the
// switch is plain buttons rather than a select so the alternative is visible
// without opening anything.
// ============================================================

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { BloomMark } from '@/app/components/landing/LandingHeader'

export interface LegalSection {
  heading: string
  /** Paragraphs. Bullet lists are passed as `items` instead. */
  body?: string[]
  items?: string[]
}

export interface LegalDocument {
  title: string
  updated: string
  intro: string[]
  sections: LegalSection[]
}

interface LegalPageProps {
  english: LegalDocument
  telugu: LegalDocument
}

export default function LegalPage({ english, telugu }: LegalPageProps) {
  const [lang, setLang] = useState<'en' | 'te'>('en')
  const doc = lang === 'en' ? english : telugu

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to rsdeducation
        </Link>

        <div className="mt-6 flex items-center gap-2.5">
          <BloomMark className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-tight">
            rsd<span className="font-normal text-muted-foreground">education</span>
          </span>
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">{doc.title}</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">{doc.updated}</p>

        {/* Language switch */}
        <div
          role="group"
          aria-label="Document language"
          className="mt-5 inline-flex rounded-full border border-border bg-card p-1"
        >
          {([
            { id: 'en' as const, label: 'English' },
            { id: 'te' as const, label: 'తెలుగు' },
          ]).map((option) => (
            <button
              key={option.id}
              onClick={() => setLang(option.id)}
              aria-pressed={lang === option.id}
              className={`min-h-9 rounded-full px-4 text-[13px] font-semibold transition ${
                lang === option.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          {doc.intro.map((para) => (
            <p key={para} className="text-[15px] leading-relaxed text-foreground">
              {para}
            </p>
          ))}
        </div>

        <div className="mt-10 space-y-9">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-bold text-foreground sm:text-lg">{section.heading}</h2>

              {section.body?.map((para) => (
                <p key={para} className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                  {para}
                </p>
              ))}

              {section.items && (
                <ul className="mt-3 space-y-2">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-[14px] leading-relaxed text-muted-foreground"
                    >
                      <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-[13px]">
          <a
            href="mailto:rsdeducationplatform@gmail.com"
            className="inline-flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.8} />
            rsdeducationplatform@gmail.com
          </a>
          <Link href="/privacy" className="text-muted-foreground transition hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-muted-foreground transition hover:text-foreground">
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  )
}
