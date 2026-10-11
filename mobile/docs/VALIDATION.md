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

## Post-account-selection investigation — 11 October 2026

The user first reported a blank screen and then clarified that selecting a Google
account returns to the login page. No physical phone is connected, so its precise error
has not been captured and a successful real Google login is not claimed.

- Native login now forwards only the server-issued nonce cookie explicitly and
  disables the automatic native cookie jar for the exchange. The existing backend
  still verifies Google's ID token and nonce; its routes were not changed.
- Eight targeted native login tests passed, including absent/stale cookies, the
  React Native header fallback, excluding old session cookies, cancellation and
  a stalled request timing out. Network requests are bounded at 25 seconds.
- All 38 mobile regression tests passed. Mobile TypeScript and ESLint passed;
  the final root recovery controls and cancellation notice passed a second
  TypeScript check and focused ESLint check after they were added.
- The final Android Hermes export passed with the verified-profile change,
  producing `../dist/login-session-export`. It is a bundle validation artifact,
  not a newly installed APK or a successful physical-device Google login.
- Sign-in stages are visible after account selection. A minimal native root error
  boundary shows recovery controls for rendering exceptions without displaying
  exception details or credentials. Existing protected-route guards are retained.
- Backend errors are displayed inside the login card beside the Google button.
  A cancelled native result now shows an explicit notice; it does not create a
  session or silently look like a successful login. Successful sign-in still
  publishes the verified backend profile before enabling protected routes.
- Native login uses the verified RSD profile already returned by the login
  endpoint, avoiding a redundant `/api/auth/me` request on successful login.
  Older backends without a usable profile retain that fallback; startup session
  restoration still calls `/api/auth/me`. Only session tokens are stored.
- An isolated sample-data navigation preview was attempted with the real provider
  and router. Its emulator repeatedly raised an Android ANR warning during startup,
  before navigation could be verified. It created no real Google/backend session.
  The preview servers and emulator were stopped afterward.
- The connected Vercel runtime-log lookup returned no entries for the available
  recent window, both with and without the auth-route query. No backend rejection
  code or Google account failure can be inferred from that empty result.

Restart Metro and reload the existing SDK 57 Google-enabled development client.
This follow-up changes JavaScript only. If the phone still fails, capture the
Metro error after account selection (without credentials); the exact failure
boundary and physical-device acceptance remain outstanding.

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

## October 11, 2026 — Google cancellation after account selection

- The supplied screenshot shows the native picker returning no token. This is
  before the app session exchange and overview navigation; it does not establish
  a backend or routing failure.
- User confirmed the installed app is an Expo/EAS APK. Read the existing linked
  project's build list without creating a project or build. Downloaded its one
  completed Android development artifact, build
  `4dd69586-ed20-4635-84f0-c7928b3d9b91`, and verified it with `apksigner`.
  Package: `com.rsdeducation.student`. EAS SHA-1:
  `40:E4:CE:B0:D8:2B:5D:23:67:51:8E:72:5C:76:2A:58:C8:9F:91:9A`.
  This differs from the previously documented local debug APK fingerprint.
- Fixed misleading native cancellation handling; separate account reauthentication
  and interruption messages, no automatic retry, and development-only logging of
  public OAuth setup values. Native signing diagnostics read the installed
  certificate rather than assuming a local debug certificate.
- Updated native module compiled and full arm64 debug APK assembled successfully
  with the existing Expo SDK 57 dependencies in the existing isolated build folder.
- TypeScript, ESLint and all 39 mobile tests passed, including the regression that
  native authorization failure must not retry or submit a backend login request.
  Expo Doctor passed 21/21 checks; Expo install reported dependencies up to date.
  Public Expo config preserved package, scheme, owner and the existing EAS ID.
- No authorized phone or Google Cloud browser session was available. The Android
  OAuth registration and a real Google account sign-in remain unverified. No
  website/backend changes, keystore upload, Expo project creation, deployment or
  successful end-to-end login is claimed.

## October 11, 2026 — authorized browser Google sign-in switch

- The user confirmed the updated native module reads the EAS certificate but
  reported a Google account reauthentication error, and explicitly authorized
  using web Google login. Android now uses the existing encrypted browser adapter,
  the same backend and SecureStore session storage. No website/backend files,
  dependencies, Expo package/scheme or EAS configuration were changed.
- Shared sign-in state keeps the app callback screen pending until profile
  verification finishes, then redirects to onboarding or signed-in tabs. Shared
  sign-in errors remain visible after the callback remounts the login screen.
- Live readiness returned `ready:true`, protocol 1 and the expected callback.
  The bridge HTML returned 200 with the corrected referrer and popup policies.
  Its Google sign-in button rendered in the browser; captured warning/error
  logs were empty. No Google account was selected or real backend session created.
- TypeScript, ESLint and 43 tests passed. Added real WebCrypto fixture round trips
  for Android/iOS, mismatched callback rejection, cancellation/no-session checks,
  failed backend readiness, and private-key wiping on every completion path.
- Expo Doctor passed 21/21 checks. Android Hermes export succeeded at
  `dist/browser-login-export`. The sandbox initially denied the compiler's
  temporary output write; the same export succeeded outside that sandbox.
