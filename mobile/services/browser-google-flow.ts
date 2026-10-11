import { p256 } from '@noble/curves/nist.js';
import { bytesToHex, decryptHandoff } from '../utils/crypto';
import { AUTH_CALLBACK, checkGoogleAuthBackend } from './auth-readiness';
import type { SignInStage } from './native-google-flow';

type BrowserOpener = (url:string,callback:string)=>Promise<{type:string;url?:string}>;

// The browser calls the existing auth API. Only its encrypted, state-bound
// session handoff returns to this initiating app; no Google client secret exists here.
export async function browserGoogleLogin(origin:string,platform:'ANDROID'|'IOS',deviceId:string,randomBytes:(length:number)=>Uint8Array,open:BrowserOpener,transport:typeof fetch=fetch,onProgress?:(stage:SignInStage)=>void) {
  if(new URL(origin).protocol!=='https:')throw new Error('Google sign-in requires an HTTPS backend.');
  let privateKey:Uint8Array|undefined;
  try {
    onProgress?.('preparing');
    await checkGoogleAuthBackend(origin,transport,true);
    do { privateKey=randomBytes(32); } while(!p256.utils.isValidSecretKey(privateKey));
    const state=bytesToHex(randomBytes(32));
    const url=new URL('/mobile-auth',origin);
    url.searchParams.set('state',state);
    url.searchParams.set('publicKey',bytesToHex(p256.getPublicKey(privateKey,false)));
    url.searchParams.set('deviceId',deviceId);
    url.searchParams.set('platform',platform);
    onProgress?.('browser');
    const result=await open(url.toString(),AUTH_CALLBACK);
    if(result.type==='cancel'||result.type==='dismiss')return null;
    if(result.type!=='success'||!result.url)throw new Error('Google did not return a sign-in response. Please try again.');
    onProgress?.('exchanging');
    return decryptHandoff(privateKey,result.url,state);
  } finally { privateKey?.fill(0); }
}
