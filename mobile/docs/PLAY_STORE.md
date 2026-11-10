# Publishing RSD Education on Google Play

The code side is done: in-app and web account deletion, Google Play Billing in the store build, unneeded Android permissions removed, and version codes that
increase on every production build. What is left happens in Google's consoles.

## 1. Before the first upload

The Play build's package is **`com.karthik.rsdeducation`** (set in `app.config.ts` when
`RSD_DISTRIBUTION=store`). The website APK keeps `com.rsdeducation.student`. Register a Google
Sign-In Android OAuth client for the Play package (see `GOOGLE_SIGN_IN.md`).


1. **Deploy the website.** The app's delete button calls `DELETE /api/auth/account`,
   and Play checks `https://rsdeducation.vercel.app/account-deletion` (deletion policy),
   `https://rsdeducation.vercel.app/delete-account` (where deletion is done) and
   `https://rsdeducation.vercel.app/privacy`. All must be live.
2. **Build the Play bundle** (an `.aab`, signed by EAS):
   ```bash
   eas build --platform android --profile production
   ```
   `autoIncrement` raises `android.versionCode` in `app.json` on each production
   build. Commit `app.json` afterwards so the next build starts from the new number.
   The local `android/` folder is generated and git-ignored; EAS rebuilds it from
   `app.json`. If you build locally, run `npx expo prebuild --platform android --clean`
   first (back up any signing files you keep inside `android/`).

## 2. Reviewer account (Play Console → App content → App access)

Reviewers must reach every feature, including Pro. Students sign in with Google;
reviewers use an email + password account made by you. There is no public sign-up.

1. Sign in to the website as admin and open `https://rsdeducation.vercel.app/admin/login-accounts`.
2. Check that the **Email sign-in** switch is **on**. Keep it on until review is approved,
   and again whenever you send an update for review. Off hides "Continue with Email"
   and signs the reviewer out.
3. Create the account:
   - Email: one used only for review, e.g. `playreview.rsd@gmail.com`. No mails are
     sent to it, but use an address you own.
   - Name: `Play Store reviewer`
   - Password: 8+ characters with letters and numbers. Keep it only in Play Console,
     never in this repository.
   - Tick **Give Pro access for** and enter `365` days.
4. Test it once on a phone with the Play build: **Continue with Email** → sign in →
   finish onboarding (language and goals) so the reviewer starts on Home. Then sign out.
5. In **App access**, choose "All or some functionality is restricted" and add:
   - Name: `Reviewer account`
   - Username / password: that email and password
   - Instructions: `On the sign-in screen tap "Continue with Email" and sign in with
     this email and password. The account has Pro access, so all practice, topic
     selection and mock tests are available. The account can be signed in on
     several devices at the same time.`

Accounts made on this page (no Google sign-in) may stay signed in on several devices at
once, one session per device, so parallel review devices do not sign each other out.
Students who sign in with Google still keep one device. This needs migration
`supabase/migrations/20261110120000_multi_device_review_sessions.sql`; until it is applied,
the reviewer account falls back to one device.

If the reviewer account stops working, open the same page and save the email again
with a new password (this also resets its Pro days), then update App access.
`scripts/grant-pro.mjs` can still give Pro to a Google account that has signed in once.

## 3. App content answers

| Form | Answer |
|---|---|
| Privacy policy | `https://rsdeducation.vercel.app/privacy` |
| Ads | No ads |
| Target audience | 18 and over (the policy says the app is for adults preparing for DSC/SGT) |
| Content rating | Category: Education. No violence, sexual content, gambling or user chat |
| Government app | No |
| Financial features | None |
| Health | No |

### Data safety

Data **collected**. Nothing is **shared**: Supabase, Vercel, Upstash and Expo (app updates)
process data on your behalf, which Google does not count as sharing. Keep this form and
`/privacy` saying the same thing: Google compares them.

Passwords exist only for the reviewer account you create, stored as a hash; students
never enter one, so there is no extra data type to declare for them.