- A real-account browser login and return to overview on the phone remain
  unverified. Restart Metro to test these JavaScript changes on the installed
  EAS development client; a native rebuild is unnecessary for this switch.

## October 11, 2026 — Chrome browser return correction

- User reported a blank Chrome page after Google account selection; no exact
  failed URL was available. Replaced the mobile adapter's popup message handoff
  with Google Identity Services redirect mode, posting to the fixed production
  `/mobile-auth` URI. Website pages and existing auth API handlers are unchanged.
- Signed, HttpOnly, five-minute request context and Google's double-submit CSRF
  check protect the POST. The adapter delegates nonce/token/session verification
  to the existing Google handler and encrypts the result to the initiating app.
  The visible **Open RSD Education** button uses a package-targeted Android intent.
- Mobile TypeScript and ESLint checks passed. All 46 tests passed, including
  encrypted Android/iOS round trips, context/CSRF tampering and expiry, backend
  rejection, and a visible app-return button from a fixture login response.
  Root TypeScript and the production Next.js build passed. Expo Doctor passed
  all 18 checks in the installed doctor version (1.18.19).
- Published and promoted the existing Vercel project's production deployment
  `dpl_Bd5hSYryZi1gzwkyaXr1Risa3Ak5` to `https://rsdeducation.vercel.app`.
  Public readiness returned 200 with `browserMode:redirect`. A valid start page
  returned 200, the fixed production callback and the signed context cookie.
  An invalid POST returned 400 with a visible error and no app-return link.
  The existing website homepage returned 200.
- The production Google account button rendered with no captured warnings/errors.
  No Google account was selected, no real session was created in these checks,
  and real-account login/return to overview on Android remains unverified.
- The existing Web OAuth client must authorize the exact redirect URI
  `https://rsdeducation.vercel.app/mobile-auth` as well as the existing JavaScript
  origin. Restart Metro and open the installed development client to test.
  These changes are still local Git changes; include the new bridge helper when
  committing/pushing so a later Git deployment retains the correction.

## October 11, 2026 — mock drawer scrolling and back navigation

- Replaced the question drawer's eager ScrollView with a virtualized FlatList
  of section headings and small grid rows. It starts with ten data rows, renders
  six rows initially, and adds ten more near the end until the full paper is
  available. Removed All/Not done/Flagged/Done filter buttons and the legend;
  a single All questions count remains. Original question numbers, subject
  grouping, answer/review indicators and jump indices are preserved.
- Timer checkpoints now update only elapsed time. Memoized drawer props and
  callbacks remain stable across timer ticks, avoiding rebuilding all buttons.
- System back, screen back and navigation gestures use the same Stay / Save &
  leave confirmation. Back first closes the drawer when it is open. The exam
  remains protected while saving; the guard is released only after persistence,
  mock answer sync and pause complete. Save & leave returns to Mock Tests or
  Practice. Submission still opens the existing results screen.
- TypeScript, targeted ESLint with zero warnings and all 50 tests passed.
  Added coverage for progressive access to all 160 questions at narrow/wide
  widths and large text, durable save/pause ordering, failed-exit protection and
  clearing an ended draft only after server acknowledgement.
- Android Hermes export passed at `dist/mock-drawer-export`. The first sandbox
  attempt could not write Hermes' temporary output; the same export succeeded
  outside that sandbox. No dependencies or Expo native settings changed.
- Physical-device gestures and opening/scroll timing have not been measured.
  Restart Metro, reload the installed development client, scroll to question
  160, jump to it, close the drawer with Back, and test Stay / Save & leave.
  Resume the mock to verify the saved answer. Current changes are local and
  require inclusion in a later Git commit/push.

## October 11, 2026 — mock start/resume across papers and medium

- Removed the mobile-only global draft lock from mock instructions and exam
  loading. Mock start/resume uses the same existing API as the website, retaining
  premium checks and module sequence gates. No website or backend code changed
  for this correction.
- Encrypted drafts now have separate user/kind/attempt keys. The original
  `active-exam` record is preserved and migrated; it is a Home resume shortcut,
  not an exam lock. Switching papers preserves pending answers, flags, position,
  elapsed time and submission intent. A failed shortcut write cannot overwrite
  a newer scoped save. Submission/abandonment clears only its own draft.
- Opening a cached exam checks server status, routes completed/submitted exams
  to results, and rejects expired/abandoned exams. Home hides confirmed ended
  exams. Only network failures allow cached offline resume; authorization and
  server errors remain errors.
- TypeScript and targeted ESLint passed with zero warnings. All 59 tests passed;
  the nine draft regressions were rerun after final edits. Coverage includes
  legacy migration, switching medium, pending-answer delivery after returning,
  practice preservation, account isolation, submitted/ended attempts, offline
  resume and partial storage failures. `git diff --check` passed.
- Physical Android testing remains pending. Restart Metro and reload the
  installed development app. Save & leave a Telugu mock, start an unlocked
  English paper, then return to the Telugu paper and confirm the saved answer
  and position. Also submit a paper on the website and open its mobile resume
  link: it should show results rather than stale questions. These are JavaScript
  changes; no native dependencies or EAS build configuration changed.

