export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://rsdeducation.vercel.app').replace(/\/$/, '');
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
