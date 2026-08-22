'use client'

// ============================================================
// app/components/dsc-sgt/practice/setup/MediumSelector.tsx
// ============================================================

import React from 'react'
import type { PracticeMedium } from '@/types/practice'

interface MediumSelectorProps {
  medium: PracticeMedium
  onSelectMedium: (medium: PracticeMedium) => void
}

export default function MediumSelector({ medium, onSelectMedium }: MediumSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-2xl border border-border/60">
      <button
        type="button"
        onClick={() => onSelectMedium('english')}
        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
          medium === 'english'
            ? 'bg-card text-foreground shadow-sm border border-border'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <span>🇬🇧</span>
        <span>English Medium</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectMedium('telugu')}
        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer ${
          medium === 'telugu'
            ? 'bg-card text-foreground shadow-sm border border-border'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <span>🇮🇳</span>
        <span>తెలుగు మీడియం</span>
      </button>
    </div>
  )
}
