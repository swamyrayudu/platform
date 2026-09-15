// ============================================================
// app/api/dsc-sgt/mock-tests/attempts/[attemptId]/abandon/route.ts
// POST — leave an exam without saving a result
// ============================================================
// The other half of the exit prompt: "save my answers" submits, this is
// "leave without saving".
//
// WHY THIS EXISTS RATHER THAN JUST NAVIGATING AWAY:
// An attempt only leaves in_progress when it is submitted. Walking away left
// the row at in_progress for ever, and those rows are not inert — they hold
// the module's place in the sequential unlock so the candidate cannot move on,
// and they read as a live exam to the admin tools, which then refuse to touch
// the module. Every attempt in the database had ended up in that state.
//
// SECURITY: the attempt must belong to the caller. Without that check an
// attempt id would be enough to end somebody else's exam.
// ============================================================

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const POST = requireAuth<{ attemptId: string }>(
  async (_request, context, { user }) => {
    try {
      const { attemptId } = await context.params

      const { data: attempt, error } = await supabaseAdmin
        .from('mock_test_attempts')
        .select('id, user_id, status, mock_test_id')
        .eq('id', attemptId)
        .maybeSingle()

      if (error) throw error
      if (!attempt || attempt.user_id !== user.id) {
        // Same answer for "does not exist" and "is not yours", so an id cannot
        // be probed for validity.
        return NextResponse.json({ success: false, error: 'Attempt not found' }, { status: 404 })
      }

      if (attempt.status === 'submitted') {
        return NextResponse.json(
          { success: false, error: 'This attempt is already submitted and scored.' },
          { status: 409 }
        )
      }

      if (attempt.status === 'abandoned') {
        return NextResponse.json({ success: true, alreadyAbandoned: true })
      }

      const { error: updateError } = await supabaseAdmin
        .from('mock_test_attempts')
        .update({
          status: 'abandoned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', attemptId)
        // Scoped by owner as well, so a race cannot end somebody else's row.
        .eq('user_id', user.id)

      if (updateError) throw updateError

      // The module's own progress row tracks in_progress separately, and a
      // stale one there would keep the module showing "resume". A module the
      // candidate has already completed on an earlier attempt keeps that.
      const { data: progress } = await supabaseAdmin
        .from('user_mock_test_progress')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('mock_test_id', attempt.mock_test_id)
        .maybeSingle()

      if (progress && progress.status !== 'completed') {
        await supabaseAdmin
          .from('user_mock_test_progress')
          .update({ status: 'not_started', attempt_id: null })
          .eq('id', progress.id)
      }

      // Saved answers are left where they are. They score nothing while the
      // attempt is abandoned, and keeping them means a support question about
      // what a candidate actually did still has an answer.
      return NextResponse.json({ success: true })
    } catch (err) {
      console.error('[MockAbandon] failed:', err)
      return NextResponse.json({ success: false, error: 'Could not leave the exam' }, { status: 500 })
    }
  }
)
