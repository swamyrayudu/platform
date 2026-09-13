// ============================================================
// app/api/admin/question-feedback/[id]/route.ts
// PATCH /api/admin/question-feedback/:id — resolve or dismiss a report
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { FeedbackStatus } from '@/types/question-feedback'

const STATUSES: FeedbackStatus[] = ['open', 'resolved', 'dismissed']
const NOTE_MAX = 1000

export const PATCH = requireAdmin<{ id: string }>(async (request, context, { user }) => {
  try {
    const { id } = await context.params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { status, adminNote } = body as Record<string, unknown>
    const update: Record<string, unknown> = {}

    if (status !== undefined) {
      if (!STATUSES.includes(status as FeedbackStatus)) {
        return NextResponse.json({ error: 'Unknown status' }, { status: 400 })
      }
      update.status = status
      // Reopening clears the resolution, so the queue does not show a report
      // as open while still crediting whoever closed it last time.
      update.resolved_by = status === 'open' ? null : user.id
      update.resolved_at = status === 'open' ? null : new Date().toISOString()
    }

    if (adminNote !== undefined) {
      if (adminNote !== null && typeof adminNote !== 'string') {
        return NextResponse.json({ error: 'adminNote must be text' }, { status: 400 })
      }
      update.admin_note = adminNote ? String(adminNote).trim().slice(0, NOTE_MAX) : null
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('question_feedback')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ success: true, item: data })
  } catch (err: unknown) {
    console.error('[PATCH /api/admin/question-feedback/[id]]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
