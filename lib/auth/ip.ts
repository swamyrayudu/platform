// ============================================================
// lib/auth/ip.ts — Trusted client-IP extraction (SERVER ONLY)
// ============================================================
// ALL auth code must use getClientIp() instead of reading
// x-forwarded-for directly. This is the single source of truth.
// ============================================================

import { hashIp } from './crypto'

/**
 * Extract the real client IP from a request.
 *
 * When TRUST_PROXY=true (Vercel / behind a reverse proxy):
 *   - Reads the first address from x-forwarded-for
 *   - The proxy is trusted to set this correctly
 *
 * When TRUST_PROXY=false (direct, local dev):
 *   - Only uses x-real-ip as a fallback, then returns 'unknown'
 *
 * NEVER trust x-forwarded-for blindly — clients can forge it
 * if your server is not behind a trusted reverse proxy.
 */
export function getClientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY === 'true'

  if (trustProxy) {
    // x-forwarded-for can be a comma-separated list; the leftmost is the client
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      const firstIp = forwarded.split(',')[0].trim()
      if (firstIp) return firstIp
    }
  }

  // x-real-ip is set by some proxies (nginx) as a single value
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

/**
 * Full pipeline: extract IP → HMAC-SHA256 → ip_hash string.
 * This is what gets stored in the database.
 */
export function getHashedIp(request: Request): string {
  const ip = getClientIp(request)
  return hashIp(ip)
}
