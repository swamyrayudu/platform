// ============================================================
// app/components/home/HomeFooter.tsx — Dashboard footer
// ============================================================
'use client'

import React from 'react'
import { BloomMark } from '@/app/components/landing/LandingHeader'

export default function HomeFooter() {
  return (
    <footer className="mt-14 flex flex-col gap-6 border-t border-border/70 pb-4 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">

      <div className="flex items-center gap-2.5">
        <BloomMark className="h-4 w-4" />
        <span>© 2026 rsdeducation — All rights reserved</span>
      </div>

      <div className="flex items-center gap-6">
        <a href="#" className="transition-colors hover:text-foreground">
          Privacy Policy
        </a>
        <a href="#" className="transition-colors hover:text-foreground">
          Terms of Service
        </a>
      </div>

    </footer>
  )
}
