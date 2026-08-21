// ============================================================
// app/components/home/TopNav.tsx — Sticky header with profile dropdown
// ============================================================
'use client'

import React from 'react'
import { toast } from 'sonner'
import {
  User,
  LogOut,
  ShieldAlert,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'

export interface UserProfile {
  name?: string | null
  email: string
  avatarUrl?: string | null
  role?: string
}

interface TopNavProps {
  user: UserProfile
  logout: () => void
  logoutAll: () => void
}

export default function TopNav({ user, logout, logoutAll }: TopNavProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = (user.name ?? user.email)[0].toUpperCase()

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-xs">
            R
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">
            rsd<span className="font-normal text-muted-foreground">education</span>
          </span>
        </div>

        {/* Right side: ModeToggle + Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3" ref={ref}>

          {/* Dark / Light Mode Toggle */}
          <ModeToggle />

          {/* Profile avatar button */}
          <button
            id="profile-menu-btn"
            onClick={() => setOpen((v) => !v)}
            aria-label="Open profile menu"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-border transition-all hover:ring-primary/60 focus:outline-none"
          >
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt={user.name ?? 'avatar'} className="h-9 w-9 object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center bg-primary text-sm font-bold text-primary-foreground">
                {initials}
              </div>
            )}
          </button>

          {/* Dropdown menu */}
          {open && (
            <ProfileDropdown
              user={user}
              initials={initials}
              onClose={() => setOpen(false)}
              logout={logout}
              logoutAll={logoutAll}
              isAdmin={user.role === 'admin'}
            />
          )}
        </div>
      </div>
    </header>
  )
}

/* ── Profile Dropdown ── */

function ProfileDropdown({
  user,
  initials,
  onClose,
  logout,
  logoutAll,
  isAdmin,
}: {
  user: UserProfile
  initials: string
  onClose: () => void
  logout: () => void
  logoutAll: () => void
  isAdmin: boolean
}) {
  return (
    <div className="absolute right-4 top-[3.75rem] w-64 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-50 zoom-in-95 sm:right-6 lg:right-8">

      {/* User info */}
      <div className="border-b border-border px-4 py-4 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 overflow-hidden rounded-full ring-2 ring-border">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-11 w-11 object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center bg-primary text-base font-bold text-primary-foreground">
                {initials}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{user.name ?? '—'}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div className="p-1.5">
        <DDItem
          icon={User}
          label="My Profile"
          onClick={() => {
            onClose()
            toast.info('Profile Section', { description: 'Profile details and account settings.' })
          }}
        />
        {isAdmin && (
          <DDItem
            icon={LayoutDashboard}
            label="Admin Dashboard"
            onClick={() => {
              onClose()
              window.location.href = '/admin'
            }}
          />
        )}
      </div>

      {/* Sign-out section */}
      <div className="border-t border-border p-1.5">
        <DDItem
          icon={LogOut}
          label="Sign out"
          onClick={() => {
            onClose()
            toast.info('Signing out...', { duration: 1500 })
            logout()
          }}
        />
        <DDItem
          icon={ShieldAlert}
          label="Sign out all devices"
          red
          onClick={() => {
            onClose()
            toast.info('Signing out from all devices...', { duration: 2000 })
            logoutAll()
          }}
        />
      </div>
    </div>
  )
}

/* ── Dropdown Item ── */

function DDItem({
  icon: Icon,
  label,
  onClick,
  red,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  red?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        red
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  )
}
