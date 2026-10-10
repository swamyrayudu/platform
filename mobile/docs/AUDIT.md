# Repository audit and implementation plan

The existing root is `platform/`, Next.js 16.3.1 App Router, React 19, TypeScript,
Tailwind 4/shadcn web UI. `mobile/` has its own install and Expo Router navigation.
No web component or backend module is imported into the native runtime.

## Backend and data

`app/api/` uses Next.js handlers. `lib/supabase-admin.ts` is the server-only
Supabase service-role client. SQL migrations 001–023 define users, sessions,
devices, security_events, medium-specific question tables, practice_sessions,
question_attempts, question_progress, mock_tests, mock_test_questions,
mock_test_attempts, mock_test_answers, user_mock_test_progress, payment_orders,
plan_overrides and question_feedback/reports. Migrations 020–022 tighten RLS,
payment activation and refresh reuse containment. The mobile app only calls HTTP.

`lib/auth/session.ts` accepts Bearer before cookies, verifies JWT signature,
expiry, DB session status/version and user ownership. Google login revokes the
previous active session (one active device per user). Refresh tokens rotate;
concurrent refreshes must be serialized. `/auth/me` returns a PublicUser directly.
The reference native Google snippet is outdated: `/auth/google` now requires a
Google token containing the nonce issued with the HttpOnly `/auth/nonce` cookie.
The added `/mobile-auth` browser adapter runs these unchanged endpoints in one
browser cookie context and encrypts the JSON token handoff to an ephemeral app
key. Google verification and session creation remain entirely in existing routes.

Practice selection is in `lib/practice/engine.ts` and per-subject providers;
SQL narrowing/hydration is in question-loader.ts. Modes: balanced, random,
weak_areas, previously_incorrect, new_questions. Free quotas and Pro topic access
are server enforced. Questions/keys are masked until instant feedback or results.
Practice uses bare question_id within its subject; mocks MUST use question_uid.
The original practice answer cache was not durable, and results GET called submit
again. Minimal persistence/idempotency fixes are required for mobile retries.

Mocks are fixed medium-specific module series, generated server-side using
blueprints, eligibility, usage and validation modules. Series progression and
premium gates apply on start. Questions arrive in paginated chunks, keys stay
private. Answers upsert by attempt/question; submit scores server-side, then
updates progress/rank. Pause persists monotonic elapsed time; there is no server
wall clock. Results expose historical verdicts and edited-since-attempt notices.

Overview/performance derive bounded actual practice and mock history. Weak topics
come from question_progress. No notification API or functional AI tutor exists.
Other exam cards are marked coming soon. Admin pages use requireAdmin; question
bank/import/generation/payment reconciliation are intentionally web-only.

Razorpay orders use server plan overrides/coupons. Verify validates ownership,
signature, amount, currency, capture and atomic idempotent subscription RPC.
Recovery asks Razorpay for trusted status; webhook handles interrupted checkout.
Upstash caches client-safe mocks and private answer keys separately, with TTL,
memory fallback and single-flight hydration. Rate limits use Upstash or memory;
all these remain server-only.

## Screen to API map

| Native screen | Existing endpoints (prefix `/api`) |
|---|---|
| Google login | GET auth/nonce; POST auth/google; auth/refresh; auth/me |
| Onboarding | POST auth/onboarding |
| Dashboard/syllabus | GET dsc-sgt/overview |
| Practice setup | GET practice/filters, quota, weak-topics under dsc-sgt |
| Practice exam | POST practice/sessions; GET sessions/:id; POST :id/answer, submit, abandon |
| Practice review/history | GET practice/history, sessions/:id/results; POST retry-incorrect |
| Mock catalog/instructions | GET mock-tests?medium,category,search,page,pageSize; GET :id |
| Mock exam | POST :id/start; GET :id/questions?start,limit; GET attempts/:id; POST answer,pause,submit,abandon |
| Mock review/leaderboard | GET attempts/:id/result; :testId/leaderboard; :testId/next |
| Performance | GET dsc-sgt/performance, practice/weak-topics |
| Profile/preferences/devices | PATCH auth/profile; GET auth/devices; DELETE auth/devices/:id; POST logout,logout-all |
| Subscriptions/coupons/payments | GET payments/plans,history; POST coupons,orders,verify,recover |
| Question reports | POST dsc-sgt/questions/feedback |
| Legal | Existing website terms/privacy in system browser |

## Phases

1. Audit above and actual request/response types, not guessed contracts.
2. Isolated Expo SDK 56 install (requires Node 22.13+; validated with bundled Node 24.19), Router,
   React Query caching, shared white/gold native components.
3. Secure auth, browser bridge, protected onboarding/tabs, centralized HTTP client.
4. All student screens, durable encrypted exam journal, serialized saves,
   server-state reconciliation before retrying submission, server result review.
5. Native Razorpay Android direct build; store builds consume entitlements with
   checkout disabled pending approved store-billing integration.
6. Type/lint/unit/Metro checks, original website checks, unauthenticated API
   smoke checks. Device/login/payment tests require user accounts and devices.
7. Setup/build/testing and limitations documentation.

## Configuration discovered

Local NEXT_PUBLIC_APP_URL is localhost. Production is documented as
https://rsdeducation.vercel.app in docs/PAYMENTS_LOCAL_TESTING.md; use that in
mobile/.env.example. Server env includes GOOGLE_CLIENT_ID, JWT_SECRET,
IP_HASH_SECRET, Supabase service role, Upstash credentials and Razorpay keys.
None belong in mobile. Browser GIS uses the existing public web Google client
ID. No Android/iOS Google secret or new OAuth provider is needed for the bridge.
