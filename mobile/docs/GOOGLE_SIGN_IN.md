# Google sign-in setup and validation

Update after the latest Vercel deployment on 10 October 2026: the existing
production backend now passes `/mobile-auth?check=1` with `ready: true`. Its
matching Web OAuth client IDs, mobile login page and nonce API were verified.
The missing-deployment condition described below has been resolved. Actual
Google account login still requires the development-app acceptance steps below.

The phone screenshot is the Expo Go guard in `services/auth-service.ts`, before
any Google request. Expo Go cannot register `rsdeducation://auth/callback`.
The configured live backend `https://rsdeducation.vercel.app/mobile-auth` also
returned **404** during this investigation on 10 October 2026. Both conditions
must be resolved: install a development build and deploy the mobile bridge on
the existing website. Upgrading the Expo SDK alone cannot resolve either.

## Authentication method

This app uses Expo WebBrowser's system-browser authentication session, not an
embedded WebView. That browser runs the existing website's Google Identity
Services flow with its existing **Web application** OAuth client ID.

1. The app checks `/mobile-auth?check=1` for deployment and matching OAuth config.
2. It creates fresh in-memory P-256 keys and a random state, then opens the bridge.
3. The browser obtains `/api/auth/nonce`, preserving its HttpOnly nonce cookie,
   and supplies that nonce to Google Identity Services.
4. The browser posts the Google credential to the existing `/api/auth/google`
   with the same cookie, device UUID and `ANDROID` platform. The existing backend
   verifies Google signature, audience, expiry and nonce, then creates its usual
   session. No authentication/database system is replaced.
5. The browser encrypts the returned app tokens for the app's ephemeral public
   key and returns to `rsdeducation://auth/callback`. If automatic return is
   blocked, the browser offers an explicit Return to RSD Education link.
6. The initiating app checks state and response age, decrypts the tokens, writes
   them to Expo SecureStore, and loads the existing `/api/auth/me` with a bearer
   token. Cold-start callback links cannot establish a session.

The nonce requirement is enforced by the existing backend on **every platform**.
Simply installing a native Google SDK and posting an arbitrary ID token would
not satisfy that requirement. The existing Expo WebBrowser, SecureStore and
development-client plugins already supply everything this method needs; an
additional Google native SDK/plugin is unnecessary.

The existing single-active-device policy remains: mobile login can revoke an
older website/device session, as designed by the backend. Refresh, session
revocation, onboarding and Google-only sign-in continue to use the existing APIs.

## Required environment and Google Cloud settings

| Location | Setting | Required value |
| --- | --- | --- |
| `mobile/.env` | `EXPO_PUBLIC_API_BASE_URL` | `https://rsdeducation.vercel.app` or the exact HTTPS origin of your existing backend deployment |
| Existing backend deployment | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Existing website **Web application** OAuth client ID |
| Existing backend deployment | `GOOGLE_CLIENT_ID` | The same Web client ID, used for server verification |
| Expo app configuration | Android package | `com.rsdeducation.student` |
| Expo app configuration | App scheme | `rsdeducation` |
| Mobile callback | App return URL | `rsdeducation://auth/callback` |

Do not put backend credentials or a Google client secret into mobile environment
variables. The app needs only the public API origin. It obtains app sessions from
the existing backend; it never connects directly to a database/auth provider.

In Google Cloud Console, select the **existing** project and Web OAuth client.
Keep the website's current authorized origins and redirect settings. Ensure
`https://rsdeducation.vercel.app` appears under **Authorized JavaScript origins**.
If testing another backend origin, add that exact HTTPS origin without a path.
If the consent configuration restricts users (testing/internal organization),
make sure your test Google account is allowed.

This flow uses GIS popup mode with a JavaScript callback. There is **no additional
Google Authorized redirect URI** to register. The custom scheme is the app's
encrypted handoff, not Google's OAuth redirect URI. Do not add it to a Web OAuth
client's redirect list. A separate Android OAuth client, Firebase configuration,
`google-services.json`, Android Google client ID and SHA-1 registration are **not
required for this browser method**. The Android package is configured for app
installation/linking. SHA-1/Android OAuth clients would apply if a future change
adopts a Google native SDK; that is a different integration.

Deploy the prepared `app/mobile-auth/route.ts` through the website's normal
deployment process after checking its two client ID settings. Existing website
login pages, nonce cookies, Google token verification and auth API handlers are
unchanged by this fix. Rebuild/redeploy if backend environment settings change.