## October 11, 2026 — mock exit controls

- Removed the two standalone leave/end buttons from mock exams. The top Back
  button and system back gesture offer exactly Stay and Stop timer & save.
  Practice controls remain available under the existing practice rules.
- Choosing Stop timer & save freezes the mock clock before asynchronous
  persistence, answer synchronization and server pause. Navigation waits for
  successful saving, then replaces the exam with `/(tabs)/mocks`. A failed save
  keeps the exam open and restarts the clock from the frozen elapsed time.
- TypeScript, targeted ESLint with zero warnings, the 19 exam/draft regression
  tests and targeted whitespace checks passed. No new native settings or
  dependencies were introduced. Physical Android confirmation remains pending:
  tap Back, test Stay, then Stop timer & save; confirm the mock library opens
  and Continue restores the saved position, answers and remaining time.

## October 11, 2026 — website practice layout and responsive app navigation

- Compared the native practice setup with the existing website's PracticeSetup,
  subject/medium/count/mode selectors, setup footer and four-item DscBottomNav.
  Native setup now uses DSC Practice Zone, English/Telugu segments, numbered
  cards, subject tiles, the Instant Answer & Explanation switch and the matching
  Start Practice question-count label. Existing topic search, progressive topic
  loading, advanced filters, quota, medium and API selection remain available.
- Four bottom tabs match the website. Profile/Pro access is in a shared header
  on every tab screen. The tab shell owns top/side safe areas; each page no longer
  adds them again. Tab height includes the actual bottom inset and larger labels,
  labels stay below icons in landscape, and navigation hides for the keyboard.
- Shared pages use responsive padding, wrapping headers/chips/badges and
  single-column stats for large text. Subject tiles switch to one column when
  space/text size requires it. On short viewports or large system text, sticky
  action bars move into scrollable content. Exam headers and answer letters
  also adapt instead of forcing a width/height smaller than their text.
- The user explicitly chose practice Stay / Stop timer & save. Both exam types
  remove the standalone leave/end buttons. Practice freezes its clock, saves and
  synchronizes pending answers without submitting/abandoning, returns to Practice
  and offers Resume practice there. Practice timing is saved locally because the
  existing API has no practice pause endpoint. Failed saving retains the exam.
- Instant practice answers automatically use the existing answer API to release
  feedback/explanations, show correct/incorrect option colors and prevent rapid
  duplicate selections while checking. End feedback remains withheld until
  submission. Pending network failures retain a retry control.
- TypeScript, full mobile ESLint with zero warnings and all 63 tests passed.
  New cases cover practice pause without abandonment, pending explanation saves,
  four-tab widths/bottom insets (280–1024 widths, system text scale 1–3), responsive
  subject columns and scrollable actions for short/large-text layouts. Final
  Android Hermes export passed at `dist/practice-responsive-export` (3.5 MB).
  No Expo dependencies, SDK settings, EAS configuration, website or backend code
  changed for this update.
- Physical Android appearance and gestures remain unverified. Restart Metro and
  reload the installed development app. Check all four tabs in portrait and
  landscape; increase Android font size; enter a practice question count with
  the keyboard open; verify Start/Previous/Next are reachable; select an answer
  with Instant Feedback, then Back → Stay and Back → Stop timer & save → Resume
  practice. Confirm position, answers and remaining time survive. Changes are
  local and have not been committed/pushed or published as an EAS update.

## October 11, 2026 — header subscription management and renewal

- Header now labels the subscription entry Plans or Manage, with an active
  indicator. The management screen shows the current plan, status and expiry,
  all API-provided prices/durations, optional coupon prices, expandable features,
  Pay/Renew actions and payment history. No app-side prices are invented.
- Existing website order, verify, history and recover endpoints are reused.
  Inspected the existing renewal SQL: paid days extend from a future expiry, or
  from payment activation when access has expired. Website/backend/configuration
  code was not changed for this update. Direct Android checkout gating remains.
- Native success never grants access by itself. Verified server profiles refresh
  the shared auth state, subscription summary and cached practice/mock data.
  Refresh no longer calls auth.reload(), which would replace the root navigation
  with its loading screen. Initial status failures prevent checkout until retried.
- Payment flow retains the encrypted pending order/receipt through cancellation,
  verification failure and pending/error recovery. Settled server recovery clears
  it before another purchase. Synchronous UI and service guards prevent concurrent
  purchases/recovery; mismatched order receipts are not sent for verification.
- Full mobile ESLint (zero warnings), TypeScript and all 71 tests passed. Eight
  new payment cases use fake storage/gateway/backend responses, covering server
  pricing, verified renewal expiry, cancellation, failed verification, unsettled
  recovery, duplicate taps, user isolation, distribution gating and mismatched
  receipts; status/price/date formatting is also covered. React hook dependencies,
  accessible controls, conditional native imports and responsive wrapping checked.
- Final Android Hermes export passed at dist/subscription-management-export
  (1426 modules, 3.5 MB). The first sandboxed compiler run hit temporary-file
  permission restrictions; the authorized retry succeeded. No dependencies added.
