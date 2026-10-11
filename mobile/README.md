# RSD Education mobile

Independent native Android/iOS frontend for the existing RSD Education backend.
Uses Expo SDK 57, React Native 0.86, TypeScript and Expo Router. All question
selection, marking, subscriptions, permissions and analytics remain server-owned.
There is no WebView, new database, or mobile connection to Supabase/Redis.

The repository contains an outer workspace and an inner website root. Run the
commands below **inside the inner `platform/mobile/` directory**. Install the
mobile packages separately; do not add them to the website's package.json.

## Mock tests and question navigation

The mock library uses compact module cards, medium tabs, search, completion status
and the website's sequential unlocking. Five modules load initially; scrolling
near the end requests the next five automatically. A small indicator shows page
loading, and a failed page has a retry action without removing earlier modules.
Cards omit repeated English/Telugu medium badges and the redundant Not Started
label; both medium tabs and all exam data remain available. Bilingual papers keep
their label. Downloads stay at five modules; subsequent rendering uses two-card
batches, with a buffer ahead of scrolling and Android off-screen view clipping.
Unchanged cards and header controls are reused during page loading.
Search/category/medium changes start their own feed.

Tapping Start opens a compact mock summary with a top Back control, the actual
question count/time/marks and marking rules. A short guide replaces the long
instructions; the paper description expands under Details. Start / resume stays
at the bottom (inline on short screens or with larger text). Back returns to
Mock Tests; navigation waits while the start request is pending. Paid papers
retain a direct Pro plans link.

During an exam, tap the grid icon beside the timer to open the question palette
on the right. It shows only **All questions**, grouped using the paper's actual
sections. Rows load progressively as you scroll and off-screen rows are
virtualized; timer ticks do not rebuild the drawer. Selecting a number closes it
and opens that question; the close button, backdrop and Android Back button
also close it. Previous/Next remain at the bottom on normal portrait screens;
on short screens or with large text they move into the scrollable content. The panel adapts its columns
to screen width and system text size, and the exam header wraps for large text.
Mock exams and practice have no Save & leave or End and leave buttons below the question.
The top Back button/system back gesture opens a custom app-styled dialog offering
Stay or Stop timer & save. Submit uses the same dialog with Keep working / Submit.
The timer pauses as either dialog opens; Stay, Keep working or Android Back
resumes it without counting time spent in the dialog. Confirming keeps it paused
through saving or submitting, including app switching. Stop timer & save saves and syncs answers, pauses
the paper, then returns directly to Mock Tests or Practice. Failed saves keep the exam open
and resume its timer. By user preference, practice is saved for resume instead of
being ended on exit. Practice's timer and position are retained in the encrypted
local draft; its existing answer endpoint saves pending answers. No new backend
pause endpoint is introduced. The practice setup offers Resume practice.
Answer saving, resume and server grading retain the existing backend rules.
Failed saves keep the exam open and resume the timer; a failed final submission
keeps its saved submission intent and stopped timer for Retry submission on Results.

Confirming Submit opens the Results route immediately. The page first shows
Submitting your answers, with the timer stopped, then loads the server result.
Submission continues after the question screen unmounts; both screens join the
same job. Errors offer Retry submission or Open saved exam. A reload recovers
the encrypted draft or checks a completed server attempt. Back is guarded while
submission is running; no completed result is displayed before server success.

Results lead with marks/maximum and marks percentage, then equal Correct/Wrong/
Skipped boxes, time and separately labelled accuracy among answered questions.
Section/topic scores and ranking expand on request. Review cards show the full
chosen and correct answers immediately; all options, explanation and reporting
expand under Explanation & options. Answer review has a subject selector based
on the paper's actual sections and 10 questions per page. Subject selection combines
with All/Wrong/Skipped/Marked; changing either filter starts at page 1. Previous/
Next and the visible range appear above and below the review. Original paper
numbering is preserved; switching pages returns to review rather than the score
summary. Next module and practice retry remain available.

The active question page uses compact cards, wrapping question/option text and
equal action sizes. Header controls and Review/Clear/Previous/Next rows stack
when screen width or larger system text needs more room. The progress line shows
answered questions. Report issue expands into a separate full-width form with
seven reason choices, optional details (required for Something else), a 1,000
character limit, server errors and a confirmed success message. The form avoids
raw text inside native View containers and repeated nested card padding.

## Responsive navigation and practice

The sign-in landing page uses the existing RSD logo, one Google-only sign-in
card, a short About this app paragraph and compact Terms/Privacy links. Large
promotional headings and statistic cards are removed. Sign-in still uses the
existing auth provider and browser callback bridge, with progress, cancellation,
errors and the active-device notice. Duplicate button taps are guarded; short
screens and larger text scroll within a safe-area layout.

