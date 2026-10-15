'use client'

// ============================================================
// app/dsc-sgt/my-tests/new/page.tsx — Create a user-made test
// ============================================================

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CreateTestForm from '@/app/components/dsc-sgt/my-tests/CreateTestForm'

export default function NewMyTestPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/dsc-sgt/my-tests" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> My Tests
      </Link>
      <h1 className="mt-4 text-xl font-black text-foreground sm:text-2xl">Create your own test</h1>
      <p className="mt-1 mb-6 text-xs text-muted-foreground">
        Your questions are private to your account. You are responsible for their accuracy.
      </p>
      <CreateTestForm />
    </main>
  )
}
