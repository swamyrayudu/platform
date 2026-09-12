// ============================================================
// app/api/auth/nonce/route.ts
// GET /api/auth/nonce — issue a single-use Google sign-in nonce
// ============================================================
// The client calls this immediately before initialising Google Identity
// Services and passes the returned value as `nonce`. Google embeds it in the
// ID token, and POST /api/auth/google then requires the token's `nonce` claim
// to match the HttpOnly cookie set here.
//
// WHY: without nonce binding, a Google ID token is a bearer credential that is
// valid for roughly an hour and accepted from anywhere. One captured from a
// server log, a proxy, or an intercepted mobile request could be replayed to
// mint a full session. Binding it to a nonce this server issued means a token
// is only usable by the browser that actually started the sign-in.
//
// The nonce is returned in the body (the browser must hand it to Google) AND
// stored in an HttpOnly cookie (so page scripts cannot forge the expectation).
// ============================================================

import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { setAuthNonceCookie } from '@/lib/auth/cookies'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  // 32 bytes base64url — well beyond guessing, and safe inside a JWT claim.
  const nonce = randomBytes(32).toString('base64url')

  const response = NextResponse.json({ nonce })
  setAuthNonceCookie(response, nonce)

  // Never cache: every sign-in attempt must get a fresh value.
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}
