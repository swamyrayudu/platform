import { createHmac, timingSafeEqual, createECDH, createHash, createCipheriv, randomBytes } from 'node:crypto'

export const MOBILE_GOOGLE_COOKIE = 'rsd_mobile_google_context'
export interface MobileGoogleContext { state: string; publicKey: string; deviceId: string; platform: 'ANDROID' | 'IOS'; nonce: string; issuedAt: number }
function signingKey(secret: string) {
  if (secret.length < 32) throw new Error('Mobile sign-in requires the existing JWT_SECRET configuration.')
  return createHmac('sha256', secret).update('rsd-mobile-google-redirect:v1').digest()
}
export function validMobileRequest(value: Pick<MobileGoogleContext, 'state' | 'publicKey' | 'deviceId' | 'platform'>) {
  if (!/^[a-f0-9]{64}$/.test(value.state) || !/^04[a-f0-9]{128}$/.test(value.publicKey) ||
      !/^[a-f0-9-]{36}$/.test(value.deviceId) || !['ANDROID', 'IOS'].includes(value.platform)) return false
  try { const curve = createECDH('prime256v1'); curve.generateKeys(); curve.computeSecret(Buffer.from(value.publicKey, 'hex')); return true } catch { return false }
}
export function sealMobileContext(context: MobileGoogleContext, secret: string) {
  const payload = Buffer.from(JSON.stringify(context)).toString('base64url')
  return payload + '.' + createHmac('sha256', signingKey(secret)).update(payload).digest('base64url')
}
export function readMobileContext(value: string, secret: string, now = Date.now()): MobileGoogleContext {
  if (value.length > 2500 || !/^[\w-]+\.[\w-]+$/.test(value)) throw new Error('Invalid mobile sign-in request.')
  const [payload, signature] = value.split('.')
  const expected = createHmac('sha256', signingKey(secret)).update(payload).digest(), actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid mobile sign-in request.')
  const context = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as MobileGoogleContext
  if (!validMobileRequest(context) || typeof context.nonce !== 'string' || !/^[\w-]{43}$/.test(context.nonce) ||
      !Number.isFinite(context.issuedAt) || now - context.issuedAt > 300000 || context.issuedAt > now + 10000) throw new Error('Mobile sign-in request expired.')
  return context
}
export function readCookie(request: Request, name: string): string {
  const values = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '='))
  return values.length === 1 ? values[0].slice(name.length + 1) : ''
}
export async function exchangeMobileCredential(request: Request, secret: string, exchange: (request: Request) => Promise<Response>) {
  const raw = await request.text()
  if (raw.length > 20000) throw new Error('Invalid Google response.')
  let form: URLSearchParams
  if (request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) form = new URLSearchParams(raw)
  else if (request.headers.get('content-type')?.startsWith('application/json')) {
    const body = JSON.parse(raw) as Record<string, unknown>
    if (typeof body.credential !== 'string' || typeof body.g_csrf_token !== 'string') throw new Error('Invalid Google response.')
    form = new URLSearchParams({ credential: body.credential, g_csrf_token: body.g_csrf_token })
  } else throw new Error('Invalid Google response.')
  const csrf = readCookie(request, 'g_csrf_token'), submitted = form.get('g_csrf_token') || ''
  if (!csrf || csrf.length > 512 || csrf !== submitted || form.getAll('g_csrf_token').length !== 1) throw new Error('Google sign-in security check failed. Start again from the app.')
  const context = readMobileContext(readCookie(request, MOBILE_GOOGLE_COOKIE), secret)
  const credential = form.get('credential') || ''
  if (!credential || credential.length > 16000 || form.getAll('credential').length !== 1) throw new Error('Missing Google sign-in response.')
  const headers = new Headers(request.headers)
  headers.delete('authorization'); headers.delete('content-length')
  headers.set('content-type', 'application/json')
  // Bind Google's POST to the nonce issued at startup in a signed HttpOnly
  // context, without changing the website's existing nonce/session cookies.
  headers.set('cookie', `dsc_auth_nonce=${context.nonce}`)
  const response = await exchange(new Request(new URL('/api/auth/google', request.url), { method: 'POST', headers,
    body: JSON.stringify({ idToken: credential, deviceId: context.deviceId, platform: context.platform, userAgent: request.headers.get('user-agent') || 'RSDMobile browser redirect' }) }))
  const tokens = await response.json()
  if (!response.ok || typeof tokens.accessToken !== 'string' || !tokens.accessToken || typeof tokens.refreshToken !== 'string' || !tokens.refreshToken) throw new Error('RSD Education could not finish Google sign-in. Close this page and try again from the app.')
  const sender = createECDH('prime256v1'); sender.generateKeys()
  const key = createHash('sha256').update(sender.computeSecret(Buffer.from(context.publicKey, 'hex'))).digest()
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(context.state))
  const payload = Buffer.concat([cipher.update(JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, issuedAt: Date.now() })), cipher.final(), cipher.getAuthTag()])
  const callback = new URL('rsdeducation://auth/callback')
  callback.search = new URLSearchParams({ state: context.state, key: sender.getPublicKey().toString('hex'), iv: iv.toString('hex'), payload: payload.toString('hex') }).toString()
  key.fill(0)
  return { context, callback: callback.toString() }
}
export function mobileAppReturnUrl(callback: string, platform: 'ANDROID' | 'IOS') {
  return platform === 'ANDROID' ? callback.replace('rsdeducation:', 'intent:') + '#Intent;scheme=rsdeducation;package=com.rsdeducation.student;end' : callback
}
