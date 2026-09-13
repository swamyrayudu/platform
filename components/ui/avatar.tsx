// ============================================================
// components/ui/avatar.tsx — Profile picture with a real fallback
// ============================================================
// Google profile photos fail for reasons the app cannot control: a privacy
// extension blocking lh3.googleusercontent.com, rate limiting, a revoked
// photo, or simply being offline. Previously each place rendered a bare <img>
// with the user's name as alt text, so a failure put that name — unstyled and
// unclipped — inside a small round frame, overflowing it.
//
// This renders the initials placeholder instead, which every one of those
// call sites already had for users with no photo at all.
// ============================================================
'use client'

import React, { useState } from 'react'

interface AvatarProps {
  src?: string | null
  /** Used for the initial, and read by assistive tech via the label. */
  name?: string | null
  email?: string | null
  /** Rendered size in pixels; the frame is square. */
  size?: number
  className?: string
}

function initialFrom(name?: string | null, email?: string | null): string {
  const source = (name ?? email ?? '').trim()
  return source ? source[0]!.toUpperCase() : 'U'
}

export function Avatar({ src, name, email, size = 36, className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false)

  // A new photo deserves a fresh attempt, otherwise one earlier failure would
  // keep the placeholder forever. Done during render rather than in an effect:
  // an effect keyed on [src] also runs once on mount, and a cached image that
  // fails before that first flush would have its error cleared again.
  const [lastSrc, setLastSrc] = useState(src)
  if (lastSrc !== src) {
    setLastSrc(src)
    setFailed(false)
  }

  const dimension = { width: size, height: size }
  const showImage = Boolean(src) && !failed

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary ${className}`}
      style={dimension}
      // The name is always rendered as text beside these, so the picture adds
      // nothing for a screen reader.
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          // Empty on purpose: a failed image must not paint the user's name
          // across a 36px circle. The fallback below covers that case.
          alt=""
          width={size}
          height={size}
          // Google's CDN rejects some referrers; sending none is the
          // documented way to keep these loading.
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-semibold text-primary-foreground"
          style={{ fontSize: Math.max(11, Math.round(size * 0.4)) }}
        >
          {initialFrom(name, email)}
        </span>
      )}
    </span>
  )
}

export default Avatar
