import { API_BASE_URL } from '@/utils/config';
import { tokenStore } from './vault';
import { createApiClient } from './http';
export { ApiError } from './http';
const listeners = new Set<() => void>();
export function onSessionExpired(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const api = createApiClient(API_BASE_URL, tokenStore, () => listeners.forEach(listener => listener()));
export function query(params: Record<string, string | number | string[] | undefined>) {
  const result = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) if (value !== undefined && value !== '') result.set(name, Array.isArray(value) ? value.join(',') : String(value));
  return result.toString();
}
