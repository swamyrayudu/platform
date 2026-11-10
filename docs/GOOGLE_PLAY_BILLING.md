# Google Play Billing (Android store build)

RSD Pro is sold in two places, and both unlock the same account-wide access:

| Where | Seller | What is sold | Code |
|---|---|---|---|
| Website + direct APK | Razorpay | One-time passes: 30 / 180 / 365 days | `lib/payments/*`, `app/api/payments/*` (unchanged) |
| Google Play app | Google Play Billing | Auto-renewing subscriptions: monthly / quarterly / yearly | `lib/payments/google-play/*`, `app/api/payments/google-play/*`, `mobile/modules/rsd-play-billing` |

## How access is shared

```
Razorpay  ──► users.subscription_*            (written only by activate_subscription — untouched)
Play      ──► play_subscriptions ──► users.play_expires_at   (written only by upsert_play_subscription)

premium = web access active  OR  play_expires_at > now      → effectiveSubscription() in lib/auth/types.ts
```

- `isUserPremium()` (every `requirePremium` route, practice quota, resources) and `toPublicUser()` use that one rule.
  The website's `PremiumContext` and the app's `hasActiveSubscription()` read `PublicUser`, so they follow
  automatically. `PublicUser.subscriptionSource` says which system grants access (`web` | `google_play`).
- Play time is kept **separately** because Google can take it back (refund, revoke, failed renewal).
  A refund recomputes `play_expires_at` from the user's tokens and never touches web-purchased days.
- A user with both keeps the later expiry. Buying on the website while a Play subscription is active
  does not stack onto Play time (and vice versa).

## Purchase flow

1. App → `GET /api/payments/google-play/config`. Returns product id, base plans, features and a random
   `obfuscatedAccountId` for this account (`users.play_account_id`, no PII). No prices.
