// ============================================================
// app/api/admin/question-feedback/route.ts
// GET /api/admin/question-feedback — the moderation queue
// ============================================================
// One entry per QUESTION, not per report, so a question flagged fifty times
// appears once with a count of fifty.
//
// Offset pagination, not a cursor: an admin working a queue needs a total, a
// page count and a stable position to come back to. See the admin page for
// why that beats infinite scroll here.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getQuestionTable } from '@/lib/questions/tables'
import type {
  AdminFeedbackItem,
  FeedbackReason,
  FeedbackStatus,
  QuestionFeedbackReport,
  QuestionFeedbackRow,
} from '@/types/question-feedback'

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 100
const STATUSES: FeedbackStatus[] = ['open', 'resolved', 'dismissed']

const REASONS: FeedbackReason[] = [
  'wrong_answer',
  'wrong_question',
  'wrong_option',
  'wrong_explanation',
  'typo',
  'duplicate',
  'other',
]

/** Reporters shown on a collapsed row before the admin expands it. */
const RECENT_PER_QUESTION = 3

export const GET = requireAdmin(async (request: Request) => {
  try {
    const url = new URL(request.url)

    const rawStatus = url.searchParams.get('status') ?? 'open'
    const status = STATUSES.includes(rawStatus as FeedbackStatus)
      ? (rawStatus as FeedbackStatus)
      : null // 'all' and anything unrecognised mean no status filter

    // Checked against the known list, not passed through: this value is
    // interpolated into a PostgREST column expression below, so an
    // unvalidated one would let a caller shape the filter itself.
    const rawReason = url.searchParams.get('reason')
    const reason = REASONS.includes(rawReason as FeedbackReason)
      ? (rawReason as FeedbackReason)
      : null
    const search = url.searchParams.get('search')?.trim() || null

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(
      PAGE_SIZE_MAX,
      Math.max(
        1,
        parseInt(url.searchParams.get('pageSize') || String(PAGE_SIZE_DEFAULT), 10) ||
          PAGE_SIZE_DEFAULT
      )
    )
    const from = (page - 1) * pageSize

    let query = supabaseAdmin
      .from('question_feedback')
      .select('*', { count: 'exact' })
      // Most-reported first: the worst question is the one to fix next.
      .order('report_count', { ascending: false })
      .order('last_reported_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('question_uid', `%${search}%`)
    // A reason filter asks "which questions did anyone flag this way?", which
    // the per-reason breakdown on the row answers without touching the child
    // table.
    if (reason) query = query.not(`reason_counts->${reason}`, 'is', null)

    const { data, count, error } = await query
    if (error) throw error

    const rows = (data ?? []) as QuestionFeedbackRow[]
    const ids = rows.map((r) => r.id)

    // Recent reporters for the listed questions, in one query rather than one
    // per row, then trimmed per question in memory.
    const [{ data: reports }, counts] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from('question_feedback_reports')
            .select('id, feedback_id, question_uid, user_id, reason, details, source, mock_test_id, created_at')
            .in('feedback_id', ids)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      countByStatus(),
    ])

    const reporterIds = [...new Set((reports ?? []).map((r) => r.user_id as string))]
    const { data: users } = reporterIds.length
      ? await supabaseAdmin.from('users').select('id, name, email').in('id', reporterIds)
      : { data: [] as { id: string; name: string | null; email: string }[] }

    const userById = new Map((users ?? []).map((u) => [u.id, u]))

    const byFeedback = new Map<string, QuestionFeedbackReport[]>()
    for (const raw of reports ?? []) {
      const r = raw as unknown as QuestionFeedbackReport
      const list = byFeedback.get(r.feedback_id) ?? []
      if (list.length < RECENT_PER_QUESTION) {
        const u = userById.get(r.user_id)
        list.push({ ...r, reporter: u ? { name: u.name, email: u.email } : null })
        byFeedback.set(r.feedback_id, list)
      }
    }

    const items: AdminFeedbackItem[] = rows.map((r) => {
      const cfg = getQuestionTable(r.question_table)
      return {
        ...r,
        reason_counts: r.reason_counts ?? {},
        subject_label: cfg?.subjectDisplayName ?? null,
        medium: cfg?.medium ?? null,
        recent_reports: byFeedback.get(r.id) ?? [],
      }
    })

    const total = count ?? items.length
    return NextResponse.json({
      success: true,
      items,
      page,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      counts,
    })
  } catch (err: unknown) {
    console.error('[GET /api/admin/question-feedback]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

/** Queue sizes for the status tabs, so the page does not guess. */
async function countByStatus(): Promise<Record<FeedbackStatus, number>> {
  const out: Record<FeedbackStatus, number> = { open: 0, resolved: 0, dismissed: 0 }
  await Promise.all(
    STATUSES.map(async (s) => {
      const { count } = await supabaseAdmin
        .from('question_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('status', s)
      out[s] = count ?? 0
    })
  )
  return out
}
