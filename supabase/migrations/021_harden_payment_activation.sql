-- ============================================================
-- DSC Platform — Migration 021: Harden payment activation
-- ============================================================
-- Migration 020 closed the six critical exposures by revoking anon/authenticated
-- access. That is the right fix, but it leaves payment integrity resting on a
-- SINGLE layer: re-introduce one permissive policy or grant and every one of
-- them comes back.
--
-- This migration adds the defence in depth underneath, so the attacks stay
-- impossible even if the grant layer is weakened again:
--
--   1. p_duration_days is clamped. It is a caller-supplied parameter, so a bug
--      in the API layer (or a future caller) could otherwise mint a 100-year
--      subscription. Longest legitimate plan is 365 days (lib/payments/plans.ts).
--
--   2. A payment_activations ledger with UNIQUE(razorpay_payment_id) makes
--      replay structurally impossible. Previously the ONLY thing stopping a
--      genuine payment being redeemed repeatedly was payment_orders.status,
--      a single mutable column: reset it to CREATED and the same real,
--      correctly-signed payment could be re-verified for another 30 days,
--      forever. A unique index cannot be reset by an UPDATE.
--
-- Both are enforced inside the function, which is the last line before the
-- subscription is written — so they hold regardless of which caller invokes it.
-- ============================================================


-- ============================================================
-- 1. Activation ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_activations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_id TEXT NOT NULL,
  razorpay_order_id   TEXT NOT NULL,
  user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  duration_days       INTEGER NOT NULL,
  activated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One activation per Razorpay payment, ever. This is the replay guard.
  CONSTRAINT uq_payment_activation UNIQUE (razorpay_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_activations_order
  ON payment_activations (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_activations_user
  ON payment_activations (user_id, activated_at DESC);

ALTER TABLE payment_activations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_activations FROM anon, authenticated;

-- Backfill from orders already marked PAID so an existing payment cannot be
-- replayed through the new path either.
INSERT INTO payment_activations (razorpay_payment_id, razorpay_order_id, user_id, duration_days, activated_at)
SELECT o.razorpay_payment_id, o.razorpay_order_id, o.user_id, 0, COALESCE(o.paid_at, now())
  FROM payment_orders o
 WHERE o.status = 'PAID'
   AND o.razorpay_payment_id IS NOT NULL
   AND o.razorpay_payment_id <> ''
ON CONFLICT (razorpay_payment_id) DO NOTHING;


-- ============================================================
-- 2. activate_subscription — clamp duration + ledger-based replay guard
-- ============================================================
-- Signature is unchanged so lib/payments/db.ts keeps working as-is.

CREATE OR REPLACE FUNCTION activate_subscription(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_duration_days       INTEGER,
  p_confirmed_via       TEXT
)
RETURNS TABLE (activated BOOLEAN, user_id UUID, expires_at TIMESTAMPTZ) AS $$
DECLARE
  v_order       payment_orders%ROWTYPE;
  v_current_exp TIMESTAMPTZ;
  v_base        TIMESTAMPTZ;
  v_new_exp     TIMESTAMPTZ;
BEGIN
  -- (1) Bound the caller-supplied duration. The longest real plan is 365 days.
  IF p_duration_days IS NULL OR p_duration_days < 1 OR p_duration_days > 400 THEN
    RAISE EXCEPTION 'Invalid subscription duration: % (expected 1..400)', p_duration_days
      USING ERRCODE = '22023';
  END IF;

  -- Lock the order row so concurrent webhook + checkout calls serialize
  SELECT * INTO v_order
  FROM payment_orders
  WHERE razorpay_order_id = p_razorpay_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_razorpay_order_id USING ERRCODE = 'P0002';
  END IF;

  -- Already processed -> idempotent no-op (unchanged behaviour)
  IF v_order.status = 'PAID' THEN
    SELECT u.subscription_expires_at INTO v_current_exp FROM users u WHERE u.id = v_order.user_id;
    RETURN QUERY SELECT false, v_order.user_id, v_current_exp;
    RETURN;
  END IF;

  -- (2) Ledger guard. Independent of payment_orders.status, so resetting that
  -- column no longer re-opens a payment for redemption.
  IF p_razorpay_payment_id IS NOT NULL AND p_razorpay_payment_id <> '' THEN
    BEGIN
      INSERT INTO payment_activations (
        razorpay_payment_id, razorpay_order_id, user_id, duration_days
      ) VALUES (
        p_razorpay_payment_id, p_razorpay_order_id, v_order.user_id, p_duration_days
      );
    EXCEPTION WHEN unique_violation THEN
      -- This payment has already been redeemed. Behave like the idempotent
      -- no-op above rather than granting a second subscription period.
      SELECT u.subscription_expires_at INTO v_current_exp FROM users u WHERE u.id = v_order.user_id;
      RETURN QUERY SELECT false, v_order.user_id, v_current_exp;
      RETURN;
    END;
  END IF;

  UPDATE payment_orders
  SET status = 'PAID',
      razorpay_payment_id = COALESCE(razorpay_payment_id, p_razorpay_payment_id),
      confirmed_via = p_confirmed_via,
      paid_at = now(),
      failure_reason = NULL
  WHERE id = v_order.id;

  SELECT u.subscription_expires_at INTO v_current_exp FROM users u WHERE u.id = v_order.user_id;

  IF v_current_exp IS NOT NULL AND v_current_exp > now() THEN
    v_base := v_current_exp;
  ELSE
    v_base := now();
  END IF;

  v_new_exp := v_base + make_interval(days => p_duration_days);

  UPDATE users
  SET account_type = 'PREMIUM',
      subscription_status = 'ACTIVE',
      subscription_plan = v_order.plan_id,
      subscription_started_at = COALESCE(
        CASE WHEN v_current_exp IS NOT NULL AND v_current_exp > now() THEN subscription_started_at END,
        now()
      ),
      subscription_expires_at = v_new_exp
  WHERE id = v_order.user_id;

  RETURN QUERY SELECT true, v_order.user_id, v_new_exp;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 3. Re-assert who may execute it
-- ============================================================
-- CREATE OR REPLACE preserves the existing ACL, but assert it explicitly so
-- this migration is safe to run on a database where 020 has not been applied.

REVOKE ALL ON FUNCTION activate_subscription(TEXT, TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION activate_subscription(TEXT, TEXT, INTEGER, TEXT) TO service_role;


-- ============================================================
-- 4. Verification
-- ============================================================
--   -- must be 0 rows:
--   SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname='public' AND p.proname='activate_subscription'
--      AND has_function_privilege('anon', p.oid, 'EXECUTE');
--
--   -- must equal the number of PAID orders with a payment id:
--   SELECT count(*) FROM payment_activations;