The app uses the website's four bottom tabs: Home, Practice, Mock Tests and
Progress. The shared DSC / SGT header opens Profile and Plans/Manage. Practice
and mock-test Pro access prompts go directly to Plans. Current subscription
details live in Profile; the plans page starts with prices and payment buttons.
The tab bar reserves the device's bottom safe area, adapts its height to larger
text, keeps labels below icons in landscape and hides while the keyboard is open.
Header/side safe areas are applied once by the tab shell. Sticky action bars sit
above navigation; short screens and large-text layouts use scrollable actions.

Practice uses the website's DSC Practice Zone header, medium switch and four
compact numbered setup cards. The header has a small usage row and direct Pro
plans link; repeated introductory text is removed. Subjects show one label in the
selected medium and use one or two columns according to available space and text
size. Only the website's seven subject groups are offered, with matching names,
Telugu labels and order; raw bank aliases do not add tiles.
Topics retain search and progressive loading, and topic/class/difficulty options
and question counts come from the existing API. Instant feedback checks answers
automatically through that API and shows its explanation; failed saves remain
queued with a retry control. Answer checking locks only after server feedback.
Page padding, headings, chips, badges and statistic cards adapt to narrower
screens and larger text without hiding the content.

Practice choices use equal widths, compact padding and 48/60-point minimum
heights. Only rows with longer labels grow; one long subject no longer enlarges
every box. Subjects use full-width rows on phones and two columns when there is
room. The final box in an odd grid keeps its width, and larger system text remains
readable. Subjects stay visible
while one compact indicator checks question availability. Filter requests are
grouped across rapid changes and share cached responses for equivalent selections;
changing question count, mode or timer does not fetch metadata again. Start stays
disabled until the current selection is confirmed. Selected topics are expandable
and revealed in batches, rather than duplicating a long list by default.
Count presets omit repeated Questions captions; custom entry expands on demand.
All five modes use compact choices, with a brief explanation only for the selected
mode. Class/difficulty/timer options and suggested topics start collapsed. Requested
choice columns are capped by the measured container width and system text size,
so even explicitly requested two-column controls can become one column.

## Profile

Profile has a top Back button (Home fallback when opened directly), a centered
account card with a photo/initial fallback, and a Your subscription card with
current plan/status/expiry and a View plans & pay/renew action. Study preferences
start as a compact summary; Edit reveals display name, medium and goal controls.
Cancel restores the saved values; a successful Save returns to the summary.
Devices and sessions expand on demand. Legal links and sign-out actions use
compact grouped rows with consistent spacing. Long names/email and larger text
wrap; selection columns adapt to phone width and font size. Existing profile,
devices, sign-out and subscription APIs are preserved. Practice/mock Pro prompts
continue to open Plans directly.

## App opening

The existing RSD icon gently scales and fades into view with the app name,
then fades into the current screen in about one second. It runs once per app
root mount, while session restoration and navigation load in parallel. Reduced
motion skips the animation; a 1.8-second fallback prevents the introduction
from blocking navigation if image loading or accessibility checks stall.
This is a JavaScript introduction after the system launch screen. No native
configuration or APK rebuild is required to see it in the development client.

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
modules are available in Expo Go. Google login requires the updated development
build: Android uses the local native Credential Manager module, and iOS uses
`rsdeducation://auth/callback`, which Expo Go cannot register. Razorpay is loaded only when checkout
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

Use the updated development client on your phone for Google sign-in and Razorpay
checkout. Android Google sign-in needs the OAuth Android client and the build's
SHA-1 fingerprint; iOS uses the app's registered custom scheme.

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
The public origin and public Web OAuth client ID configure mobile Google login.
Never copy the website's `.env` into mobile:
JWT, Supabase service-role, Google client secrets, Upstash and Razorpay secrets
must remain on the server. The Razorpay *public* key ID comes from the order API.

For local API development use a computer LAN IP or an HTTPS tunnel. Protected
native API calls use bearer authentication. Only Google login preserves the
backend's short-lived nonce cookie between nonce issuance and token verification.
A phone's localhost points to itself. Google login requires **HTTPS** and the
browser adapter requires an authorized Google Web OAuth origin and redirect URI.

## Google-only login

See [Google sign-in setup](docs/GOOGLE_SIGN_IN.md) for the confirmed failure
causes, required backend deployment/Google settings, exact Windows phone build
commands and the real-account acceptance steps. Expo Go cannot complete this flow.

Android and iOS use the system-browser flow with the existing backend:

1. App creates a fresh P-256 key pair and random state in memory.
2. Opens `${API_BASE_URL}/mobile-auth` in the system authentication browser.
3. The route renders Google Identity Services using the existing **Web** client
   in redirect mode. Google POSTs to `/mobile-auth`; it checks CSRF and signed
   request context, then calls the existing Google handler with its original
   nonce, `ANDROID` or `IOS`, and the persisted device UUID.
