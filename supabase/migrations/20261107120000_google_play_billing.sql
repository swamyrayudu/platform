-- ============================================================
-- DSC Platform — Google Play Billing (Android store build)
-- ============================================================
-- Adds Google Play subscriptions NEXT TO the Razorpay system. Nothing
-- Razorpay owns is altered: payment_orders, payment_activations and
-- activate_subscription() are untouched, and Razorpay keeps writing
-- users.subscription_* exactly as before.
--
-- Shared premium rule (lib/auth/types.ts effectiveSubscription):
--   premium = Razorpay/admin access   (users.subscription_* — unchanged)
--          OR Google Play access      (users.play_expires_at > now())
--
-- Play time is tracked separately rather than added onto
-- subscription_expires_at, because Play can take access BACK (refund,
-- revoke, failed renewal). A separate column can be recomputed from
-- play_subscriptions at any time without touching web-purchased time.
--
-- Adds:
--   users.play_account_id / play_expires_at / play_plan
--   play_subscriptions        one row per Play purchase token
--   play_rtdn_events          Real-time developer notification log (dedupe)
--   upsert_play_subscription  atomic write + ownership + entitlement refresh
-- ============================================================


-- ---- users: denormalised Play entitlement -----------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS play_account_id TEXT,
  ADD COLUMN IF NOT EXISTS play_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS play_plan       TEXT;

-- play_account_id is a random opaque id (no PII) sent to Google as
-- obfuscatedAccountId, so a purchase token can be mapped back to the
-- account that bought it, and another account cannot claim it.
CREATE UNIQUE INDEX IF NOT EXISTS users_play_account_id_key
  ON users (play_account_id) WHERE play_account_id IS NOT NULL;

COMMENT ON COLUMN users.play_account_id IS 'Random opaque id sent to Google Play as obfuscatedAccountId. Not PII.';
COMMENT ON COLUMN users.play_expires_at IS 'End of current Google Play entitlement. Maintained ONLY by upsert_play_subscription(). NULL = no Play access.';
COMMENT ON COLUMN users.play_plan       IS 'Plan key of the Play subscription that sets play_expires_at (play_monthly | play_quarterly | play_yearly).';


-- ---- play_subscriptions -----------------------------------------

