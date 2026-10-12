// ============================================================
// components/ui/loading-screen.tsx — Premium Loading Animation Screen
// ============================================================
'use client'

import React from 'react'
import { BrandMark } from '@/components/brand-logo'

export function LoadingScreen({ message = 'Loading rsdeducation...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground transition-colors duration-200">
      <div className="relative flex flex-col items-center">
        {/* Shared brand mark inside the loading ring */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute h-20 w-20 animate-spin rounded-full border border-transparent border-t-primary border-r-primary/30 [animation-duration:1.4s]" />
          <div className="absolute h-14 w-14 animate-pulse rounded-full bg-secondary" />

          <BrandMark className="relative h-11 w-11" />
        </div>

        {/* Brand & loading label */}
        <div className="mt-5 text-center">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            RSD Education
          </p>
          <p className="mt-1.5 animate-pulse text-xs text-muted-foreground">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}
