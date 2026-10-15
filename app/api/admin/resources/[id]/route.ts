// ============================================================
// app/api/admin/resources/[id]/route.ts — Admin: edit or delete one
// ============================================================
// PATCH   any of { title, description, category, subject, medium, access, is_published }
// DELETE  the resource and its PDF
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { checkFields } from '@/lib/resources/config'
import { deleteResource, updateResource } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)
const notFound = () => NextResponse.json({ success: false, error: 'Resource not found.' }, { status: 404 })

export const PATCH = requireAdmin<{ id: string }>(async (request, { params }) => {
  try {
    const { id } = await params
    if (!isUuid(id)) return notFound()
    const checked = checkFields(await request.json().catch(() => null), true)
    if ('error' in checked) return NextResponse.json({ success: false, error: checked.error }, { status: 400 })
    if (Object.keys(checked.fields).length === 0) return NextResponse.json({ success: false, error: 'Nothing to change.' }, { status: 400 })
    const resource = await updateResource(id, checked.fields)
    return resource ? NextResponse.json({ success: true, resource }) : notFound()
  } catch (err) {
    return resourcesError(err, 'Could not update the resource.')
  }
})

export const DELETE = requireAdmin<{ id: string }>(async (_request, { params }) => {
  try {
    const { id } = await params
    if (!isUuid(id) || !(await deleteResource(id))) return notFound()
    return NextResponse.json({ success: true })
  } catch (err) {
    return resourcesError(err, 'Could not delete the resource.')
  }
})
