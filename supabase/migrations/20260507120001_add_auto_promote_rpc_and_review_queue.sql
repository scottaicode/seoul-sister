-- ============================================================
-- Migration: add_auto_promote_rpc_and_review_queue
-- Date: 2026-05-07
-- Version: v10.3.9
--
-- Two related additions:
--
-- 1. RPC `auto_promote_verified_products` — fast SQL path for the daily
--    auto-promote routine added to the link-ingredients cron. Promotes
--    products to is_verified=true when they meet the hardened criteria
--    (name+brand+category present, category != not_skincare, ingredients_raw
--    populated, has price record, ≥8 ingredient links). Idempotent.
--
-- 2. Table `ss_enrichment_review_queue` — persistent record of products
--    that the stub-enrichment script could not enrich (low confidence, wrong
--    product page, weak Incidecoder coverage, etc.). Replaces the ephemeral
--    /tmp log file. A monthly retry cron will pick up entries older than
--    30 days and re-attempt — Incidecoder coverage grows over time.
--
-- Both are safe to apply against the production database.
-- ============================================================

-- =================================================================
-- Part 1: auto_promote_verified_products RPC
-- =================================================================

CREATE OR REPLACE FUNCTION auto_promote_verified_products()
RETURNS TABLE(promoted INTEGER, checked INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promoted_count INTEGER;
  checked_count INTEGER;
BEGIN
  -- Count candidates first (for observability)
  SELECT COUNT(*) INTO checked_count
  FROM ss_products p
  WHERE p.name_en IS NOT NULL
    AND p.brand_en IS NOT NULL
    AND p.category IS NOT NULL
    AND p.category != 'not_skincare'
    AND p.ingredients_raw IS NOT NULL
    AND (p.is_verified = false OR p.is_verified IS NULL);

  -- Promote eligible products
  WITH eligible AS (
    SELECT p.id
    FROM ss_products p
    WHERE p.name_en IS NOT NULL
      AND p.brand_en IS NOT NULL
      AND p.category IS NOT NULL
      AND p.category != 'not_skincare'
      AND p.ingredients_raw IS NOT NULL
      AND (p.is_verified = false OR p.is_verified IS NULL)
      AND EXISTS (
        SELECT 1 FROM ss_product_prices pp WHERE pp.product_id = p.id
      )
      AND (
        SELECT COUNT(*) FROM ss_product_ingredients pi WHERE pi.product_id = p.id
      ) >= 8
  )
  UPDATE ss_products
  SET is_verified = true,
      updated_at = NOW()
  FROM eligible
  WHERE ss_products.id = eligible.id;

  GET DIAGNOSTICS promoted_count = ROW_COUNT;

  RETURN QUERY SELECT promoted_count, checked_count;
END;
$$;

-- Grant execute to service role (cron jobs use service role)
GRANT EXECUTE ON FUNCTION auto_promote_verified_products() TO service_role;

-- =================================================================
-- Part 2: ss_enrichment_review_queue table
-- =================================================================

CREATE TABLE IF NOT EXISTS ss_enrichment_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_url TEXT,
  confidence DECIMAL(3, 2),
  reasoning TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  retry_after TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'resolved', 'permanent_skip')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cron lookup: find pending entries due for retry
CREATE INDEX IF NOT EXISTS idx_review_queue_pending_due
  ON ss_enrichment_review_queue(retry_after, status)
  WHERE status = 'pending';

-- Index for product lookup (reverse direction)
CREATE INDEX IF NOT EXISTS idx_review_queue_product
  ON ss_enrichment_review_queue(product_id);

-- Updated_at trigger (using existing helper if present, else inline)
CREATE OR REPLACE FUNCTION ss_review_queue_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_review_queue_updated_at ON ss_enrichment_review_queue;
CREATE TRIGGER set_review_queue_updated_at
  BEFORE UPDATE ON ss_enrichment_review_queue
  FOR EACH ROW
  EXECUTE FUNCTION ss_review_queue_set_updated_at();

-- RLS: service role only (this is internal pipeline data, no user access)
ALTER TABLE ss_enrichment_review_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to review queue"
  ON ss_enrichment_review_queue
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- Admin read access
CREATE POLICY "Admins can read review queue"
  ON ss_enrichment_review_queue
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles
    WHERE user_id = (select auth.uid()) AND is_admin = true
  ));
