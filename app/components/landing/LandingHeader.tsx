// ============================================================
// app/components/landing/LandingHeader.tsx — Top Navigation
// ============================================================
'use client'

import React from 'react'
import Link from 'next/link'
import { ModeToggle } from '@/components/mode-toggle'
import { BrandLogo } from '@/components/brand-logo'

const NAV_LINKS = [
  { label: 'Mock Tests', href: '#mock-tests' },
  { label: 'Practice', href: '#practice' },
  { label: 'Previous Papers', href: '#papers' },
  { label: 'Pricing', href: '#pricing' },
]

interface LandingHeaderProps {
  /** False when NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset — fall back to a link. */
  googleEnabled?: boolean
  /** Wide Google button, shown from sm up. */
  gsiButtonRef?: React.RefObject<HTMLDivElement | null>
  /** Compact Google button, shown below sm. */
  gsiCompactRef?: React.RefObject<HTMLDivElement | null>
}

export default function LandingHeader({
  googleEnabled = false,
  gsiButtonRef,
  gsiCompactRef,
}: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-card/75 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">

        {/* Left: Logo mark + wordmark */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <BrandLogo />
        </Link>

        {/* Center: Nav links — hidden below lg, as in the reference */}
        <nav className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right: Theme toggle + sign in with Google */}
        <div className="flex shrink-0 items-center gap-2.5">
          <ModeToggle />

          {googleEnabled ? (
            // Both containers stay mounted — Google renders into them once on
            // load, so unmounting either would leave an empty box behind.
            <>
              <div ref={gsiCompactRef} className="sm:hidden" />
              <div ref={gsiButtonRef} className="hidden sm:block" />
            </>
          ) : (
            <a href="#sign-in" className="bloom-pill bloom-pill-dark px-4 py-2 text-[13px]">
              Start Free
            </a>
          )}
        </div>

      </div>
    </header>
  )
}
