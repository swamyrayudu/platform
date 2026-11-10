// ============================================================
// lib/payments/google-play/schema.ts — Survive a not-yet-applied migration
// ============================================================
// Admin queries select users.play_expires_at / play_plan (migration
// 20261107120000_google_play_billing.sql). If the code is deployed before
// that migration runs, Postgres answers 42703 "column does not exist" and
// the whole admin page fails. withPlayColumns() retries the same query
// without the Play columns, so admin keeps working (web access only) until
// the migration is applied. The miss is remembered for a minute so normal
// traffic does not pay for two queries.
// ============================================================

interface QueryError { code?: string; message?: string }

const RECHECK_MS = 60_000
let missingUntil = 0

export function isMissingPlayColumn(error: QueryError | null | undefined): boolean {
  return !!error && error.code === '42703' && /play_/.test(error.message ?? '')
}

export async function withPlayColumns<T extends { error: QueryError | null }>(
  run: (withPlay: boolean) => PromiseLike<T>
): Promise<T> {
  if (Date.now() >= missingUntil) {
    const result = await run(true)
    if (!isMissingPlayColumn(result.error)) return result
    missingUntil = Date.now() + RECHECK_MS
    console.warn('[Google Play] users.play_* columns are missing. Apply supabase/migrations/20261107120000_google_play_billing.sql')
  }
  return run(false)
}
