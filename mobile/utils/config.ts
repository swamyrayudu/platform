export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://rsdeducation.vercel.app').replace(/\/$/, '');
// Public OAuth identifier verified from the existing deployed RSD backend.
// Different backend deployments can override it; never put a client secret here.
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '37964450681-qjr64dq42neav1q5jbpbeo0pcgtgpfi0.apps.googleusercontent.com';
export function validateApiUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error('API base URL must be an origin without a path or credentials.');
  }
  if (parsed.protocol !== 'https:' && !(__DEV__ && parsed.protocol === 'http:')) {
    throw new Error('The production API requires HTTPS.');
  }
  if (['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('Use your computer’s LAN IP or an HTTPS development URL on a phone.');
  }
}
