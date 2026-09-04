# Razorpay payments — local testing with zrok

This guide covers running the Razorpay flow end to end on `http://localhost:3000`
in **Test Mode**. The application code already exists in the repo; this document
is about keys, the tunnel, the dashboard, and how to verify each step.

---

## 1. Where the code lives

| Piece | File |
|---|---|
| Plan catalog (the only place prices are defined) | `lib/payments/plans.ts` |
| Razorpay SDK + HMAC signature checks | `lib/payments/razorpay.ts` |
| Coupons (server-only) | `lib/payments/coupons.ts` |
| DB helpers (`payment_orders`, activation) | `lib/payments/db.ts` |
| Checkout script loader (client) | `lib/payments/load-razorpay.ts` |
| Create order (`POST /api/payments/orders`) | `app/api/payments/orders/route.ts` |
| Verify after Checkout (`POST /api/payments/verify`) | `app/api/payments/verify/route.ts` |
| Webhook (`POST /api/payments/webhook`) | `app/api/payments/webhook/route.ts` |
| Coupon check (`POST /api/payments/coupons`) | `app/api/payments/coupons/route.ts` |
| Purchase history (`GET /api/payments/history`) | `app/api/payments/history/route.ts` |
| Pro state + Checkout launcher (client) | `app/components/dsc-sgt/PremiumContext.tsx` |
| Pricing modal (client) | `app/components/dsc-sgt/PremiumModal.tsx` |
| Schema (`payment_orders`, `activate_subscription()`) | `supabase/migrations/016_payments_schema.sql` |

The "create-order" endpoint in Razorpay's docs is `/api/payments/orders` here.

Packages: `razorpay` (already in `package.json`). Nothing else is needed;
signature checks use Node's built-in `crypto`.

---

## 2. The four secrets and what each one is

| Name | Who creates it | Where it lives | What it does |
|---|---|---|---|
| `RAZORPAY_KEY_ID` | Razorpay | `.env.local` (server). It is also sent to the browser by `/api/payments/orders` because Checkout needs it. It is not sensitive on its own. | Identifies your Razorpay account. Starts with `rzp_test_` in Test Mode and `rzp_live_` in Live Mode. |
| `RAZORPAY_KEY_SECRET` | Razorpay | `.env.local` only. **Never** `NEXT_PUBLIC_`. | Authenticates server calls to the Razorpay API (create order, fetch payment, capture). Also the HMAC key that verifies the **Checkout** signature in `/api/payments/verify`. |
| `RAZORPAY_WEBHOOK_SECRET` | **You** — type any long random string into the "Secret" field when you add a webhook in the dashboard. | `.env.local` only. **Never** `NEXT_PUBLIC_`. | The HMAC key Razorpay uses to sign every **webhook** it sends to that URL. Each webhook you create has its own secret. |
| `X-Razorpay-Signature` | Razorpay, per request | HTTP header on every webhook call | `HMAC_SHA256(raw_request_body, RAZORPAY_WEBHOOK_SECRET)` as hex. If our recomputed value matches, the request really came from Razorpay and was not altered. |

Two different signatures exist and use two different keys:

- **Checkout signature** (browser → `/api/payments/verify`):
  `HMAC_SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)`
- **Webhook signature** (Razorpay → `/api/payments/webhook`):
  `HMAC_SHA256(raw_body, RAZORPAY_WEBHOOK_SECRET)`

Generate a webhook secret on Windows (PowerShell):

```powershell
-join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
```

### `.env.local`

```env
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=the-string-you-typed-into-the-dashboard
```

Get the first two from **Dashboard → Account & Settings → Websites & API keys →
Generate Test Key** (make sure the "Test Mode" toggle at the bottom left is ON).
The key secret is shown once; download it.

Restart `next dev` after editing `.env.local` — env vars are read at startup.

---

## 3. Why the raw body matters

Razorpay signs the exact bytes it sends. If the route called `request.json()`
and then re-serialised, key order or whitespace could change and the HMAC would
never match. The webhook route therefore does:

```ts
const rawBody = await request.text()                         // exact bytes
const signature = request.headers.get('x-razorpay-signature') ?? ''
if (!signature || !verifyWebhookSignature(rawBody, signature)) {
  return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })
}
const body = JSON.parse(rawBody)                             // parse only after verifying
```

and `verifyWebhookSignature` is a constant-time compare of
`createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex')`.

App Router route handlers do not pre-parse bodies, so nothing has to be disabled.

---

## 4. Which payment status to trust

Never unlock anything because the browser said "success". A user can call
`/api/payments/verify` with made-up ids, or a slow network can drop the callback.

Order of trust, highest first:

1. **Webhook `payment.captured` / `order.paid`**, signature verified. Sent by
   Razorpay's servers, retried on failure, arrives even if the user closed the tab.
2. **`/api/payments/verify`**, which checks the Checkout signature **and then
   re-fetches the payment from Razorpay's API** to confirm `status === "captured"`
   and that the amount and currency equal what we stored for that order.