4. Tokens returned by the existing handler are encrypted with ephemeral ECDH,
   SHA-256 and AES-GCM, bound to the app state. The fixed redirect is
   `rsdeducation://auth/callback`; it contains ciphertext, never plain tokens.
   Tap **Open RSD Education** on the browser return page. Android targets the
   installed `com.rsdeducation.student` package using an intent link.
5. The app decrypts only within the initiating in-memory auth session, checks
   state and a 60-second response age, stores tokens in OS SecureStore and calls
   `/api/auth/me`. Cold-start links cannot sign a user in.

Changes to the mobile-only `/mobile-auth` adapter require deployment to the
existing website project. The app checks for the new redirect capability before
opening Google. Website pages and the existing auth API handlers are unchanged.

Google Cloud Console: retain the current web OAuth client and authorize the exact
backend origin (production `https://rsdeducation.vercel.app`; your HTTPS tunnel
if used for development). Authorize the exact Web redirect URI
`https://rsdeducation.vercel.app/mobile-auth`. `rsdeducation://auth/callback` is an **app handoff**,
not a redirect URI to register on Google's web client. No iOS client ID,
client secret or new Google provider is required for this browser flow. The Expo
scheme is registered when building the native app. Choose final bundle IDs before
store publication.

Login replaces the preceding active session because the backend intentionally
allows one active device. Refresh is single-flight; rotation/revocation errors
clear credentials. Transient network errors preserve them. Logout revokes the
server session, then clears tokens, encrypted local drafts and query cache.

## Student features

Home centers on the exam syllabus: actual question count, marks and duration,
one Practice/Mock Tests action pair and a compact list of the backend's sections
with their question/mark split. Known sections open the existing practice subject;
unknown sections remain visible without inventing a practice choice. Saved exam
resume remains available. Motivational/promotional panels, repeated route links,
progress statistics and module journey are removed from Home. Progress, History,
Profile and Plans remain available through their existing navigation.

Home and Practice mark Telugu, English, Mathematics, Science and Social Studies
as Content + Methodology, matching the existing AP SGT blueprint. In Telugu
practice medium the label and brief teaching-methods explanation are Telugu.
Methodology is part of these subjects, not an eighth practice subject or extra
exam marks. Existing topic selection, access rules and question loading remain.

Progress uses an overall performance pie chart, two compact activity counts and
subject bars showing correct/recorded questions. Green means correct; gold means
wrong or skipped, because the existing analytics includes all questions from
submitted mock sections. The chart uses exact subject counts rather than an
average of subject percentages. Empty history shows a start action, not a zero
score chart. Next practice links one real subject/topic into the existing setup;
three recent mocks link to results, and full history remains available. Practice
accuracy changes are labelled in percentage points. Progress refreshes when its
tab opens and supports pull-to-refresh. Charts use native Views with no additional
native dependencies or APK rebuild.

The mobile controls use the website's Bloom colours and subject styling. Practice
follows four numbered steps, with topic search and a responsive Start button. Subjects,
topics, counts, access rules and explanations come from the existing APIs.

Mock papers load five at a time as you scroll, with separate feeds for medium,
category and search. A failed next page keeps the loaded papers visible and offers
retry. History and results APIs return full responses; history reveals 12 attempts
at a time, while results show a subject-filtered page of at most 10 review cards.
Both virtualize the visible rows. Results pagination is local and does not add
unsupported pagination parameters or extra API requests. Topic search
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

Mock papers use the website's existing start/resume endpoint. A paused paper does
not block another module or the other medium: encrypted drafts are kept per
user, exam kind and server attempt ID. The installed app's old single draft is
migrated without discarding queued answers. Home offers the most recently opened
exam; earlier mock attempts remain available through their library cards.
Opening a saved exam checks server status first, so submitted papers open results
and ended attempts cannot be resumed. A network-only failure can still resume a
cached draft; authentication failures do not bypass the server check.

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

Profile's **View plans & pay/renew** button opens all prices from the existing
authenticated plans API. Profile shows the current plan, status and expiry.
The plans page has a compact Back/Refresh header and consistent plan cards with
prices, durations, two benefit previews and **Pay/Renew** buttons. More benefits
expand on demand. An optional coupon card stays below the plans; payment history
is collapsed initially and shows five rows at a time when opened. Apply a coupon before paying; updated
prices appear on the plan cards above. Renewal uses the same server payment flow as the website;
paid days extend an unexpired subscription, or restart access after expiry.
Prices are not hardcoded in the app. A coupon changes only the display and code
sent with the order; the server determines the actual charge. Repeated taps
cannot open concurrent checkouts, and an interrupted order must be checked
before a new payment. Paid confirmation refreshes the profile, history and
practice/mock access without restarting the app.

For the installed Android development app, restart Metro with the same direct
distribution setting as its EAS build so the payment buttons are available:

```powershell
$env:RSD_DISTRIBUTION = 'direct'
npx expo start --dev-client --clear --lan
```

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
