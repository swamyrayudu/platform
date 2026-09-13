// ============================================================
// lib/active-exam.ts — Which exam hub the signed-in user is locked into
// ============================================================
//
// Once a candidate picks an exam, they stay inside that hub until they sign
// out. The choice is remembered per user id, so a second account signing in
// on the same browser does not inherit the first one's lock.
//
// This is a navigation rule, not a security boundary — it lives in
// localStorage and a determined user can clear it. Anything that must be
// enforced belongs on the server.

const STORAGE_KEY = 'rsd.activeExam'

/** Route segment of every hub a user can be locked into. */
export type ExamId = 'dsc-sgt'

/** Where each exam id sends the user. */
export const EXAM_HOME: Record<ExamId, string> = {
  'dsc-sgt': '/dsc-sgt',
}

interface StoredLock {
  userId: string
  examId: ExamId
}

function read(): StoredLock | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredLock>
    if (typeof parsed?.userId !== 'string') return null
    if (!parsed.examId || !(parsed.examId in EXAM_HOME)) return null
    return { userId: parsed.userId, examId: parsed.examId }
  } catch {
    // Unreadable or disabled storage just means "no lock".
    return null
  }
}

/** The exam this user is locked into, or null if they have not picked one. */
export function getActiveExam(userId: string | null | undefined): ExamId | null {
  if (!userId) return null
  const lock = read()
  return lock && lock.userId === userId ? lock.examId : null
}

/** Lock the user into an exam hub. Safe to call repeatedly. */
export function setActiveExam(userId: string | null | undefined, examId: ExamId): void {
  if (typeof window === 'undefined' || !userId) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, examId }))
  } catch {
    // Storage unavailable (private mode, blocked cookies) — the user simply
    // is not locked, which is the safer failure direction.
  }
}

/** Release the lock. Called on sign-out so the next session starts fresh. */
export function clearActiveExam(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do — a lock we cannot remove is a lock we could not set.
  }
}
