// ============================================================
// app/api/admin/resources/route.ts — Admin: list and record resources
// ============================================================
// GET   every resource, published or not, with download counts, and every folder
// POST  { path, fileName, title, description, category, subject, medium,
//         access, is_published, folder_id } — step 2 of an upload, after the browser
//         has put the PDF at `path` (see ./upload-url).
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { checkFields, type ResourceFields } from '@/lib/resources/config'
import { createResource, isResourcePath, listAllResources, listFolders } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

export const GET = requireAdmin(async () => {
  try {
    const resources = await listAllResources()
    return NextResponse.json({ success: true, resources, folders: await listFolders(resources, true) })
  } catch (err) {
    return resourcesError(err, 'Could not load resources.')
  }
})

export const POST = requireAdmin(async (request, _ctx, { user }) => {
  try {
    const body = await request.json().catch(() => null)
    const path = typeof body?.path === 'string' ? body.path : ''
    const fileName = typeof body?.fileName === 'string' && body.fileName.trim() ? body.fileName.trim() : 'resource.pdf'
    if (!isResourcePath(path)) return NextResponse.json({ success: false, error: 'Upload the PDF first.' }, { status: 400 })
    const checked = checkFields(body)
    if ('error' in checked) return NextResponse.json({ success: false, error: checked.error }, { status: 400 })

    const result = await createResource(path, fileName, checked.fields as ResourceFields, user.id)
    if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, resource: result }, { status: 201 })
  } catch (err) {
    return resourcesError(err, 'Could not save the resource.')
  }
})
