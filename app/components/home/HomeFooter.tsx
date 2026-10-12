// ============================================================
// app/components/home/HomeFooter.tsx — Dashboard footer
// ============================================================
'use client'

import React from 'react'
import { BrandMark } from '@/components/brand-logo'

export default function HomeFooter() {
  return (
    <footer className="mt-14 flex flex-col gap-6 border-t border-border/70 pb-4 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">

      <div className="flex items-center gap-2.5">
        <BrandMark className="h-5 w-5" />
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