| Data type | Collected | Why | Optional? |
|---|---|---|---|
| Name | Yes | Account management, app functionality | Required |
| Email address | Yes | Account management | Required |
| User IDs | Yes (Google account ID) | Account management | Required |
| Other personal info: profile photo URL from Google | Yes | App functionality | Required |
| Purchase history | Yes (Google Play subscriptions and Pro bought on the website) | App functionality | Optional |
| App interactions / other actions (answers, scores, progress, study files opened) | Yes | App functionality, analytics | Required |
| Other user-generated content (question reports and their optional note; questions uploaded in My Tests) | Yes | App functionality | Optional |
| Device or other IDs | Yes (random device code for sign-in sessions; random installation code sent to Expo for updates) | Security, account management, app functionality | Required |
| Location, contacts, photos, files, messages, audio | No | — | — |
| Crash logs / diagnostics | No (no analytics or crash SDK) | — | — |

- Data encrypted in transit: **Yes** (HTTPS only).
- Users can request deletion: **Yes**. Delete account URL:
  `https://rsdeducation.vercel.app/account-deletion` (public policy page: steps in the app,
  on the website and by email; what is deleted and kept). It links to `/delete-account`,
  where a signed-in user deletes the account without installing the app.
- Users can request that some data be deleted without deleting the account: **Yes** (by email,
  described on the same page).
- Deletion is in the app too: Profile → Account → Delete account.

## 4. Store listing

- App icon 512 × 512 PNG, feature graphic 1024 × 500, at least 2 phone screenshots.
- Short description (80 characters) and full description, in English. Add Telugu as a
  translation.
- Category: Education. Contact email: `rsdeducationplatform@gmail.com`.

## 5. Testing before production

- **Personal developer account created after November 2023:** run a **closed test with
  at least 12 testers who stay opted in for 14 days in a row**. Only then can you
  apply for production access.
- **Organisation account:** no tester minimum; internal testing then production.
- Check the Play Console home page for **developer identity verification** and finish it.

## 6. Payments in the store build

The store build (`RSD_DISTRIBUTION=store`) sells RSD Pro as **Google Play prepaid passes** (1, 3 or 12
months; one-time payment, no auto-renewal, no auto-pay) through `modules/rsd-play-billing` and
`components/play-subscription-plans.tsx`. Buying again adds time. Prices come from Google; the server
verifies every purchase with the Google Play Developer API and tracks expiry and refunds through
real-time developer notifications.
The direct APK (`RSD_DISTRIBUTION=direct`) still sells through Razorpay, unchanged. Pro bought either
way works on the website and in both apps (`planSource` in `services/payment-service.ts`).

Razorpay can never appear in the Play app, by three separate guards:

- **No Razorpay code in the Play build.** `react-native.config.js` leaves the Razorpay native SDK out
  unless `RSD_DISTRIBUTION=direct`.
- **Checkout needs that code.** `services/payment-service.ts` offers Razorpay only when its native module
  is present, so even a JavaScript update with the wrong settings cannot open it in the Play app.
- **Separate update channels by runtime.** The Play build's runtime version is `<version>-play`
  (`app.config.ts`); the website APK's is the plain version. An `eas update` made with
  `RSD_DISTRIBUTION=direct` is only delivered to website APKs, and one made without it only to Play
  installs. Publish Play updates with `RSD_DISTRIBUTION` unset (or `store`), and website-APK updates
  with `RSD_DISTRIBUTION=direct`, each from its own channel.

Setup (Play Console products, service account, Pub/Sub, env vars, migration, testing):
see `../docs/GOOGLE_PLAY_BILLING.md` in the website root.

App content: declare **Purchase history** as collected (Google Play subscriptions and website purchases).
Card / UPI details are handled by Google Play and never reach RSD Education.

### Over-the-air updates to the Play app

Google Play allows JavaScript updates outside the store for bug fixes. Payment changes, changes to
what content is shown, and new features must go out as a new build that Google reviews. Publish Play
updates only with:

```bash
npm run update:play -- --message "Fix result screen"
```

`scripts/play-update.ts` compares the app (including uncommitted files) with the commit of the latest
finished EAS production build, which is what Play installs run, and refuses to publish if anything in
`utils/play-update-rules.ts` changed:

| Changed | Why it is refused |
|---|---|
| `modules/`, `app.config.ts`, `app.json`, `eas.json`, `react-native.config.js`, `package.json`, app icon | Native or build change: only a new build can carry it |
| Payment and subscription screens and services | Play payments policy: reviewed build only |
| `services/content-policy.ts`, `utils/legal.ts` | Hidden content and the government disclaimer |
| A new file under `app/` | A new screen is a new feature |

