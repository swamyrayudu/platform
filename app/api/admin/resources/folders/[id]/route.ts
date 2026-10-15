// ============================================================
// app/api/admin/resources/folders/[id]/route.ts — Admin: rename or delete
// ============================================================
// PATCH   { name?, description? }
// DELETE  the folder; its files stay, outside any folder
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { checkFolder } from '@/lib/resources/config'
import { deleteFolder, updateFolder } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)
const notFound = () => NextResponse.json({ success: false, error: 'Folder not found.' }, { status: 404 })

export const PATCH = requireAdmin<{ id: string }>(async (request, { params }) => {
  try {
    const { id } = await params
    if (!isUuid(id)) return notFound()
    const checked = checkFolder(await request.json().catch(() => null), true)
    if ('error' in checked) return NextResponse.json({ success: false, error: checked.error }, { status: 400 })
    if (Object.keys(checked.fields).length === 0) return NextResponse.json({ success: false, error: 'Nothing to change.' }, { status: 400 })
    const folder = await updateFolder(id, checked.fields)
    if (folder && 'error' in folder) return NextResponse.json({ success: false, error: folder.error }, { status: 409 })
    return folder ? NextResponse.json({ success: true, folder }) : notFound()
  } catch (err) {
    return resourcesError(err, 'Could not update the folder.')
  }
})

export const DELETE = requireAdmin<{ id: string }>(async (_request, { params }) => {
  try {
    const { id } = await params
    if (!isUuid(id) || !(await deleteFolder(id))) return notFound()
    return NextResponse.json({ success: true })
  } catch (err) {
    return resourcesError(err, 'Could not delete the folder.')
  }
})
