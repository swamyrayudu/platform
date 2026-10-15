'use client'

// ============================================================
// app/dsc-sgt/my-tests/[id]/page.tsx — Take a user-made test
// ============================================================

import { useParams } from 'next/navigation'
import MyTestRunner from '@/app/components/dsc-sgt/my-tests/MyTestRunner'

export default function MyTestPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <MyTestRunner testId={id} />
    </main>
  )
}
