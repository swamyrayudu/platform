// ============================================================
// lib/mock-tests/live-attempts.ts — Who is genuinely mid-exam
// ============================================================
// Editing a question out from under somebody sitting an exam is the one thing
// the admin tools refuse to do. Deciding who that is turns out to need more
// care than `status = 'in_progress'`.
//
// An attempt is only moved off in_progress when the candidate submits, or when
// the client submits for them at time-up. Close the tab and nothing does: the
// row sits at in_progress for ever. Every attempt in the database at the time
// of writing was in that state — six of them, aged between three and fifty-two
// hours against a hundred-and-fifty-minute exam, all with time_spent_seconds
// of zero. Trusting the status alone let those six block edits to modules 1, 2,
// 3 and 20 permanently, which read from the admin side as "replace is broken".
//
// So an attempt counts as live only while its own exam window is still open:
// started_at + the module's duration, plus a few minutes of slack for a
// submit that is in flight.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase-admin'

/** Slack past the official end, for a submission still on its way. */
const GRACE_MINUTES = 10

/** Used when a module somehow has no duration recorded. */
const FALLBACK_DURATION_MINUTES = 150

export interface LiveAttempt {
  attemptId: string
  mockTestId: string
  startedAt: string
  endsAt: number
}

/**
 * Attempts still inside their exam window, among the given modules.
 * Pass no ids to check every module.
 */
export async function findLiveAttempts(mockTestIds?: string[]): Promise<LiveAttempt[]> {
  if (mockTestIds && mockTestIds.length === 0) return []

  const now = Date.now()
  const rows: Record<string, unknown>[] = []

  const chunks = mockTestIds
    ? Array.from({ length: Math.ceil(mockTestIds.length / 100) }, (_, i) =>
        mockTestIds.slice(i * 100, i * 100 + 100)
      )
    : [null]

  for (const chunk of chunks) {
    let query = supabaseAdmin
      .from('mock_test_attempts')
      .select('id, mock_test_id, started_at, mock_tests(duration_minutes)')
      .eq('status', 'in_progress')
    if (chunk) query = query.in('mock_test_id', chunk)

    const { data, error } = await query
    if (error) throw error
    rows.push(...((data ?? []) as Record<string, unknown>[]))
  }

  const live: LiveAttempt[] = []
  for (const row of rows) {
    const startedAt = row.started_at as string | null
    if (!startedAt) continue

    const test = row.mock_tests as { duration_minutes?: number | null } | null
    const minutes = test?.duration_minutes ?? FALLBACK_DURATION_MINUTES
    const endsAt = new Date(startedAt).getTime() + (minutes + GRACE_MINUTES) * 60_000

    if (Number.isFinite(endsAt) && endsAt > now) {
      live.push({
        attemptId: row.id as string,
        mockTestId: row.mock_test_id as string,
        startedAt,
        endsAt,
      })
    }
  }

  return live
}

/** The modules that currently have somebody genuinely sitting them. */
export async function liveModuleIds(mockTestIds?: string[]): Promise<Set<string>> {
  const live = await findLiveAttempts(mockTestIds)
  return new Set(live.map((a) => a.mockTestId))
}
