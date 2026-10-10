# Google sign-in investigation — 10 October 2026

## Live Vercel verification — subsequent deployment

The existing `swamyrayudus-projects/rsdeducation` production deployment is now
READY at `https://rsdeducation.vercel.app`. The Vercel account and exact project
were inspected using the authenticated CLI. No account settings needed changing
and no additional deployment was created by this verification.

- `/mobile-auth?check=1` returns 200 with `ready: true`, protocol 1 and the correct
  app callback. This confirms the two backend Web OAuth client IDs are configured
  and match.
- A valid app handshake request returns the mobile Google page with status 200,
  the existing Google API integration, encrypted return link, `no-store` and
  `same-origin-allow-popups` headers.
- `/api/auth/nonce` returns 200 and sets an HttpOnly nonce cookie.
- The website homepage returns 200.

These public checks create no account or authenticated session. Real Google
account login and return to the Android app remain unverified and must be tested
using the installed RSD development app. The 404 findings below describe the
earlier deployment, before this update became live.

## Earlier investigation and local validation

The supplied phone screenshot is the Expo Go guard, before a Google request.
The app's custom callback cannot be registered by Expo Go. The live configured
backend's `/mobile-auth` returned 404. A development build and deployment of the
prepared bridge on the existing backend are required; real Google login has
**not** been verified.

The browser method preserves the website's mandatory Google nonce cookie and
its existing token verification/session handlers. The bridge now exposes a
credential-free readiness contract and rejects mismatched frontend/server Web
OAuth client IDs. Mobile checks that contract before opening a browser and
requires HTTPS. A manual encrypted Return to RSD link is offered if a browser
blocks the automatic app handoff. Native SecureStore/session APIs are retained.

Checks completed for this change:

- Mobile TypeScript and lint pass.
- All 24 automated tests pass, including execution of the actual bridge's
  browser script against fixture Google/backend responses, followed by native
  decryption. Fixture tests are not live Google end-to-end tests.
- Expo Doctor: 21/21 pass; `expo install --check`: dependencies up to date.
- Existing website production build with Webpack passes, including `/mobile-auth`.
- The local production bridge responds with readiness 200 and rejects an invalid
  handoff with 400. Live deployment still returns 404.
- Generated Android manifest registers `rsdeducation` and the development-client
  scheme for package `com.rsdeducation.student`.
- SDK 57 native Android x86_64 development APK built successfully with the phone
  helper's build-only mode in a short ASCII temporary folder (5m 21s). Output:
  `dist/android/rsd-education-sdk57-development-x86_64.apk`. This is an emulator
  APK; the default phone helper detects and builds the physical phone's ABI.
- Installed that APK on the Android emulator and opened the SDK 57 development
  app successfully. Tapping Continue with Google displays the expected missing
  bridge deployment message, instead of the Expo Go callback error. No app
  JavaScript/runtime crash was observed. See
  [native development app screenshot](android-google-development.png).
- The first native attempt failed with CMake/Ninja's dirty-manifest error in a
  longer temporary folder. Shortening the helper's temporary folder name fixed
  the build without changing dependencies or website/app source locations.
- Existing website login page, auth handlers, Google verifier, cookie helpers,
  proxy and package manifests are untouched by this change.

See [Google setup and phone commands](GOOGLE_SIGN_IN.md). Actual Google account
sign-in, persistence after real login and phone end-to-end acceptance remain
manual. No production deployment or real account/session/payment was made.

## SDK 57 upgrade validation — earlier checks

