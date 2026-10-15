// ============================================================
// app/api/dsc-sgt/resources/route.ts — Published resources for candidates
// ============================================================
// The list includes Pro resources (shown locked to free users), but never a
// storage path: links come only from ./[id]/link after an access check.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { listPublishedResources } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

export const GET = requireAuth(async () => {
  try {
    return NextResponse.json({ success: true, resources: await listPublishedResources() })
  } catch (err) {
    return resourcesError(err, 'Could not load resources.')
  }
})
