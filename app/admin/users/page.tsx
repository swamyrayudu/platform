'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Loader2, RefreshCw, Search, Users } from 'lucide-react'
import type { AdminUsersResponse } from '@/types/admin-users'
import { AccessBadge, UserDataTable, UserPagination, userDate } from '@/app/components/admin/UserDataUI'

const INITIAL_FILTERS = { page: 1, pageSize: 25, q: '', access: 'all', role: 'all', medium: 'all', sort: 'newest' }

export default function AdminUsersPage() {
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [draft, setDraft] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [resource, setResource] = useState<{ key: string; data?: AdminUsersResponse; error?: string } | null>(null)
  const params = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]))
  const query = params.toString()
  const key = `${query}:${refresh}`
  const loading = resource?.key !== key
  const data = loading ? undefined : resource?.data
  const error = loading ? undefined : resource?.error

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/admin/users?${query}`, { credentials: 'include', signal: controller.signal })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.error ?? 'Could not load users')
        if (controller.signal.aborted) return
        if (result.pagination.totalPages > 0 && result.pagination.page > result.pagination.totalPages) {
          setFilters((current) => ({ ...current, page: result.pagination.totalPages }))
          return
        }
        setResource({ key, data: result as AdminUsersResponse })
      } catch (err) {
        if (!controller.signal.aborted) setResource({ key, error: err instanceof Error ? err.message : 'Could not load users' })
      }
    }
    void load()
    return () => controller.abort()
  }, [query, key])

  function changeFilter(name: 'access' | 'role' | 'medium' | 'sort', value: string) {
    setFilters((current) => ({ ...current, [name]: value, page: 1 }))
  }

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Users className="h-6 w-6 text-primary" /> Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">Find a user and view their profile, usage, activity and payment history.</p>
      </div>
      <button onClick={() => setRefresh((n) => n + 1)} disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
      </button>
    </div>
    <section className="mb-5 rounded-2xl border border-border bg-card p-4">
      <form onSubmit={(e) => { e.preventDefault(); setFilters((current) => ({ ...current, q: draft.trim(), page: 1 })) }} className="flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input aria-label="Search users by name, email or user ID" maxLength={120} value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Search name, email or user ID…" className="w-full bg-transparent py-2.5 text-sm outline-none" />
        </label>
        <button className="rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground">Search</button>
      </form>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ['access', 'Access', [['all', 'All access'], ['premium', 'Active premium'], ['free', 'Free access'], ['expired', 'Expired premium']]],
          ['role', 'Role', [['all', 'All roles'], ['user', 'Users'], ['admin', 'Admins']]],
          ['medium', 'Medium', [['all', 'All media'], ['english', 'English'], ['telugu', 'Telugu']]],
          ['sort', 'Sort', [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Name A–Z']]],
        ] as const).map(([name, label, options]) => <label key={name} className="text-[11px] font-semibold text-muted-foreground">
          {label}<select value={filters[name]} onChange={(e) => changeFilter(name, e.target.value)} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground">
            {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>)}
      </div>
      <button onClick={() => { setFilters(INITIAL_FILTERS); setDraft('') }} className="mt-3 text-xs font-semibold text-primary hover:underline">Clear filters</button>
    </section>
    {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4" />{error}<button onClick={() => setRefresh((n) => n + 1)} className="ml-auto underline">Retry</button>
    </div>}
    <section className="overflow-hidden rounded-2xl border border-border bg-card" aria-busy={loading}>
      {loading ? <div className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading users…</div>
        : data && <>
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">{data.pagination.total.toLocaleString('en-IN')} matching users <span className="ml-2 text-[11px] font-normal text-muted-foreground">Dates shown in IST</span></div>
          <UserDataTable headings={['User', 'Access', 'Role / medium', 'Joined', 'Last active', 'Details']} empty="No users match these filters."
            rows={data.users.map((user) => ({ id: user.id, cells: [
              <div key="identity" className="min-w-48"><Link href={`/admin/users/${user.id}`} className="font-semibold text-foreground hover:text-primary">{user.name || 'Unnamed user'}</Link><p className="mt-1 break-all text-muted-foreground">{user.email}</p></div>,
              <div key="access"><AccessBadge user={user} /><p className="mt-1 text-[11px] text-muted-foreground">{user.subscriptionPlan ?? 'No subscription'}</p></div>,
              <div key="role" className="capitalize">{user.role}<p className="mt-1 text-muted-foreground">{user.educationMedium ?? 'Not selected'}</p></div>,
              <span key="joined" className="whitespace-nowrap">{userDate(user.createdAt)}</span>,
              <span key="active" className="whitespace-nowrap">{userDate(user.lastActivityAt)}</span>,
              <Link key="view" href={`/admin/users/${user.id}`} className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-primary">View user <ArrowUpRight className="h-3.5 w-3.5" /></Link>,
            ] }))} />
          <UserPagination pagination={data.pagination}
            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
            onPageSizeChange={(pageSize) => setFilters((current) => ({ ...current, pageSize, page: 1 }))} />
        </>}
    </section>
  </main>
}
