import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { p256 } from '@noble/curves/nist.js';
import { bytesToHex, decryptHandoff } from '@/utils/crypto';
import { API_BASE_URL, validateApiUrl } from '@/utils/config';
import { api } from './api-client';
import { tokenStore, getDeviceId } from './vault';
import { AUTH_CALLBACK, checkGoogleAuthBackend } from './auth-readiness';
import { signInWithNativeGoogle, clearNativeGoogleSession } from './native-google-auth';
import type { SignInStage } from './native-google-flow';
import type { PublicUser, LearningGoal, EducationMedium } from '@/types/auth';
let signing = false;
export const authService = {
  me: () => api.request<PublicUser>('/api/auth/me'),
  async signIn(onProgress?:(stage:SignInStage)=>void) {
    if (isRunningInExpoGo()) throw new Error('Google sign-in needs the updated RSD Education development build. Expo Go does not include this app’s Google sign-in integration.');
    if (signing) throw new Error('Sign-in is already in progress.');
    signing = true;
    let privateKey: Uint8Array | undefined;
    try {
      validateApiUrl(API_BASE_URL);
      if (new URL(API_BASE_URL).protocol !== 'https:') throw new Error('Google sign-in requires an HTTPS backend.');
      if(Platform.OS==='android') {
        const tokens=await signInWithNativeGoogle(onProgress);
        if(!tokens)return null;
        await tokenStore.write({accessToken:tokens.accessToken,refreshToken:tokens.refreshToken});
        onProgress?.('profile');
        if(tokens.user)return tokens.user;
        try{return await authService.me();}
        catch(err){await tokenStore.clear();throw err;}
      }
      await checkGoogleAuthBackend(API_BASE_URL);
      // Explicit entropy works on native, where crypto.getRandomValues may be absent.
      do { privateKey = Crypto.getRandomBytes(32); } while (!p256.utils.isValidSecretKey(privateKey));
      const state = bytesToHex(Crypto.getRandomBytes(32));
      const url = new URL('/mobile-auth', API_BASE_URL);
      url.searchParams.set('state', state);
      url.searchParams.set('publicKey', bytesToHex(p256.getPublicKey(privateKey, false)));
      url.searchParams.set('deviceId', await getDeviceId());
      url.searchParams.set('platform', Platform.OS === 'ios' ? 'IOS' : 'ANDROID');
      const result = await WebBrowser.openAuthSessionAsync(url.toString(), AUTH_CALLBACK);
      if (result.type !== 'success') return null;
      const tokens = decryptHandoff(privateKey, result.url, state);
      await tokenStore.write(tokens);
      try { return await authService.me(); }
      catch (err) { await tokenStore.clear(); throw err; }
    } finally { privateKey?.fill(0); signing = false; }
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
