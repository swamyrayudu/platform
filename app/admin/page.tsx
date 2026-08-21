'use client'

// ============================================================
// app/admin/page.tsx — Admin Dashboard (client-side)
// ============================================================
// Protected at two layers:
//   1. Frontend: redirects non-admin users to /home
//   2. Backend: /api/admin/dashboard returns 403 for non-admins
// ============================================================

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import TopNav from '@/app/components/home/TopNav'
import { LoadingScreen } from '@/components/ui/loading-screen'
import { ShieldCheck, Users, Activity, Settings } from 'lucide-react'

interface DashboardData {
  message: string
  timestamp: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, loading, logout, logoutAll } = useAuth()
  const [dashboardData, setDashboardData] = React.useState<DashboardData | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Redirect non-admin users
  React.useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
      return
    }
    if (!loading && user && user.role !== 'admin') {
      router.replace('/home')
      return
    }
  }, [user, loading, router])

  // Fetch admin dashboard data from the server (double-checks role)
  React.useEffect(() => {
    if (!user || user.role !== 'admin') return

    async function fetchDashboard() {
      try {
        const res = await fetch('/api/admin/dashboard', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setDashboardData(data)
        } else if (res.status === 403) {
          // Server says not admin — redirect
          router.replace('/home')
        } else {
          setError('Failed to load admin dashboard')
        }
      } catch {
        setError('Network error loading admin dashboard')
      }
    }
    fetchDashboard()
  }, [user, router])

  if (loading) {
    return <LoadingScreen message="Loading admin dashboard..." />
  }

  if (!user || user.role !== 'admin') return null

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Reuse the same top navigation */}
      <TopNav user={user} logout={logout} logoutAll={logoutAll} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Admin Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your platform
              </p>
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Dashboard Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminCard
            icon={Users}
            title="Users"
            description="Manage platform users"
          />
          <AdminCard
            icon={Activity}
            title="Analytics"
            description="View platform analytics"
          />
          <AdminCard
            icon={ShieldCheck}
            title="Security"
            description="Security events & audit log"
          />
          <AdminCard
            icon={Settings}
            title="Settings"
            description="Platform configuration"
          />
        </div>

        {/* Server data confirmation */}
        {dashboardData && (
          <div className="mt-8 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">
              Server verified at {new Date(dashboardData.timestamp).toLocaleString()}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

/* ── Admin Card ── */

function AdminCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