3. The Checkout `handler` callback in the browser — only a hint to call (2).

Both (1) and (2) end in the same SQL function `activate_subscription()`, which
locks the order row, refuses to run twice for the same order, and extends the
subscription in one transaction. That is the duplicate-webhook protection.

---

## 5. zrok on Windows

Razorpay refuses `localhost` as a webhook URL, and it could not reach your
machine anyway. zrok gives `localhost:3000` a public HTTPS address.

```
Razorpay  →  https://<name>.share.zrok.io/api/payments/webhook
          →  zrok tunnel
          →  http://localhost:3000/api/payments/webhook   (Next.js route handler)
```

Only the webhook goes through the tunnel. You keep using `http://localhost:3000`
in your browser for the site itself.

### 5.1 Install

1. Open https://github.com/openziti/zrok/releases/latest and download
   `zrok_<version>_windows_amd64.zip`.
2. Extract and put it on your PATH (PowerShell, adjust the version):

```powershell
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\zrok" | Out-Null
Expand-Archive "$env:USERPROFILE\Downloads\zrok_*_windows_amd64.zip" -DestinationPath "$env:LOCALAPPDATA\zrok" -Force
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";$env:LOCALAPPDATA\zrok", "User")
```

3. Open a **new** terminal and check:

```powershell
zrok version
```

### 5.2 Create an account and enable this machine (one time)

```powershell
zrok invite
```

Enter your email, click the link in the email, set a password, and copy the
**account token** shown on https://api.zrok.io (or https://myzrok.io). Then:

```powershell
zrok enable <your-account-token>
```

### 5.3 Reserve a stable name (so the URL survives restarts)

A plain `zrok share public` gets a random name every time, which would force you
to edit the Razorpay webhook after every restart. Reserve one instead:

```powershell
zrok reserve public localhost:3000 --unique-name rsdeducationdev
```

Output ends with the address, e.g. `https://rsdeducationdev.share.zrok.io`.
Pick your own name: lowercase letters and digits only.

### 5.4 Start the tunnel (every session)

Keep this terminal open for as long as you are testing:

```powershell
zrok share reserved rsdeducationdev --headless
```

`--headless` prints the public URL and request log to the console instead of
opening the full-screen TUI. Press `Ctrl+C` to stop; the reserved name stays
yours. To give it up later: `zrok release rsdeducationdev`.

Note: on zrok's free tier, browser visits to a public share show an interstitial
page first. Razorpay's webhook client is not a browser, so it is not affected.
If a webhook log in the dashboard ever shows an HTML response body instead of
`{"received":true}`, that interstitial is being served; use a paid zrok plan,
or swap the tunnel for `cloudflared tunnel --url http://localhost:3000`
(free, same idea).

---

## 6. Razorpay dashboard webhook

**Dashboard → Account & Settings → Webhooks → + Add New Webhook** (Test Mode ON).

| Field | Value |
|---|---|
| Webhook URL | `https://rsdeducationdev.share.zrok.io/api/payments/webhook` |
| Secret | the string you put in `RAZORPAY_WEBHOOK_SECRET` |
| Alert Email | your email |
| Active Events | `payment.captured`, `payment.failed`, `order.paid` — **only these three** |

Save. Add this as a **second** webhook; leave the existing one pointing at
`https://rsdeducation.vercel.app` for the deployed app.

Two things to fix on that existing production webhook:

- It currently has 29 events enabled. Edit it and untick everything except the
  three above. Extra events just create traffic and log noise.
- Its URL must include the path: `https://rsdeducation.vercel.app/api/payments/webhook`.
  If it is only the bare domain, Razorpay is posting to your home page.
- Its secret must equal `RAZORPAY_WEBHOOK_SECRET` in the **Vercel** project
  environment. The local and production webhooks can use different secrets;
  each environment only needs to match its own webhook.

---

## 7. Test end to end

**Step 1 — database.** Run `supabase/migrations/016_payments_schema.sql` in the
Supabase SQL editor (once).

**Step 2 — env.** Fill the three variables in `.env.local` (section 2).

**Step 3 — Next.js.** Terminal A:

```powershell
npm run dev
```

**Step 4 — tunnel.** Terminal B:

```powershell
zrok share reserved rsdeducationdev --headless
```

**Step 5 — dashboard.** Confirm the webhook URL from section 6 uses the exact
zrok address printed in Terminal B, with `/api/payments/webhook` appended.

**Step 6 — create an order.** Sign in at `http://localhost:3000`, open
`/dsc-sgt`, click **Get PRO**, pick a plan, click **Unlock Pro**. Behind the
scenes the browser POSTs `{ planId }` to `/api/payments/orders`, the server
creates a Razorpay order for the server-side price, stores a `payment_orders`
row with status `CREATED`, and Razorpay Checkout opens.

**Step 7 — pay.** In Test Mode use a test instrument:

- Card `4111 1111 1111 1111`, any future expiry, any CVV, OTP `1234` (or the
  "Success" button on the test bank page).
- Or UPI id `success@razorpay` (and `failure@razorpay` to test a failure).

