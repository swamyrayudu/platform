'use client'

// ============================================================
// app/components/dsc-sgt/DscBottomNav.tsx — Phone navigation
// ============================================================
// Replaces the hamburger sheet.
//
// A hamburger hides every destination behind an icon that has to be learned,
// and candidates were not finding it — the app looked like it had one screen.
// A bottom bar shows the whole app at once, always, one thumb-reach away. It
// is what LeetCode and every other study app on a phone does, and it needs no
// explaining.
//
// TWO ROUTES ARE DELIBERATELY ABSENT:
//   /dsc-sgt/mock-exam    not a destination — it is a running exam, entered
//                         from a specific test and left through the exit
//                         dialog. Offering it as a tab invites a candidate to
//                         wander into whatever attempt happens to be open.
//   /dsc-sgt/mock-result  reached from a finished attempt, never browsed to.
//
// The bar hides itself during an exam so it cannot become a way out that
// skips the save prompt.
// ============================================================

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, FileCheck2, BarChart3, Home, LayoutGrid, ChevronRight } from 'lucide-react'
import { DSC_MORE_ITEMS } from './DscHeader'

/**
 * Height of the bar, as a Tailwind-usable length.
 *
 * Exported because anything else pinned to the bottom of the viewport has to
 * sit above it, and a second copy of "3.5rem" in another file is a bug waiting
 * to happen — it already was one: the practice Start button sat underneath
 * this bar and could not be reached.
 */
export const BOTTOM_NAV_OFFSET = 'calc(3.5rem + env(safe-area-inset-bottom))'

// A page that takes over the screen — a running practice session — hides the
// bar rather than stacking a second one under its own controls. Pathname alone
// cannot decide this: practice setup, the exam and the results are all
// /dsc-sgt/practice, told apart only by component state.
const HideContext = createContext<((hidden: boolean) => void) | null>(null)

/** Hide the bar for as long as the calling component is mounted. */
export function useHideBottomNav(active = true): void {
  const setHidden = useContext(HideContext)
  useEffect(() => {
    if (!setHidden || !active) return
    setHidden(true)
    return () => setHidden(false)
  }, [setHidden, active])
}

/** Everything a candidate should be able to reach at any moment, plus "More" (DSC_MORE_ITEMS). */
export const DSC_BOTTOM_NAV_ITEMS = [
  { label: 'Home', href: '/dsc-sgt', icon: Home },
  { label: 'Practice', href: '/dsc-sgt/practice', icon: BookOpen },
  { label: 'Mock Tests', href: '/dsc-sgt/mock-tests', icon: FileCheck2 },
  { label: 'Progress', href: '/dsc-sgt/performance', icon: BarChart3 },
] as const

/** Routes that take over the screen and must not show the bar. */
const HIDDEN_ON = ['/dsc-sgt/mock-exam']

function isActive(pathname: string, href: string) {
  return href === '/dsc-sgt' ? pathname === href : pathname.startsWith(href)
}

export function BottomNavProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [hidden, setHidden] = useState(false)
  // Memoised so a consumer's effect does not re-run on every parent render.
  const value = useMemo(() => setHidden, [])

  const visible = !hidden && !HIDDEN_ON.some((route) => pathname.startsWith(route))

  return (
    <HideContext.Provider value={value}>
      {/* The spacer belongs to the bar, not to the layout. A fixed 56px of
          padding applied regardless would push a full-screen page — the mock
          exam is h-screen — past the viewport and give it a phantom scroll. */}
      <div className={visible ? 'flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0' : 'flex-1'}>
        {children}
      </div>
      {visible && <DscBottomNav pathname={pathname} />}
    </HideContext.Provider>
  )
}

const tabClass = (active: boolean) =>
  // min-h-14 keeps every tab a comfortable thumb target.
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
    active ? 'text-primary' : 'text-muted-foreground'
  }`

function DscBottomNav({ pathname }: { pathname: string }) {
  // "More" holds the pages that do not fit on the bar (the header's More menu
  // on desktop, the More tab in the mobile app): a panel just above the bar.
  const [moreOpen, setMoreOpen] = useState(false)
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setMoreOpen(false)
  }
  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const moreActive = moreOpen || DSC_MORE_ITEMS.some((item) => isActive(pathname, item.href))

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close more pages"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/30 animate-in fade-in-0"
          />
          <div
            id="dsc-more-pages"
            role="menu"
            aria-label="More pages"
            className="absolute inset-x-0 mx-auto max-w-lg rounded-t-3xl border border-b-0 border-border bg-popover p-3 pb-4 text-popover-foreground shadow-2xl animate-in slide-in-from-bottom-4"
            style={{ bottom: BOTTOM_NAV_OFFSET }}
          >
            <p className="px-2 pb-2 pt-1 text-sm font-semibold text-foreground">More</p>
            <div className="space-y-1">
              {DSC_MORE_ITEMS.map(({ label, detail, href, icon: Icon }) => {
                const active = isActive(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    role="menuitem"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 transition-colors ${
                      active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-foreground">{label}</span>
                      <span className="block text-[11px] text-muted-foreground">{detail}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Main"
        // pb from the safe-area inset so the bar clears the iOS home indicator
        // instead of sitting under it.
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {DSC_BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = !moreOpen && isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMoreOpen(false)}
                className={tabClass(active)}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.2 : 1.7} aria-hidden />
                <span className={`text-[11px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-controls="dsc-more-pages"
            className={tabClass(moreActive)}
          >
            <LayoutGrid className="h-5 w-5 shrink-0" strokeWidth={moreActive ? 2.2 : 1.7} aria-hidden />
            <span className={`text-[11px] leading-none ${moreActive ? 'font-semibold' : 'font-medium'}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