- Physical phone payment and real server renewal remain unverified. In a payment
  test environment, verify free purchase, active renewal, expired renewal, coupon,
  checkout cancellation, interrupted confirmation and Check payment status.
  Compare the displayed expiry with the verified backend profile. No real charge
  was made, and these mobile changes have not been pushed or published.

## October 11, 2026 — practice subjects match the website

- Found that mobile rendered the API's raw available_subjects list, whereas the
  website SubjectSelector displays seven canonical subject groups. Mobile now
  uses exactly that website list, order and Telugu labels in both mediums.
  Topics, question availability, question loading and grading retain the APIs.
- Known backend registry aliases in practice links and weak recommendations map
  to the matching website group. Unknown subjects cannot become a selection via
  a link/recommendation. No question records or existing sessions were removed.
- TypeScript, lint of all changed code and all 73 mobile tests passed. The new
  contract check compares the native catalog against the actual website source;
  alias/link checks cover canonical names, Telugu labels and unrelated subjects.
  Website/backend/configuration code was not edited. Physical phone appearance
  is unverified; reload the development app and check both practice mediums.

## October 11, 2026 — consistent practice choices and compact loading

- Subjects, topic mode, question presets, practice modes, advanced choices and
  weak recommendations use a shared native choice grid. Items within a group
  use equal widths and the tallest measured text height; reserved check space
  keeps selection from changing text wrapping. Odd final grid items retain their
  width. Geometry resets for viewport/font changes and avoids truncating labels.
- Removed the large loading component from subject selection. Website subject
  choices remain usable during metadata requests, with one compact status row.
  Unknown/stale counts no longer appear as zero or produce false shortage notices.
  Duplicate practice history and access controls were removed; their header
  controls remain. Selected topic rows are expanded on demand, in batches of 12.
- Added 180 ms grouping for rapid filter changes and canonical multi-select
  cache keys. Counts/modes/timers/feedback are excluded from metadata keys.
  Topic catalogs are retained only within the same medium, subject and classes;
  changed filters never enable Start using a placeholder/previous count. Active
  subject/medium taps do nothing instead of clearing topic selections. Server
  quota, session creation, grading and existing website/backend are preserved.
- TypeScript, full mobile ESLint (zero warnings) and all 76 tests passed. Three
  cache contract tests check reused requests, subject/medium/class isolation and
  distinct confirmed topic/difficulty counts. Android Hermes export passed at
  dist/practice-consistent-export. No dependencies or native configuration changed.
- Native appearance still needs physical phone verification. Reload the installed
  development app; check both mediums, all seven subjects, topic search/selection,
  question presets and modes. Increase system font size and rotate the phone.
  Confirm equal group boxes, readable long labels, the unchanged odd final item,
  stable choices while checking, batched selected topics and disabled Start until
  the requested selection is ready. These changes remain local and unpublished.

## October 11, 2026 — logo introduction and smaller practice boxes

- Added a short opening animation using the existing assets/icon.png: a gentle
  scale/slide entrance with RSD Education and Learn. Practice. Grow., followed by
  a fade into navigation. It mounts once outside the auth-driven Navigation;
  session restoration runs in parallel and sign-in/reloads do not replay it.
  Reduced motion skips animation. A 1.8-second fallback and effect cleanup avoid
  blocking the app on image loading/accessibility errors or leaving animations
  and subscriptions running after unmount.
- Removed group-wide maximum text height and the text measurement updates from
  practice choices. Controls now have compact 48/60-point minimum heights, smaller
  padding and 32-point icons. Long text grows its own row without enlarging every
  choice. Phone subjects use one full-width column, matching the website; wider
  screens can use two. Full subject names and Telugu labels remain visible.
- TypeScript, full mobile ESLint (zero warnings) and all 76 mobile tests passed;
  the updated layout check also passed for full-width subject rows on ordinary
  phone widths. Final Android Hermes export passed at
  dist/opening-compact-final-export (1432 modules, existing RSD icon included).
- Physical-device appearance remains unverified. Check a cold start, sign-in,
  returning from the background (no repeated animation), reduced motion, both
  practice mediums, longer subject/topic names and larger system fonts.
  These are JavaScript changes; the installed development client can load them
  without an APK rebuild. No website/backend/native configuration changed.

## October 11, 2026 — Profile text error and layout

- Confirmed the exact error: an inline literal JSX space between the devices
  error and device list expressions compiled to a string child of Card's native
  View. Removed that space by restructuring Profile; Card itself was valid and
  was not changed to hide or automatically wrap invalid text.
- Added a top Back control with a Home fallback. Arranged account identity,
  active subscription/expiry, editable preferences, compact device rows, sign-out
  actions and legal links. Names/email wrap and the identity stacks on narrow
  screens or larger text. Missing/failed avatars have an initial fallback.
  Existing profile, sessions, revoke, sign-out and subscription APIs are retained;
  devices query cache is scoped to the current user.
- The regression check inspects compiled JSX literal children and failed on the
  original Profile with Card: " ". It now passes. All 77 mobile tests, TypeScript
  and lint of the changed Profile/test passed. Android Hermes export passed at
  dist/profile-fixed-export. No website/backend or native configuration changed.
