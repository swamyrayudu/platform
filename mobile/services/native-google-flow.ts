import type { PublicUser } from '@/types/auth';
type GooglePicker = (webClientId:string,nonce:string)=>Promise<string|null>;
export type SignInStage = 'preparing' | 'choosing' | 'exchanging' | 'profile';

async function signInRequest(url:string,options:RequestInit,transport:typeof fetch) {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),25000);
  try {
    const response=await transport(url,{...options,signal:controller.signal});
    const body=await response.json().catch(()=>null);
    return {response,body};
  } catch {
    throw new Error('Could not finish Google sign-in. Check your connection and try again.');
  } finally { clearTimeout(timer); }
}

function readNonceCookie(response:Response,nonce:string) {
  const values=typeof response.headers.getSetCookie==='function'
    ? response.headers.getSetCookie() : [response.headers.get('set-cookie')||''];
  for(const value of values) {
    const match=value.match(/(?:^|,\s*)dsc_auth_nonce=([^;,\s]+)/);
    if(match?.[1]===encodeURIComponent(nonce))return `dsc_auth_nonce=${match[1]}`;
  }
  throw new Error('Could not receive the sign-in nonce cookie. Reload the app and try again.');
}

// Forward only the cookie actually issued for this attempt. React Native's
// cookie jar can race or retain older cookies; omit it so it cannot override
// our explicit nonce. No old session cookie or bearer token belongs here.
export async function nativeGoogleLogin(origin:string,webClientId:string,deviceId:string,pick:GooglePicker,transport:typeof fetch=fetch,onProgress?:(stage:SignInStage)=>void) {
  if(new URL(origin).protocol!=='https:')throw new Error('Google sign-in requires an HTTPS backend.');
  if(!/^[\w-]+\.apps\.googleusercontent\.com$/.test(webClientId))throw new Error('Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to the existing backend Web OAuth client ID.');
  onProgress?.('preparing');
  const {response:nonceResponse,body:nonceBody}=await signInRequest(`${origin}/api/auth/nonce`,{credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}},transport);
  if(!nonceResponse.ok||typeof nonceBody?.nonce!=='string'||!nonceBody.nonce)throw new Error('Could not prepare secure Google sign-in. Check your connection and try again.');
  const cookie=readNonceCookie(nonceResponse,nonceBody.nonce);
  onProgress?.('choosing');
  const idToken=await pick(webClientId,nonceBody.nonce);
  if(!idToken)return null;
  onProgress?.('exchanging');
  const {response,body}=await signInRequest(`${origin}/api/auth/google`,{method:'POST',credentials:'omit',headers:{Accept:'application/json','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({idToken,deviceId,platform:'ANDROID',userAgent:'RSDMobile/1.0 Android CredentialManager'})},transport);
  if(!response.ok)throw new Error(typeof body?.message==='string'?body.message:'Google sign-in was rejected by RSD Education. Check the Web OAuth client ID and Android signing configuration.');
  if(typeof body?.accessToken!=='string'||!body.accessToken||typeof body?.refreshToken!=='string'||!body.refreshToken)throw new Error('The backend did not return a mobile session. Please try again.');
  // This is the verified RSD profile from the existing login endpoint, not a
  // Google picker profile. Older backends without it still use /api/auth/me.
  const profile=body.user;
  const user:PublicUser|undefined=profile&&typeof profile.id==='string'&&typeof profile.email==='string'
    &&typeof profile.onboardingCompleted==='boolean'&&(profile.name===null||typeof profile.name==='string')
    &&Array.isArray(profile.learningGoals)?profile:undefined;
  return {accessToken:body.accessToken,refreshToken:body.refreshToken,...(user?{user}:{})};
}
