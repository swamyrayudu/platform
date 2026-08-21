// ============================================================
// app/components/landing/LandingHeader.tsx — Top Navigation
// ============================================================
'use client'

import React from 'react'
import { ModeToggle } from '@/components/mode-toggle'

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-xs">
            R
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">
            rsd<span className="font-normal text-muted-foreground">education</span>
          </span>
        </div>

        {/* Right: ModeToggle */}
        <div className="flex items-center gap-3">
          <ModeToggle />
        </div>

      </div>
    </header>
  )
}