- Physical phone appearance/navigation and live profile changes remain unverified.
  Reload the development client, open Profile from the avatar, check Back, long
  names, devices/loading/error states and larger system text. No APK rebuild is
  needed for these JavaScript changes; changes are local and unpublished.

## October 11, 2026 — subscription information in Profile, direct Plans links

- Practice quota/Pro-topic and locked mock prompts open Plans directly. The
  shared header Plans/Manage button and Home View plans action remain available.
  Profile has a dedicated Your subscription card with status, server plan name,
  expiry and pay/renew link. Only the current subscription summary moved there.
  Plan names reuse the existing plans query, enabled for accounts with a plan.
- The plans page starts with plan prices and Pay/Renew buttons; the current access
  summary lives in Profile. The optional coupon card follows the plan cards, with
  responsive input/apply controls, applied/invalid feedback and Remove coupon.
  Applying a code updates the displayed prices above before checkout. Payment
  history stays below; interrupted payment recovery remains available and blocks
  another checkout. Back falls back to Profile for direct route opens.
- Payment services, server prices/order creation, verification, recovery and
  access updates were not changed. All 77 tests, TypeScript, full mobile ESLint
  (zero warnings) passed after restoring the direct Plans links. The plans layout
  Android Hermes export passed at dist/profile-plans-export before that navigation
  correction. Source checks confirm Pro prompts navigate directly to /subscription.
- No live checkout was performed. Phone appearance, coupon application and real
  payment still require device verification. Reload the development client, open
  avatar → Profile → View plans & pay/renew, check plans first and coupon below,
  and check Back returns to the previous screen. Also check locked practice/mock
  features and header/Home actions go directly to Plans. No APK rebuild or website/backend edit is
  required. These changes are local and unpublished.

## October 11, 2026 — Profile overview and organized sections

- Redesigned Profile with a centered Google identity card, full-width name/email
  wrapping, photo/initial fallback, white sections with consistent padding/icons,
  and the existing top Back control. Subscription status, plan and expiry stay
  in Profile with the existing direct Plans action.
- Study preferences begin as a medium/goals summary; Edit opens the display-name
  field, website medium tabs and compact goal choices. Cancel restores saved
  values. Successful server saves update the profile and return to the summary;
  failures keep the form open. Save and Cancel controls are disabled while saving.
- Devices and sessions expand on demand instead of filling the initial page.
  Existing loading/error/retry, device status and revoke actions are preserved.
  Legal links and sign-out actions use grouped rows with consistent touch targets,
  dividers, icon styling and text wrapping. All-device sign-out retains confirmation.
  Practice/mock prompts still navigate directly to Plans; those screens and the
  backend were not edited during this redesign.
- TypeScript, lint of the changed Profile/test, all 77 mobile tests and Android
  Hermes export passed at dist/profile-organized-export. The existing compiled
  JSX regression check also covers the new ProfileSection container and passed
  again after the final accessibility changes. No native dependencies changed.
- Physical-phone appearance and live preference/device actions remain unverified.
  Reload the development client; check long identity text, larger system fonts,
  Edit/Cancel/Save, opening devices, Back and Plans. No APK rebuild is required.

## October 11, 2026 — organized subscription plans

- Replaced the large default page heading with compact Back/Refresh controls.
  Plan cards share a consistent layout: server name/badge, price/original price,
  period/duration, two benefit previews and Pay/Renew. Remaining benefits expand
  on demand; current/recommended plans have small badges and a subtle accent.
  Typography, padding, dividers and wrapping match the redesigned Profile.
- The optional coupon section remains below the plans, with an uppercase native
  input, Apply control and compact applied-code/Remove feedback. Input is disabled
  during coupon validation or checkout; confirmed coupon prices still come from
  the existing endpoint. Pending payment recovery and errors stay visible, and
  existing guards prevent payment while account/payment checks are incomplete.
- Payment history expands on demand, initially revealing five compact rows with
  plan name, date, amount and status. Show more reveals another five. History
  failure is reported as unavailable rather than incorrectly showing no payments.
  Current subscription information remains in Profile. Direct Plans links from
  Practice/Mock Tests, payment services, native configuration and backend are intact.
- TypeScript, lint of all changed code, all 79 mobile tests and Android Hermes
  export passed at dist/plans-organized-export. The existing native text-child
  regression now also covers the Plans screen and shared plan card.
- No live payment was made. Physical-phone layout, coupon interaction, payment
  history expansion and live checkout need device verification. Reload the
  installed development client; no APK rebuild is required. Changes remain local.

## October 11, 2026 — compact mock library and five-module scrolling

- Simplified the heading, single medium switch, search and unlock hint. Cards use
  compact spacing, smaller rounded corners, consistent statistics/actions and no
  shadow. Repeated English/Telugu medium badges and Not Started labels were removed;
  both medium tabs, bilingual labels, actual exam titles/data and progress remain.
