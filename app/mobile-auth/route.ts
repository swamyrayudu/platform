import { randomBytes } from 'node:crypto'

// Browser-only compatibility adapter. Existing API handlers own every auth decision.
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams
  // Public readiness contract: no cookies, credentials or sessions are returned.
  // The native app checks this before opening a browser on an undeployed route.
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const verificationClientId = process.env.GOOGLE_CLIENT_ID
  if (query.get('check') === '1') {
    const ready = Boolean(clientId && verificationClientId && clientId === verificationClientId)
    return Response.json(ready
      ? { ready: true, protocol: 1, callback: 'rsdeducation://auth/callback' }
      : { ready: false, error: 'GOOGLE_CONFIG_REQUIRED', message: 'Set GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_CLIENT_ID to the same existing Web OAuth client ID on the backend.' },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
  }
  const state = query.get('state') ?? ''
  const publicKey = query.get('publicKey') ?? ''
  const deviceId = query.get('deviceId') ?? ''
  const platform = query.get('platform') ?? ''
  if (!/^[a-f0-9]{64}$/.test(state) || !/^04[a-f0-9]{128}$/.test(publicKey) ||
      !/^[a-f0-9-]{36}$/.test(deviceId) || !['ANDROID', 'IOS'].includes(platform)) {
    return new Response('Start sign-in from the RSD Education app.', { status: 400 })
  }
  if (!clientId || !verificationClientId || clientId !== verificationClientId) return new Response('Google sign-in is unavailable. Check the backend Web OAuth client configuration.', { status: 503 })
  const scriptNonce = randomBytes(18).toString('base64')
  const config = JSON.stringify({ state, publicKey, deviceId, platform, clientId }).replace(/</g, '\\u003c')
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RSD Education — Google sign-in</title>
<style nonce="${scriptNonce}">body{font-family:system-ui;background:#fffdf8;color:#242526;margin:0;display:grid;place-items:center;min-height:100vh}main{padding:32px;max-width:360px;text-align:center;border:1px solid #ecdfbd;border-radius:24px;background:white}h1{font-size:28px}p{line-height:1.6;color:#666}#google{display:flex;justify-content:center}#message{min-height:48px}</style></head>
<body><main><h1>RSD Education</h1><p>Continue with Google to return to your study app.</p><div id="google"></div><p id="message" role="status">Preparing secure sign-in…</p><a id="return" hidden>Return to RSD Education</a><button id="retry" hidden>Try again</button></main>
<script nonce="${scriptNonce}">
const config=${config};
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=value=>Uint8Array.from(value.match(/.{2}/g),b=>parseInt(b,16));
let signing=false;
async function initialize(){
  try{
    if(!crypto.subtle)throw new Error('Secure sign-in requires an HTTPS backend.');
    const res=await fetch('/api/auth/nonce',{credentials:'same-origin',cache:'no-store'});
    const body=await res.json();if(!res.ok)throw new Error(body.message||body.error);
    google.accounts.id.initialize({client_id:config.clientId,nonce:body.nonce,ux_mode:'popup',callback:finish});
    document.getElementById('google').replaceChildren();
    google.accounts.id.renderButton(document.getElementById('google'),{theme:'outline',size:'large',text:'continue_with'});
    document.getElementById('message').textContent='Choose your Google account to sign in to RSD Education.';
  }catch(e){document.getElementById('message').textContent=e.message;document.getElementById('retry').hidden=false;}
}
async function finish(credential){
  if(signing)return;signing=true;
  try{
    document.getElementById('message').textContent='Signing in…';
    const res=await fetch('/api/auth/google',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:credential.credential,deviceId:config.deviceId,platform:config.platform,userAgent:'RSDMobile/1.0 '+navigator.userAgent})});
    const tokens=await res.json();if(!res.ok)throw new Error(tokens.message||tokens.error||'Sign-in failed');
    if(!tokens.accessToken||!tokens.refreshToken)throw new Error('Missing mobile session');
    const recipient=await crypto.subtle.importKey('raw',unhex(config.publicKey),{name:'ECDH',namedCurve:'P-256'},false,[]);
    const ephemeral=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
    const secret=await crypto.subtle.deriveBits({name:'ECDH',public:recipient},ephemeral.privateKey,256);
    const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',secret),'AES-GCM',false,['encrypt']);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const payload=new TextEncoder().encode(JSON.stringify({accessToken:tokens.accessToken,refreshToken:tokens.refreshToken,issuedAt:Date.now()}));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(config.state)},key,payload);
    const pub=await crypto.subtle.exportKey('raw',ephemeral.publicKey);
    const redirect=new URL('rsdeducation://auth/callback');
    redirect.searchParams.set('state',config.state);redirect.searchParams.set('key',hex(pub));redirect.searchParams.set('iv',hex(iv));redirect.searchParams.set('payload',hex(ciphertext));
    // Some browsers require a fresh user gesture for an external app link.
    const returnLink=document.getElementById('return');returnLink.href=redirect.toString();returnLink.hidden=false;
    document.getElementById('message').textContent='Signed in. Returning to your app… If it does not open, tap Return to RSD Education.';location.replace(redirect.toString());
  }catch(e){signing=false;document.getElementById('message').textContent=e.message;document.getElementById('retry').hidden=false;}
}
document.getElementById('retry').onclick=()=>{document.getElementById('retry').hidden=true;initialize();};
const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=initialize;script.onerror=()=>{document.getElementById('message').textContent='Could not connect to Google. Check your connection.';};document.head.appendChild(script);
</script></body></html>`
  return new Response(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    // Follow GIS's recommended policy so Google can receive our origin.
    // Cross-origin requests still exclude this page's state/key query string.
    'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${scriptNonce}' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com; connect-src 'self' https://accounts.google.com; style-src 'unsafe-inline' https://accounts.google.com/gsi/style; img-src https://*.googleusercontent.com https://accounts.google.com; base-uri 'none'; frame-ancestors 'none'`,
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  } })
}
