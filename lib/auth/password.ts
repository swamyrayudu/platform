// ============================================================
// lib/auth/password.ts — Password hashing (SERVER ONLY)
// ============================================================
// scrypt from Node's crypto: memory-hard, no native dependency. Stored as
//   scrypt$<N>$<r>$<p>$<salt base64>$<key base64>
// so the cost can be raised later without breaking existing hashes.
// ============================================================

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'

const N = 16384
const R = 8
const P = 1
const KEY_LENGTH = 64

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keyLength, options, (err, key) => (err ? reject(err) : resolve(key))))
}

/** Why a new password is not accepted, or null when it is. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string') return 'Enter a password.'
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letters and numbers.'
  return null
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P })
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !key) return false
  const expected = Buffer.from(key, 'base64')
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/**
 * A hash of nothing, checked when the email has no password account, so a
 * wrong email takes as long as a wrong password and does not reveal which
 * emails have accounts.
 */
let dummy: Promise<string> | undefined
export function dummyHash(): Promise<string> {
  return (dummy ??= hashPassword(randomBytes(16).toString('hex')))
}