- The existing module endpoint accepts pageSize=5; no backend change was needed.
  Requests now pass five for each page, and the cache key isolates the old
  20-module feed. Scrolling near the end fetches the next page automatically,
  with a small footer indicator instead of a Load more button. Failures retain
  the loaded modules and retry the same page; repeated events share one request.
- The mock list opts into five-item rendering batches and a smaller virtualized
  window. Stable row keys, render callbacks and retained data identities allow
  memoized cards to reuse previous renders. Other feeds keep their list defaults.
  Start, Continue, result navigation, sequential locks and direct Pro → Plans
  links retain their existing behavior; exam/question pagination is untouched.
- TypeScript, full mobile ESLint with zero warnings, all 82 tests and Android
  Hermes export passed at dist/mocks-five-export. New regression coverage verifies
  5 → 10 → 15 → 16 accumulation, final-page stopping, earlier card identities and
  old-cache isolation. Existing retry/filter/duplicate-request checks passed;
  native text-child checks now cover the mock screen and card as well.
- Phone layout and scroll performance are not yet measured. Reload the installed
  development client and scroll through several batches, switch mediums/search,
  and check Start/Continue/Results and Pro → Plans. No APK rebuild is required.
  Changes are local and unpublished.

## October 11, 2026 — further mock library scroll optimization

- Separated network paging from rendering: downloads remain five modules, with
  five initial cards and two cards per subsequent render batch, spaced 32 ms
  apart. The render window is seven viewports and fetching begins within 1.2
  viewports of the end, allowing more preparation before reaching new cards.
- Android detaches off-screen native views; iOS retains its previous clipping
  behavior. Cards have no transforms, absolute positioning or shadows. Heights
  remain dynamic for long titles, progress and larger text; no guessed fixed
  card geometry was introduced. Other feeds retain their existing defaults.
- Memoized the mock heading, controls and shared list header element, and retained
  the stable refresh/render handlers. Page loading notifications no longer rebuild
  medium tabs, search and filters when their values have not changed. Existing
  pagination, retry, exam navigation and subscription behavior are preserved.
- Reviewed React hooks, dependency lists, accessibility and render identity, and
  consulted https://reactnative.dev/docs/optimizing-flatlist-configuration.
  TypeScript, full mobile ESLint with zero warnings, all 82 existing tests and
  Android Hermes export passed at dist/mocks-smooth-export. No dependencies changed.
- These changes reduce avoidable rendering/drawing work; frame timing on the
  user's phone is not yet measured. Reload the current development client and
  check slow/fast scrolling down and back up through several pages, including
  larger system text. No APK rebuild is required; changes remain local.

## October 11, 2026 — simplified responsive Practice setup

- Replaced the large introductory card with a compact DSC Practice Zone heading,
  History control, short server quota row and direct Pro plans action. Removed
  Smart Practice Engine copy and repeated introductory/pro/topic descriptions.
  Important quota-exhaustion reasons, unavailable-question errors and retry
  controls remain visible. Subscription details still live in Profile.
- Four consistent panels use short Subject/Topics/Questions/Practice mode headings,
  compact padding and smaller corners. Subjects show the website's full label in
  the selected English/Telugu medium while retaining the same canonical API value,
  seven subject groups and order. Medium tabs use short labels and retain full
  accessible names. Topic selection, search and progressive loading are preserved.
- Question presets omit repeated captions; custom count is still available through
  an expandable row. All five existing modes are selectable in compact tiles,
  with one short explanation for the chosen mode. Instant feedback uses a concise
  switch row. Class/difficulty/timer and suggested topics are initially collapsed;
  opening them retains the existing selection and recommendation behavior.
- Choice columns now use measured container width and font scale; requested column
  counts are maximums, avoiding squeezed two-column controls on narrow screens or
  with larger text. Geometry tests cover 160–700-point containers, 1–3x text sizes,
  compact/regular tiles and 1–3 requested columns. Existing safe-area navigation,
  short-screen inline Start button and text wrapping remain in place.
- Reviewed native text children, hooks and accessibility. TypeScript, full mobile
  ESLint with zero warnings, all 88 tests and Android Hermes export passed at
  dist/practice-simple-export. Native text-child regression checks now cover the
  Practice screen, its selectors/choices/resume and TopicPicker. Website subject
  parity and the existing practice/session tests passed.
- No website/backend, authentication, native configuration or dependencies changed.
  Physical-phone layout and live practice selection need verification. Reload the
  development client; check both mediums, long subject names, custom count, all
  modes, More options/timer, saved resume and direct Pro → Plans. No APK rebuild
  is required. Changes are local and unpublished.

## October 11, 2026 — compact Grand Test start page and top Back

- Replaced the verbose mock instructions screen with a top Back control, compact
  module/access badges, full paper title and responsive question/time/marks tiles.
  Correct-answer marks and negative marking remain visible using server metadata.
  A four-line guide explains answering, the grid, pausing through Back and submitting.
  The old Save & leave wording and backend/storage implementation paragraphs are gone.
- The actual description is retained under an expandable Details panel. Start /
  resume uses the existing start endpoint and attempt navigation, with a sticky
  button that becomes inline on short/large-text screens. Back returns directly
  to Mock Tests; Back/Pro plans and route removal are guarded during the pending
  start request. Paid papers retain their direct Pro → Plans link. The duplicate
  bottom Back button was removed.