Otherwise it runs `eas update` on the production channel with `RSD_DISTRIBUTION=store`. Use
`--dry-run` to check without publishing. Never run `eas update --channel production` by hand.

### App updates: small and required (Google Play in-app updates)

The Play app uses Google Play's own in-app updates (`modules/rsd-app-update`,
`components/play-app-update.tsx`, rules in `utils/play-update-policy.ts`). It checks when the app
opens and when it comes back to the front (at most every 30 minutes, every time while an update is
required). Nothing interrupts an exam: prompts wait until the student leaves the exam screen.

| Kind | When | What the student sees |
|---|---|---|
| **Small update** (Play "flexible") | A newer version is live on Google Play and "Small updates" is on | "Update available" → Update / Later. It downloads in the background; then "Update ready" → Restart. "Later" asks again after 3 days, or at once for a newer version. A downloaded update also installs by itself when the app goes to the background. |
| **Required update** (Play "immediate") | The installed version code is below the minimum at `/admin/app-updates`, or the release has Play update priority 4–5 | Play's full-screen update opens by itself. If they back out, the app stays locked on "Please update RSD Education" with an Update now button. If Play cannot update it (for example the app was not installed from Play), the button opens the Play Store page. |

Releasing:

1. Build and upload as usual; wait until the release is live on the production track.
2. Nothing else for a normal release: students get the small-update prompt.
3. For a release everyone must have (a serious bug, a payment change, a server change old versions
   cannot handle): open `/admin/app-updates` and set **Minimum version code** to the new version
   code (Play Console → Test and release → App bundle explorer). Set it only after the version is
   live, or students are asked for a version they cannot get yet. Phones pick it up within a minute.
4. Update priority (0–5) can only be set through the Google Play Developer API, not in Play Console;
   the minimum version code is the normal way.

The website APK has no Play updates (it is not installed from Play); it keeps the over-the-air
updates above.

Testing: in-app updates only work for an app installed from Google Play. Install an older version
from an internal testing track (or internal app sharing), publish a higher version code to the same
track, then open the app (Play may take a little while to see the new version; clearing the Play
Store app's cache helps).

## 7. Content hidden in the Play build

Until we hold the rights to publish them on Google Play, the store build hides study files
and previous papers (`services/content-policy.ts`):

- **Resources** (books, study material, bit banks, previous papers) is removed from More;
  an old link to it opens More instead.
- The exam roadmap still shows its study-note PDFs in every build: they are our own work.
  Reviewers see exactly what students see; never hide content only from the review account.
- Mock tests: no "Previous papers" filter, and the server leaves `previous_paper` mocks out
  of the list (`exclude_category`).

The website APK and the website still show all of it. To show it in the Play app again, change
`showsStudyFiles` in `services/content-policy.ts`, and add it back to the store listing.

## 8. App size

Set in `app.config.ts` and `package.json`, measured on a local release build:

- Release builds run R8, which strips unused code and resources. The app code went from
  14.8 MB to 6.3 MB. Keep rules for Razorpay and Credential Manager are included.
- `react-native-reanimated` and `react-native-gesture-handler` are left out of native
  linking (`expo.autolinking.exclude`). Only expo-router's drawer uses them, and the app
  has no drawer. If you ever add a drawer or animations, remove them from that list.
- The direct APK (`RSD_COMPACT_APK=1`, preview profile) contains only ARM code and
  compresses it: **100.8 MB → 26.0 MB**.
- The Play bundle keeps every CPU type. Play delivers only the one each phone needs, so
  the download should be about 20 MB; Play Console shows the exact figure after upload.
- After any native change, test the release build on a phone before publishing:
  Google sign-in, Razorpay checkout (direct APK), practice, mock tests and updates.

## 9. Requirements already met

- Target SDK 36 (Android 16), required for new apps since 31 August 2026.
- "Draw over other apps" and the storage permissions are removed. The rest are normal
  permissions that need no declaration: internet, network state and vibrate, plus NFC,
  biometric and basic phone state, which libraries add (Credential Manager,
  `expo-secure-store`, Razorpay).
- No ads, analytics or tracking SDKs.
