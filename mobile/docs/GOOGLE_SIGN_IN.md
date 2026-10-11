# Google sign-in setup and validation

## Current Android and iOS login: browser Google sign-in

The user authorized browser sign-in after the rebuilt native module reported
Google account reauthentication failure. Android now uses the existing browser
flow, just like iOS, through `expo-web-browser.openAuthSessionAsync`.

1. The app checks the existing `/mobile-auth?check=1` readiness contract.
2. It generates a temporary P-256 key and request state, then opens the existing
   HTTPS `/mobile-auth` page with the public key, device ID and app platform.
3. The page uses the website's Web OAuth client in Google Identity Services
   redirect mode. Google POSTs its credential to the fixed `/mobile-auth` URI.
   The server checks Google's CSRF cookie/body pair and a signed, HttpOnly,
   five-minute context cookie, then calls the existing Google login handler.
   The existing handler verifies the server-issued nonce and creates the session.
4. The server encrypts that session to the initiating app's temporary public key.
   After account selection, tap **Open RSD Education** on the return page. On
   Android this uses an intent targeting `com.rsdeducation.student` with the
   `rsdeducation://auth/callback` scheme. The fresh tap avoids relying on an
   automatic external-app navigation from Google's browser redirect.
5. The initiating app verifies the callback host/path, state, encryption and age,
   stores only session tokens in SecureStore, then verifies `/api/auth/me`.
   The callback screen waits for that verification before opening onboarding or
   the signed-in tabs. Browser errors survive the login screen being remounted.
6. Cancellation creates no local session; the temporary private key is wiped on
   success, failure and cancellation. Cold-start callbacks cannot authenticate.

No account chooser is automatically retried. Google sign-in no longer invokes
the native module or emits its `RSD_GOOGLE_AUTH_SETUP` warning. The unused native
module remains in the app for compatibility with existing APKs and logout cleanup.
No dependency, package, scheme, EAS project or native plugin changes were needed.

The earlier popup bridge rendered Google's button but the user reported a blank
Chrome page after account selection. That observation does not identify the
phone's exact failing URL. The updated bridge removes the popup message handoff
and automatic app navigation; provider/server failures now have a visible page.
A real account selection and return to overview still require phone testing.

Keep `https://rsdeducation.vercel.app` in the existing Web OAuth client's
Authorized JavaScript origins. In that same **Web application** client, add/retain
the exact Authorized redirect URI `https://rsdeducation.vercel.app/mobile-auth`.
Keep both backend client IDs matched and retain the existing server `JWT_SECRET`.
No new client secret or environment secret is required. Android
package/SHA-1 registration is required for the previous native flow, not this
browser flow. The custom scheme is the app-return URL, not a Google Web OAuth
redirect URI. Preserve the other existing website redirect settings.

For the installed EAS development client, restart Metro in this maintained mobile
folder and scan its new QR. These changes are JavaScript only; the installed app
already includes the browser module and scheme. A new APK is unnecessary for this
JavaScript change. The mobile-only website adapter must be deployed before
testing; the app readiness check rejects the earlier popup adapter:

```powershell
cd 'C:\Users\swamy\OneDrive\ドキュメント\platform\platform\mobile'
$env:PATH = 'C:\Users\swamy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
npx expo start --dev-client --clear --lan
```

Real-account login and navigation on the phone still require acceptance testing.
If building a standalone APK later, use `npx eas-cli build --platform android
--profile preview`; development clients need Metro.

## Previous native Android flow and certificate diagnostics

The previous Android implementation uses Google's Credential Manager. The
local Expo module `modules/rsd-google-auth` requests only a Google ID token, using
`GetSignInWithGoogleOption` with the existing backend's exact nonce.

1. The app obtains `/api/auth/nonce` and reads the server-issued `dsc_auth_nonce`
   cookie from its response header. A missing or mismatched cookie stops sign-in.
2. The native account chooser receives that nonce and the existing Web OAuth ID.
3. The app posts the Google token, persistent device UUID and `ANDROID` platform
   to `/api/auth/google`, forwarding only this attempt's nonce in a Cookie header.
   Both requests use `credentials: omit` so the native cookie jar cannot override
   that header with an older cookie. No nonce is synthesized from the JSON body.
4. The existing backend verifies the signature, audience, expiry and nonce,
   creates its usual session, and applies its existing single-active-device rule.
5. The app stores only the returned session tokens in Expo SecureStore and uses
   the verified RSD profile returned by that same login response. It falls back
   to `/api/auth/me` for older backends that omit the profile. Startup session
   restoration still verifies `/api/auth/me` using bearer authentication.
   Normal API calls do not use cookie authentication.