- Metadata failures/retry, start errors, server marking rules, active exam controls,
  saving/timers and question data are preserved. Summary tiles reuse the tested
  width/font-scale layout utility. All text wraps and interactive controls retain
  minimum 44-point targets. No native configuration, dependencies or backend edits.
- TypeScript, full mobile ESLint with zero warnings, all 89 tests and Android
  Hermes export passed at dist/mock-start-simple-export. The native text-child
  regression now covers the redesigned start screen as well.
- Phone appearance and authenticated Start/Resume remain unverified. Reload the
  development client and check Mock Tests → Start, top Back, Details, narrow/large
  text layouts, paid Pro plans and entering/resuming an attempt. No new APK is
  needed. Changes are local and unpublished.

## October 11, 2026 — responsive active Grand Test and question report

- Reproduced the expanded report form's raw-text error with the compiled JSX
  regression: the existing Card received a literal inline space between its
  error and success branches. Removed that child by restructuring the form;
  native text-child coverage now includes Exam and ReportQuestion.
- Compact question cards preserve complete English/Telugu questions and all
  options. Header icons retain 44-point targets; question Review/Clear actions
  use short labels and accessible descriptions. Width/font-scale calculations
  stack the header/action/navigation rows when needed. Bottom controls remain
  equal width in a row and become inline on short/large-text screens. Progress
  and paper metadata now scroll with the question; the bar represents answers.
- Report issue is a separate expandable panel instead of a nested padded Card.
  Full-width reason rows wrap long labels, with a details counter, the existing
  1,000-character cap, required Other details and disabled fields while sending.
  Errors are Text elements; success appears only after the existing API accepts
  the report. Memoization avoids rebuilding the form on each timer tick. iOS
  keyboard avoidance and drag-to-dismiss support the multiline field.
- Existing answer selection/locking, instant explanations, review flags, drawer,
  saving, paused resume, Back confirmation and submit flow remain intact. The
  shared question screen/form also improve practice and result reports. No API,
  authentication, website/backend, dependency or native configuration edits.
- TypeScript, full mobile ESLint with zero warnings, all 92 tests and Android
  Hermes export passed at dist/grand-exam-responsive-export (1,433 modules,
  3.6 MB bundle). Geometry checks cover 280–1,024-point widths and 1–3x text.
- Physical-phone appearance and authenticated report submission remain untested.
  Reload the installed development client; check both mediums, long options,
  larger system text, landscape, Review/Clear, the drawer, Report issue with
  keyboard, Back → Stay/Stop timer & save, resume and submit. No APK rebuild is
  required. Changes remain local and unpublished.

## October 11, 2026 — immediate answer selection

- Found that useExam.select published the chosen option only after awaiting the
  encrypted local draft save. It now publishes the journal's synchronous in-memory
  change before awaiting that save, so the highlight is independent of storage
  latency. Network sync still waits for the durable save; no debounce, dropped
  save, automatic grading or optimistic server acknowledgment was introduced.
- Regression tests exercise the actual compiled hook tap handler with the real
  ExamJournal and gated storage/network ports. All four reproduced the previous
  delayed highlight before the fix. They now verify immediate feedback, latest
  rapid-tap choice, no network send before persistence, retained pending answers
  on disk failure, and instant-practice locking while checking an answer.
- The change also covers Review/Clear through the shared handler. Existing
  save/sync failures, stale acknowledgments, submission, Back/pause and resume
  remain covered by the journal tests. No dependencies or backend edits.
- TypeScript, full mobile ESLint with zero warnings, all 96 tests and Android
  Hermes export passed at dist/mock-answer-immediate-export (1,433 modules,
  3.6 MB bundle). Physical-phone frame timing remains unmeasured. Reload the
  installed development client; check quick answer changes, Review/Clear, Next,
  pause/resume and offline retry. No new APK is required; changes remain local.

## October 11, 2026 — custom exam confirmation dialogs and stopped timer

- Replaced the native Back/Submit alerts with a reusable native AlertDialog:
  app colors, rounded white panel, dimmed backdrop, icon, wrapping text and
  two responsive buttons. Short/large-text screens can scroll the dialog.
  Android Back and accessibility escape cancel; the backdrop does not submit
  or discard answers. The existing palette Back behavior remains unchanged.
- Back offers Stay / Stop timer & save; Submit offers Keep working / Submit
  with the current unanswered count. Opening either dialog checkpoints and
  pauses the exam clock synchronously. Cancel resumes from that checkpoint
  and excludes dialog time from the question's time-taken value. Repeated taps
  cannot open duplicate dialogs or reset the original pause time.
- AppState transitions preserve an explicit dialog/action pause. Timer ticks
  avoid repeated checkpoint saves and expiry submission while paused. Confirming
  retains the stopped clock through durable saves, synchronization and server
  pause/submission. Failed leave resumes; failed final submission retains its
  durable intent and frozen timer for retry, including when reloading a saved
  pending submission. Existing timer expiry and backend endpoints are preserved.
