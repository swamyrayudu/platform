'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  FileCheck2,
  Timer,
  BarChart3,
  Sparkles,
  Crown,
  Menu,
  X,
  LogOut,
  ShieldAlert,
  Home,
  User,
} from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { useAuth } from '@/app/contexts/AuthContext'
import { usePremium, type DevTierOverride } from './PremiumContext'
import { toast } from 'sonner'

export const DSC_NAV_ITEMS = [
  { label: 'Overview', href: '/dsc-sgt', icon: Home },
  { label: 'Practice', href: '/dsc-sgt/practice', icon: BookOpen },
  { label: 'Mock Tests', href: '/dsc-sgt/mock-tests', icon: FileCheck2 },
  { label: 'Mock Exam', href: '/dsc-sgt/mock-exam', icon: Timer, badge: 'Live' },
  { label: 'Performance', href: '/dsc-sgt/performance', icon: BarChart3 },
]

function isItemActive(pathname: string, href: string) {
  return href === '/dsc-sgt' ? pathname === href : pathname.startsWith(href)
}

export default function DscHeader() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isPremium, openModal, devTierOverride, setDevTierOverride } = usePremium()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Close the profile dropdown on an outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Navigating dismisses both menus. Each link already closes on tap; this
  // covers the routes we do not control — browser back/forward, a redirect.
  // Adjusting during render rather than in an effect avoids the extra pass.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setMobileMenuOpen(false)
    setProfileOpen(false)
  }

  // The sheet is a full-screen overlay on small screens, so stop the page
  // behind it from scrolling underneath.
  useEffect(() => {
    if (!mobileMenuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileMenuOpen])

  const initials = user?.name
    ? user.name[0].toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : 'U'

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/80 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">

        {/* ── Left: exam identity ── */}
        <Link href="/dsc-sgt" className="flex min-w-0 shrink items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-[10px] font-semibold tracking-tight text-primary-foreground">
            DSC
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                DSC / SGT
              </span>
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-secondary-foreground">
                AP
              </span>
            </div>
            <span className="hidden truncate text-[10px] text-muted-foreground md:block">
              School Grade Teacher Hub
            </span>
          </div>
        </Link>

        {/* ── Center: desktop nav ── */}
        <nav className="hidden items-center gap-0.5 rounded-full border border-border bg-muted/40 p-1 lg:flex">
          {DSC_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isItemActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
                <span>{item.label}</span>
                {item.badge && <LiveDot />}
              </Link>
            )
          })}
        </nav>

        {/* ── Right: actions ── */}
        <div className="flex shrink-0 items-center gap-2">

          {/* Premium state. On small screens the upsell moves into the sheet. */}
          {isPremium ? (
            <button
              onClick={() => openModal('header_badge')}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-700 transition hover:border-amber-500/60 dark:text-amber-400"
            >
              <Crown className="h-3.5 w-3.5 fill-current" />
              <span className="hidden sm:inline">Pro active</span>
            </button>
          ) : (
            <button
              onClick={() => openModal('header_upgrade')}
              className="bloom-pill bloom-pill-dark hidden px-4 py-2 text-[12px] sm:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.7} />
              <span>Get Pro</span>
            </button>
          )}

          <div className="hidden sm:block">
            <ModeToggle />
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="User profile"
              aria-expanded={profileOpen}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-1 ring-border transition hover:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.name ?? 'avatar'}
                  className="h-9 w-9 object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
              )}
            </button>

            {profileOpen && (
              <ProfileMenu
                user={user}
                isPremium={isPremium}
                openModal={openModal}
                devTierOverride={devTierOverride}
                setDevTierOverride={setDevTierOverride}
                onClose={() => setProfileOpen(false)}
                logout={logout}
              />
            )}
          </div>

          {/* Sheet trigger */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Mobile sheet ── */}
      {mobileMenuOpen && (
        <>
          {/* Offsets track the header height, which grows at sm */}
          <div
            className="fixed inset-0 top-14 z-30 bg-bloom-ink/20 backdrop-blur-[2px] sm:top-16 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="absolute inset-x-0 top-full z-40 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-border bg-card p-4 shadow-xl animate-in slide-in-from-top-2 sm:max-h-[calc(100dvh-4rem)] lg:hidden">
            <nav className="flex flex-col gap-1">
              {DSC_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = isItemActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                    <span>{item.label}</span>
                    {item.badge && <span className="ml-auto"><LiveDot /></span>}
                  </Link>
                )
              })}
            </nav>

            {/* Actions that are hidden from the bar on small screens */}
            <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
              {!isPremium && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    openModal('header_upgrade')
                  }}
                  className="bloom-pill bloom-pill-dark min-h-11 flex-1 text-[13px]"
                >
                  <Sparkles className="h-4 w-4" strokeWidth={1.7} />
                  <span>Get Pro</span>
                </button>
              )}
              <ModeToggle />
            </div>
          </div>
        </>
      )}
    </header>
  )
}

/* ── A quiet "happening now" marker, on palette ── */

function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0" title="Live">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bloom-violet opacity-70" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-bloom-violet" />
    </span>
  )
}

/* ── Profile dropdown ── */

function ProfileMenu({
  user,
  isPremium,
  openModal,
  devTierOverride,
  setDevTierOverride,
  onClose,
  logout,
}: {
  user: ReturnType<typeof useAuth>['user']
  isPremium: boolean
  openModal: (source?: string) => void
  devTierOverride: DevTierOverride
  setDevTierOverride: (tier: DevTierOverride) => void
  onClose: () => void
  logout: () => void
}) {
  return (
    <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-50 zoom-in-95">

      {/* Identity */}
      <div className="border-b border-border px-4 py-3.5">
        <p className="truncate text-sm font-medium text-foreground">{user?.name ?? 'Candidate'}</p>
        <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            AP DSC Candidate
          </span>
          {isPremium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
              <Crown className="h-2.5 w-2.5 fill-current" /> Pro
            </span>
          )}
        </div>
      </div>

      <div className="p-1.5">
        <Link
          href="/dsc-sgt/profile"
          onClick={onClose}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <User className="h-4 w-4 shrink-0" strokeWidth={1.7} />
          <span>My profile</span>
        </Link>

        <button
          onClick={() => {
            onClose()
            openModal('profile_menu')
          }}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
        >
          <Crown className="h-4 w-4 shrink-0" strokeWidth={1.7} />
          <span>{isPremium ? 'Manage Pro subscription' : 'Upgrade to DSC Pro Pass'}</span>
        </button>

        {user?.role === 'admin' && (
          <Link
            href="/admin"
            onClick={onClose}
            className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" strokeWidth={1.7} />
            <span>Admin Dashboard</span>
          </Link>
        )}

        {/* Admin-only: test Free vs Pro without touching the database */}
        {user?.role === 'admin' && (
          <div className="mx-1 my-1.5 rounded-xl border border-border bg-muted/40 p-2">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
              <span>Subscription testing</span>
              <span className="uppercase text-foreground">{devTierOverride}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(['auto', 'free', 'pro'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setDevTierOverride(tier)}
                  className={`rounded-lg px-1.5 py-1 text-[10px] font-medium capitalize transition ${
                    devTierOverride === tier
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-foreground hover:bg-accent'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Signing out is the only way back to the exam list */}
      <div className="border-t border-border p-1.5">
        <button
          onClick={() => {
            onClose()
            toast.info('Signing out...', { duration: 1500 })
            logout()
          }}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.7} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )
}
