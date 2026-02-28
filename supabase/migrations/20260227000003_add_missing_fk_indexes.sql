-- Fix 6: Add missing indexes on foreign key columns
--
-- Foreign key columns without indexes cause sequential scans on cascading
-- deletes and joins. These 3 columns reference ss_products(id) but lack indexes.
-- Note: Using regular CREATE INDEX (not CONCURRENTLY) because Supabase SQL Editor
-- wraps statements in an implicit transaction. These are small tables so the
-- brief lock is negligible.

CREATE INDEX IF NOT EXISTS idx_batch_code_verifications_product_id
  ON ss_batch_code_verifications (product_id);

CREATE INDEX IF NOT EXISTS idx_product_staging_processed_product_id
  ON ss_product_staging (processed_product_id);

CREATE INDEX IF NOT EXISTS idx_user_product_tracking_product_id
  ON ss_user_product_tracking (product_id);
