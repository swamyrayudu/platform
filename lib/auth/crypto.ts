// ============================================================
// lib/auth/crypto.ts — Cryptographic utilities (SERVER ONLY)
// ============================================================
// Uses Node.js built-in `crypto` and the `jose` package.
// Never import this file in client components.
// ============================================================

import { createHmac, randomBytes } from 'crypto'
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'
import type { AccessTokenPayload } from './types'
import { AuthError } from './errors'

// ---- Secret keys (validated at startup) -----------------------

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters. Set it in .env.local')
  }
  return new TextEncoder().encode(secret)
}

function getIpHashSecret(): string {
  const secret = process.env.IP_HASH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('IP_HASH_SECRET must be at least 16 characters. Set it in .env.local')
  }
  return secret
}

// ---- HMAC-SHA256 -----------------------------------------------

/**
 * HMAC-SHA256(value, secret) → hex string.
 * Used for IP hashing and refresh-token hashing.
 */
export function hmacSha256(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

// ---- Refresh token hashing ------------------------------------

/**
 * Hash a refresh token for safe DB storage.
 * Uses HMAC-SHA256 with the JWT_SECRET as the HMAC key.
 */
export function hashRefreshToken(token: string): string {
  return hmacSha256(token, process.env.JWT_SECRET!)
}

// ---- Opaque token generation ----------------------------------

/**
 * Generate a cryptographically secure random opaque token.
 * Default: 48 bytes = 96 hex chars.
 */
export function generateOpaqueToken(byteLength = 48): string {
  return randomBytes(byteLength).toString('hex')
}

// ---- JWT (Access Token) ---------------------------------------

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60 // 15 minutes

/**
 * Sign a short-lived JWT access token.
 * Payload contains only: sub, sid, sv, iat, exp.
 */
export async function signAccessToken(
  payload: Omit<AccessTokenPayload, 'iat' | 'exp'>
): Promise<string> {
  const secret = getJwtSecret()
  return new SignJWT({ sid: payload.sid, sv: payload.sv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret)
}

/**
 * Verify and decode a JWT access token.
 * Throws AuthError on invalid, expired, or tampered tokens.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.sv !== 'number'
    ) {
      throw new AuthError('UNAUTHORIZED', 401, 'Invalid token claims')
    }

    return {
      sub: payload.sub,
      sid: payload.sid as string,
      sv: payload.sv as number,
      iat: payload.iat!,
      exp: payload.exp!,
    }
  } catch (err) {
    if (err instanceof AuthError) throw err
    if (err instanceof joseErrors.JWTExpired) {
      throw new AuthError('SESSION_EXPIRED', 401, 'Access token expired')
    }
    throw new AuthError('UNAUTHORIZED', 401, 'Invalid access token')
  }
}

// ---- IP hashing -----------------------------------------------

/**
 * Hash an IP address using HMAC-SHA256 with IP_HASH_SECRET.
 * Returns 'unknown' if the IP is empty or unknown.
 */
export function hashIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown'
  return hmacSha256(ip, getIpHashSecret())
}

// Export TTL for use in session creation
export { ACCESS_TOKEN_TTL_SECONDS }
