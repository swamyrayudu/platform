# RSD Education mobile

Independent native Android/iOS frontend for the existing RSD Education backend.
Uses Expo SDK 57, React Native 0.86, TypeScript and Expo Router. All question
selection, marking, subscriptions, permissions and analytics remain server-owned.
There is no WebView, new database, or mobile connection to Supabase/Redis.

The repository contains an outer workspace and an inner website root. Run the
commands below **inside the inner `platform/mobile/` directory**. Install the
mobile packages separately; do not add them to the website's package.json.

## Mock tests and question navigation

The mock library uses the website's compact module cards, medium tabs, search,
completion status and sequential unlocking. Existing pagination still loads
modules in batches as you scroll.

During an exam, tap the grid icon beside the timer to open the question palette
on the right. Questions are grouped using the paper's actual sections, with
All, Not done, Flagged and Done filters. Selecting a number closes the palette
and opens that question; the close button, backdrop and Android Back button
also close it. Previous/Next remain at the bottom. The panel adapts its columns
to screen width and system text size, and the exam header wraps for large text.
Answer saving, timers, resume and server grading use the existing exam logic.

## Open in Expo Go on Android

Use Node 22.13+ or a supported newer release (validation used Node 24.19).
Stop any previous development server with Ctrl+C, then run:

```powershell
cd "C:\Users\swamy\OneDrive\ドキュメント\platform\platform\mobile"
npm ci
npx expo start --go --clear --lan
```

This workstation's default Node is 22.11. To use its already installed Node 24.19
without changing any system settings, replace the start command above with:

```powershell
& 'C:\Users\swamy\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .\node_modules\expo\bin\cli start --go --clear --lan
```

Connect your Android phone and computer to the same Wi-Fi, open Expo Go with SDK
57 support, and scan the terminal QR code. The explicit `--go` flag is needed
because this project also includes a development client.
`npm run start:go -- --clear --lan` does the same. If LAN connections are blocked, stop the server and
run `npx expo start --go --clear --tunnel`; allow Expo's tunnel helper installation
if prompted. If Expo Go asks you to log in, use the same Expo account in Expo Go
and `npx expo login`.

Expo Go can open the app and login screen. SQLite, SecureStore and the other Expo
modules are available in Expo Go. The existing Google login callback uses
`rsdeducation://auth/callback`, which Expo Go cannot register; sign-in shows a
clear message to use a development build. Razorpay is loaded only when checkout
is available in a direct Android native build. Full authenticated student flows
and native checkout therefore require the development build described below.
The SDK upgrade preserves those flows and does not change the backend.

## Run an Android development build

Use Node **22.13+** or **24.3+**, npm, JDK 17, Android Studio, and an emulator or
Android phone. The workstation's default Node 22.11 is below React Native's
requirement; validation used the bundled Node 24.19 executable instead.

```powershell
cd mobile
npm ci
Copy-Item .env.example .env
npx expo prebuild --platform android
npm run android
```

Expo SDK 57 uses its matching bundled native template. Prebuild regenerates the
ignored native directories; all screens and services remain in the mobile source.
Old SDK 56 development APKs must be rebuilt before connecting to this project.
Never move the existing website to fix a native build path issue.

After the development build is installed:

```powershell
npm start
```

Use the development client on your phone for Google sign-in and Razorpay checkout.
The Google redirect needs the app's registered custom scheme.

If Windows's Gradle batch file corrupts the Japanese workspace path, run the
wrapper through Java directly from `mobile/android/`:

```powershell
java '-Dfile.encoding=UTF-8' -classpath gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain app:assembleDebug '-Pandroid.overridePathCheck=true'
```

Android CMake/Ninja failed on this workstation's Japanese folder name. A drive
alias also failed because dependency discovery resolves original paths. For a
local build, copy **only the mobile source** to a new ASCII temporary folder and
build there; the app's maintained source stays in this repository:

```powershell
# Run from mobile/ with Node 22.13+ / 24.3+ on PATH.
$mobileBuild = Join-Path $env:TEMP ('rsd-mobile-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $mobileBuild | Out-Null
Get-ChildItem -Force | Where-Object {
  $_.Name -notin @('node_modules', 'android', 'ios', 'dist', '.expo', '.git', 'tsconfig.tsbuildinfo')
} | Copy-Item -Destination $mobileBuild -Recurse
Push-Location $mobileBuild
npm ci
npx expo prebuild --platform android
npm run android
Pop-Location
```

Keep or remove that uniquely named temporary folder after building. EAS builds
also avoid the local path limitation. Do not rename the website.

## API and environments

