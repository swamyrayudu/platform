// ============================================================
// app/components/home/HeroBanner.tsx — Header banner with illustration
// ============================================================
'use client'

import React from 'react'

export default function HeroBanner() {
  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-xs transition-colors sm:p-8 lg:p-9">
      <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
        
        {/* Left: Heading & description */}
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[2rem] lg:leading-tight">
            Choose Your Exam
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Select an exam category and start your preparation journey with{' '}
            <span className="font-semibold text-primary">rsdeducation</span>.
          </p>
        </div>

        {/* Right: 3D-styled SVG Education Illustration */}
        <div className="flex shrink-0 items-center justify-center">
          <div className="relative flex h-28 w-44 items-center justify-center sm:h-32 sm:w-52">
            {/* Soft decorative glow */}
            <div className="absolute h-20 w-36 rounded-full bg-primary/10 blur-2xl" />

            <svg
              className="relative h-28 w-auto drop-shadow-md sm:h-32"
              viewBox="0 0 240 180"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Bottom Book */}
              <path
                d="M40 135C40 130 75 125 120 125C165 125 200 130 200 135V148C200 153 165 158 120 158C75 158 40 153 40 148V135Z"
                fill="#3B82F6"
                fillOpacity="0.85"
              />
              <path
                d="M40 132C40 127 75 122 120 122C165 122 200 127 200 132V136C200 141 165 146 120 146C75 146 40 141 40 136V132Z"
                fill="#60A5FA"
              />
              <path
                d="M40 132C40 127 75 122 120 122C165 122 200 127 200 132L195 130C160 125 80 125 45 130L40 132Z"
                fill="#93C5FD"
              />

              {/* Middle Book (Emerald) */}
              <path
                d="M48 115C48 110 80 106 120 106C160 106 192 110 192 115V125C192 130 160 134 120 134C80 134 48 130 48 125V115Z"
                fill="#10B981"
                fillOpacity="0.9"
              />
              <path
                d="M48 112C48 107 80 103 120 103C160 103 192 107 192 112V116C192 121 160 125 120 125C80 125 48 121 48 116V112Z"
                fill="#34D399"
              />

              {/* Graduation Cap Top Diamond */}
              <path
                d="M130 42L185 62L130 82L75 62L130 42Z"
                fill="#2563EB"
              />
              <path
                d="M130 42L185 62L130 68L75 62L130 42Z"
                fill="#3B82F6"
              />

              {/* Graduation Cap Skull Base */}
              <path
                d="M95 69V88C95 98 110 105 130 105C150 105 165 98 165 88V69L130 82L95 69Z"
                fill="#1D4ED8"
              />

              {/* Tassel & Ribbon */}
              <path
                d="M130 62C145 66 155 76 158 88"
                stroke="#F59E0B"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="158" cy="92" r="3.5" fill="#F59E0B" />
              <path d="M158 95V106" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />

              {/* Checklist Clipboard */}
              <rect x="160" y="55" width="44" height="60" rx="6" fill="#EDE9FE" />
              <rect x="174" y="50" width="16" height="8" rx="3" fill="#8B5CF6" />
              {/* Checkmarks */}
              <path d="M168 68L171 71L177 65" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="181" y1="68" x2="196" y2="68" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />

              <path d="M168 82L171 85L177 79" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="181" y1="82" x2="196" y2="82" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />

              <path d="M168 96L171 99L177 93" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="181" y1="96" x2="192" y2="96" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />

              {/* Plant Pot */}
              <path d="M148 140L152 155H166L170 140H148Z" fill="#6366F1" />
              <path d="M159 130C155 133 154 138 159 141C164 138 163 133 159 130Z" fill="#10B981" />
              <path d="M152 134C149 137 150 141 154 142C157 140 156 136 152 134Z" fill="#34D399" />
              <path d="M166 134C169 137 168 141 164 142C161 140 162 136 166 134Z" fill="#059669" />
            </svg>
          </div>
        </div>

      </div>
    </div>
  )
}
