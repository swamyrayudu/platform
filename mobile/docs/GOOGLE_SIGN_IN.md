# Google sign-in setup and validation

## Android: Google chooser inside the app

Android now uses Google's Credential Manager rather than a browser popup. The
local Expo module `modules/rsd-google-auth` requests only a Google ID token, using
`GetSignInWithGoogleOption` with the existing backend's exact nonce.

1. The app obtains `/api/auth/nonce` with `credentials: include`.
2. The native account chooser receives that nonce and the existing Web OAuth ID.
3. The app posts the Google token, persistent device UUID and `ANDROID` platform
   to `/api/auth/google`, preserving the nonce cookie with `credentials: include`.
4. The existing backend verifies the signature, audience, expiry and nonce,
   creates its usual session, and applies its existing single-active-device rule.
5. The app stores the returned session in Expo SecureStore and loads `/api/auth/me`
   using bearer authentication. Normal API calls do not use cookie authentication.

Cancellation creates no app session. Logout revokes the existing backend session,
clears local app tokens and asks Credential Manager to clear its credential state.
No new backend, database, provider, client secret or email/password login is added.

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

The completed `dist/android/rsd-education-native-google-development-arm64-v8a.apk`
was verified with Android's APK signing tool. Its package is
`com.rsdeducation.student`, its ABI is `arm64-v8a` and its minimum Android SDK is 24.
The APK's signing SHA-1 is:

```text
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

This is **not** a claim about the signing fingerprint of your existing EAS APK.
Inspect EAS credentials for the development profile before registering its SHA-1:

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

## iOS/browser flow and the blank-page investigation

The live `/mobile-auth?check=1` returned `ready: true`, and both Google client IDs
match. The live bridge uses the correct `same-origin-allow-popups` opener policy.
Browser inspection nevertheless recorded Google's error:
`[GSI_LOGGER]: The given origin is not allowed for the given client ID.`
The website page uses the same client ID without that error. The mobile bridge
set `Referrer-Policy: no-referrer`, a likely contributor to this rejection. The local
adapter now uses Google's recommended `strict-origin-when-cross-origin`; query
parameters are still excluded from cross-origin referrers. Deploy this small
mobile-adapter correction through the existing website's deployment process.
It has not been deployed by this task, nor does it prove the precise cause of
every blank page on the user's phone.

iOS retains the encrypted browser handoff through `rsdeducation://auth/callback`.
The initiating app verifies state/age and decrypts with its in-memory private key;
a cold-start callback cannot create a session. If a browser blocks automatic app
return, tap its Return to RSD Education link. Keep the backend HTTPS origin in the
Web client's Authorized JavaScript origins. The custom app scheme is not a Google
Web OAuth redirect URI. The existing website's authentication behavior is unchanged.

## Real-account acceptance still required

1. Configure the Android client with the installed APK's SHA-1 and install the new build.
2. Tap Continue with Google: Android should show the native Google account chooser.
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
[Google ID releases](https://developers.google.com/identity/android-credential-manager/releases),
[AndroidX Credentials releases](https://developer.android.com/jetpack/androidx/releases/credentials),
[Google GIS browser setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid),
[Expo local modules](https://docs.expo.dev/modules/get-started/).
