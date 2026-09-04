// ============================================================
// lib/auth/mobile-reference.ts
// ============================================================
// REFERENCE FILE FOR THE REACT NATIVE TEAM
// This file is NOT deployed to the Next.js server.
// Copy the relevant snippets into the React Native project.
// ============================================================

/**
 * ============================================================
 * 1. DEPENDENCIES (React Native project)
 * ============================================================
 *
 * Install in your React Native project:
 *   npm install @react-native-google-signin/google-signin
 *   npm install expo-secure-store          (Expo)
 *   OR
 *   npm install react-native-keychain      (bare React Native)
 *   npm install react-native-device-info  (for device ID)
 *
 * ============================================================
 * 2. DEVICE ID GENERATION
 * ============================================================
 *
 * Generate a persistent device ID and store it securely:
 *
 * ```typescript
 * import * as SecureStore from 'expo-secure-store'
 * import DeviceInfo from 'react-native-device-info'
 * import uuid from 'react-native-uuid'
 *
 * const DEVICE_ID_KEY = 'dsc_device_id'
 *
 * export async function getOrCreateDeviceId(): Promise<string> {
 *   let id = await SecureStore.getItemAsync(DEVICE_ID_KEY)
 *   if (!id) {
 *     id = uuid.v4() as string
 *     await SecureStore.setItemAsync(DEVICE_ID_KEY, id)
 *   }
 *   return id
 * }
 * ```
 *
 * ============================================================
 * 3. GOOGLE SIGN-IN + BACKEND LOGIN
 * ============================================================
 *
 * ```typescript
 * import { GoogleSignin } from '@react-native-google-signin/google-signin'
 * import * as SecureStore from 'expo-secure-store'
 * import { Platform } from 'react-native'
 *
 * const API_BASE = 'https://your-nextjs-app.com'
 *
 * // Configure once (e.g., in App.tsx)
 * GoogleSignin.configure({
 *   webClientId: 'YOUR_GOOGLE_CLIENT_ID',  // same as GOOGLE_CLIENT_ID
 *   iosClientId: 'YOUR_IOS_CLIENT_ID',     // from Google Cloud
 * })
 *
 * export async function signInWithGoogle(): Promise<AuthResult> {
 *   await GoogleSignin.hasPlayServices()
 *   const userInfo = await GoogleSignin.signIn()
 *
 *   // Get the ID token to send to the backend
 *   const { idToken } = await GoogleSignin.getTokens()
 *   if (!idToken) throw new Error('Failed to get Google ID token')
 *
 *   const deviceId = await getOrCreateDeviceId()
 *   const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID'
 *   const userAgent = `DSCApp/${Platform.OS}`
 *
 *   // Send to backend — server verifies the token
 *   const res = await fetch(`${API_BASE}/api/auth/google`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ idToken, deviceId, platform, userAgent }),
 *   })
 *
 *   if (!res.ok) {
 *     const err = await res.json()
 *     throw new Error(err.error ?? 'Login failed')
 *   }
 *
 *   const data = await res.json()  // { accessToken, refreshToken, user }
 *
 *   // Store tokens securely
 *   await SecureStore.setItemAsync('dsc_access_token', data.accessToken)
 *   await SecureStore.setItemAsync('dsc_refresh_token', data.refreshToken)
 *
 *   return data
 * }
 * ```
 *
 * ============================================================
 * 4. AXIOS INTERCEPTOR — Auto token refresh + SESSION_REVOKED handling
 * ============================================================
 *
 * ```typescript
 * import axios from 'axios'
 * import * as SecureStore from 'expo-secure-store'
 *
 * const api = axios.create({ baseURL: API_BASE })
 *
 * // Attach access token to every request
 * api.interceptors.request.use(async (config) => {
 *   const token = await SecureStore.getItemAsync('dsc_access_token')
 *   if (token) config.headers.Authorization = `Bearer ${token}`
 *   return config
 * })
 *
 * let isRefreshing = false
 * let failedQueue: Array<{ resolve: Function; reject: Function }> = []
 *
 * function processQueue(error: Error | null, token: string | null = null) {
 *   failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token))
 *   failedQueue = []
 * }
 *
 * api.interceptors.response.use(
 *   (response) => response,
 *   async (error) => {
 *     const originalRequest = error.config
 *     const data = error.response?.data
 *
 *     // SESSION_REVOKED / SESSION_EXPIRED: clear auth and navigate to Login
 *     if (
 *       error.response?.status === 401 &&
 *       (data?.error === 'SESSION_REVOKED' || data?.error === 'SESSION_EXPIRED' || data?.error === 'REFRESH_TOKEN_REUSE_DETECTED')
 *     ) {
 *       await SecureStore.deleteItemAsync('dsc_access_token')
 *       await SecureStore.deleteItemAsync('dsc_refresh_token')
 *       // Navigate to login screen — use your navigation solution:
 *       // navigationRef.current?.reset({ index: 0, routes: [{ name: 'Login' }] })
 *       return Promise.reject(error)
 *     }
 *
 *     // Silent refresh on 401 UNAUTHORIZED (expired access token)
 *     if (error.response?.status === 401 && !originalRequest._retry) {
 *       if (isRefreshing) {
 *         return new Promise((resolve, reject) => {
 *           failedQueue.push({ resolve, reject })
 *         }).then(token => {
 *           originalRequest.headers.Authorization = `Bearer ${token}`
 *           return api(originalRequest)
 *         })
 *       }
 *
 *       originalRequest._retry = true
 *       isRefreshing = true
 *
 *       try {
 *         const refreshToken = await SecureStore.getItemAsync('dsc_refresh_token')
 *         const res = await fetch(`${API_BASE}/api/auth/refresh`, {
 *           method: 'POST',
 *           headers: { 'Content-Type': 'application/json' },
 *           body: JSON.stringify({ refreshToken }),
 *         })
 *
 *         if (!res.ok) throw new Error('Refresh failed')
 *
 *         const { accessToken, refreshToken: newRefreshToken } = await res.json()
 *         await SecureStore.setItemAsync('dsc_access_token', accessToken)
 *         await SecureStore.setItemAsync('dsc_refresh_token', newRefreshToken)
 *
 *         processQueue(null, accessToken)
 *         originalRequest.headers.Authorization = `Bearer ${accessToken}`
 *         return api(originalRequest)
 *       } catch (refreshError) {
 *         processQueue(refreshError as Error)
 *         await SecureStore.deleteItemAsync('dsc_access_token')
 *         await SecureStore.deleteItemAsync('dsc_refresh_token')
 *         // Navigate to login
 *         return Promise.reject(refreshError)
 *       } finally {
 *         isRefreshing = false
 *       }
 *     }
 *
 *     return Promise.reject(error)
 *   }
 * )
 *
 * export default api
 * ```
 *
 * ============================================================
 * 5. LOGOUT
 * ============================================================
 *
 * ```typescript
 * export async function logout(): Promise<void> {
 *   try {
 *     await api.post('/api/auth/logout')
 *   } finally {
 *     await SecureStore.deleteItemAsync('dsc_access_token')
 *     await SecureStore.deleteItemAsync('dsc_refresh_token')
 *     await GoogleSignin.revokeAccess()
 *     await GoogleSignin.signOut()
 *   }
 * }
 * ```
 *
 * ============================================================
 * 6. KEY SECURITY RULES
 * ============================================================
 *
 * ✓ NEVER store tokens in AsyncStorage (unencrypted)
 * ✓ ALWAYS use expo-secure-store or react-native-keychain
 * ✓ ALWAYS send tokens via Authorization: Bearer header
 * ✓ ALWAYS handle SESSION_REVOKED by clearing tokens + navigating to Login
 * ✓ NEVER store the raw Google password (Google OAuth is used)
 * ✓ Device ID is persistent (survives app restarts) but not hardware-bound
 *
 * ============================================================
 * 7. PAYMENTS (Razorpay) — same endpoints as the web app
 * ============================================================
 *
 * Install: npm install react-native-razorpay
 *
 * ```typescript
 * import RazorpayCheckout from 'react-native-razorpay'
 *
 * // 1. Ask OUR server for an order. Send only the planId — never an amount.
 * //    planId: 'pro_sprint' | 'pro_full' | 'lifetime'
 * const { data: order } = await api.post('/api/payments/orders', {
 *   planId: 'pro_full',
 *   couponCode: 'APDSC50', // optional
 * })
 * // order = { orderId, amount, currency, keyId, plan, prefill }
 *
 * // 2. Open Razorpay Checkout with those values
 * const result = await RazorpayCheckout.open({
 *   key: order.keyId,
 *   order_id: order.orderId,
 *   amount: order.amount,
 *   currency: order.currency,
 *   name: 'RSD Education',
 *   description: order.plan.name,
 *   prefill: order.prefill,
 *   theme: { color: '#f59e0b' },
 * })
 *
 * // 3. Verify on OUR server — this is what actually unlocks Pro
 * const { data } = await api.post('/api/payments/verify', {
 *   razorpay_order_id: result.razorpay_order_id,
 *   razorpay_payment_id: result.razorpay_payment_id,
 *   razorpay_signature: result.razorpay_signature,
 * })
 * // data.user is the refreshed PublicUser (accountType, subscriptionExpiresAt, ...)
 *
 * // GET /api/payments/history → { user, orders[] } for a "My purchases" screen
 * ```
 *
 * Pro status rule (same as server requirePremium):
 *   accountType === 'PREMIUM' && subscriptionStatus === 'ACTIVE'
 *   && new Date(subscriptionExpiresAt) > new Date()
 *
 * If /api/payments/verify fails after a successful checkout, do NOT let
 * the user pay again — the Razorpay webhook activates the plan server-side.
 * Re-fetch /api/auth/me after a short delay instead.
 */

export {}  // Make this a module (no actual exports — reference only)
