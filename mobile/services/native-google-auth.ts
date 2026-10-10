import { requireOptionalNativeModule } from 'expo';
import { GOOGLE_WEB_CLIENT_ID, API_BASE_URL } from '@/utils/config';
import { getDeviceId } from './vault';
import { nativeGoogleLogin } from './native-google-flow';

interface GoogleModule { signIn(webClientId:string,nonce:string):Promise<string|null>; clearSession():Promise<void> }
const nativeGoogle=requireOptionalNativeModule<GoogleModule>('RsdGoogleAuth');

export async function signInWithNativeGoogle() {
  if(!nativeGoogle)throw new Error('This RSD Education build does not include native Google sign-in. Build and install the updated Android development app; reloading JavaScript alone cannot add it.');
  return nativeGoogleLogin(API_BASE_URL,GOOGLE_WEB_CLIENT_ID,await getDeviceId(),(clientId,nonce)=>nativeGoogle.signIn(clientId,nonce));
}
export async function clearNativeGoogleSession() { await nativeGoogle?.clearSession(); }
