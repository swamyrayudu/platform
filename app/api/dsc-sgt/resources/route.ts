// ============================================================
// app/api/dsc-sgt/resources/route.ts — Published resources for candidates
// ============================================================
// The list includes Pro resources (shown locked to free users), but never a
// storage path: links come only from ./[id]/link after an access check.
//
//   ?view=root     folders with file counts, and the files in no folder
//   ?folder=<id>   one folder and its files (loaded when it is opened)
//   ?search=<text> matching files in every folder
//   (none)         every file and folder: what older app updates expect
//
// Files come in reading order (Day 1 → Day 28): lib/resources/config.ts.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { listFolders, listPublishedResources, loadFolderResources, loadResourcesRoot, searchPublishedResources } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

export const GET = requireAuth(async (request) => {
  try {
    const params = new URL(request.url).searchParams
    const folderId = params.get('folder')
    const search = params.get('search')

    if (folderId !== null) {
      const found = isUuid(folderId) ? await loadFolderResources(folderId) : null
      if (!found) return NextResponse.json({ success: false, error: 'This folder is not available.' }, { status: 404 })
      return NextResponse.json({ success: true, ...found })
    }
    if (search !== null) {
      return NextResponse.json({ success: true, resources: await searchPublishedResources(search) })
    }
    if (params.get('view') === 'root') {
      return NextResponse.json({ success: true, ...(await loadResourcesRoot()) })
    }

    const resources = await listPublishedResources()
    // Only folders holding published files; older app builds ignore this field.
    return NextResponse.json({ success: true, resources, folders: await listFolders(resources, false) })
  } catch (err) {
    return resourcesError(err, 'Could not load resources.')
  }
})
