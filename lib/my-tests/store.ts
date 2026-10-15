// ============================================================
// lib/my-tests/store.ts — User-made tests: Storage + database (server only)
// ============================================================
// Questions live in one gzip-compressed JSON file per test in the private
// `user-tests` bucket; the database holds only metadata and attempts.
// See supabase/migrations/20261014120000_user_mock_tests.sql.
// ============================================================

import { gzipSync, gunzipSync } from 'node:zlib'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { MyTestMedium, MyTestQuestion } from './format'

export const MY_TESTS_BUCKET = 'user-tests'

const TEST_COLUMNS =
  'id, title, medium, subject, topics, question_count, duration_minutes, size_bytes, created_at, last_attempt_at'

export interface MyTestSummary {
  id: string
  title: string
  medium: MyTestMedium
  subject: string
  topics: string[]
  question_count: number
  duration_minutes: number
  size_bytes: number
  created_at: string
  last_attempt_at: string | null
}

export interface MyTestAttempt {
  id: string
  answers: string
  correct_count: number
  total_questions: number
  time_spent_seconds: number
  submitted_at: string
}

interface StoredTest {
  version: 1
  questions: MyTestQuestion[]
}

export async function countMyTests(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin.from('user_mock_tests')
    .select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if (error) throw error
  return count ?? 0
}

export async function listMyTests(userId: string): Promise<(MyTestSummary & { best_correct: number | null; attempts: number })[]> {
  const { data, error } = await supabaseAdmin.from('user_mock_tests')
    .select(TEST_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  const tests = (data ?? []) as MyTestSummary[]
  if (tests.length === 0) return []
  const { data: attempts, error: attemptError } = await supabaseAdmin.from('user_mock_attempts')
    .select('test_id, correct_count').eq('user_id', userId).in('test_id', tests.map((t) => t.id))
  if (attemptError) throw attemptError
  const stats = new Map<string, { best: number; count: number }>()
  for (const a of (attempts ?? []) as { test_id: string; correct_count: number }[]) {
    const s = stats.get(a.test_id) ?? { best: 0, count: 0 }
    stats.set(a.test_id, { best: Math.max(s.best, a.correct_count), count: s.count + 1 })
  }
  return tests.map((t) => ({ ...t, best_correct: stats.get(t.id)?.best ?? null, attempts: stats.get(t.id)?.count ?? 0 }))
}

/** Upload the compressed questions, then record the test. A failed insert removes the file again. */
export async function createMyTest(userId: string, meta: {
  title: string
  medium: MyTestMedium
  subject: string
  topics: string[]
  duration_minutes: number
}, questions: MyTestQuestion[]): Promise<MyTestSummary> {
  const id = crypto.randomUUID()
  const path = `${userId}/${id}.json.gz`
  const body = gzipSync(Buffer.from(JSON.stringify({ version: 1, questions } satisfies StoredTest)))

  const { error: uploadError } = await supabaseAdmin.storage.from(MY_TESTS_BUCKET)
    .upload(path, body, { contentType: 'application/gzip', upsert: false })
  if (uploadError) throw uploadError

  const { data, error } = await supabaseAdmin.from('user_mock_tests').insert({
    id, user_id: userId, ...meta, question_count: questions.length, storage_path: path, size_bytes: body.length,
  }).select(TEST_COLUMNS).single()
  if (error) {
    await supabaseAdmin.storage.from(MY_TESTS_BUCKET).remove([path])
    throw error
  }
  return data as MyTestSummary
}

async function findOwned(userId: string, testId: string) {
  const { data, error } = await supabaseAdmin.from('user_mock_tests')
    .select(`${TEST_COLUMNS}, storage_path`).eq('id', testId).eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as (MyTestSummary & { storage_path: string }) | null
}

/** The test with its questions, or null when it is not this user's. */
export async function getMyTest(userId: string, testId: string) {
  const test = await findOwned(userId, testId)
  if (!test) return null
  const { data: file, error } = await supabaseAdmin.storage.from(MY_TESTS_BUCKET).download(test.storage_path)
  if (error || !file) throw error ?? new Error('Test file is missing')
  const stored = JSON.parse(gunzipSync(Buffer.from(await file.arrayBuffer())).toString('utf8')) as StoredTest
  const { storage_path, ...summary } = test
  void storage_path
  return { ...summary, questions: stored.questions }
}

export async function listAttempts(userId: string, testId: string, limit = 10): Promise<MyTestAttempt[]> {
  const { data, error } = await supabaseAdmin.from('user_mock_attempts')
    .select('id, answers, correct_count, total_questions, time_spent_seconds, submitted_at')
    .eq('user_id', userId).eq('test_id', testId)
    .order('submitted_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []) as MyTestAttempt[]
}

export async function recordAttempt(userId: string, testId: string, attempt: {
  answers: string
  correct_count: number
  total_questions: number
  time_spent_seconds: number
}): Promise<MyTestAttempt> {
  const { data, error } = await supabaseAdmin.from('user_mock_attempts')
    .insert({ test_id: testId, user_id: userId, ...attempt })
    .select('id, answers, correct_count, total_questions, time_spent_seconds, submitted_at').single()
  if (error) throw error
  await supabaseAdmin.from('user_mock_tests')
    .update({ last_attempt_at: (data as MyTestAttempt).submitted_at }).eq('id', testId).eq('user_id', userId)
  return data as MyTestAttempt
}

/** Delete one test: its file first, so a failure never leaves an unowned file behind. */
export async function deleteMyTest(userId: string, testId: string): Promise<boolean> {
  const test = await findOwned(userId, testId)
  if (!test) return false
  const { error: removeError } = await supabaseAdmin.storage.from(MY_TESTS_BUCKET).remove([test.storage_path])
  if (removeError) throw removeError
  const { error } = await supabaseAdmin.from('user_mock_tests').delete().eq('id', testId).eq('user_id', userId)
  if (error) throw error
  return true
}

/**
 * Remove every test file a user owns — used by account deletion, where the
 * database rows cascade but Storage files would not. A missing bucket means
 * the feature was never set up, so there is nothing to remove.
 */
export async function removeAllMyTestFiles(userId: string): Promise<void> {
  const bucket = supabaseAdmin.storage.from(MY_TESTS_BUCKET)
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 100 })
    if (error) {
      if (/not found/i.test(error.message)) return
      throw error
    }
    if (!data?.length) return
    const { error: removeError } = await bucket.remove(data.map((f) => `${userId}/${f.name}`))
    if (removeError) throw removeError
    if (data.length < 100) return
  }
}
