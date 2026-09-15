// ============================================================
// app/components/landing/LandingFooter.tsx — Landing Page Footer
// ============================================================
'use client'

import React from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { BloomMark } from './LandingHeader'

export default function LandingFooter() {
  return (
    <footer className="mt-14 flex flex-col gap-6 border-t border-border/70 pb-4 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">

      {/* Left: mark + copyright */}
      <div className="flex items-center gap-2.5">
        <BloomMark className="h-4 w-4" />
        <span>© 2026 rsdeducation — All rights reserved</span>
      </div>

      {/* Right: contact and legal.
          A paid product with no way to reach anybody is the thing people
          complain about first, and a payment or a wrong answer both need a
          human at some point. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <a
          href="mailto:rsdeducationplatform@gmail.com"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
        >
          <Mail className="h-3.5 w-3.5" strokeWidth={1.8} />
          rsdeducationplatform@gmail.com
        </a>
        <Link href="/privacy" className="transition-colors hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="transition-colors hover:text-foreground">
          Terms of Service
        </Link>
      </div>

    </footer>
  )
}