CREATE TABLE IF NOT EXISTS play_subscriptions (
  purchase_token        TEXT PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id            TEXT NOT NULL,
  base_plan_id          TEXT,
  plan_key              TEXT NOT NULL,
  latest_order_id       TEXT,
  -- Previous token when this purchase replaced one (plan change / resubscribe)
  linked_purchase_token TEXT,
  -- Newer token that replaced this one; a superseded token never entitles
  superseded_by         TEXT,
  -- SubscriptionPurchaseV2.subscriptionState, e.g. SUBSCRIPTION_STATE_ACTIVE
  state                 TEXT NOT NULL,
  acknowledgement_state TEXT,
  auto_renewing         BOOLEAN NOT NULL DEFAULT false,
  started_at            TIMESTAMPTZ,
  expiry_time           TIMESTAMPTZ,
  -- Computed server-side from state + expiry + revocation + supersession
  entitled              BOOLEAN NOT NULL DEFAULT false,
  -- Refund / chargeback / revoke of the CURRENT order. Cleared when a later
  -- paid order (renewal) arrives, so refunding one month never blocks the next.
  revoked_at            TIMESTAMPTZ,
  revocation_reason     TEXT,
  is_test               BOOLEAN NOT NULL DEFAULT false,
  -- 'client' | 'rtdn' | 'reconcile'
  last_verified_via     TEXT NOT NULL,
  -- When Google's API was read for this state; older reads never overwrite newer
  fetched_at            TIMESTAMPTZ NOT NULL,
  raw                   JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS play_subscriptions_user_idx
  ON play_subscriptions (user_id, expiry_time DESC);
CREATE INDEX IF NOT EXISTS play_subscriptions_linked_idx
  ON play_subscriptions (linked_purchase_token) WHERE linked_purchase_token IS NOT NULL;

DROP TRIGGER IF EXISTS play_subscriptions_updated_at ON play_subscriptions;
CREATE TRIGGER play_subscriptions_updated_at
  BEFORE UPDATE ON play_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE play_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON play_subscriptions FROM anon, authenticated;

COMMENT ON TABLE play_subscriptions IS 'One row per Google Play subscription purchase token. Written only via upsert_play_subscription().';


-- ---- play_rtdn_events -------------------------------------------

CREATE TABLE IF NOT EXISTS play_rtdn_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Pub/Sub messageId: Pub/Sub delivers at-least-once, this dedupes
  message_id        TEXT NOT NULL UNIQUE,
  -- 'subscription' | 'voided' | 'test' | 'one_time' | 'unknown'
  kind              TEXT NOT NULL,
  notification_type INTEGER,
  purchase_token    TEXT,
  event_time        TIMESTAMPTZ,
  -- 'received' | 'processed' | 'ignored' | 'unclaimed' | 'failed'
  status            TEXT NOT NULL DEFAULT 'received',
  error             TEXT,
  payload           JSONB,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS play_rtdn_events_token_idx
  ON play_rtdn_events (purchase_token, received_at DESC);

ALTER TABLE play_rtdn_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON play_rtdn_events FROM anon, authenticated;

COMMENT ON TABLE play_rtdn_events IS 'Google Play real-time developer notifications received via Pub/Sub push.';


-- ---- upsert_play_subscription -----------------------------------
-- One transaction:
--   1. Lock the token row. A token already owned by another user is rejected.
--   2. Ignore reads of Google older than the stored one (out-of-order RTDN).
--   3. Write the row. Supersession is sticky; revocation follows the current order.
--   4. Supersede the linked (replaced) token of the same user.
--   5. Recompute users.play_expires_at / play_plan from ALL the user's rows.

CREATE OR REPLACE FUNCTION upsert_play_subscription(
  p_purchase_token        TEXT,
  p_user_id               UUID,
  p_product_id            TEXT,
  p_base_plan_id          TEXT,
  p_plan_key              TEXT,
  p_latest_order_id       TEXT,
  p_linked_purchase_token TEXT,
  p_state                 TEXT,
  p_acknowledgement_state TEXT,
  p_auto_renewing         BOOLEAN,
  p_started_at            TIMESTAMPTZ,
  p_expiry_time           TIMESTAMPTZ,
  p_entitled              BOOLEAN,
  p_revoked               BOOLEAN,
  p_revocation_reason     TEXT,
  p_is_test               BOOLEAN,
  p_verified_via          TEXT,
  p_fetched_at            TIMESTAMPTZ,
  p_raw                   JSONB
)
RETURNS TABLE (user_id UUID, play_expires_at TIMESTAMPTZ, play_plan TEXT, entitled BOOLEAN, stale BOOLEAN) AS $$
#variable_conflict use_column
DECLARE
  v_existing   play_subscriptions%ROWTYPE;
  v_found      BOOLEAN;
  v_revoked_at TIMESTAMPTZ;
  v_entitled   BOOLEAN;
  v_best       play_subscriptions%ROWTYPE;
BEGIN
  IF p_purchase_token IS NULL OR length(p_purchase_token) < 10 OR length(p_purchase_token) > 4096 THEN
    RAISE EXCEPTION 'Invalid purchase token' USING ERRCODE = '22023';
  END IF;

  -- Serialise every writer for this user (verify + RTDN racing each other,
  -- or two tokens of the same user), then the token row itself.
  PERFORM 1 FROM users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_existing FROM play_subscriptions s
   WHERE s.purchase_token = p_purchase_token FOR UPDATE;
  v_found := FOUND;

  -- (1) Ownership: a token belongs to the first account that proved it.
  IF v_found AND v_existing.user_id <> p_user_id THEN
    RAISE EXCEPTION 'PLAY_PURCHASE_OWNED_BY_OTHER_USER' USING ERRCODE = '42501';
  END IF;

  -- (2) Out-of-order guard: an older read of Google never overwrites a newer one.
  IF v_found AND v_existing.fetched_at > p_fetched_at THEN
    SELECT u.play_expires_at, u.play_plan INTO play_expires_at, play_plan FROM users u WHERE u.id = p_user_id;
    RETURN QUERY SELECT p_user_id, play_expires_at, play_plan, v_existing.entitled, true;
    RETURN;
  END IF;

  -- (3) Revocation follows the caller's per-order decision (sync.ts checks the
  --     voided order ids against the order currently paying); supersession is sticky.
  v_revoked_at := CASE WHEN p_revoked THEN COALESCE(v_existing.revoked_at, now()) END;
  v_entitled := COALESCE(p_entitled, false)
                AND v_revoked_at IS NULL
                AND (NOT v_found OR v_existing.superseded_by IS NULL)
                AND p_expiry_time IS NOT NULL
                AND p_expiry_time > now();

  INSERT INTO play_subscriptions AS s (
    purchase_token, user_id, product_id, base_plan_id, plan_key, latest_order_id,
    linked_purchase_token, state, acknowledgement_state, auto_renewing, started_at,
    expiry_time, entitled, revoked_at, revocation_reason, is_test, last_verified_via,
    fetched_at, raw
  ) VALUES (
    p_purchase_token, p_user_id, p_product_id, p_base_plan_id, p_plan_key, p_latest_order_id,
    p_linked_purchase_token, p_state, p_acknowledgement_state, COALESCE(p_auto_renewing, false), p_started_at,
    p_expiry_time, v_entitled, v_revoked_at, CASE WHEN v_revoked_at IS NOT NULL THEN COALESCE(p_revocation_reason, v_existing.revocation_reason) END,
    COALESCE(p_is_test, false), p_verified_via, p_fetched_at, p_raw
  )
  ON CONFLICT (purchase_token) DO UPDATE SET
    product_id            = EXCLUDED.product_id,
    base_plan_id          = EXCLUDED.base_plan_id,
    plan_key              = EXCLUDED.plan_key,
    latest_order_id       = COALESCE(EXCLUDED.latest_order_id, s.latest_order_id),
    linked_purchase_token = COALESCE(EXCLUDED.linked_purchase_token, s.linked_purchase_token),
    state                 = EXCLUDED.state,
    acknowledgement_state = EXCLUDED.acknowledgement_state,
    auto_renewing         = EXCLUDED.auto_renewing,
    started_at            = COALESCE(s.started_at, EXCLUDED.started_at),
    expiry_time           = EXCLUDED.expiry_time,
    entitled              = EXCLUDED.entitled,
    revoked_at            = EXCLUDED.revoked_at,
    revocation_reason     = EXCLUDED.revocation_reason,
    is_test               = EXCLUDED.is_test,
    last_verified_via     = EXCLUDED.last_verified_via,
    fetched_at            = EXCLUDED.fetched_at,
    raw                   = EXCLUDED.raw;

  -- (4) The replaced token stops entitling once its successor is known.
  IF p_linked_purchase_token IS NOT NULL AND p_linked_purchase_token <> p_purchase_token THEN
    UPDATE play_subscriptions s
       SET superseded_by = p_purchase_token, entitled = false
     WHERE s.purchase_token = p_linked_purchase_token
       AND s.user_id = p_user_id;
  END IF;

  -- (5) Recompute the user's Play entitlement from every token they own.
  SELECT * INTO v_best FROM play_subscriptions s
   WHERE s.user_id = p_user_id
     AND s.entitled
     AND s.expiry_time > now()
   ORDER BY s.expiry_time DESC
   LIMIT 1;

  UPDATE users u
     SET play_expires_at = v_best.expiry_time,
         play_plan       = v_best.plan_key
   WHERE u.id = p_user_id;

  RETURN QUERY SELECT p_user_id, v_best.expiry_time, v_best.plan_key, v_entitled, false;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION upsert_play_subscription(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ,
  TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_play_subscription(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ,
  TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT, TIMESTAMPTZ, JSONB
) TO service_role;

COMMENT ON FUNCTION upsert_play_subscription IS
  'Atomically records a verified Google Play subscription state and recomputes users.play_expires_at. Rejects tokens owned by another user.';
