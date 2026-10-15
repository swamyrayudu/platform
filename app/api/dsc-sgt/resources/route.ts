// ============================================================
// app/api/dsc-sgt/resources/route.ts — Published resources for candidates
// ============================================================
// The list includes Pro resources (shown locked to free users), but never a
// storage path: links come only from ./[id]/link after an access check.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { listFolders, listPublishedResources } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

export const GET = requireAuth(async () => {
  try {
    const resources = await listPublishedResources()
    // Only folders holding published files; older app builds ignore this field.
    return NextResponse.json({ success: true, resources, folders: await listFolders(resources, false) })
  } catch (err) {
    return resourcesError(err, 'Could not load resources.')
  }
})
