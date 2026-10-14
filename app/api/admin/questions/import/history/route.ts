import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getQuestionTable } from '@/lib/questions/tables'
import { UUID_PATTERN } from '@/lib/questions/import-history'

export const GET = requireAdmin(async (request) => {
  try {
    const url = new URL(request.url)
    const table = getQuestionTable(url.searchParams.get('table') ?? '')?.table
    const page = Number(url.searchParams.get('page') ?? 1)
    if (!table || !Number.isSafeInteger(page) || page < 1 || page > 100000) return NextResponse.json({ success: false, error: 'Invalid table or page' }, { status: 400 })
    let query = supabaseAdmin.from('admin_question_import_batches')
      .select('id, origin, status, row_count, topics, created_at, changed_at, actor:users!admin_question_import_batches_actor_id_fkey(name, email)', { count: 'exact' })
      .eq('question_table', table)
    if (url.searchParams.has('topic')) {
      const topic = JSON.parse(url.searchParams.get('topic')!)
      if (topic !== null && (typeof topic !== 'string' || topic.length > 1000)) throw new Error('Invalid topic')
      // This column is JSONB, not a Postgres text array. Pass JSON explicitly
      // so null and Telugu names retain their exact JSON types.
      query = query.contains('topics', JSON.stringify([topic]))
    }
    const { data, count, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * 20, page * 20 - 1)
    if (error) throw error
    return NextResponse.json({ success: true, batches: data ?? [], page, total: count ?? 0, pageSize: 20 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ success: false, error: 'Could not load import history' }, { status: 400 })
  }
})

export const POST = requireAdmin(async (request, _context, { user }) => {
  try {
    const body = await request.json()
    const table = getQuestionTable(typeof body?.table === 'string' ? body.table : '')?.table
    if (!table || typeof body.batchId !== 'string' || !UUID_PATTERN.test(body.batchId) || !['undo', 'restore'].includes(body.action) || typeof body.apply !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Invalid import action' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin.rpc('admin_question_import_action', {
      p_actor_id: user.id, p_table: table, p_batch_id: body.batchId, p_action: body.action, p_apply: body.apply,
    })
    if (error) return NextResponse.json({ success: false, error: error.message || 'Import could not be changed. Preview again.' }, { status: 409 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ success: false, error: 'Could not change this import' }, { status: 400 })
  }
})
