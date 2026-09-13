// ============================================================
// app/components/dsc-sgt/CopyGuard.tsx — Discourage copying content
// ============================================================
// For the post-submission review screens, where questions, correct answers
// and explanations are on show. Text cannot be selected, and copy / cut /
// right-click / drag are swallowed.
//
// This is a deterrent, not protection. The content still reaches the browser,
// so anyone determined can read it from devtools, the network tab or a
// screenshot. Treat it as friction against casual copying — content that must
// not leave the server cannot be sent to the client in the first place.
//
// Two ways to apply it:
//   <main className={`… ${COPY_GUARD_CLASS}`} {...copyGuardProps}>
//   <CopyGuard>…</CopyGuard>
//
// The class is kept out of `copyGuardProps` deliberately: spreading a props
// object that carries className onto an element that already has one silently
// discards the original.
// ============================================================
'use client'

import React from 'react'

const block = (e: React.SyntheticEvent) => e.preventDefault()

/** Removes the selection that copy and cut would otherwise act on. */
export const COPY_GUARD_CLASS = 'select-none'

/**
 * Spread onto the element enclosing the protected content. Copy, cut,
 * contextmenu and dragstart all bubble, so one set of handlers covers every
 * descendant. Pair it with COPY_GUARD_CLASS.
 */
export const copyGuardProps = {
  onCopy: block,
  onCut: block,
  onContextMenu: block,
  onDragStart: block,
} as const

interface CopyGuardProps {
  children: React.ReactNode
  className?: string
}

export default function CopyGuard({ children, className = '' }: CopyGuardProps) {
  return (
    <div className={`${COPY_GUARD_CLASS} ${className}`} {...copyGuardProps}>
      {children}
    </div>
  )
}