2. App → Play Billing Library: loads `ProductDetails` (Google's localized price), opens the purchase sheet
   with `setObfuscatedAccountId`.
3. App → `POST /api/payments/google-play/verify {purchaseToken}`. The server:
   reads the token with **`purchases.subscriptionsv2.get`**, checks product + base plan, checks ownership
   (the token's `obfuscatedExternalAccountId` must map to the caller), writes it atomically, then
   **acknowledges it server-side** (`purchases.subscriptions.acknowledge`). Access comes only from this answer.
4. Pending payments (UPI / cash, common in India) are stored as `PENDING` with no access. When Google confirms
   them, RTDN `SUBSCRIPTION_PURCHASED` and the app's purchase listener both re-sync.
5. On every app start (signed in), the app re-sends this account's active Play purchases, so a lost verify
   call (app killed, offline) is still confirmed and acknowledged within Google's 3-day window.
6. Plan change (e.g. monthly → yearly) passes the old token with `WITH_TIME_PRORATION`. The new token carries
   `linkedPurchaseToken`; the old row is marked superseded and stops granting access.

## Lifecycle via RTDN

`POST /api/payments/google-play/rtdn` receives Pub/Sub push messages, verifies the Google-signed OIDC token,
dedupes by Pub/Sub `messageId` (`play_rtdn_events`), and **re-reads the token from Google** for every
notification, so order and duplicates do not matter.

| Notification | Result |
|---|---|
| PURCHASED, RENEWED, RECOVERED, RESTARTED | access until the new `expiryTime` |
| IN_GRACE_PERIOD | access continues while Google retries payment |
| CANCELED / CANCELLATION_SCHEDULED | access until the end of the paid period |
| ON_HOLD, PAUSED | no access until recovered / resumed |
| EXPIRED, PENDING_PURCHASE_CANCELED | no access |
| REVOKED (12), voided purchase (refund / chargeback) | access removed immediately; **sticky** (`revoked_at`) |
| test notification | logged |

A refund that arrives before the app ever reported the token is kept in `play_rtdn_events` and applied when
an account claims the token.

## One-time setup

### 1. Play Console — products
Monetize with Play → Products → **Subscriptions** → Create subscription:
- Product id: `rsd_pro` (or set `GOOGLE_PLAY_SUBSCRIPTION_ID`)
- Base plans (auto-renewing): `monthly` (1 month), `quarterly` (3 months), `yearly` (1 year). Activate each.
- Set INR prices per base plan. Optional: a free-trial / intro offer — the app shows it automatically to eligible users.
- Recommended: enable grace period and account hold (Monetization setup → Subscriptions).

Base plan ids must match `lib/payments/google-play/catalog.ts`. A base plan that is not active simply does not show in the app.

### 2. Google Cloud — service account for the Developer API
1. Google Cloud project linked to Play Console. Enable **Google Play Android Developer API**.
2. Create a service account → Keys → Add key (JSON).
3. Play Console → Users and permissions → Invite new user → the service account email → app permissions:
   **View financial data** and **Manage orders and subscriptions**. (Can take up to 24 h to apply.)
4. Put the JSON in `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (one line, or base64 of the file).

### 3. Real-time developer notifications
1. Pub/Sub → create topic, e.g. `play-rtdn`. Grant `google-play-developer-notifications@system.gserviceaccount.com`
   the **Pub/Sub Publisher** role on it.
2. Play Console → Monetization setup → Real-time developer notifications → topic
   `projects/<gcp-project>/topics/play-rtdn` → Send test notification.
3. Create a **push** subscription on the topic:
   - Endpoint: `https://<your-domain>/api/payments/google-play/rtdn`
   - **Enable authentication** → service account (e.g. `play-rtdn-push@<project>.iam.gserviceaccount.com`)
   - Audience: the endpoint URL (or any string — must equal `GOOGLE_PLAY_RTDN_AUDIENCE`)
   - Retry policy: exponential backoff.
4. Set `GOOGLE_PLAY_RTDN_AUDIENCE` and `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT` (that service account's email).

### 4. Deploy — in this order
1. **Apply the migration** `supabase/migrations/20261107120000_google_play_billing.sql` (SQL editor or
   `supabase db push`). Admin user lists select the new columns, so apply it **before** deploying the website.
2. Add the env vars (see `.env.example` §7) in Vercel and deploy the website.
3. Build and upload the app: `eas build --platform android --profile production` (app version 1.1.0 —
   new native module, so an OTA update alone is not enough). Older app versions keep working: without the
   native module they show the existing "Your access" screen.

## Testing
- Play Console → Settings → **License testing**: add tester Gmail accounts. Their purchases are free test
  purchases with accelerated renewals (monthly renews every ~5 minutes) — good for exercising RTDN.
- Install the app **from the internal testing track** (Play Billing does not work in Expo Go or the direct APK).
- Test rows have `play_subscriptions.is_test = true`.
- Check: purchase → `PLAY_PURCHASE_VERIFIED` in `security_events`; RTDN → rows in `play_rtdn_events` with `status = processed`.
- Refund a test order in Play Console (Order management → Refund, with "Remove entitlement") → access disappears.

## Policy notes (India)
- The Play build sells digital subscriptions **only** through Google Play Billing and never shows Razorpay,
  web prices or "buy on our website" links. The direct APK (website download) keeps Razorpay.
- Prices, currency and taxes shown are Google's strings (`formattedPrice`); nothing is hard-coded.
- The plans screen states the price, billing period, auto-renewal, that it is charged to the Google Play
  account, and how to cancel; "Manage in Google Play" opens Play's subscription page.
- Google's service fee for subscriptions is 15%.
- India also has **user choice billing** (offer another payment option next to Google Play Billing in the app).
  It needs enrollment and extra integration and is **not** implemented here — check current eligibility in
  Play Console before considering it.
- Deleting an RSD account does not cancel a Google Play subscription. Tell users to cancel in Google Play first
  (consider adding this line to the delete-account screens).