The upgrade follows the [official SDK 57 instructions](https://expo.dev/changelog/sdk-57).
Versions came from Expo's dependency checker, not manually guessed versions.
The installed set is Expo 57.0.27, React Native 0.86.3, React/React DOM 19.2.3,
Expo Router 57.0.25, Reanimated 4.5.1, Worklets 0.10.1 and TypeScript 6.0.3.
The mobile lockfile records all installed Expo module versions.

Commands run in `mobile/` with Node 24.19:

```text
npx expo install expo@^57.0.0 --fix
npx expo install --fix
npx expo-doctor@latest
npx expo install --check
```

The first upgrade command installed the packages but requested the `expo-font`
plugin because the project uses dynamic configuration. After adding the plugin
to app.json, the standalone `--fix` completed successfully. The initial npm child
process used the workstation's older Node 22.11 and printed engine warnings;
subsequent alignment and all validation used Node 24.19.

Expo Doctor passed **21/21 checks** after the final changes. Expo's dependency
checker reports all packages up to date. Mobile type checking, lint and all 20
existing tests pass. The complete npm dependency tree has no missing or invalid
packages. Android and iOS production Hermes exports passed into `dist/sdk57`.
The sandbox initially blocked Hermes temporary bytecode writes; repeating the
export with permission to run the compiler outside that sandbox succeeded.
An explicit Node type dependency and the TypeScript `types`
setting accommodate TypeScript 6's change to ambient type discovery.

The resolved Expo configuration reports `sdkVersion: 57.0.0`, with the existing
app identifiers, custom scheme and screens preserved. There is no hardcoded SDK
56 configuration. The EAS SDK 56 template override was removed, and only ignored
generated Android native files were regenerated using SDK 57's matching bundled
template. The previous SDK 56 APK needs a rebuild; it is historical evidence only.

`npm run start:go -- --clear --lan` explicitly targets Expo Go. Razorpay loads
only inside supported native checkout, so its absent native module does not
prevent Expo Go startup. The existing Google callback needs a development build;
Expo Go sign-in displays that requirement without initiating an unusable callback.
Authenticated acceptance and native payment tests still require a rebuilt client
and the previously prepared backend adapter to be deployed. No backend or website
files were edited during this SDK upgrade.

SDK 57 runtime validation also passed in SDK 57 Expo Go (Android client 57.0.9)
on the temporary API 35 emulator. The login screen rendered and its developer
menu confirmed SDK 57.0.0, with no JavaScript or Android runtime crash. See
`android-sdk57-expo-go.png`. The initial localhost attempt failed because Windows
listened only on IPv6; LAN server mode with an emulator-only IPv4 host and adb
reverse resolved the connection. Phone testing should use normal LAN mode as
documented in README. The temporary emulator and test server were stopped.

## Historical SDK 56 validation

The checks and artifacts below belong to the earlier SDK 56 implementation;
they do not certify a native SDK 57 build.

## Checks actually run

| Check | Result |
| --- | --- |
| Mobile TypeScript (`tsc --noEmit`) | Passed |
| Mobile ESLint | Passed |
| Automated tests | 20 passed, 0 failed |
| Expo development server | Started successfully on port 8082 |
| Expo dependency compatibility check | Passed using the installed SDK compatibility map (offline) |
| Android and iOS production Hermes JavaScript exports | Passed |
| Android native debug build | Passed for x86_64 in an isolated ASCII build folder |
| Android API 35 emulator | APK installed; native login rendered; browser launch and cancellation checked |
| Existing website production build (`next build --webpack`) | Passed; routes and TypeScript compiled |
| Production API read-only smoke check | Passed |
| Full website ESLint | Existing failures: 57 errors and 74 warnings across 43 files |

Tests use isolated fixtures, including the actual practice data layer behind a
stubbed database port. They cover durable writes, database failure, safe repeated
completion, browser/native crypto interoperability, tampering, encrypted Telugu
text, token rotation/revocation, transient auth failure, server error contracts,
offline answers, stale acknowledgments, interrupted submission, double taps,
timer gaps, instant-feedback answer locking, logout during an in-flight storage
write, and late responses from an older session. These are **not** claims of
authenticated end-to-end production coverage.

The production smoke check called the real deployed API without credentials:
auth/profile/analytics/plans reject unauthenticated requests, nonce and Google
availability respond, and the public mock catalog matches its discovered
contract. It did not create accounts, exam attempts, orders or payments.

The Android emulator was headless/read-only, using Pixel_7_Pro_API_35. Native
startup produced no JavaScript/runtime error. Google entry generated the device
ID and ephemeral key and opened Chrome; its first-run screen was cancelled
without adding an account or completing sign-in. See `android-login.png` for the
actual native screen. This also exercised SecureStore access and native entropy.

Windows CMake/Ninja rejected the Japanese workspace path. A temporary drive
alias was insufficient because module discovery resolves original paths. A
temporary copy of **only mobile source**, installed from the unchanged lockfile,
built successfully in an ASCII folder. The website and maintained mobile source
were not moved. The temporary alias was removed afterward. The saved
`../dist/android/rsd-education-emulator-development.apk` is a development client
for **x86_64 emulators**, needs Metro, and is not a release/phone APK. Use the EAS
preview profile for a standalone direct-distribution Android build.

The website's default Turbopack build failed locally while starting a child Node
process in this Windows environment. The supported Webpack production build
completed successfully. Its existing lint failures are recorded in
`website-lint-report.json`; new mobile code is checked independently.

## Mock-test design update — 10 October 2026

The mock library now uses compact website-style module cards. Exam navigation
opens a sectioned right-side question palette from the top grid button, instead
of rendering all question numbers below the question. Header and footer controls
adapt to narrow screens and large system text.

- TypeScript and mobile ESLint passed; all 30 mobile tests passed. New tests cover
  original jump indices after filtering, distinct source identities, all 160
  questions, older saved drafts and 24 width/text-size geometry combinations.
- The final Android production JavaScript/Hermes export passed.
- Native Android emulator previews were inspected at 411 and 320 logical pixels
  wide. At 320 pixels, 200% system text was also checked; header controls wrap,
  footer labels remain readable and palette cells change to three columns.
- With isolated sample data, opening the palette, the Flagged filter, jumping to
  question 2 and question 160, closing after selection, and Android Back dismissal
  were checked. The last question offers Submit; no real exam was submitted.

The preview used copied UI source with fixture-only auth/API/exam state and no
production requests. Saved-answer, timer and submission behavior is covered by
the existing regression tests. This is not an authenticated production exam or
a physical-device/iOS acceptance run. Website/backend, Expo configuration and
dependencies were not changed by this design update. Screenshots are saved in
`../dist/mock-design-*.png` and show sample data.

## Native Android Google sign-in update — 10 October 2026

Android now uses a local Expo module with Google's Credential Manager account
chooser. It passes the existing server-issued nonce to Google and exchanges the
result at the unchanged `/api/auth/google` endpoint. Sessions still use SecureStore
and the existing bearer API client. iOS retains the encrypted browser handoff.

- All 33 mobile tests passed, including nonce forwarding, cookie-enabled transport,
  cancellation without creating a session, and rejected/missing sessions.
- Mobile TypeScript/ESLint and the Android production Hermes export passed.
- Expo install reported aligned dependencies; Expo Doctor passed all 21 checks.
- Expo autolinking found the local native module, and its Kotlin compilation passed
  with AndroidX Credentials 1.6.0 and Google ID 1.1.1. Newer Google ID 1.2.1 required
  Kotlin 2.4 metadata unsupported by the SDK 57 template's Kotlin 2.1 compiler.
- The complete arm64 Android debug APK built successfully in an isolated short
  ASCII folder. Android's APK tools verified its signature, package
  `com.rsdeducation.student` and `arm64-v8a` ABI. The copied artifact's SHA-256
  matches the original build. It is saved as
  `../dist/android/rsd-education-native-google-development-arm64-v8a.apk` and needs
  Metro. An earlier build in a longer temporary path hit a Windows Ninja/CMake
  manifest loop; the existing short-folder build approach succeeded.
- Live `/mobile-auth?check=1` reported ready. Browser inspection of its Google button
  recorded an origin rejection; the usual website page uses the same client ID.
  The mobile adapter's restrictive referrer policy was changed to Google's
  recommended policy locally. This browser correction has not been deployed.

The native module requires a newly installed development APK and a Google Cloud
Android OAuth client matching its package and signing SHA-1. No physical phone
was connected, so the Google token exchange, native nonce-cookie persistence and
authenticated screen remain unverified. Follow `GOOGLE_SIGN_IN.md` for setup and
real-account acceptance. No Google account was selected in the browser inspection,
and no backend login session or live deployment was created by this task.

## Authenticated acceptance run still required

Deploy the prepared `/mobile-auth` adapter and practice persistence correction
to the **existing** backend, then use an authorized student/test account:

1. Sign in through Google; cancel and retry; relaunch to check persistence.
2. Choose a medium and subject, filter topics/classes, and start practice. Check
   explanations in instant mode; verify end mode reveals them after submission.
3. Turn connectivity off, select answers, relaunch, reconnect and sync. Submit
   with a dropped response; verify the same session's result and history entry.
4. Start a mock; navigate, clear, mark for review, background/pause/resume, and
   submit. Compare results, leaderboard and next-module access with the website.
5. Compare performance, weak topics, history and preferences across web/mobile.
6. Revoke a device and log out/log out all; verify protected navigation and token
   cleanup. Transient offline failure should retain login for reconnection.
7. On a **direct-distribution Android test build**, use the existing backend's
   Razorpay test-mode environment for success, cancellation and interrupted
   checkout recovery. Verify entitlements only after server verification.
8. On store/iOS builds, confirm checkout is unavailable and existing entitlements
   still work. Validate layout on a physical budget Android device and an iPhone.

No Google account or payment test credentials were supplied. Real login,
authenticated practice/mock/analytics journeys, account revocation and payment
flows have therefore **not** been run. No live backend deployment was performed.
iOS native compilation requires macOS/Xcode or an authorized EAS build.

## Dependency audit

The installed mobile dependency audit reported 29 advisory entries (19 high,
10 moderate), propagated from `braces`, `node-forge`, `uuid` and
`decode-uri-component` through Expo tooling/router dependencies. The report is
saved in `../dependency-audit.json`. Suggested automatic fixes included an
incompatible Expo downgrade to SDK 44 or router upgrade beyond SDK 56, so a
forced audit fix was not applied. Re-run the audit before release and adopt
compatible upstream patches as available.
