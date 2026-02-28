-- Yuri Fix Plan Migrations
-- Apply via Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Created: 2026-02-28

-- =============================================================================
-- Fix 2: texture_weight column on ss_products
-- =============================================================================
-- Texture thickness: 1=water-thin, 3=essence/light serum, 5=medium serum,
-- 7=cream-serum, 10=heavy cream. Used for layering tiebreakers within same category.
ALTER TABLE ss_products ADD COLUMN IF NOT EXISTS texture_weight INTEGER
  CHECK (texture_weight BETWEEN 1 AND 10);

COMMENT ON COLUMN ss_products.texture_weight IS
  'Texture thickness: 1=water-thin, 3=essence/light serum, 5=medium serum, 7=cream-serum, 10=heavy cream. Used for layering tiebreakers within same category.';

-- =============================================================================
-- Fix 5: ss_user_products table — personal product inventory
-- =============================================================================
-- Tracks products users own/use, including products NOT in the ss_products database.
-- Enables verify_routine product completeness checks and user corrections.
CREATE TABLE IF NOT EXISTS ss_user_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  product_id UUID REFERENCES ss_products(id),  -- NULL if not in DB
  custom_name TEXT,                              -- User's name for the product
  custom_brand TEXT,                             -- Brand if not in DB
  category TEXT,                                 -- cleanser, serum, etc.
  texture_weight INTEGER CHECK (texture_weight BETWEEN 1 AND 10),
  notes TEXT,                                    -- User notes (e.g. "thinner than PDRN")
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished', 'destashed')),
  learned_from TEXT DEFAULT 'conversation',      -- How Yuri learned about this product
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ss_user_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own products" ON ss_user_products
  FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own products" ON ss_user_products
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own products" ON ss_user_products
  FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own products" ON ss_user_products
  FOR DELETE USING ((select auth.uid()) = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_products_user ON ss_user_products(user_id);
CREATE INDEX IF NOT EXISTS idx_user_products_product ON ss_user_products(product_id) WHERE product_id IS NOT NULL;

-- Updated_at trigger
CREATE TRIGGER set_updated_at_ss_user_products
  BEFORE UPDATE ON ss_user_products
  FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
