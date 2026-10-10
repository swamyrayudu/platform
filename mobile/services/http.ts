export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) { super(message); }
}
export interface SessionPort { read(): Promise<{accessToken: string; refreshToken: string} | null>; write(tokens: {accessToken: string; refreshToken: string}): Promise<void>; clear(): Promise<void> }
export function createApiClient(base: string, sessions: SessionPort, revoked: () => void, transport: typeof fetch = fetch) {
  let refreshing: Promise<void> | undefined;
  let epoch = 0;
  let sessionChanges: Promise<void> = Promise.resolve();
  function changeSession(operation:()=>Promise<void>) {
    const next=sessionChanges.catch(()=>{}).then(operation);
    sessionChanges=next;
    return next;
  }
  async function raw<T>(path: string, method: string, body: unknown, token?: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const res = await transport(base + path, { method, credentials: 'omit', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data?.code ?? data?.error ?? 'REQUEST_FAILED', data?.message ?? data?.error ?? `Request failed (${res.status})`, data?.retryAfter ?? (Number(res.headers.get('Retry-After')) || undefined));
      if (!data || data.success === false) throw new ApiError(res.status, 'INVALID_RESPONSE', data?.error ?? 'The server returned an invalid response.');
      return data as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach RSD Education. Check your connection and try again.');
    } finally { clearTimeout(timer); }
  }
  async function expire() { epoch++; await changeSession(()=>sessions.clear()); revoked(); }
  async function refresh() {
    if (refreshing) return refreshing;
    const generation = epoch;
    refreshing = (async () => {
      const tokens = await sessions.read();
      if (!tokens) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in again.');
      try {
        const next = await raw<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', 'POST', { refreshToken: tokens.refreshToken });
        await changeSession(async()=>{if (generation === epoch) await sessions.write(next);});
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) await expire();
        throw err;
      }
    })().finally(() => { refreshing = undefined; });
    return refreshing;
  }
  async function request<T>(path: string, method = 'GET', body?: unknown, retry = true): Promise<T> {
    const generation=epoch;
    const tokens = await sessions.read();
    try { return await raw<T>(path, method, body, tokens?.accessToken); }
    catch (err) {
      if (err instanceof ApiError && err.status === 401 && tokens) {
        if(generation!==epoch)throw err; // An old request cannot revoke a later login.
        if (['SESSION_REVOKED', 'REFRESH_TOKEN_REUSE_DETECTED'].includes(err.code)) { await expire(); throw err; }
        if (retry) {
          // If another request already rotated, reuse its token instead of rotating twice.
          const latest = await sessions.read();
          if (latest?.accessToken === tokens.accessToken) await refresh();
          return request<T>(path, method, body, false);
        }
        await expire();
      }
      throw err;
    }
  }
  return { request, refresh, invalidate: expire };
}
