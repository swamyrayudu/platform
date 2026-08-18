// ============================================================
// lib/auth/device-id.ts — Browser device ID (CLIENT ONLY)
// ============================================================
// Generates and persists a unique device identifier in
// localStorage. This is for web (Next.js) only.
// React Native generates device IDs differently (see mobile-reference.ts)
// ============================================================

const DEVICE_ID_KEY = 'dsc_device_id'

/**
 * Get or create a persistent browser device ID.
 * - Reads from localStorage on subsequent visits
 * - Generates a new UUID v4 on first visit
 *
 * Only callable in the browser (not in SSR/server components).
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    throw new Error('getOrCreateDeviceId() can only be called in the browser')
  }

  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY)
    if (stored) return stored

    // Generate a new UUID v4
    const id =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : generateUuidFallback()

    localStorage.setItem(DEVICE_ID_KEY, id)
    return id
  } catch {
    // localStorage can be blocked (private mode, storage disabled)
    // Return a session-scoped fallback — won't persist across sessions
    return generateUuidFallback()
  }
}

/** UUID v4 fallback for environments without crypto.randomUUID */
function generateUuidFallback(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
