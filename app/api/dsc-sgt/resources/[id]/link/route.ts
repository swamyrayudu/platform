// ============================================================
// app/api/dsc-sgt/resources/[id]/link/route.ts — A link for the PDF viewers
// ============================================================
// POST → { url }, signed for one minute. Only the website's and the app's
// own viewers use it (and the app's private download); it is never offered
// as a browser download. A `download` field from older apps is ignored.
// Pro resources need an active Pro subscription; this is the only check
// that matters, because the bucket is private and the URL expires.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth, isUserPremium } from '@/lib/auth/session'
import { createAccessUrl } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

export const POST = requireAuth<{ id: string }>(async (request, { params }, { user }) => {
  try {
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ success: false, error: 'Resource not found.' }, { status: 404 })
    const result = await createAccessUrl(id, isUserPremium(user))
    if ('error' in result) {
      return result.error === 'PRO_REQUIRED'
        ? NextResponse.json({ success: false, code: 'PRO_REQUIRED', error: 'This resource is for Pro members.' }, { status: 403 })
        : NextResponse.json({ success: false, error: 'Resource not found.' }, { status: 404 })
    }
    return NextResponse.json({ success: true, url: result.url })
  } catch (err) {
    return resourcesError(err, 'Could not open this resource.')
  }
})
