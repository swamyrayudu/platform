// Shared error response for the My Tests routes.
import { NextResponse } from 'next/server'

/** Tables or bucket missing means migration 20261014120000_user_mock_tests is not applied yet. */
export function myTestsError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message
    : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : fallback
  if (/user_mock_tests|user_mock_attempts|bucket not found|schema cache/i.test(message)) {
    return NextResponse.json(
      { success: false, code: 'NOT_SET_UP', error: 'My Tests is not available yet.' },
      { status: 503 }
    )
  }
  console.error('[My Tests]', err)
  return NextResponse.json({ success: false, error: fallback }, { status: 500 })
}
