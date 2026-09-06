-- ============================================================
-- DSC Platform — Migration 017: Admin-editable plan price overrides
-- ============================================================
-- Allows admins to change plan prices without a redeployment.
-- The server merges these overrides with the defaults in plans.ts.
-- Run in the Supabase SQL editor or via: supabase db push
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_overrides (
  plan_id               TEXT PRIMARY KEY,
  amount_paise          INTEGER NOT NULL CHECK (amount_paise >= 100),
  original_amount_paise INTEGER NOT NULL CHECK (original_amount_paise >= 100),
  name                  TEXT,
  period                TEXT,
  badge                 TEXT,
  features              JSONB,
  updated_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE plan_overrides IS
  'Admin-managed price/name/feature overrides for subscription plans. '
  'Merged at runtime with the code defaults in lib/payments/plans.ts. '
  'amount_paise is the effective selling price; original_amount_paise is the struck-through price.';

-- Only one row per plan_id (PRIMARY KEY), updated_at auto-bumped via trigger
CREATE OR REPLACE FUNCTION set_updated_at_plan_overrides()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plan_overrides_updated_at
  BEFORE UPDATE ON plan_overrides
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_plan_overrides();

-- Only the service role can read/write this table
ALTER TABLE plan_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_on_plan_overrides"
  ON plan_overrides FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON COLUMN plan_overrides.plan_id               IS 'Must match a PlanId from lib/payments/plans.ts (pro_sprint | pro_full | lifetime)';
COMMENT ON COLUMN plan_overrides.amount_paise          IS 'Effective price in paise (₹1 = 100 paise). Must be >= 100 (Razorpay minimum).';
COMMENT ON COLUMN plan_overrides.original_amount_paise IS 'Crossed-out "original" price shown in the UI for discount display.';
COMMENT ON COLUMN plan_overrides.features              IS 'JSON array of feature strings. If NULL the default from plans.ts is used.';
COMMENT ON COLUMN plan_overrides.updated_by            IS 'user.id of the admin who last changed this row.';
