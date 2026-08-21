// ============================================================
// lib/auth/errors.ts — Standardized auth errors (SERVER ONLY)
// ============================================================

export type AuthErrorCode =
  | 'AUTH_INVALID_TOKEN'
  | 'UNAUTHORIZED'
  | 'SESSION_REVOKED'
  | 'SESSION_EXPIRED'
  | 'REFRESH_TOKEN_REUSE_DETECTED'
  | 'PREMIUM_REQUIRED'
  | 'ADMIN_REQUIRED'
  | 'RATE_LIMITED'
  | 'DEVICE_NOT_FOUND'
  | 'INTERNAL_ERROR'

/**
 * Typed auth error that carries an HTTP status code.
 * Thrown by auth utilities and caught by route handlers.
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly status: number,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'AuthError'
  }
}

/**
 * Build a standardized JSON error Response.
 * Never includes internal details, stack traces, or raw tokens.
 */
export function errorResponse(
  code: AuthErrorCode,
  status: number,
  extra?: Record<string, unknown>
): Response {
  return Response.json(
    { error: code, ...extra },
    { status }
  )
}

/** Map common AuthError codes to their default HTTP status. */
export const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  AUTH_INVALID_TOKEN: 401,
  UNAUTHORIZED: 401,
  SESSION_REVOKED: 401,
  SESSION_EXPIRED: 401,
  REFRESH_TOKEN_REUSE_DETECTED: 401,
  PREMIUM_REQUIRED: 403,
  ADMIN_REQUIRED: 403,
  RATE_LIMITED: 429,
  DEVICE_NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
}

/**
 * Convert any thrown error into a safe Response.
 * Prevents internal details from leaking to clients.
 */
export function handleAuthError(err: unknown): Response {
  if (err instanceof AuthError) {
    return errorResponse(err.code, err.status)
  }
  // Log unexpected errors server-side without exposing to client
  console.error('[Auth] Unexpected error:', err)
  return errorResponse('INTERNAL_ERROR', 500)
}
