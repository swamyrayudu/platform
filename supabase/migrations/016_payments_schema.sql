-- ============================================================
-- DSC Platform — Migration 016: Razorpay payments schema
-- ============================================================
-- Run this in the Supabase SQL editor or via supabase db push
--
-- Adds:
--   - users.subscription_plan      : which plan the user last purchased
--   - payment_orders table         : one row per Razorpay order
--   - activate_subscription() RPC  : atomic + idempotent activation
-- ============================================================

-- ---- Enum -------------------------------------------------------

CREATE TYPE payment_order_status AS ENUM ('CREATED', 'PAID', 'FAILED');

-- ---- users.subscription_plan ------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT;

COMMENT ON COLUMN users.subscription_plan IS 'Plan id of the most recent successful purchase (e.g. pro_sprint, pro_full, lifetime). NULL for free users.';

-- ---- payment_orders ---------------------------------------------

CREATE TABLE IF NOT EXISTS payment_orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id              TEXT NOT NULL,
  -- Amount in the smallest currency unit (paise for INR)
  amount               INTEGER NOT NULL CHECK (amount > 0),
  currency             TEXT NOT NULL DEFAULT 'INR',
  coupon_code          TEXT,
  discount_percent     INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  razorpay_order_id    TEXT UNIQUE NOT NULL,
  razorpay_payment_id  TEXT UNIQUE,
  status               payment_order_status NOT NULL DEFAULT 'CREATED',
  failure_reason       TEXT,
  -- Which path confirmed the payment: 'checkout' (client callback) or 'webhook'
  confirmed_via        TEXT,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_orders_user_id_idx ON payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders(status);

CREATE TRIGGER payment_orders_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access for service role on payment_orders"
  ON payment_orders FOR ALL USING (true) WITH CHECK (true);

-- ---- activate_subscription RPC ----------------------------------
-- Marks the order PAID and extends the user's subscription in ONE
-- transaction. Safe to call twice for the same order (idempotent):
-- the second call is a no-op and returns activated = false.
--
-- Extension rule: if the user already has an unexpired subscription,
-- the new duration is added on top of the current expiry; otherwise
-- it starts from now().

CREATE OR REPLACE FUNCTION activate_subscription(
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_duration_days       INTEGER,
  p_confirmed_via       TEXT
)
RETURNS TABLE (activated BOOLEAN, user_id UUID, expires_at TIMESTAMPTZ) AS $$
DECLARE
  v_order         payment_orders%ROWTYPE;
  v_current_exp   TIMESTAMPTZ;
  v_base          TIMESTAMPTZ;
  v_new_exp       TIMESTAMPTZ;
BEGIN
  -- Lock the order row so concurrent webhook + checkout calls serialize
  SELECT * INTO v_order
  FROM payment_orders
  WHERE razorpay_order_id = p_razorpay_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_razorpay_order_id USING ERRCODE = 'P0002';
  END IF;

  -- Already processed → idempotent no-op
  IF v_order.status = 'PAID' THEN
    SELECT u.subscription_expires_at INTO v_current_exp FROM users u WHERE u.id = v_order.user_id;
    RETURN QUERY SELECT false, v_order.user_id, v_current_exp;
    RETURN;
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

-- ---- Comments ---------------------------------------------------

COMMENT ON TABLE payment_orders IS 'One row per Razorpay order. Amount is stored in paise. Signature/secret material is never stored.';
COMMENT ON FUNCTION activate_subscription IS 'Atomically marks an order PAID and extends the user subscription. Idempotent per order.';
