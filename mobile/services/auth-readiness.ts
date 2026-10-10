export const AUTH_CALLBACK = 'rsdeducation://auth/callback';

// Separate from the authenticated API client: this request must not rotate an
// old session or send its bearer token just to check a public login page.
export async function checkGoogleAuthBackend(origin: string, transport: typeof fetch = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await transport(`${origin}/mobile-auth?check=1`, {
      credentials: 'omit', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) throw new Error('Google sign-in is not deployed on this backend. Deploy the existing website’s mobile-auth route before signing in.');
    const body = await response.json().catch(() => null);
    if (response.status === 503 && body?.error === 'GOOGLE_CONFIG_REQUIRED') {
      throw new Error('Google sign-in is not configured on the backend. Its two Google client ID settings must match the existing Web OAuth client.');
    }
    if (!response.ok || body?.ready !== true || body?.protocol !== 1 || body?.callback !== AUTH_CALLBACK) {
      throw new Error('This backend does not have the compatible mobile Google sign-in route. Check the app’s API address and deploy the mobile-auth update.');
    }
  } catch (error) {
    if (error instanceof Error && ['TypeError', 'AbortError'].includes(error.name)) {
      throw new Error('Could not reach Google sign-in on RSD Education. Check your connection and try again.');
    }
    throw error;
  } finally { clearTimeout(timer); }
}
