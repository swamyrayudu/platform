import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { GOOGLE_WEB_CLIENT_ID, API_BASE_URL } from '@/utils/config';
import { getDeviceId } from './vault';
import { nativeGoogleLogin, NativePickerError, type SignInStage } from './native-google-flow';

interface GoogleModule { signIn(webClientId:string,nonce:string):Promise<string|null>; clearSession():Promise<void>; getSetupInfo?():{packageName:string;sha1Fingerprints:string[]} }
const nativeGoogle=requireOptionalNativeModule<GoogleModule>('RsdGoogleAuth');
// After the account sheet fails once, the rest of this app run uses the browser
// so a phone without working in-app sign-in does not fail on every tap.
let pickerFailed=false;

function reportSetup() {
  if(!__DEV__)return;
  try {
    const info=nativeGoogle?.getSetupInfo?.();
    // These are public OAuth registration values, not tokens or provider errors.
    console.warn('RSD_GOOGLE_AUTH_SETUP',JSON.stringify({packageName:info?.packageName||'com.rsdeducation.student',sha1Fingerprints:info?.sha1Fingerprints||['Rebuild the development APK to read its certificate.'],webClientId:GOOGLE_WEB_CLIENT_ID}));
  } catch { /* Diagnostics must never mask the original sign-in failure. */ }
}

/** Android's in-app Google account sheet, or null when this build or phone cannot use it. */
export function nativeGoogleSignIn() {
  const module=nativeGoogle;
  if(Platform.OS!=='android'||!module||pickerFailed)return null;
  return async(onProgress?:(stage:SignInStage)=>void)=>nativeGoogleLogin(API_BASE_URL,GOOGLE_WEB_CLIENT_ID,await getDeviceId(),async(clientId,nonce)=>{
    try {
      const token=await module.signIn(clientId,nonce);
      if(!token)reportSetup();
      return token;
    } catch(error) { reportSetup();pickerFailed=true;throw new NativePickerError(error); }
  },fetch,onProgress);
}
export async function clearNativeGoogleSession() { await nativeGoogle?.clearSession(); }
