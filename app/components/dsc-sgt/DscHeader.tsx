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
  ChevronLeft,
  Menu,
  X,
  User,
  LogOut,
  ShieldAlert,
  LayoutDashboard,
  Home,
  CheckCircle2,
} from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { useAuth } from '@/app/contexts/AuthContext'
import { usePremium } from './PremiumContext'
import { toast } from 'sonner'

export const DSC_NAV_ITEMS = [
  {
    label: 'Overview',
    href: '/dsc-sgt',
    icon: Home,
  },
  {
    label: 'Practice',
    href: '/dsc-sgt/practice',
    icon: BookOpen,
  },
  {
    label: 'Mock Tests',
    href: '/dsc-sgt/mock-tests',
    icon: FileCheck2,
  },
  {
    label: 'Mock Exam',
    href: '/dsc-sgt/mock-exam',
    icon: Timer,
    badge: 'Live',
  },
  {
    label: 'Performance',
    href: '/dsc-sgt/performance',
    icon: BarChart3,
  },
]

export default function DscHeader() {
  const pathname = usePathname()
  const { user, logout, logoutAll } = useAuth()
  const { isPremium, openModal } = usePremium()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Close profile dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = user?.name ? user.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : 'U'

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex h-15 max-w-7xl items-center justify-between px-3.5 sm:px-6 lg:px-8">
        
        {/* Left Side: Brand + Back to Home & Exam Badge */}
        <div className="flex items-center gap-3">
          <Link
            href="/home"
            className="group flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:bg-accent hover:text-foreground shadow-2xs"
            title="Back to All Exams"
          >
            <ChevronLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">All Exams</span>
          </Link>

          <div className="h-5 w-px bg-border/80 hidden sm:block" />

          {/* Exam Tag */}
          <Link href="/dsc-sgt" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground shadow-xs">
              DSC
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold tracking-tight text-foreground">DSC / SGT</span>
                <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.2 text-[9px] font-bold text-primary">AP</span>
              </div>
              <span className="text-[10px] text-muted-foreground hidden md:block">School Grade Teacher Hub</span>
            </div>
          </Link>
        </div>

        {/* Center: Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-1 rounded-2xl border border-border/60 bg-muted/30 p-1">
          {DSC_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/dsc-sgt' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-background text-foreground shadow-xs ring-1 ring-border/50'
                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-red-500/10 px-1.5 py-0.2 text-[9px] font-bold text-red-500 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right Side: Pro CTA + ModeToggle + Profile Menu */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          
          {/* Pro / Premium Trigger Button */}
          {isPremium ? (
            <button
              onClick={() => openModal('header_badge')}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-3 py-1.5 text-xs font-bold text-amber-500 transition hover:border-amber-500/60 shadow-2xs"
            >
              <Crown className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span>PRO ACTIVE</span>
            </button>
          ) : (
            <button
              onClick={() => openModal('header_upgrade')}
              className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:brightness-105 hover:shadow-md active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Get PRO</span>
              <span className="hidden sm:inline-block rounded-md bg-white/20 px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-white">
                50% OFF
              </span>
            </button>
          )}

          {/* Dark / Light Mode Toggle */}
          <ModeToggle />

          {/* Profile Button */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              aria-label="User profile"
              className="relative flex h-8.5 w-8.5 items-center justify-center overflow-hidden rounded-full ring-2 ring-border transition hover:ring-primary/60 focus:outline-none"
            >
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={user.name ?? 'avatar'} className="h-8.5 w-8.5 object-cover" />
              ) : (
                <div className="flex h-8.5 w-8.5 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </div>
              )}
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 top-11 w-64 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-50 zoom-in-95 z-50">
                <div className="border-b border-border px-4 py-3.5 bg-muted/20">
                  <p className="truncate text-xs font-bold text-foreground">{user?.name ?? 'Candidate'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      AP DSC Candidate
                    </span>
                    {isPremium && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                        <Crown className="h-2.5 w-2.5 fill-amber-500" /> Pro
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false)
                      openModal('profile_menu')
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span>{isPremium ? 'Manage Pro Subscription' : 'Upgrade to DSC Pro Pass'}</span>
                  </button>
                  <Link
                    href="/home"
                    onClick={() => setProfileOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>All Exam Categories</span>
                  </Link>
                </div>

                <div className="border-t border-border p-1">
                  <button
                    onClick={() => {
                      setProfileOpen(false)
                      toast.info('Signing out...', { duration: 1500 })
                      logout()
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-border lg:hidden text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Links Bar */}
      {mobileMenuOpen && (
        <div className="border-t border-border/80 bg-background/95 p-3.5 backdrop-blur-md lg:hidden animate-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-2">
            {DSC_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== '/dsc-sgt' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-red-500/10 px-1.5 py-0.2 text-[9px] font-bold text-red-500">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </header>
  )
}
