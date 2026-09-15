'use client'

// ============================================================
// app/admin/layout.tsx — Admin shell and navigation
// ============================================================
// The admin used to be one 1,300-line page with six unrelated jobs stacked in
// a single scroll — user stats, revenue, plan pricing, the question bank,
// recent payments and the module generator — plus four header buttons to the
// tools that already had their own routes. Finding anything meant scrolling
// past everything else, and on a phone it was unusable.
//
// Each job now has a route, and this is the frame they share. The auth check
// lives here too rather than being repeated at the top of every page.
//
// The nav is a horizontally scrolling strip of pills below sm and a wrapped
// row above it. Not a hamburger and not a sidebar: there are eight
// destinations, they are all short, and an admin on a phone should be able to
// see what exists without opening anything.
// ============================================================

import React, { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  CreditCard,
  Database,
  FileCheck2,
  Flag,
  Plus,
  Replace,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '@/app/contexts/AuthContext'
import { LoadingScreen } from '@/components/ui/loading-screen'
import TopNav from '@/app/components/home/TopNav'

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/question-bank', label: 'Question bank', icon: Database },
  { href: '/admin/mock-tests', label: 'Mock modules', icon: FileCheck2 },
  { href: '/admin/module-questions', label: 'Module questions', icon: Replace },
  { href: '/admin/bulk-update', label: 'Bulk update', icon: FileSpreadsheet },
  { href: '/admin/import-questions', label: 'Import', icon: Plus },
  { href: '/admin/question-feedback', label: 'Reports', icon: Flag },
] as const

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === href : pathname.startsWith(href)
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, logout, logoutAll } = useAuth()

  // One check for the whole section instead of the same four lines at the top
  // of every admin page. Every admin API enforces this again server-side —
  // this only decides whether the shell renders.
  useEffect(() => {
    if (loading) return
    if (!user) router.replace('/')
    else if (user.role !== 'admin') router.replace('/dsc-sgt')
  }, [user, loading, router])

  if (loading) return <LoadingScreen message="Checking access…" />
  if (!user || user.role !== 'admin') return null

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <TopNav user={user} logout={logout} logoutAll={logoutAll} />

      {/* ── Admin identity + nav ── */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h1 className="text-base font-bold tracking-tight">Admin</h1>
            <span className="rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-destructive">
              Restricted
            </span>
          </div>

          {/* -mx-4 + px-4 lets the strip bleed to the screen edge on a phone,
              so a half-visible pill signals there is more to scroll to. */}
          <nav
            aria-label="Admin sections"
            className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition ${
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {children}
    </div>
  )
}
