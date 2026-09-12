-- ============================================================
-- DSC Platform — Migration 020: Close public RLS exposure
-- ============================================================
-- CRITICAL SECURITY FIX.
--
-- THE BUG
--   Migrations 001, 016 and 017 created policies named "...for service role"
--   but never restricted them to the service_role:
--
--     CREATE POLICY "Allow full access for service role on users"
--       ON users FOR ALL USING (true) WITH CHECK (true);
--
--   A policy with no TO clause applies to EVERY role, including `anon`.
--   The anon/publishable key is shipped to every browser
--   (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), so anyone could call PostgREST
--   directly and read AND WRITE:
--
--     users            - every email, name, google_id, role, subscription
--     sessions         - refresh_token_hash, session_version, expiry
--     devices          - device fingerprints and ip hashes
--     security_events  - the audit trail
--     payment_orders   - order amounts and razorpay order ids
--
--   Verified against the live database before writing this:
--     - role escalation IS blocked by the protect_users_role trigger (good)
--     - but account_type / subscription_status / subscription_expires_at are
--       NOT covered by that trigger, so anyone could grant themselves PREMIUM
--     - anon also holds DELETE and TRUNCATE on every table
--
--   Separately, migrations 004 and 006-015 made every question table
--   world-readable INCLUDING `correct_answer`, and 018 made
--   mock_test_questions world-readable. Together those let anyone
--   reconstruct the full answer key of any paid mock module.
--
-- WHY DROPPING THESE IS SAFE
--   `service_role` BYPASSES row level security entirely — these policies were
--   never required for the backend to work. The application talks to Supabase
--   only server-side through `supabaseAdmin` (service role); nothing imports
--   the browser client in lib/client.ts. With RLS enabled and no permissive
--   policy, anon and authenticated get nothing, and the server is unaffected.
--
-- AFTER THIS MIGRATION
--   Verify with the anon key that every table below returns 0 rows.
-- ============================================================


-- ============================================================
-- 1. Auth tables — remove blanket public access
-- ============================================================

DROP POLICY IF EXISTS "Allow full access for service role on users"           ON users;
DROP POLICY IF EXISTS "Allow full access for service role on devices"         ON devices;
DROP POLICY IF EXISTS "Allow full access for service role on sessions"        ON sessions;
DROP POLICY IF EXISTS "Allow full access for service role on security_events" ON security_events;

-- RLS stays ON. No policy = deny for anon/authenticated; service_role bypasses.
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Defence in depth: even if a policy is added by mistake later, the anon and
-- authenticated roles should not hold table privileges on auth tables.
REVOKE ALL ON users           FROM anon, authenticated;
REVOKE ALL ON devices         FROM anon, authenticated;
REVOKE ALL ON sessions        FROM anon, authenticated;
REVOKE ALL ON security_events FROM anon, authenticated;


-- ============================================================
-- 2. Payment tables — remove blanket public access
-- ============================================================

DROP POLICY IF EXISTS "Allow full access for service role on payment_orders" ON payment_orders;
DROP POLICY IF EXISTS "service_role_full_access_on_plan_overrides"           ON plan_overrides;

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_overrides ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON payment_orders FROM anon, authenticated;
REVOKE ALL ON plan_overrides FROM anon, authenticated;


-- ============================================================
-- 3. Question bank — stop publishing the answer key
-- ============================================================
-- These tables hold `correct_answer` and `explanation`, which are the paid
-- product. They are served only through the app's own API, which strips
-- answers for in-progress exams. Direct anon reads have no legitimate use.

DO $$
DECLARE
  t TEXT;
  pol RECORD;
  question_tables TEXT[] := ARRAY[
    'english_subject_questions',
    'telugu_subject_questions',
    'pedagogy_subject_questions',
    'pedagogy_english_medium',
    'telugu_medium_math',
    'math_english_medium',
    'telugu_medium_science',
    'english_medium_science',
    'socal_telugu_medimum',
    'socal_english_medium',
    'gk_english_medium',
    'gk_telugu_medium',
    'dsc_practice_questions'
  ];
BEGIN
  FOREACH t IN ARRAY question_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = t) THEN

      -- Drop every existing policy on the table, whatever it was named.
      FOR pol IN
        SELECT policyname FROM pg_policies
         WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- 4. Mock test tables — remove public read
-- ============================================================
-- mock_test_questions maps a module to (question_table, question_id).
-- Combined with a readable question table that is a complete answer key,
-- so it must not be world-readable either.

DROP POLICY IF EXISTS "Public can read mock test questions" ON mock_test_questions;
DROP POLICY IF EXISTS "Public can read published mock tests" ON mock_tests;

