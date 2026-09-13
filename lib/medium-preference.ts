// ============================================================
// lib/medium-preference.ts — Which language tab opens by default
// ============================================================
// A candidate picks their medium during onboarding, and every screen that
// offers a Telugu/English choice should open on it rather than on a hardcoded
// default. Practice already worked this way; mock tests did not, and always
// opened Telugu.
//
// Order of authority:
//   1. educationMedium on the profile — what they actually registered with
//   2. the last medium they switched to by hand, remembered locally
//   3. nothing, and the caller keeps its own default
//
// The profile wins over the stored value on purpose: switching tabs to glance
// at the other medium should not quietly rewrite the choice they registered
// with on the next device they sign in from.
// ============================================================

export type MediumKey = 'english' | 'telugu'

/** Shared with onboarding, which writes it at the end of the flow. */
export const MEDIUM_STORAGE_KEY = 'preferred_practice_medium'

function isMedium(value: unknown): value is MediumKey {
  return value === 'english' || value === 'telugu'
}

/** The medium remembered from a manual switch, if any. */
export function readStoredMedium(): MediumKey | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(MEDIUM_STORAGE_KEY)
    return isMedium(stored) ? stored : null
  } catch {
    // Storage blocked — fall through to the caller's default.
    return null
  }
}

/** Remember a manual switch so the next visit opens the same way. */
export function storeMedium(medium: MediumKey): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MEDIUM_STORAGE_KEY, medium)
  } catch {
    // Nothing to do; the profile still carries the registered medium.
  }
}

/**
 * The tab to open, or null when there is nothing better than the caller's
 * default. Call this only once the profile has loaded — passing undefined
 * because auth is still resolving would let the stored value win a race it
 * should lose.
 */
export function resolvePreferredMedium(
  educationMedium?: string | null
): MediumKey | null {
  if (isMedium(educationMedium)) return educationMedium
  return readStoredMedium()
}
