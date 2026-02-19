-- Feature 8.5: Expiration / PAO (Period After Opening) Tracking
-- Allows users to track when they opened products and get expiry alerts

CREATE TABLE IF NOT EXISTS ss_user_product_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES ss_products(id) ON DELETE SET NULL,
  custom_product_name TEXT,
  opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  pao_months INTEGER,
  purchase_date DATE,
  manufacture_date DATE,
  batch_code TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'finished', 'discarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add PAO data columns to products table
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS pao_months INTEGER;
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS shelf_life_months INTEGER;

-- Enable RLS
ALTER TABLE ss_user_product_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own product tracking"
  ON ss_user_product_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product tracking"
  ON ss_user_product_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own product tracking"
  ON ss_user_product_tracking FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own product tracking"
  ON ss_user_product_tracking FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ss_upt_user_id ON ss_user_product_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_ss_upt_user_expiry ON ss_user_product_tracking(user_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_ss_upt_status ON ss_user_product_tracking(status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION ss_update_product_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ss_product_tracking_updated_at ON ss_user_product_tracking;
CREATE TRIGGER ss_product_tracking_updated_at
  BEFORE UPDATE ON ss_user_product_tracking
  FOR EACH ROW EXECUTE FUNCTION ss_update_product_tracking_timestamp();

-- Seed default PAO values for existing products by category
UPDATE ss_products SET pao_months = 6 WHERE category IN ('serum', 'ampoule', 'sunscreen', 'mask', 'mist') AND pao_months IS NULL;
UPDATE ss_products SET pao_months = 12 WHERE category IN ('cleanser', 'toner', 'moisturizer', 'essence', 'oil') AND pao_months IS NULL;
UPDATE ss_products SET pao_months = 12 WHERE category IN ('eye_care', 'lip_care') AND pao_months IS NULL;
UPDATE ss_products SET pao_months = 9 WHERE category IN ('exfoliator', 'spot_treatment') AND pao_months IS NULL;
UPDATE ss_products SET shelf_life_months = 36 WHERE shelf_life_months IS NULL;