ALTER TABLE mock_tests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_test_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_test_answers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_usage      ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON mock_tests          FROM anon, authenticated;
REVOKE ALL ON mock_test_questions FROM anon, authenticated;
REVOKE ALL ON mock_test_attempts  FROM anon, authenticated;
REVOKE ALL ON mock_test_answers   FROM anon, authenticated;
REVOKE ALL ON question_usage      FROM anon, authenticated;


-- ============================================================
-- 5. Practice progress tables — remove public access
-- ============================================================
-- 005 allowed `user_id IS NULL` rows to be read and written by anyone.

DROP POLICY IF EXISTS "Users can manage their practice sessions" ON practice_sessions;
DROP POLICY IF EXISTS "Users can manage their attempts"          ON question_attempts;
DROP POLICY IF EXISTS "Users can view and update their progress" ON question_progress;

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_progress ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON practice_sessions FROM anon, authenticated;
REVOKE ALL ON question_attempts FROM anon, authenticated;
REVOKE ALL ON question_progress FROM anon, authenticated;


-- ============================================================
-- 6. Tables added in 019
-- ============================================================

DROP POLICY IF EXISTS "Admins read question usage"             ON mock_question_usage;
DROP POLICY IF EXISTS "Users manage their own module progress" ON user_mock_test_progress;
DROP POLICY IF EXISTS "Admins read all module progress"        ON user_mock_test_progress;
DROP POLICY IF EXISTS "Admins read generation reports"         ON mock_generation_reports;

REVOKE ALL ON mock_question_usage       FROM anon, authenticated;
REVOKE ALL ON user_mock_test_progress   FROM anon, authenticated;
REVOKE ALL ON mock_generation_reports   FROM anon, authenticated;


-- ============================================================
-- 7. Blanket revoke: anon/authenticated hold DELETE/INSERT/UPDATE/TRUNCATE
--    on EVERY table in public (Supabase's default bootstrap grants).
-- ============================================================
-- Verified before writing this: information_schema.role_table_grants showed
-- anon with DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on
-- all 25 public tables. The per-table REVOKEs above are kept for clarity;
-- this catches everything, including tables not listed here such as
-- `2025_previous_year_questions`.

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;


-- ============================================================
-- 8. Lock down PostgREST-exposed functions
-- ============================================================
-- Every function in `public` is reachable at /rest/v1/rpc/<name>, and
-- PostgreSQL grants EXECUTE to PUBLIC by default.
--
-- `activate_subscription` is the privileged core of the payment flow: it
-- flips an order to PAID and extends the user's subscription. It performs NO
-- payment verification of its own — that is done by the API route before it
-- is called. Confirmed reachable by anon against the live database: calling
-- it with a bogus order id executed the body and raised P0002 'Order not
-- found' rather than a permission error. With a real order id (obtainable by
-- creating an unpaid order) an attacker could grant themselves PREMIUM for
-- an arbitrary p_duration_days.

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Trigger functions are invoked by the table owner during DML, not over the
-- API, so revoking EXECUTE from anon does not affect them.

-- IMPORTANT: both RPCs the application calls are owned by `postgres`, and
-- service_role only held EXECUTE through the PUBLIC grant revoked above.
-- Without these explicit grants, Google login (upsert_device) and payment
-- activation (activate_subscription) would break.
GRANT EXECUTE ON FUNCTION activate_subscription(TEXT, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION upsert_device(UUID, TEXT, platform_type, TEXT, TEXT) TO service_role;

-- Bound the duration even for a legitimate caller, so a bug in the API layer
-- cannot mint a 100-year subscription.
CREATE OR REPLACE FUNCTION assert_subscription_duration(p_days INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 400 THEN
    RAISE EXCEPTION 'Invalid subscription duration: %', p_days USING ERRCODE = '22023';
  END IF;
  RETURN p_days;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

REVOKE ALL ON FUNCTION assert_subscription_duration(INTEGER) FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 9. Stop future objects from being granted to anon by default
-- ============================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;


-- ============================================================
-- 10. Post-migration verification
-- ============================================================
-- Expect ZERO rows from both queries after this migration:
--
--   SELECT table_name, grantee, privilege_type
--     FROM information_schema.role_table_grants
--    WHERE table_schema='public' AND grantee IN ('anon','authenticated');
--
--   SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
--    WHERE n.nspname='public' AND has_function_privilege('anon', p.oid, 'EXECUTE');
--
-- And with the anon key, every one of these must return 0 rows / 401:
--   GET /rest/v1/users, /rest/v1/sessions, /rest/v1/payment_orders,
--       /rest/v1/plan_overrides, /rest/v1/english_subject_questions
