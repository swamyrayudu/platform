// ============================================================
// app/api/admin/resources/upload-url/route.ts — Step 1 of an upload
// ============================================================
// POST { fileName, size } → { path, signedUrl }
// The admin's browser PUTs the PDF straight to Storage with signedUrl, so the
// file never passes through this server. Then POST /api/admin/resources.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { fileProblem } from '@/lib/resources/config'
import { createUploadUrl } from '@/lib/resources/store'
import { resourcesError } from '@/lib/resources/respond'

export const POST = requireAdmin(async (request) => {
  try {
    const body = await request.json().catch(() => null)
    const fileName = typeof body?.fileName === 'string' ? body.fileName : ''
    const size = Number(body?.size)
    const problem = fileProblem({ name: fileName, size: Number.isFinite(size) ? size : 0 })
    if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 })
    return NextResponse.json({ success: true, ...(await createUploadUrl()) })
  } catch (err) {
    return resourcesError(err, 'Could not start the upload.')
  }
})
