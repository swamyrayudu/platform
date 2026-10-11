import { requireOptionalNativeModule } from 'expo';
import { GOOGLE_WEB_CLIENT_ID, API_BASE_URL } from '@/utils/config';
import { getDeviceId } from './vault';
import { nativeGoogleLogin, type SignInStage } from './native-google-flow';

interface GoogleModule { signIn(webClientId:string,nonce:string):Promise<string|null>; clearSession():Promise<void>; getSetupInfo?():{packageName:string;sha1Fingerprints:string[]} }
const nativeGoogle=requireOptionalNativeModule<GoogleModule>('RsdGoogleAuth');

function reportSetup() {
  if(!__DEV__)return;
  try {
    const info=nativeGoogle?.getSetupInfo?.();
    // These are public OAuth registration values, not tokens or provider errors.
    console.warn('RSD_GOOGLE_AUTH_SETUP',JSON.stringify({packageName:info?.packageName||'com.rsdeducation.student',sha1Fingerprints:info?.sha1Fingerprints||['Rebuild the development APK to read its certificate.'],webClientId:GOOGLE_WEB_CLIENT_ID}));
  } catch { /* Diagnostics must never mask the original sign-in failure. */ }
}

export async function signInWithNativeGoogle(onProgress?:(stage:SignInStage)=>void) {
  if(!nativeGoogle)throw new Error('This RSD Education build does not include native Google sign-in. Build and install the updated Android development app; reloading JavaScript alone cannot add it.');
  return nativeGoogleLogin(API_BASE_URL,GOOGLE_WEB_CLIENT_ID,await getDeviceId(),async(clientId,nonce)=>{
    try {
      const token=await nativeGoogle.signIn(clientId,nonce);
      if(!token)reportSetup();
      return token;
    } catch(error) { reportSetup();throw error; }
  },fetch,onProgress);
}
export async function clearNativeGoogleSession() { await nativeGoogle?.clearSession(); }