- Regression tests execute the actual hook callbacks with the real ExamJournal,
  a controlled clock and gated persistence/network ports: cancellation, app
  switching, slow/failed pause, successful submission and failed submission.
  Immediate answer selection, saving/expiry tests and native text checks pass.
- TypeScript, full mobile ESLint with zero warnings, all 102 tests and Android
  Hermes export passed at dist/exam-alert-dialog-export (1,435 modules,
  3.6 MB bundle). Reviewed hooks, synchronous double-tap guards, accessibility,
  wrapping and short-screen layout. No new dependencies or backend edits.
- Physical-phone dialog appearance and authenticated server flow remain untested.
  Reload the development app and check header Back, system Back/gesture, Stay,
  Stop timer & save, Submit/Keep working, background/return while open, larger
  text, landscape and offline retry. No APK rebuild is required; edits are local.

## October 11, 2026 — immediate Results route and clearer submission/results

- Previously useExam awaited encrypted saves, server submission, draft cleanup
  and all active cache refreshes before redirecting. Confirming Submit now freezes
  the clock, marks submit intent, hands the real journal to a shared job and
  immediately requests the Results route. The route joins that job and shows
  submission progress before fetching/displaying the server result. Successful
  completion marks related caches stale without waiting for background refetches.
- The job retains the journal across route unmount, serializes simultaneous joins,
  and uses ExamJournal's existing persist → state check → answer flush → submit
  order. Failed disk/network/cleanup operations retain intent and answers for
  Retry submission. App restarts can recover the encrypted draft; if none remains,
  only a confirmed completed/submitted server state permits result loading. User,
  kind and attempt identity are checked before accepting restored/handed-off data.
  A lost response is reconciled without another final submit. Back is guarded
  while submitting; errors expose retry and saved-exam recovery.
- Submit confirmation uses shorter text with answered/remaining counts and a
  Timer paused notice. Results replace the large generic stats/card stack with
  marks, maximum and marks percentage; equal Correct/Wrong/Skipped counts; time;
  and answer accuracy with its denominator explained. Mock marks percentage is
  no longer labelled Accuracy. Fractional/negative scores and skipped/zero-answer
  cases retain their actual meaning; no pass/fail threshold or grade is invented.
- Section/topic scores and ranking are expandable; practice recommendations remain
  under topic scores. Next module/practice mistakes remain available. Compact
  review cards show full chosen/correct option text, then expand all options,
  explanations and reporting. Original paper numbers, source identities, recorded
  verdicts, edit warnings, four filters and eight-at-a-time review loading remain.
- Regression coverage checks immediate handoff before server completion, shared
  pending work, durable write ordering, cold recovery, failed writes, scoped
  identity, lost responses and cleanup retry; result metrics and Telugu answer
  labels; equal outcome geometry and native text containers. React hooks,
  accessibility, conditional queries and virtualized review rendering reviewed.
- TypeScript, full mobile ESLint with zero warnings, all 116 tests and Android
  Hermes export passed at dist/results-immediate-export (1,440 modules, 3.6 MB).
  No dependency, native configuration, website or backend changes.
- Physical-phone timing/layout and authenticated submission remain untested.
  Reload the development app; check Submit → immediate progress → results,
  offline retry, app restart during submission, Back guard, fractional marks,
  skipped answers, filters/details, ranking/next module and larger text. These
  are local changes; no APK rebuild is required.

## October 11, 2026 — subject filters and submitted-answer pagination

- Results now offer All subjects and only the subjects/sections present in the
  returned paper. Mock sections use their real IDs and names; practice falls back
  to subject. Counts show how many questions belong to each available subject.
  Selection combines with All/Wrong/Skipped/Marked and resets to page 1.
- Replaced growing review batches with at most 10 answers per page. Previous/Next,
  page count and visible range appear above and below the review. Only current
  page rows enter the existing FlatList. Page changes scroll to review controls
  using measured header height, without reloading the score summary or adding a
  nested list. Larger text stacks navigation buttons; subject names wrap and the
  selector scrolls within a safe-area modal, dismissible by Android Back.
- Pagination uses the existing full result response; no backend changes or
  unsupported query parameters. Original numbering, unique identities, recorded
  verdicts, chosen/correct answers, expanded options/explanations and reporting
  remain available. Empty filters have an empty state, not a fabricated page;
  refreshed/shrunken data clamps to an available page.
- Tests cover reaching all 160 questions once, section/subject identity and
  fallback, combining each verdict filter, original numbering and explanations,
  partial/empty pages, refresh clamping and the actual filter callbacks resetting
  page 1. Native JSX containers checked for the new controls. Hooks, stable
  list identities, virtualized rendering and accessibility reviewed.
- TypeScript, full mobile ESLint with zero warnings, all 122 tests and Android
  Hermes export passed at dist/results-pagination-export (1,441 modules, 3.6 MB).
  No new dependencies or native configuration changes.
- Physical-phone appearance and scroll position remain untested. Reload the
  development app; review a submitted 160-question paper, select each subject,
  combine verdict filters, use both pagers, expand answers, refresh the result
  and check larger text/landscape. Changes are local; no APK rebuild required.
