// ============================================================
// app/components/landing/BloomField.tsx — Decorative hero backdrop
// ============================================================
// The reference design uses a photograph of a lavender meadow under a pale
// sky. This rebuilds that atmosphere without an image asset: a radial "sky"
// gradient behind three scattered bands of blooms that recede into it.
//
// The scatter is seeded, so the server and client draw the identical field
// and the markup hydrates cleanly. Tiling a gradient was the obvious
// alternative but reads as a halftone grid — real meadows are not on a grid.
'use client'

import React from 'react'

/** mulberry32 — small deterministic PRNG, so the field never shifts on hydrate. */
function seededRandom(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const VIEW_W = 1200
const VIEW_H = 420

interface Band {
  seed: number
  count: number
  /** Bloom radius range, in viewBox units. */
  minR: number
  maxR: number
  /** How far up from the bottom this band reaches. */
  spread: number
  blur: number
  opacity: number
  tone: string
}

// Far to near: bigger, softer and paler at the back; smaller, sharper and
// deeper at the front. Density rises toward the bottom in every band.
const BANDS: Band[] = [
  { seed: 9137, count: 120, minR: 12, maxR: 28, spread: 232, blur: 9, opacity: 0.55, tone: 'var(--meadow-back)' },
  { seed: 4421, count: 165, minR: 8, maxR: 18, spread: 162, blur: 4.5, opacity: 0.68, tone: 'var(--meadow-mid)' },
  { seed: 7703, count: 210, minR: 4, maxR: 12, spread: 104, blur: 1.6, opacity: 0.85, tone: 'var(--meadow-front)' },
]

function bloomsFor(band: Band) {
  const rand = seededRandom(band.seed)
  return Array.from({ length: band.count }, (_, i) => {
    // Square the vertical sample so blooms bunch up toward the ground.
    const depth = rand() ** 2
    return {
      key: i,
      cx: rand() * (VIEW_W + 80) - 40,
      cy: VIEW_H - depth * band.spread,
      r: band.minR + rand() * (band.maxR - band.minR),
    }
  })
}

interface BloomFieldProps {
  /**
   * Half-height banner treatment. The discs and the field are sized for a
   * 420px landing hero; at the dashboard's 200px they swallow the heading.
   */
  compact?: boolean
  className?: string
}

export default function BloomField({ className = '', compact = false }: BloomFieldProps) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* Sky */}
      <div className="bloom-sky absolute inset-0" />

      {/* Two glass discs echoing the reference's floating coins, half-sunk in the field */}
      <div
        className={`absolute -left-10 bottom-[16%] rounded-full bg-white/25 ring-1 ring-inset ring-white/50 backdrop-blur-[2px] ${
          compact ? 'h-20 w-20 sm:h-28 sm:w-28' : 'h-32 w-32 sm:h-48 sm:w-48'
        }`}
      />
      <div
        className={`absolute -right-12 bottom-[22%] rounded-full bg-white/20 ring-1 ring-inset ring-white/40 backdrop-blur-[2px] ${
          compact ? 'h-24 w-24 sm:h-32 sm:w-32' : 'h-36 w-36 sm:h-56 sm:w-56'
        }`}
      />

      {/* Meadow */}
      <svg
        className={`absolute inset-x-0 bottom-0 w-full ${compact ? 'h-[52%]' : 'h-[62%]'}`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {BANDS.map((band, i) => (
            <filter key={i} id={`bloom-soften-${i}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={band.blur} />
            </filter>
          ))}

          {/* Dissolve the top of the field into the sky. A mask is read by
              luminance, so the stops must be white — black would hide the
              field entirely no matter what opacity it carried. */}
          <linearGradient id="bloom-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" />
            <stop offset="45%" stopColor="#8c8c8c" />
            <stop offset="80%" stopColor="#fff" />
          </linearGradient>
          <mask id="bloom-mask">
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="url(#bloom-fade)" />
          </mask>
        </defs>

        <g mask="url(#bloom-mask)">
          {BANDS.map((band, i) => (
            // fill goes through `style`, not the presentation attribute —
            // var() only resolves in a CSS property.
            <g
              key={i}
              filter={`url(#bloom-soften-${i})`}
              style={{ fill: band.tone }}
              opacity={band.opacity}
            >
              {bloomsFor(band).map((b) => (
                <circle key={b.key} cx={b.cx} cy={b.cy} r={b.r} />
              ))}
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
