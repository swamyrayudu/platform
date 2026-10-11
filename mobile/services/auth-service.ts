import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { API_BASE_URL, validateApiUrl } from '@/utils/config';
import { api } from './api-client';
import { tokenStore, getDeviceId } from './vault';
import { clearNativeGoogleSession } from './native-google-auth';
import { browserGoogleLogin } from './browser-google-flow';
import type { SignInStage } from './native-google-flow';
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
      const tokens=await browserGoogleLogin(API_BASE_URL,Platform.OS==='ios'?'IOS':'ANDROID',await getDeviceId(),Crypto.getRandomBytes,WebBrowser.openAuthSessionAsync,fetch,onProgress);
      if(!tokens)return null;
      await tokenStore.write(tokens);
      onProgress?.('profile');
      try { return await authService.me(); }
      catch (err) { await tokenStore.clear(); throw err; }
    } finally { signing = false; }
  },
  onboarding: (learningGoals: LearningGoal[], educationMedium: EducationMedium) => api.request<{user: PublicUser}>('/api/auth/onboarding', 'POST', { learningGoals, educationMedium }),
  profile: (data: {name: string; learningGoals: LearningGoal[]; educationMedium: EducationMedium}) => api.request<{user: PublicUser}>('/api/auth/profile', 'PATCH', data),
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
