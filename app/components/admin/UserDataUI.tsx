'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { AdminUser, Pagination } from '@/types/admin-users'

export function userDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  })
}

export function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount / 100) }
  catch { return `${currency} ${(amount / 100).toFixed(2)}` }
}

export function duration(seconds: number) {
  const n = Math.max(0, Number(seconds) || 0)
  return n >= 3600 ? `${Math.floor(n / 3600)}h ${Math.floor(n % 3600 / 60)}m` : `${Math.floor(n / 60)}m ${Math.floor(n % 60)}s`
}

export function StatusBadge({ value }: { value: string }) {
  const positive = ['PAID', 'completed', 'submitted', 'Premium active', 'Correct'].includes(value)
  const negative = ['FAILED', 'expired', 'Premium expired', 'Incorrect'].includes(value)
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${positive
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : negative ? 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
      : 'border-border bg-muted text-muted-foreground'}`}>{value.replaceAll('_', ' ')}</span>
}

export function AccessBadge({ user }: { user: AdminUser }) {
  const expired = user.accountType === 'PREMIUM' && (user.subscriptionStatus === 'EXPIRED' ||
    (user.subscriptionExpiresAt !== null && new Date(user.subscriptionExpiresAt) <= new Date()))
  return <StatusBadge value={user.isPremium ? 'Premium active' : expired ? 'Premium expired' : 'Free access'} />
}

export function UserPagination({ pagination, disabled = false, onPageChange, onPageSizeChange }: {
  pagination: Pagination; disabled?: boolean; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void
}) {
  const { page, pageSize, total, totalPages } = pagination
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-xs">
    <span className="text-muted-foreground">{total === 0 ? '0 records' : `${((page - 1) * pageSize + 1).toLocaleString('en-IN')}–${Math.min(page * pageSize, total).toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`}</span>
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-muted-foreground">Rows
        <select value={pageSize} disabled={disabled} onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground">
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <button aria-label="Previous page" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}
        className="rounded-lg border border-border p-2 hover:bg-accent disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
      <span>Page {totalPages ? page : 0} / {totalPages}</span>
      <button aria-label="Next page" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}
        className="rounded-lg border border-border p-2 hover:bg-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
    </div>
  </div>
}

export function UserDataTable({ headings, rows, empty }: { headings: string[]; rows: { id: string; cells: ReactNode[] }[]; empty: string }) {
  return <div className="overflow-x-auto">
    <table className="w-full text-left text-xs">
      <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr>{headings.map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{heading}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((row) => <tr key={row.id} className="align-top hover:bg-accent/20">
          {row.cells.map((cell, index) => <td key={index} className="px-4 py-4">{cell}</td>)}
        </tr>)}
        {rows.length === 0 && <tr><td colSpan={headings.length} className="p-10 text-center text-muted-foreground">{empty}</td></tr>}
      </tbody>
    </table>
  </div>
}
