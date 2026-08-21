// ============================================================
// components/ui/loading-screen.tsx — Premium Loading Animation Screen
// ============================================================
'use client'

import React from 'react'

export function LoadingScreen({ message = 'Loading rsdeducation...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground transition-colors duration-200">
      <div className="relative flex flex-col items-center">
        {/* Glowing pulsing brand icon with rotating outer ring */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          {/* Animated spinning gradient ring */}
          <div className="absolute h-20 w-20 animate-spin rounded-2xl border-2 border-transparent border-t-primary border-r-primary/40 [animation-duration:1.2s]" />
          <div className="absolute h-16 w-16 animate-pulse rounded-xl bg-primary/10" />
          
          {/* Center Logo Badge */}
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-md shadow-primary/20">
            R
          </div>
        </div>

        {/* Brand & Loading Label */}
        <div className="mt-5 text-center">
          <p className="text-sm font-bold tracking-tight text-foreground">
            rsd<span className="font-normal text-muted-foreground">education</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground animate-pulse">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}
