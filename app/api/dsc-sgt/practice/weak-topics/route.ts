// ============================================================
// app/api/dsc-sgt/practice/weak-topics/route.ts
// ============================================================

import { NextResponse } from 'next/server'
import { getOptionalAuth } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { WeakAreaRecommendation } from '@/types/practice'

export async function GET(request: Request) {
  try {
    const auth = await getOptionalAuth(request)
    const userId = auth?.user?.id || null

    if (!userId) {
      // Default sample recommendations if unauthenticated/new user
      const sampleRecommendations: WeakAreaRecommendation[] = [
        {
          subject: 'English',
          topic: 'Tenses',
          subtopic: 'Present & Past Perfect',
          total_attempted: 25,
          accuracy_pct: 52,
          incorrect_count: 12,
          recommended_question_count: 20,
          action_label: 'Practice Tenses (52% Accuracy)',
        },
        {
          subject: 'English',
          topic: 'Articles & Prepositions',
          subtopic: 'Prepositions of Place & Time',
          total_attempted: 18,
          accuracy_pct: 60,
          incorrect_count: 7,
          recommended_question_count: 15,
          action_label: 'Practice Prepositions (60% Accuracy)',
        },
      ]

      return NextResponse.json({
        success: true,
        recommendations: sampleRecommendations,
      })
    }

    const { data, error } = await supabaseAdmin
      .from('question_progress')
      .select('*')
      .eq('user_id', userId)

    const recommendations: WeakAreaRecommendation[] = []

    if (!error && data) {
      const topicMap: Record<string, { subject: string; topic: string; correct: number; total: number; incorrect: number }> = {}

      data.forEach((row: any) => {
        const key = `${row.subject}__${row.topic}`
        if (!topicMap[key]) {
          topicMap[key] = {
            subject: row.subject,
            topic: row.topic,
            correct: 0,
            total: 0,
            incorrect: 0,
          }
        }
        topicMap[key].correct += row.correct_count || 0
        topicMap[key].total += row.attempt_count || 0
        topicMap[key].incorrect += row.incorrect_count || 0
      })

      Object.values(topicMap).forEach((st) => {
        const acc = st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0
        if (st.total >= 3 && acc < 65) {
          recommendations.push({
            subject: st.subject,
            topic: st.topic,
            total_attempted: st.total,
            accuracy_pct: acc,
            incorrect_count: st.incorrect,
            recommended_question_count: Math.min(25, Math.max(10, st.incorrect * 3)),
            action_label: `Practice ${st.topic} (${acc}%)`,
          })
        }
      })
    }

    return NextResponse.json({
      success: true,
      recommendations,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to calculate weak topics'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
