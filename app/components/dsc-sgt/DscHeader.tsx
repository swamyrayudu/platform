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
  LogOut,
  ShieldAlert,
  Home,
  User,
} from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { useAuth } from '@/app/contexts/AuthContext'
import { usePremium } from './PremiumContext'
import { Avatar } from '@/components/ui/avatar'
import { toast } from 'sonner'

export const DSC_NAV_ITEMS = [
  { label: 'Overview', href: '/dsc-sgt', icon: Home },
  { label: 'Practice', href: '/dsc-sgt/practice', icon: BookOpen },
  { label: 'Mock Tests', href: '/dsc-sgt/mock-tests', icon: FileCheck2 },
  { label: 'Mock Exam', href: '/dsc-sgt/mock-exam', icon: Timer },
  { label: 'Performance', href: '/dsc-sgt/performance', icon: BarChart3 },
]

function isItemActive(pathname: string, href: string) {
  return href === '/dsc-sgt' ? pathname === href : pathname.startsWith(href)
}

export default function DscHeader() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { isPremium, openModal } = usePremium()
  const [profileOpen, setProfileOpen] = useState(false)
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

  // Navigating dismisses the profile menu. It closes on tap already; this
  // covers the routes we do not control — browser back/forward, a redirect.
  // Adjusting during render rather than in an effect avoids the extra pass.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setProfileOpen(false)
  }

  // A running exam owns the whole screen. The app header costs 56px of it and
  // offers nothing a candidate mid-paper can use — the exam has its own bar
  // with the timer, the palette and the way out.
  if (pathname.startsWith('/dsc-sgt/mock-exam')) return null


  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/80 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">

        {/* ── Left: exam identity ── */}
        <Link href="/dsc-sgt" className="flex min-w-0 shrink items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-[11px] font-semibold tracking-tight text-primary-foreground">
            DSC
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                DSC / SGT
              </span>
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
                AP
              </span>
            </div>
            <span className="hidden truncate text-[11px] text-muted-foreground md:block">
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
              className="bloom-pill bloom-pill-dark inline-flex px-3 py-2 text-[12px] sm:px-4"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.7} />
              {/* Label drops on the narrowest screens; the icon carries it. */}
              <span className="hidden sm:inline">Get Pro</span>
            </button>
          )}

          {/* Always visible now. It used to live only inside the hamburger
              sheet, which is gone. */}
          <ModeToggle />

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="User profile"
              aria-expanded={profileOpen}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-1 ring-border transition hover:ring-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar src={user?.avatarUrl} name={user?.name} email={user?.email} size={36} />
            </button>

            {profileOpen && (
              <ProfileMenu
                user={user}
                isPremium={isPremium}
                openModal={openModal}
                onClose={() => setProfileOpen(false)}
                logout={logout}
              />
            )}
          </div>

        </div>
      </div>

    </header>
  )
}

/* ── Profile dropdown ── */

function ProfileMenu({
  user,
  isPremium,
  openModal,
  onClose,
  logout,
}: {
  user: ReturnType<typeof useAuth>['user']
  isPremium: boolean
  openModal: (source?: string) => void
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
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            AP DSC Candidate
          </span>
          {isPremium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
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
