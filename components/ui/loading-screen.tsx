// ============================================================
// components/ui/loading-screen.tsx — Premium Loading Animation Screen
// ============================================================
'use client'

import React from 'react'

export function LoadingScreen({ message = 'Loading rsdeducation...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground transition-colors duration-200">
      <div className="relative flex flex-col items-center">
        {/* Sparkle mark inside a slowly rotating ring */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute h-20 w-20 animate-spin rounded-full border border-transparent border-t-primary border-r-primary/30 [animation-duration:1.4s]" />
          <div className="absolute h-14 w-14 animate-pulse rounded-full bg-secondary" />

          <svg
            className="relative h-7 w-7 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M12 1.5c.55 4.6 2.4 7.45 6.6 8.4l3.9.9-3.9.9c-4.2.95-6.05 3.8-6.6 8.4-.55-4.6-2.4-7.45-6.6-8.4L1.5 10.8l4.4-.9C10.1 8.95 11.45 6.1 12 1.5Z"
              fill="currentColor"
            />
          </svg>
        </div>

        {/* Brand & loading label */}
        <div className="mt-5 text-center">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            rsd<span className="font-normal text-muted-foreground">education</span>
          </p>
          <p className="mt-1.5 animate-pulse text-xs text-muted-foreground">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}