An incomplete Google authorization creates no app session. Logout revokes the existing backend session,
clears local app tokens and asks Credential Manager to clear its credential state.
No new backend, database, provider, client secret or email/password login is added.

After account selection the login screen shows whether the session is being
exchanged or the profile is being loaded. Network requests time out after 25
seconds and return a retryable error rather than leaving login pending. A root
screen error boundary offers a reload button if rendering fails. These JavaScript
changes can be loaded by restarting Metro in the installed development app.
The subsequent native cancellation/error diagnostic changes require a new APK.
Changing the Google Cloud Android client's fingerprint alone does not require
rebuilding the existing app.

The screenshot reporting cancellation identifies a failure before Google returns
an ID token, before `/api/auth/google` or overview navigation. Google can report
`GetCredentialCancellationException` for failed authorization as well as an actual
user cancellation. The native module now reports incomplete authorization without
claiming that the user pressed Back. Account reauthentication and interrupted
requests get distinct safe messages. It never retries the chooser automatically.
In development, Metro prints `RSD_GOOGLE_AUTH_SETUP` after a native failure, with
only the installed package, public signing SHA-1 and Web client ID. A rebuilt
module reads the actual installed APK certificate, including EAS signatures;
older modules explicitly report that the certificate is unavailable.

The native module is automatically linked by Expo. No Google config plugin,
Firebase project or `google-services.json` is needed for this implementation.
Its Gradle dependencies are AndroidX Credentials/Play Services Auth **1.6.0** and
Google ID **1.1.1**. Google's newer 1.2.1 failed compilation because its Kotlin
metadata is 2.4, while the SDK 57 template uses Kotlin 2.1. The released 1.1.1
supports the required nonce/button APIs and compiled successfully with SDK 57.

**An older installed APK cannot gain this module through a JavaScript reload.**
Install a new development build. Expo Go does not contain this local module.

## Required Google Cloud settings

Use the same Google Cloud project as the existing website's Web OAuth client.

| Setting | Value |
| --- | --- |
| Android OAuth application type | Android |
| Android package | `com.rsdeducation.student` |
| Android SHA-1 | Signing certificate of the APK actually installed on the phone |
| Web OAuth client ID | `37964450681-qjr64dq42neav1q5jbpbeo0pcgtgpfi0.apps.googleusercontent.com` |
| Mobile public override | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Web ID above, never the Android client ID) |
| Existing backend | Keep `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` matched to that Web ID |
| Mobile API origin | `EXPO_PUBLIC_API_BASE_URL=https://rsdeducation.vercel.app` |

The Web ID above was read from the existing deployed RSD login page. It is a
public identifier, not a secret. The mobile default uses it; deployments with a
different Web client must set the public override before building/starting Metro.

Create an Android OAuth client for each package/signing-certificate combination
that you use. A locally generated debug APK, an EAS-signed APK, and a Play Store
app can have different fingerprints. Use EAS credentials for EAS builds and the
Play app-signing certificate (not merely the upload key) for Play distribution.
Ensure a Google test account is permitted by any consent-screen audience limits.
Android native sign-in does not require a Google redirect URI or a browser return
link. Preserve the website's existing origins/redirects and consent configuration.

### Existing EAS development APK: use this certificate for your EAS installation

On October 11, 2026, the existing project returned one Android build:
`4dd69586-ed20-4635-84f0-c7928b3d9b91`, development profile, completed October 10.
Its downloaded APK was verified using Android's `apksigner`; its package is
`com.rsdeducation.student`. Its signing SHA-1 is:

```text
40:E4:CE:B0:D8:2B:5D:23:67:51:8E:72:5C:76:2A:58:C8:9F:91:9A
```

The user confirmed an Expo/EAS APK is installed. In Google Cloud **Google Auth
Platform → Clients**, verify an **Android** OAuth client exists in the same project
as the Web ID in the table above. Use `com.rsdeducation.student` and this EAS
SHA-1. If a client exists only for the local debug certificate below, keep it and
create another Android client for the EAS certificate. Preserve Web client IDs,
secrets, origins and redirects. Do not enter this fingerprint into a Web client.

If the installed APK came from a different project/build, inspect that APK instead.
The certificate of the user's phone installation and Google Cloud registration
could not be read directly because no phone or signed-in Cloud session was connected.
Therefore missing/mismatched registration remains a concrete setup item to verify,
not a proven diagnosis. Retry the existing EAS APK after correcting that setting;
if it still fails, install the rebuilt EAS APK for the safe native error category
and signing diagnostics. Also verify consent-screen test-account access and that
Google Play services is current.

### Local APK: separate certificate, not the EAS value

