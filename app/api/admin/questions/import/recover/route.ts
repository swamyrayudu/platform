import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getQuestionTable } from '@/lib/questions/tables'
import { importFingerprint, importReceipt, matchOriginalImport, snapshotHash, UUID_PATTERN } from '@/lib/questions/import-history'

export const POST = requireAdmin(async (request, _context, { user }) => {
  try {
    const body = await request.json()
    const table = getQuestionTable(typeof body?.table === 'string' ? body.table : '')?.table
    if (!table || (body.topic !== null && (typeof body.topic !== 'string' || body.topic.length > 1000)) || typeof body.csv !== 'string' || !body.csv.trim() || body.csv.length > 8 * 1024 * 1024 || typeof body.apply !== 'boolean' || typeof body.requestId !== 'string' || !UUID_PATTERN.test(body.requestId)) {
      return NextResponse.json({ success: false, error: 'Choose the wrong topic and provide its original import CSV.' }, { status: 400 })
    }
    const fingerprint = importFingerprint(table, body.csv, body.topic)
    if (body.apply) {
      const receipt = await importReceipt(body.requestId, table, fingerprint)
      if (receipt) return receipt.status === 'undone' ? NextResponse.json(receipt.result)
        : NextResponse.json({ success: false, error: 'This recovered import was restored. Use its history to undo it again.' }, { status: 409 })
    }
    const candidates: Record<string, unknown>[] = []
    for (let offset = 0; ; ) {
      let query = supabaseAdmin.from(table).select('*').order('question_id').range(offset, offset + 999)
      query = body.topic === null ? query.is('topic', null) : query.eq('topic', body.topic)
      const { data, error } = await query
      if (error) throw new Error('Could not read the selected topic.')
      candidates.push(...data ?? [])
      if (!data?.length) break
      offset += data.length
    }
    const rows = matchOriginalImport(body.csv, candidates)
    const { data: tracked, error: trackedError } = await supabaseAdmin.from('admin_question_import_ids')
      .select('question_id').eq('question_table', table).in('question_id', rows.map((row) => row.question_id))
    if (trackedError) throw new Error('Could not check import history.')
    if (tracked?.length) throw new Error('These questions already have recorded import history. Use Preview Undo for that import above.')
    const hash = snapshotHash(rows)
    if (!body.apply) {
      const { data, error } = await supabaseAdmin.rpc('admin_question_import_action', {
        p_actor_id: user.id, p_table: table, p_batch_id: randomUUID(), p_action: 'undo', p_apply: false, p_preview_rows: rows,
      })
      if (error) throw new Error(error.message)
      return NextResponse.json({ ...data, snapshotHash: hash })
    }
    if (body.snapshotHash !== hash) return NextResponse.json({ success: false, error: 'Questions changed since preview. Preview again; nothing was removed.' }, { status: 409 })
    const { data, error } = await supabaseAdmin.rpc('capture_admin_question_import', {
      p_actor_id: user.id, p_table: table, p_request_id: body.requestId, p_fingerprint: fingerprint,
      p_rows: rows, p_result: {}, p_origin: 'recovery',
    })
    if (error) return NextResponse.json({ success: false, error: error.message || 'Nothing was removed. Preview again.' }, { status: 409 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Invalid recovery request' }, { status: 400 })
  }
})