```env
EXPO_PUBLIC_API_BASE_URL=https://rsdeducation.vercel.app
```

This production origin is documented in the website's
`docs/PAYMENTS_LOCAL_TESTING.md`. No guessed replacement backend is used.
Only this public origin is needed. Never copy the website's `.env` into mobile:
JWT, Supabase service-role, Google client secrets, Upstash and Razorpay secrets
must remain on the server. The Razorpay *public* key ID comes from the order API.

For local API development use a computer LAN IP or an HTTPS tunnel. Native fetch
uses bearer authentication, not browser cookies or Supabase authentication. A
phone's localhost points to itself. Google sign-in's WebCrypto adapter requires
**HTTPS** and an origin authorized for the existing Google web OAuth client.
An HTTP LAN backend can test API calls but cannot complete the browser login.

## Google-only login

See [Google sign-in setup](docs/GOOGLE_SIGN_IN.md) for the confirmed failure
causes, required backend deployment/Google settings, exact Windows phone build
commands and the real-account acceptance steps. Expo Go cannot complete this flow.

The existing server requires `/api/auth/nonce`'s HttpOnly cookie and the same
nonce in the verified Google ID token. Its old native-reference snippet omits
that requirement. This app preserves it using an Expo system-browser session:

1. App creates a fresh P-256 key pair and random state in memory.
2. Opens `${API_BASE_URL}/mobile-auth` in the system authentication browser.
3. That tiny added route fetches `/api/auth/nonce`, renders Google Identity
   Services using the existing public **web** client ID, then calls the existing
   `/api/auth/google` with `ANDROID` or `IOS` and the persisted device UUID.
4. Tokens returned by the existing handler are encrypted with ephemeral ECDH,
   SHA-256 and AES-GCM, bound to the app state. The fixed redirect is
   `rsdeducation://auth/callback`; it contains ciphertext, never plain tokens.
5. The app decrypts only within the initiating in-memory auth session, checks
   state and a 60-second response age, stores tokens in OS SecureStore and calls
   `/api/auth/me`. Cold-start links cannot sign a user in.

**Deploy `app/mobile-auth/route.ts` and the small practice persistence fix to
the existing Next.js deployment before testing production login.** These changes
are prepared locally; this task does not automatically redeploy your live site.
Existing website pages, cookies, Google verification and payment handlers remain
in place. `/mobile-auth` is the only added public compatibility route.

Google Cloud Console: retain the current web OAuth client and authorize the exact
backend origin (production `https://rsdeducation.vercel.app`; your HTTPS tunnel
if used for development). Google Identity Services popup mode requires no new
Google OAuth redirect URI. `rsdeducation://auth/callback` is an **app handoff**,
not a redirect URI to register on Google's web client. No Android/iOS client ID,
client secret or new Google provider is required for this browser flow. The Expo
scheme is registered when building the native app. Choose final bundle IDs before
store publication.

Login replaces the preceding active session because the backend intentionally
allows one active device. Refresh is single-flight; rotation/revocation errors
clear credentials. Transient network errors preserve them. Logout revokes the
server session, then clears tokens, encrypted local drafts and query cache.

## Student features

The mobile controls use the website's Bloom colours and subject styling. Practice
follows four numbered steps, with topic search and a fixed Start button. Subjects,
topics, counts, access rules and explanations come from the existing APIs.

Mock papers load 20 at a time as you scroll, with separate feeds for medium,
category and search. A failed next page keeps the loaded papers visible and offers
retry. History and results APIs return full responses; their lists reveal 12
attempts or 8 review cards at a time and virtualize the visible rows. Topic search
reveals 12 choices at a time. Review cards retain original question numbers and
expand the server's explanation on demand. Google authentication, offline exam
storage and server grading are unchanged by this UI update.

- Dashboard with live study streak, accuracy, module progress and syllabus.
- Onboarding/preferences: English or Telugu and existing study goals.
- All server-provided subjects, class levels, topics, subtopics and difficulty
  filters; question count, five practice modes, instant/end feedback and timer.
- Practice history, results, explanations, topic performance, weak-topic actions,
  retry incorrect questions, and question-quality reports.
- Mock catalog with medium, search, category, server pagination, instructions,
  sequential unlocks, resume, question navigation, review flags and server results.
- Mock section scores, rank/percentile, leaderboard and next module.
- Performance, subject proficiency and recent mock history.
- Profile, Google identity, study preferences, devices, session revocation,
  logout/all-device logout, subscriptions, payment history and legal pages.
- Loading, empty, offline/error, authentication and premium-denied states.

