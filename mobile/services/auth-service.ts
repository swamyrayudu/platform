import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { API_BASE_URL, validateApiUrl } from '@/utils/config';
import { api } from './api-client';
import { tokenStore, getDeviceId } from './vault';
import { clearNativeGoogleSession, nativeGoogleSignIn } from './native-google-auth';
import { browserGoogleLogin } from './browser-google-flow';
import { withBrowserBackup, type SignInStage } from './native-google-flow';
import type { PublicUser, LearningGoal, EducationMedium } from '@/types/auth';
let signing = false;
export const authService = {
  me: () => api.request<PublicUser>('/api/auth/me'),
  async signIn(onProgress?:(stage:SignInStage)=>void) {
    if (isRunningInExpoGo()) throw new Error('Google sign-in needs the updated RSD Education development build. Expo Go does not include this app’s Google sign-in integration.');
    if (signing) throw new Error('Sign-in is already in progress.');
    signing = true;
    try {
      validateApiUrl(API_BASE_URL);
      if (new URL(API_BASE_URL).protocol !== 'https:') throw new Error('Google sign-in requires an HTTPS backend.');
      // Android: in-app Google account sheet; the browser is the backup (and iOS's only way).
      const native=nativeGoogleSignIn();
      const tokens=await withBrowserBackup(native&&(()=>native(onProgress)),
        async()=>browserGoogleLogin(API_BASE_URL,Platform.OS==='ios'?'IOS':'ANDROID',await getDeviceId(),Crypto.getRandomBytes,WebBrowser.openAuthSessionAsync,fetch,onProgress));
      if(!tokens)return null;
      await tokenStore.write(tokens);
      onProgress?.('profile');
      try { return await authService.me(); }
      catch (err) { await tokenStore.clear(); throw err; }
    } finally { signing = false; }
  },
  /**
   * Email + password, for accounts made by RSD Education (for example a store
   * reviewer's); students sign in with Google. Same tokens as Google sign-in.
   */
  async signInWithPassword(email:string,password:string) {
    if (signing) throw new Error('Sign-in is already in progress.');
    signing = true;
    try {
      validateApiUrl(API_BASE_URL);
      let res:Response;
      try {
        res=await fetch(`${API_BASE_URL}/api/auth/password`,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email,password,deviceId:await getDeviceId(),platform:Platform.OS==='ios'?'IOS':'ANDROID'})});
      } catch { throw new Error('Could not reach RSD Education. Check your connection and try again.'); }
      const data=await res.json().catch(()=>null) as {accessToken?:string;refreshToken?:string;error?:string;message?:string;retryAfter?:number}|null;
      if(res.status===429)throw new Error(`Too many attempts. Please try again in ${Math.ceil((data?.retryAfter??60)/60)} minute(s).`);
      if(!res.ok||!data?.accessToken||!data.refreshToken)throw new Error(data?.message??(res.status===401?'Wrong email or password.':'Sign-in could not finish. Please try again.'));
      await tokenStore.write({accessToken:data.accessToken,refreshToken:data.refreshToken});
      try { return await authService.me(); }
      catch (err) { await tokenStore.clear(); throw err; }
    } finally { signing = false; }
  },
  onboarding: (learningGoals: LearningGoal[], educationMedium: EducationMedium) => api.request<{user: PublicUser}>('/api/auth/onboarding', 'POST', { learningGoals, educationMedium }),
  profile: (data: {name: string; learningGoals: LearningGoal[]; educationMedium: EducationMedium}) => api.request<{user: PublicUser}>('/api/auth/profile', 'PATCH', data),
  /** Permanently deletes the account on the server, then signs this device out. Throws, still signed in, if the server refuses. */
  async deleteAccount() {
    await api.request('/api/auth/account', 'DELETE', { confirm: 'DELETE' });
    await api.invalidate();
    if(Platform.OS==='android')await clearNativeGoogleSession().catch(()=>undefined);
  },
  async logout(all = false) {
    try { await api.request(`/api/auth/${all ? 'logout-all' : 'logout'}`, 'POST'); }
    catch (error) {
      throw new Error(all
        ? 'Signed out on this device. Other sessions could not be revoked; reconnect to complete that action.'
        : 'Signed out on this device. The server could not be reached to revoke the session.', {cause:error});
    } finally {
      await api.invalidate();
      // Backend logout/token cleanup must succeed even if Play services is offline.
      if(Platform.OS==='android')await clearNativeGoogleSession().catch(()=>undefined);
    }
  },
};