The completed `dist/android/rsd-education-native-google-development-arm64-v8a.apk`
was verified with Android's APK signing tool. Its package is
`com.rsdeducation.student`, its ABI is `arm64-v8a` and its minimum Android SDK is 24.
The APK's signing SHA-1 is:

```text
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

This local fingerprint differs from the verified EAS value above. To inspect
signing credentials when building with a different EAS profile:

```powershell
cd 'C:\Users\swamy\OneDrive\ドキュメント\platform\platform\mobile'
$env:PATH = 'C:\Users\swamy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
npx eas-cli credentials --platform android
```

## Build and install on Windows

### Install the APK already built in this task

Enable USB debugging on an arm64 Android phone, connect it and authorize this
computer. Then run:

```powershell
cd 'C:\Users\swamy\OneDrive\ドキュメント\platform\platform\mobile'
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb install -r .\dist\android\rsd-education-native-google-development-arm64-v8a.apk
& 'C:\Users\swamy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\expo\bin\cli start --dev-client --clear --lan
```

Use the SHA-1 above for this APK. Open the installed RSD app and scan Metro's QR
on the same Wi-Fi network. The APK is a development client and requires Metro;
it is not a standalone release. The relative APK path also avoids Windows tools
misreading the Japanese characters in this workspace's absolute path.
If installation reports incompatible signatures, rebuild with the existing EAS
credentials below rather than uninstalling and discarding existing app data.

### Build with your existing EAS signing credentials

Use the existing EAS project and signing configuration:

```powershell
cd 'C:\Users\swamy\OneDrive\ドキュメント\platform\platform\mobile'
$env:PATH = 'C:\Users\swamy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
npx eas-cli build --platform android --profile development
```

Install the resulting development APK on your phone, then start Metro:

```powershell
& 'C:\Users\swamy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\expo\bin\cli start --dev-client --clear --lan
```

Open the RSD development app and scan the QR code; use the same Wi-Fi network.
The EAS project remains `e277917c-28a9-463f-91ec-2f6cace259ae`.

For a local USB build using this workstation's installed JDK/SDK/Node, enable USB
debugging on the phone and authorize the computer, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\android-device.ps1
```

The helper selects a single authorized physical phone, builds in an isolated
ASCII path and installs with `adb install -r`. It copies local native modules too.
If the installed APK has a different signature, use an EAS build signed like the
existing app; do not uninstall the app just to bypass a signature mismatch.

## Earlier browser blank-page investigation

The live `/mobile-auth?check=1` returned `ready: true`, and both Google client IDs
match. The live bridge uses the correct `same-origin-allow-popups` opener policy.
Browser inspection nevertheless recorded Google's error:
`[GSI_LOGGER]: The given origin is not allowed for the given client ID.`
The website page uses the same client ID without that error. The mobile bridge
set `Referrer-Policy: no-referrer`, a likely contributor to this rejection. On
October 11 the deployed adapter was verified using Google's recommended
`strict-origin-when-cross-origin`; query parameters are excluded from cross-origin
referrers. Its Google button rendered without the earlier origin error. This
does not prove the precise cause of every blank page on the user's phone.

Both Android and iOS now use the encrypted browser handoff through `rsdeducation://auth/callback`.
The initiating app verifies state/age and decrypts with its in-memory private key;
a cold-start callback cannot create a session. If a browser blocks automatic app
return, tap its Return to RSD Education link. Keep the backend HTTPS origin in the
Web client's Authorized JavaScript origins. The custom app scheme is not a Google
Web OAuth redirect URI. The existing website's authentication behavior is unchanged.

## Real-account acceptance still required

1. Restart Metro and load the updated code in the installed development app.
2. Tap Continue with Google: the app should open the RSD browser sign-in page.
3. Choose an allowed account and confirm the app displays onboarding or the signed-in
   home screen. Verify session restoration after closing/reopening the app.
4. Cancel and retry; then test logout and Google sign-in with another account.
5. Confirm the website retains its intentional single-active-device behavior.

No authorized physical phone was connected during this task. Automated tests use
fixture credentials; native compilation is not proof of successful Google login.
A real Google token exchange, nonce-cookie round trip on the phone and authenticated
home screen must still be checked. Never share tokens, complete callback URLs,
keystores, credentials or SecureStore dumps when reporting results.

Sources: [Google native button flow](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation),
[Google cancellation troubleshooting](https://developer.android.com/identity/sign-in/credential-manager-troubleshooting-guide),
[Google ID releases](https://developers.google.com/identity/android-credential-manager/releases),
[AndroidX Credentials releases](https://developer.android.com/jetpack/androidx/releases/credentials),
[Google GIS browser setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid),
[Expo local modules](https://docs.expo.dev/modules/get-started/).