**Step 8 — checkout verification.** Checkout calls the `handler`, which POSTs
the three ids to `/api/payments/verify`. Watch Terminal A: no error means the
signature matched, Razorpay reported `captured`, and `activate_subscription()`
ran. The modal closes and the header shows **PRO ACTIVE**.

**Step 9 — webhook.** Within a few seconds Terminal B logs a `POST
/api/payments/webhook`, and Terminal A shows nothing alarming. In the dashboard,
**Webhooks → your zrok webhook → view logs** shows `payment.captured` and
`order.paid` with HTTP 200 and body `{"received":true}`.

**Step 10 — database.** In Supabase:

```sql
select razorpay_order_id, status, confirmed_via, paid_at
from payment_orders order by created_at desc limit 5;

select email, account_type, subscription_status, subscription_plan, subscription_expires_at
from users where email = 'you@example.com';

select event_type, created_at from security_events
where event_type like 'PAYMENT_%' or event_type = 'SUBSCRIPTION_ACTIVATED'
order by created_at desc limit 10;
```

Expected: the order is `PAID`, `confirmed_via` is `checkout` (or `webhook` if
the webhook won the race), and the user is `PREMIUM / ACTIVE` with an expiry
`durationDays` in the future. `SUBSCRIPTION_ACTIVATED` appears **once** even
though two paths ran — that is the idempotency working.

**Step 11 — webhook-only path.** Repeat step 6, and when Checkout says success,
close the browser tab immediately so `/api/payments/verify` never runs. The
webhook alone must flip the order to `PAID` with `confirmed_via = 'webhook'`.
Reload the site: Pro is active.

**Step 12 — failure path.** Pay with `failure@razorpay`. The order becomes
`FAILED` with a `failure_reason`, and the user stays `FREE`.

To replay a delivery without paying again: dashboard webhook logs have a
**Resend** button. The replay must return 200 and must not extend the expiry.

---

## 8. Problems and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Dashboard rejects `http://localhost:3000/...` | Razorpay only accepts public HTTPS URLs | Use the zrok URL (section 5) |
| Webhook stopped working after a restart | Used `zrok share public` (random name) | Use a **reserved** share; the name is permanent |
| Webhook log shows `400 {"error":"INVALID_SIGNATURE"}` | Secret in `.env.local` ≠ secret typed into that webhook, or you edited `.env.local` without restarting `next dev`, or you hit the prod webhook's URL with the local secret | Make the secrets identical for that webhook; restart dev server |
| Signature mismatch even though secrets match | Body was modified before hashing | Route must use `await request.text()` first; do not add middleware that rewrites bodies |
| `503 WEBHOOK_NOT_CONFIGURED` | `RAZORPAY_WEBHOOK_SECRET` missing | Add it and restart |
| `503 PAYMENTS_UNAVAILABLE` from `/api/payments/orders` | `RAZORPAY_KEY_ID` / `KEY_SECRET` missing | Add them and restart |
| `502 GATEWAY_ERROR` creating an order | Wrong key/secret pair, or Test key while dashboard is in Live Mode (or vice-versa) | Both must be from the same mode; Test Mode toggle ON for `rzp_test_` keys |
| Checkout opens then errors "key id invalid" | Same test/live mismatch on the key sent to Checkout | Same fix |
| Same event delivered twice | Razorpay retries on any non-2xx or timeout | Expected; `activate_subscription()` is a no-op the second time. Return 200 fast |
| Webhook times out | Handler took > few seconds (Razorpay's limit is short) | Keep the handler lean; it already does only a DB lookup and one RPC. Do not call slow third parties inside it |
| Dashboard shows HTML in the response body | zrok free-tier interstitial | See the note at the end of section 5.4 |
| CORS errors | Not applicable to webhooks (server-to-server, no `Origin`). If the browser shows CORS errors on `/api/payments/*`, `NEXT_PUBLIC_APP_URL` does not match the origin you are browsing from | Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` locally |
| Env vars `undefined` | File named `.env` instead of `.env.local`, or dev server not restarted, or the variable was read in a client component | Use `.env.local`, restart, keep secrets server-side only |
| `ORDER_NOT_FOUND` from verify | The order was created with a different key (other mode/account) or belongs to another user | Recreate the order in the current mode with the logged-in user |
| Pro not showing after a successful webhook | The browser still has the old user object | `/api/auth/me` is refetched on reload; the verify path updates it immediately |
| Payment shows `authorized`, not `captured` | Auto-capture disabled in the dashboard | `/api/payments/verify` captures explicitly; or enable auto-capture under **Settings → Payment capture** |

---

## 9. Going live later

1. Complete KYC ("Activate your account" banner).
2. Generate **Live** keys and set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in
   Vercel's environment (they start with `rzp_live_`).
3. Switch the dashboard to Live Mode and create the production webhook again
   there — Test and Live webhooks are separate. Use a fresh secret and put it in
   Vercel as `RAZORPAY_WEBHOOK_SECRET`.
4. Nothing in the code changes.
