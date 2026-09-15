// ============================================================
// app/api/dsc-sgt/mock-tests/attempts/[attemptId]/pause/route.ts
// POST — stop the clock and keep the attempt resumable
// ============================================================
// Leaving an exam is not the same as ending it. This records how much of the
// duration has been used and leaves the attempt in_progress, so re-entering
// picks up where the candidate left off with the remaining time intact.
//
// WHY THE CLIENT'S NUMBER IS TRUSTED, WITHIN LIMITS:
// The server has no clock running for an attempt — elapsed time only exists in
// the page. So the figure comes from the client, and is then clamped:
//   - never above the module's duration
//   - never below what is already recorded
// The floor is what matters. Without it, a candidate could pause, edit the
// request to report one second, and hand themselves the whole paper again.
//
// SECURITY: the attempt must belong to the caller.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const POST = requireAuth<{ attemptId: string }>(
  async (request, context, { user }) => {
    try {
      const { attemptId } = await context.params

      let body: unknown
      try {
        body = await request.json()
      } catch {
        body = {}
      }
      const { totalTimeSpentSeconds } = body as Record<string, unknown>

      const { data: attempt, error } = await supabaseAdmin
        .from('mock_test_attempts')
        .select('id, user_id, status, duration_seconds, time_spent_seconds')
        .eq('id', attemptId)
        .maybeSingle()

      if (error) throw error
      if (!attempt || attempt.user_id !== user.id) {
        // Same answer for "does not exist" and "is not yours".
        return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 })
      }
      if (attempt.status !== 'in_progress') {
        return NextResponse.json(
          { success: false, error: 'This attempt is no longer running.' },
          { status: 409 }
        )
      }

      const reported = Number(totalTimeSpentSeconds)
      const duration = Number(attempt.duration_seconds) || 0
      const recorded = Number(attempt.time_spent_seconds) || 0

      const elapsed = Math.min(
        duration,
        Math.max(recorded, Number.isFinite(reported) && reported > 0 ? Math.round(reported) : recorded)
      )

      const { error: updateError } = await supabaseAdmin
        .from('mock_test_attempts')
        .update({ time_spent_seconds: elapsed, updated_at: new Date().toISOString() })
        .eq('id', attemptId)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      return NextResponse.json({
        success: true,
        timeSpentSeconds: elapsed,
        remainingSeconds: Math.max(0, duration - elapsed),
      })
    } catch (err) {
      console.error('[MockPause] failed:', err)
      return NextResponse.json({ success: false, error: 'Could not pause the exam' }, { status: 500 })
    }
  }
)
