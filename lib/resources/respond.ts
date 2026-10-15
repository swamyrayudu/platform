// Shared error response for the Resources routes.
import { NextResponse } from 'next/server'

/** Table or bucket missing means migration 20261014150000_resources is not applied yet. */
export function resourcesError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message
    : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : fallback
  if (/folder_id|resource_folders/i.test(message)) {
    return NextResponse.json(
      { success: false, code: 'FOLDERS_NOT_SET_UP', error: 'Folders are not set up yet. Run migration 20261015120000_resource_folders.sql in the Supabase SQL Editor.' },
      { status: 503 }
    )
  }
  if (/'public\.resources'|relation "?(public\.)?resources"?|bucket not found|increment_resource_downloads/i.test(message)) {
    return NextResponse.json(
      { success: false, code: 'NOT_SET_UP', error: 'Resources are not available yet.' },
      { status: 503 }
    )
  }
  console.error('[Resources]', err)
  return NextResponse.json({ success: false, error: fallback }, { status: 500 })
}
