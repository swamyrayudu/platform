// ============================================================
// app/api/admin/resources/folders/route.ts — Admin: list and create folders
// ============================================================
// GET   every folder, with how many files each holds (published or not)
// POST  { name, description? }
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { checkFolder } from '@/lib/resources/config'
import { createFolder, listAllResources, listFolders } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

export const GET = requireAdmin(async () => {
  try {
    return NextResponse.json({ success: true, folders: await listFolders(await listAllResources(), true) })
  } catch (err) {
    return resourcesError(err, 'Could not load folders.')
  }
})

export const POST = requireAdmin(async (request) => {
  try {
    const checked = checkFolder(await request.json().catch(() => null))
    if ('error' in checked) return NextResponse.json({ success: false, error: checked.error }, { status: 400 })
    const folder = await createFolder({ name: checked.fields.name!, description: checked.fields.description ?? '' })
    if ('error' in folder) return NextResponse.json({ success: false, error: folder.error }, { status: 409 })
    return NextResponse.json({ success: true, folder }, { status: 201 })
  } catch (err) {
    return resourcesError(err, 'Could not create the folder.')
  }
})
