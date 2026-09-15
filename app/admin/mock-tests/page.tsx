'use client'

// ============================================================
// app/admin/mock-tests/page.tsx — Generate mock module series
// ============================================================
// The generator was the last section of the old dashboard, below eight
// hundred lines of question bank. It is a distinct job with its own risks —
// it creates published papers — and deserves its own address.
// ============================================================

import React from 'react'
import Link from 'next/link'
import { Replace } from 'lucide-react'
import MockModuleGenerator from '@/app/components/admin/MockModuleGenerator'

export default function AdminMockTestsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Mock modules</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Generate a series of full-length papers from the blueprint. Generation only fills draft
          modules — a published module cannot be regenerated, because its 160 mappings are the only
          record of what past candidates actually sat.
        </p>

        <Link
          href="/admin/module-questions"
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-[13px] font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Replace className="h-3.5 w-3.5" />
          Swap a question inside a published module
        </Link>
      </div>

      <MockModuleGenerator />
    </main>
  )
}
