-- =============================================================================
-- Feature 8.6: Reformulation Tracker
-- Tracks product formulation changes and alerts affected users
-- =============================================================================

-- Product formulation history (version tracking)
CREATE TABLE IF NOT EXISTS ss_product_formulation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  change_date DATE,
  change_type TEXT CHECK (change_type IN ('reformulation', 'packaging', 'both', 'minor_tweak')),
  ingredients_added TEXT[] DEFAULT '{}',
  ingredients_removed TEXT[] DEFAULT '{}',
  ingredients_reordered BOOLEAN DEFAULT FALSE,
  change_summary TEXT,
  impact_assessment TEXT,
  detected_by TEXT DEFAULT 'manual' CHECK (detected_by IN ('manual', 'scan_comparison', 'cron_job')),
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User reformulation alerts
CREATE TABLE IF NOT EXISTS ss_user_reformulation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
  formulation_history_id UUID NOT NULL REFERENCES ss_product_formulation_history(id) ON DELETE CASCADE,
  seen BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add version tracking columns to ss_products
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS current_formulation_version INTEGER DEFAULT 1;
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS last_reformulated_at DATE;

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE ss_product_formulation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_user_reformulation_alerts ENABLE ROW LEVEL SECURITY;

-- Anyone can read formulation history (public product info)
CREATE POLICY "Anyone can read formulation history"
  ON ss_product_formulation_history FOR SELECT USING (true);

-- Service role can insert/update formulation history (detection + cron)
CREATE POLICY "Service role manages formulation history"
  ON ss_product_formulation_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role updates formulation history"
  ON ss_product_formulation_history FOR UPDATE
  USING (true);

-- Users can read their own alerts
CREATE POLICY "Users can read own reformulation alerts"
  ON ss_user_reformulation_alerts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (dismiss) their own alerts
CREATE POLICY "Users can update own reformulation alerts"
  ON ss_user_reformulation_alerts FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can create alerts for any user
CREATE POLICY "Service role creates reformulation alerts"
  ON ss_user_reformulation_alerts FOR INSERT
  WITH CHECK (true);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pfh_product_version
  ON ss_product_formulation_history(product_id, version_number);

CREATE INDEX IF NOT EXISTS idx_pfh_change_date
  ON ss_product_formulation_history(change_date DESC);

CREATE INDEX IF NOT EXISTS idx_pfh_detected_by
  ON ss_product_formulation_history(detected_by);

CREATE INDEX IF NOT EXISTS idx_ura_user_seen
  ON ss_user_reformulation_alerts(user_id, seen);

CREATE INDEX IF NOT EXISTS idx_ura_product
  ON ss_user_reformulation_alerts(product_id);

CREATE INDEX IF NOT EXISTS idx_ura_history
  ON ss_user_reformulation_alerts(formulation_history_id);

-- =============================================================================
-- Triggers
-- =============================================================================

CREATE OR REPLACE FUNCTION ss_update_formulation_history_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ss_formulation_history_updated_at ON ss_product_formulation_history;
CREATE TRIGGER ss_formulation_history_updated_at
  BEFORE UPDATE ON ss_product_formulation_history
  FOR EACH ROW EXECUTE FUNCTION ss_update_formulation_history_timestamp();
