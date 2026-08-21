// ============================================================
// app/components/home/HomeFooter.tsx — Clean matching footer
// ============================================================
'use client'

import React from 'react'

export default function HomeFooter() {
  return (
    <footer className="pb-10 pt-2 text-center text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <span>© 2026 rsdeducation · All rights reserved</span>
        <span className="hidden text-border sm:inline">|</span>
        <a
          href="#"
          className="transition-colors hover:text-foreground hover:underline underline-offset-4"
        >
          Privacy Policy
        </a>
        <span className="hidden text-border sm:inline">|</span>
        <a
          href="#"
          className="transition-colors hover:text-foreground hover:underline underline-offset-4"
        >
          Terms of Service
        </a>
      </div>
    </footer>
  )
}