The source has no working AI tutor or notification API. The existing AI goal is
an interest preference only. Other exam programs are coming-soon cards. Admin
imports, question editing, generation and payment reconciliation remain web-only;
the native student UI never calls admin endpoints.

## Reliable examinations

Answers, question cache, current position, elapsed time, review flags and pending
submission are journaled in AES-GCM-encrypted SQLite. The encryption key stays in
OS SecureStore. A storage failure is shown; failed network writes retain pending
answers. Saved drafts belong to a user ID and cannot appear for another account.

Mock answer IDs use `question_uid` (`table:id`), not colliding bare question IDs.
Practice uses the server's subject-scoped IDs. Writes are serialized and versioned
so an older acknowledgment cannot erase a newer answer. Instant-feedback practice
locks a checked answer, matching the website. No client grading is used.

Final submit persists intent, reads server state, flushes pending answers and
submits the same attempt/session ID. On a lost response, retry reads status first
and opens existing results if already complete. Drafts clear only after confirmed
submission. There are no automatic retries of payment-order or practice-session
creation: those existing endpoints do not provide creation-idempotency keys.

Mock pause follows the website's policy: backgrounding/save-and-leave records
elapsed time and keeps the attempt resumable. Practice timer uses wall-clock
elapsed time while backgrounded. Elapsed time is checkpointed every ten seconds;
abrupt OS termination can lose at most the interval since the latest checkpoint.
The server currently trusts/clamps client elapsed time; this app does not invent a
new server timer. Sync requires connectivity, while an already loaded draft can
be answered offline. Initial question loading and results need the backend.

Minimal existing-backend changes: practice creation checks durable-save failure;
answers are persisted before acknowledgment; restores use the session's medium
and subject; end-feedback responses omit answer keys; completion is claimed once
using the existing row's status. Re-reading results does not create another
question attempt. No migrations, tables, selection or scoring algorithms added.
The existing async mastery write design remains; transactional mastery guarantees
across abrupt server termination would require a separate backend improvement.

## Razorpay and distribution

`app.config.ts` reads build-only `RSD_DISTRIBUTION`:

- `direct`: Android internal/direct APK builds have native Razorpay checkout,
  server-created orders, coupon validation, `/payments/verify` and recovery of
  interrupted orders through `/payments/recover`.
- `store` (default): existing subscription access, plans and payment history are
  supported. No external checkout button/link is displayed. iOS checkout is always
  disabled. A device-side payment-success event never activates access.

Educational digital subscriptions generally require store billing or an eligible
approved regional program. Before enabling purchasing in a store build, implement
the applicable store billing and backend receipt validation/entitlement bridge,
or obtain the relevant program approval. The existing Razorpay endpoints alone
do not support Apple/Play receipts. This app does not bypass that limitation.

Policies: [Google Play payments](https://support.google.com/googleplay/android-developer/answer/10281818),
[Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/).
Google-only login also needs an App Store guideline 4.8 eligibility review before
submission; no additional provider is introduced without your instruction.

Interrupted orders are retained encrypted. Use Check payment status; pending/error
outcomes remain recoverable. A successful backend verify/recover refreshes the
user's entitlements. No live payments are made by automated tests.

## Builds

```powershell
# Android APK for direct distribution
npx eas-cli build --platform android --profile preview

# Development client
npx eas-cli build --platform android --profile development

# Store Android AAB / iOS build (purchasing disabled)
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

The first EAS run requires your Expo account/project and signing setup. Set the
public API origin in your EAS environment if it differs. iOS local builds require
macOS/Xcode. Windows can export iOS JavaScript but cannot produce an iOS binary.
All EAS profiles pin the compatible Node runtime. The old SDK 56 template override
has been removed so Expo generates native projects using its SDK 57 template.

## Checks

```powershell
npm run check
npx expo-doctor@latest
npx expo install --check
npx expo export --platform all
node scripts/smoke.mjs https://rsdeducation.vercel.app
```

`tests/` exercises crypto interoperability and tamper rejection, auth rotation and
revocation, durable answers, stale acknowledgments, submission reconciliation,
timer gaps, the actual practice data-layer persistence with an isolated database
test port, and the auth adapter. Fixtures never reach production. Smoke checks
are read-only and validate unauthenticated protection and mock-list contracts.

See [validation results](docs/VALIDATION.md) for exactly what ran and what still
needs an authenticated device test. See [repository audit](docs/AUDIT.md) for
the discovered screen/endpoint map. Website changes beyond the compatibility
fixes only exclude `mobile/` from web TypeScript/lint and remove two unused runtime
exports rejected by Next.js's existing admin route build checker. The website's
package.json, package-lock.json, environment and page layouts are unchanged.
