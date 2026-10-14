# Publishing RSD Education on Google Play

The code side is done: in-app and web account deletion, a store build without
plans or prices, unneeded Android permissions removed, and version codes that
increase on every production build. What is left happens in Google's consoles.

## 1. Before the first upload

1. **Deploy the website.** The app's delete button calls `DELETE /api/auth/account`,
   and Play checks `https://rsdeducation.vercel.app/delete-account` and
   `https://rsdeducation.vercel.app/privacy`. Both must be live.
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

Reviewers must reach every feature, including Pro, and the app only offers Google sign-in.

1. Create a new Gmail account just for review. **Turn 2-Step Verification off**: Google's
   reviewers cannot receive your sign-in codes.
2. Sign in to the app with it once and finish onboarding, so the account exists.
3. Give it Pro (preview first, then write):
   ```bash
   node --env-file=.env scripts/grant-pro.mjs reviewer@gmail.com
   ```
   ```bash
   node --env-file=.env scripts/grant-pro.mjs reviewer@gmail.com 365 --apply
   ```
4. In **App access**, choose "All or some functionality is restricted" and add:
   - Name: `Reviewer account`
   - Username / password: the Gmail address and password
   - Instructions: `Tap "Continue with Google" and choose this account. It has Pro
     access, so all practice, topic selection and mock tests are available.
     Sign-in is Google-only; there is no separate password login.`

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

Data **collected**. Nothing is **shared**: Supabase, Vercel and Upstash process data
on your behalf, which Google does not count as sharing.

| Data type | Collected | Why | Optional? |
|---|---|---|---|
| Name | Yes | Account management, app functionality | Required |
| Email address | Yes | Account management | Required |
| User IDs | Yes (Google account ID) | Account management | Required |
| Other personal info: profile photo URL from Google | Yes | App functionality | Required |
| Purchase history | Yes (Pro bought on the website) | App functionality | Optional |
| App interactions / other actions (answers, scores, progress) | Yes | App functionality, analytics of your own progress | Required |
| Device or other IDs | Yes (device identifier for sign-in sessions) | Security, account management | Required |
| Location, contacts, photos, files, messages, audio | No | — | — |
| Crash logs / diagnostics | No (no analytics or crash SDK) | — | — |

- Data encrypted in transit: **Yes** (HTTPS only).
- Users can request deletion: **Yes**. Delete account URL:
  `https://rsdeducation.vercel.app/delete-account`
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

Google Play requires its own billing for digital subscriptions. The store build
(`RSD_DISTRIBUTION=store`) therefore shows **no plans, prices or "upgrade" buttons**
(`showsPlans` in `services/payment-service.ts`). People who bought Pro on the website
sign in and get Pro. The direct APK (`RSD_DISTRIBUTION=direct`) still sells through
Razorpay. Selling inside the Play app later means adding Google Play Billing, or
enrolling in Google's alternative billing programme for India.

## 7. App size

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

## 8. Requirements already met

- Target SDK 36 (Android 16), required for new apps since 31 August 2026.
- "Draw over other apps" and the storage permissions are removed. The rest are normal
  permissions that need no declaration: internet, network state and vibrate, plus NFC,
  biometric and basic phone state, which libraries add (Credential Manager,
  `expo-secure-store`, Razorpay).
- No ads, analytics or tracking SDKs.
