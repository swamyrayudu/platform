// ============================================================
// lib/auth/google.ts — Google ID token verification (SERVER ONLY)
// ============================================================
// Uses google-auth-library to verify tokens issued by Google.
// Verifies: signature, audience (GOOGLE_CLIENT_ID), expiry.
// Never trust the frontend's claim about who the user is.
// ============================================================

import { OAuth2Client } from 'google-auth-library'
import { AuthError } from './errors'
import type { GoogleProfile } from './types'

let _client: OAuth2Client | null = null

function getOAuth2Client(): OAuth2Client {
  if (!_client) {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is not set')
    }
    _client = new OAuth2Client(clientId)
  }
  return _client
}

/**
 * Verify a Google ID token received from the client (web or mobile).
 *
 * The token is cryptographically verified against Google's public keys.
 * Returns the verified profile or throws AuthError('AUTH_INVALID_TOKEN').
 *
 * @param idToken       - The credential/id_token from Google Sign-In
 * @param expectedNonce  - The nonce this server issued for this sign-in attempt.
 *                         REQUIRED. Binding the token to a server-issued nonce
 *                         is what stops a captured ID token being replayed from
 *                         somewhere else during its ~1h validity.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce: string
): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is not set')
  }

  try {
    const client = getOAuth2Client()
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      throw new AuthError('AUTH_INVALID_TOKEN', 401, 'Empty Google token payload')
    }

    // Google sub is the stable, unique identifier for the user
    const googleId = payload.sub
    const email = payload.email

    if (!googleId || !email) {
      throw new AuthError('AUTH_INVALID_TOKEN', 401, 'Missing required Google claims')
    }

    if (!payload.email_verified) {
      throw new AuthError('AUTH_INVALID_TOKEN', 401, 'Google email is not verified')
    }

    // Bind the token to the sign-in attempt this server started.
    // Compared after signature/aud/iss/exp so an attacker learns nothing about
    // the nonce from a token that was invalid anyway.
    if (!expectedNonce) {
      throw new AuthError('AUTH_INVALID_TOKEN', 401, 'Missing sign-in nonce')
    }
    if (payload.nonce !== expectedNonce) {
      throw new AuthError('AUTH_INVALID_TOKEN', 401, 'Google token nonce mismatch')
    }

    return {
      googleId,
      email,
      name: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    }
  } catch (err) {
    if (err instanceof AuthError) throw err
    // google-auth-library throws on invalid/expired tokens
    console.error('[Auth] Google token verification failed:', (err as Error).message)
    throw new AuthError('AUTH_INVALID_TOKEN', 401, 'Google token verification failed')
  }
}
