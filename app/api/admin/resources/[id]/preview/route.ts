// POST /api/admin/resources/[id]/preview → { url } for an admin to check any resource.
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { createPreviewUrl } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

export const POST = requireAdmin<{ id: string }>(async (_request, { params }) => {
  try {
    const { id } = await params
    const url = /^[0-9a-f-]{36}$/i.test(id) ? await createPreviewUrl(id) : null
    return url
      ? NextResponse.json({ success: true, url })
      : NextResponse.json({ success: false, error: 'Resource not found.' }, { status: 404 })
  } catch (err) {
    return resourcesError(err, 'Could not open the resource.')
  }
})
