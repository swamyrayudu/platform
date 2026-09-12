// ============================================================
// lib/auth/ip.ts — Trusted client-IP extraction (SERVER ONLY)
// ============================================================
// ALL auth code must use getClientIp() instead of reading
// x-forwarded-for directly. This is the single source of truth.
// ============================================================

import { hashIp } from './crypto'

/**
 * Is this process behind a reverse proxy we trust to set forwarding headers?
 *
 * Explicit configuration always wins. When TRUST_PROXY is unset we fall back to
 * detecting a platform that overwrites `x-forwarded-for` at the edge, so a
 * production deployment does not silently lose per-IP rate limiting just
 * because an env var was forgotten.
 */
function isBehindTrustedProxy(): boolean {
  const configured = process.env.TRUST_PROXY
  if (configured === 'true') return true
  if (configured === 'false') {
    warnIfProductionWithoutProxyTrust()
    return false
  }
  // Platforms that terminate at their own edge and rewrite x-forwarded-for.
  return process.env.VERCEL === '1'
}

let warnedAboutProxyTrust = false

/**
 * With no trusted proxy every request resolves to the same 'unknown' IP, so all
 * per-IP rate limits collapse into ONE shared bucket. That is the safe failure
 * mode (a bypass would be worse), but in production it means a single abuser
 * can exhaust the login limit for everybody. Make that loud rather than silent.
 */
function warnIfProductionWithoutProxyTrust(): void {
  if (warnedAboutProxyTrust) return
  if (process.env.NODE_ENV !== 'production') return
  warnedAboutProxyTrust = true
  console.error(
    '[auth/ip] TRUST_PROXY=false in production: client IPs cannot be determined, ' +
      'so every per-IP rate limit shares a single bucket. Set TRUST_PROXY=true ' +
      'when running behind Vercel/nginx so x-forwarded-for can be trusted.'
  )
}

/**
 * Extract the client IP from a request.
 *
 * SECURITY — why both headers sit behind the same guard:
 *   `x-forwarded-for` AND `x-real-ip` are both ordinary request headers. A
 *   client can send either one with any value it likes. They are only
 *   meaningful when a trusted proxy sits in front and OVERWRITES them.
 *
 *   This function previously read `x-real-ip` outside the trust check, which
 *   meant that with TRUST_PROXY=false — the configured value — the sole source
 *   of the client IP was a header the caller controls. Since every auth rate
 *   limit is keyed on this value (`auth:google:${ipHash}`, refresh, logout),
 *   an attacker could send a fresh `X-Real-IP` per request and land in a new
 *   bucket every time, defeating the limiter entirely. The same value is
 *   stored as `ip_hash` on sessions, devices and security_events, so it could
 *   also be used to attribute one's own logins to an arbitrary address.
 *
 * When the proxy is NOT trusted we return 'unknown' rather than a forgeable
 * value. That is deliberately a single shared bucket: a coarse, honest limit
 * is safer than a per-request bypass. Set TRUST_PROXY=true in production.
 */
export function getClientIp(request: Request): string {
  if (!isBehindTrustedProxy()) {
    // No trusted proxy: every forwarding header is attacker-controlled.
    return 'unknown'
  }

  // x-forwarded-for can be a comma-separated chain; the leftmost is the client.
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim()
    if (firstIp) return firstIp
  }

  // x-real-ip is set by some proxies (nginx) as a single value.
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

/**
 * Whether the IP returned by getClientIp for this request is attributable to a
 * real client. Callers that need to fail closed (or fall back to a different
 * rate-limit key, such as the authenticated user id) can branch on this.
 */
export function isClientIpTrusted(request: Request): boolean {
  return isBehindTrustedProxy() && getClientIp(request) !== 'unknown'
}

/**
 * Full pipeline: extract IP → HMAC-SHA256 → ip_hash string.
 * This is what gets stored in the database.
 */
export function getHashedIp(request: Request): string {
  const ip = getClientIp(request)
  return hashIp(ip)
}
