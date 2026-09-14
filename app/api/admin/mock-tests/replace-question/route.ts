// ============================================================
// app/api/admin/mock-tests/replace-question/route.ts
// GET  — the slots holding a question, plus candidate replacements
// POST — swap it, in one module or everywhere it appears
// ============================================================
// The surgical alternative to regenerating a module. See
// lib/mock-tests/replace-question.ts for why regeneration is not on offer:
// mock_test_questions has no version column, so regenerating a published
// module rewrites what every past attempt appears to have contained.
//
// Preview and apply are the same GET/POST pair on purpose — the slots listed
// by GET are exactly the rows POST will touch.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { parseQuestionUid, buildQuestionUid } from '@/lib/questions/tables'
import {
  findCandidates,
  findSlotsUsing,
  liveModuleIds,
  replaceSlots,
} from '@/lib/mock-tests/replace-question'

// ---- GET: what would change -------------------------------------

export const GET = requireAdmin(async (request) => {
  try {
    const url = new URL(request.url)
    const uid = url.searchParams.get('uid')
    const search = url.searchParams.get('search') ?? undefined
    const mockTestId = url.searchParams.get('mockTestId') ?? undefined
    const page = Number(url.searchParams.get('page') ?? '1') || 1
    const pageSize = Number(url.searchParams.get('pageSize') ?? '25') || 25
    const unusedOnly = url.searchParams.get('unusedOnly') === '1'

    const parsed = uid ? parseQuestionUid(uid) : null
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'uid must be table:question_id for a known question table' },
        { status: 400 }
      )
    }

    const allSlots = await findSlotsUsing(parsed.questionTable, parsed.questionId)
    const slots = mockTestId ? allSlots.filter((s) => s.mockTestId === mockTestId) : allSlots
    const live = await liveModuleIds([...new Set(slots.map((s) => s.mockTestId))])

    // Exclude the question being replaced, so it cannot be offered as its own
    // replacement.
    const candidates = await findCandidates(parsed.questionTable, {
      search,
      excludeIds: new Set([parsed.questionId]),
      page,
      pageSize,
      unusedOnly,
    })

    return NextResponse.json({
      success: true,
      uid: buildQuestionUid(parsed.questionTable, parsed.questionId),
      questionTable: parsed.questionTable,
      slots: slots.map((s) => ({ ...s, live: live.has(s.mockTestId) })),
      liveModules: live.size,
      ...candidates,
    })
  } catch (err) {
    console.error('[AdminReplace] lookup failed:', err)
    return NextResponse.json({ success: false, error: 'Lookup failed' }, { status: 500 })
  }
})

// ---- POST: do it -------------------------------------------------

export const POST = requireAdmin(async (request) => {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const { uid, scope, mockTestId, replacementId } = body as Record<string, unknown>

    const parsed = typeof uid === 'string' ? parseQuestionUid(uid) : null
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'Unknown question' }, { status: 400 })
    }
    if (scope !== 'module' && scope !== 'all') {
      return NextResponse.json(
        { success: false, error: "scope must be 'module' or 'all'" },
        { status: 400 }
      )
    }
    if (scope === 'module' && typeof mockTestId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'mockTestId is required when replacing in one module' },
        { status: 400 }
      )
    }

    const allSlots = await findSlotsUsing(parsed.questionTable, parsed.questionId)
    const slots =
      scope === 'module' ? allSlots.filter((s) => s.mockTestId === mockTestId) : allSlots

    if (slots.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No module currently uses that question' },
        { status: 404 }
      )
    }

    // A chosen replacement only makes sense for a single slot: the same
    // question cannot fill two slots of one module, and across modules each
    // one needs its own pick anyway.
    const chosen =
      typeof replacementId === 'string' && replacementId && slots.length === 1
        ? replacementId
        : null

    const outcomes = await replaceSlots(slots, chosen)

    const summary = {
      slots: outcomes.length,
      replaced: outcomes.filter((o) => o.status === 'replaced').length,
      blockedLive: outcomes.filter((o) => o.status === 'blocked_live').length,
      noCandidate: outcomes.filter((o) => o.status === 'no_candidate').length,
    }

    return NextResponse.json({ success: true, summary, outcomes })
  } catch (err) {
    console.error('[AdminReplace] replace failed:', err)
    return NextResponse.json({ success: false, error: 'Replace failed' }, { status: 500 })
  }
})