Confirm readiness from PowerShell before testing on a phone:

```powershell
Invoke-RestMethod 'https://rsdeducation.vercel.app/mobile-auth?check=1'
```

Expect `ready: true`, `protocol: 1`, and callback `rsdeducation://auth/callback`.
A 404 means the bridge is not deployed. A 503 means the backend Web client IDs
are absent or differ. This check creates no account/session and returns no tokens.

## Windows PowerShell: build and install on your phone

Prerequisites: Android Studio's Android SDK and SDK tools, JDK 17, and a supported
Node runtime. This workstation already has JDK 17, Android SDK and bundled Node
24.19; the helper selects them without changing system settings. If using another
machine, set `JAVA_HOME`/`ANDROID_HOME` or pass `-JavaPath`, `-SdkPath`, `-NodePath`.

On the Android phone, enable Developer options and USB debugging. Connect it by
USB with a data cable and accept the debugging authorization prompt. This helper
selects a single authorized physical phone (not an emulator), detects its ABI,
builds a development APK and installs it using `adb install -r`.

```powershell
cd 'C:\Users\swamy\OneDrive\ドキュメント\platform\platform\mobile'

# Preserve an existing mobile .env; create it only if absent.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Verify your authorized phone appears with status "device".
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices

# Build SDK 57 and install it on the connected phone.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\android-device.ps1

# Start the maintained source for the RSD development app, rather than Expo Go.
$env:RSD_DISTRIBUTION = 'direct'
& 'C:\Users\swamy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\expo\bin\cli start --dev-client --clear --lan
```

Use `-DeviceId YOUR_ADB_SERIAL` if more than one phone is connected. The helper
copies **only mobile source** into a unique ASCII temporary folder because
Android's native compiler previously failed on this Japanese workspace path.
It leaves the website and maintained app source in place. It retains that build
folder and saves the APK at `mobile/dist/android/rsd-education-sdk57-development-<ABI>.apk`.
The default phone ABI is detected; build-only defaults to `arm64-v8a`.

Open the installed **RSD Education** development app, and scan/connect to Metro's
QR using that app. Keep the phone and PC on the same Wi-Fi. Do not open Expo Go.
For a USB-only Metro connection, run in another PowerShell window:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" -s YOUR_ADB_SERIAL reverse tcp:8081 tcp:8081
```

Then enter `http://127.0.0.1:8081` in the RSD development client's server launcher.
Keep Metro in LAN mode; on this Windows machine localhost-only mode listened
only on IPv6 and could not be reached through adb's IPv4 port forwarding.

If local Android tooling is unavailable, use the existing EAS profile instead
(Expo account/project setup and signing credentials must be completed manually):

```powershell
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile development
```

Download/install the resulting development APK on your phone, then start Metro
with the command above. `app.config.ts` preserves EAS's project ID in `extra`.
No production deployment or EAS build is triggered automatically by this fix.

## Actual end-to-end acceptance

After readiness succeeds and the development app is installed:

1. Tap Continue with Google. Confirm the system browser opens the configured
   backend's RSD login page rather than a 404.
2. Tap the Google button, choose an authorized Google account, and complete any
   consent prompts. If needed, tap Return to RSD Education on the browser page.
3. Confirm the app returns and displays onboarding (new user) or the authenticated
   home screen (returning user). This verifies `/api/auth/me`, not just a Google
   popup or browser message.
4. Close/reopen the app and confirm the SecureStore-backed session persists.
5. Cancel a new login and retry; confirm no session is created by cancellation.
6. Sign out, relaunch, and confirm protected screens require Google login again.
7. Confirm website Google login still works. Expect the backend's intentional
   one-active-device policy to apply when switching between website and phone.

Do not share ID tokens, callback URLs, access/refresh tokens or SecureStore dumps
while reporting results. A screenshot of the authenticated screen or the exact
non-sensitive error is sufficient.

Real Google sign-in has **not been successfully tested** by this task. The live
bridge is now deployed, but no authorized physical phone/Google account has been
provided for a real login. Automated browser-bridge tests use fixture credentials
and are not evidence of real Google authentication. See validation results for
the native build/test checks actually completed.

Sources: [Expo browser sessions](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/),
[Expo authentication limitations](https://docs.expo.dev/guides/authentication/),
[Google GIS setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
