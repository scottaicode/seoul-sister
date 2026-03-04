-- Add unique constraint for unmatched trending products (product_id IS NULL).
-- These are Olive Young/Reddit products not yet in our ss_products database.
-- Without this constraint, each cron run inserts duplicate rows instead of
-- updating existing ones via UPSERT.
--
-- Partial unique index: only applies when product_id IS NULL AND
-- source_product_name IS NOT NULL.

CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_products_source_name
  ON ss_trending_products(source, source_product_name)
  WHERE product_id IS NULL AND source_product_name IS NOT NULL;
