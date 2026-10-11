import { randomBytes } from 'node:crypto'
import { GET as issueNonce } from '../api/auth/nonce/route'
import { MOBILE_GOOGLE_COOKIE, validMobileRequest, sealMobileContext, exchangeMobileCredential, mobileAppReturnUrl, type MobileGoogleContext } from '../../lib/mobile-google-bridge'

// Only the mobile browser adapter changes. Every session is still created by
// the existing Google handler, including its nonce, signature and rate checks.
export const dynamic = 'force-dynamic'
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!))

function page(content: string, script = '', status = 200) {
  const nonce = randomBytes(18).toString('base64')
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RSD Education — Google sign-in</title>' +
    '<style nonce="' + nonce + '">body{font-family:system-ui;background:#f4f2ed;color:#302d55;margin:0;display:grid;place-items:center;min-height:100vh}main{margin:20px;padding:28px;max-width:380px;text-align:center;border:1px solid #ddd;border-radius:24px;background:white}h1{font-size:26px}p{line-height:1.6}#google{display:flex;justify-content:center}a{display:block;padding:16px;margin-top:18px;background:#302d55;color:white;border-radius:14px;text-decoration:none}#message{min-height:48px}</style></head>' +
    '<body><main><h1>RSD Education</h1>' + content + '</main>' +
    (script ? '<script nonce="' + nonce + '">' + script + '</script>' : '') + '</body></html>'
  return new Response(html, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; script-src 'nonce-" + nonce + "' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com; connect-src 'self' https://accounts.google.com; style-src 'unsafe-inline' https://accounts.google.com/gsi/style; img-src https://*.googleusercontent.com https://accounts.google.com; form-action 'self' https://accounts.google.com; base-uri 'none'; frame-ancestors 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  } })
}
function clearContext(response: Response) {
  response.headers.append('Set-Cookie', MOBILE_GOOGLE_COOKIE + '=; Path=/mobile-auth; HttpOnly; Secure; SameSite=None; Max-Age=0')
  response.headers.append('Set-Cookie', 'dsc_auth_nonce=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0')
  return response
}
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url), query = url.searchParams
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, verificationClientId = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.JWT_SECRET || ''
  const ready = Boolean(clientId && verificationClientId && clientId === verificationClientId && secret.length >= 32)
  if (query.get('check') === '1') return Response.json(ready
    ? { ready: true, protocol: 1, browserMode: 'redirect', callback: 'rsdeducation://auth/callback' }
    : { ready: false, error: 'GOOGLE_CONFIG_REQUIRED', message: 'Check the existing backend Google client IDs and JWT_SECRET configuration.' },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
  const input = { state: query.get('state') || '', publicKey: query.get('publicKey') || '', deviceId: query.get('deviceId') || '', platform: query.get('platform') as 'ANDROID' | 'IOS' }
  if (!validMobileRequest(input)) return page('<p>Start Google sign-in from the RSD Education app.</p>', '', 400)
  if (!ready) return page('<p>Google sign-in is unavailable. Check the existing backend configuration.</p>', '', 503)
  const nonceResponse = await issueNonce(), { nonce } = await nonceResponse.json()
  const context: MobileGoogleContext = { ...input, nonce, issuedAt: Date.now() }
  // Keep a fixed Google redirect URI. App state is signed in an HttpOnly cookie.
  const config = JSON.stringify({ clientId, nonce, loginUri: new URL('/mobile-auth', url.origin).toString() }).replace(/</g, '\\u003c')
  const response = page('<p>Continue with Google to return to your study app.</p><div id="google"></div><p id="message" role="status">Preparing secure sign-in…</p>', [
    'const config=' + config + ';',
    'const message=document.getElementById("message");',
    'function initialize(){try{',
    'google.accounts.id.initialize({client_id:config.clientId,nonce:config.nonce,ux_mode:"redirect",login_uri:config.loginUri});',
    'google.accounts.id.renderButton(document.getElementById("google"),{theme:"outline",size:"large",text:"continue_with"});',
    'message.textContent="Choose your Google account. After signing in, tap Open RSD Education.";',
    '}catch{message.textContent="Google sign-in could not start. Close this page and try again from the app.";}}',
    'const script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.onload=initialize;',
    'script.onerror=()=>{message.textContent="Could not connect to Google. Check your connection and try again.";};document.head.appendChild(script);',
  ].join('\n'))
  response.headers.append('Set-Cookie', MOBILE_GOOGLE_COOKIE + '=' + sealMobileContext(context, secret) + '; Path=/mobile-auth; HttpOnly; Secure; SameSite=None; Max-Age=300')
  for (const cookie of nonceResponse.headers.getSetCookie()) response.headers.append('Set-Cookie', cookie)
  return response
}
export async function POST(request: Request): Promise<Response> {
  try {
    const result = await exchangeMobileCredential(request, process.env.JWT_SECRET || '', async authRequest => {
      const { POST: existingLogin } = await import('../api/auth/google/route')
      return existingLogin(authRequest)
    })
    // Chrome needs a fresh gesture to reliably launch an external app. Keep
    // this page visible and target RSD's package instead of navigating blindly.
    const appUrl = mobileAppReturnUrl(result.callback, result.context.platform)
    return clearContext(page('<p role="status">Google sign-in completed. Tap below to open your study app.</p><a href="' + escapeHtml(appUrl) + '">Open RSD Education</a><p>If the app does not open, make sure RSD Education is installed and this sign-in was started from the app.</p>'))
  } catch {
    // Never render or log a submitted credential or provider exception.
    return clearContext(page('<p role="alert">Google sign-in could not finish (MOBILE_GOOGLE_RETURN_FAILED). Close this page and start sign-in again from RSD Education.</p>', '', 400))
  }
}
