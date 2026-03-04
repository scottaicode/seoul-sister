-- Add unique constraint on ss_trending_products for UPSERT support.
-- The UPSERT pattern (onConflict: 'source,product_id') requires a unique
-- index on these columns. Without it, duplicate rows accumulate on every
-- cron run instead of updating in place.
--
-- Partial unique index: only applies when product_id IS NOT NULL.
-- Unmatched products (product_id IS NULL) are keyed by source_product_name
-- and don't need this constraint — they use a separate upsert path.

CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_products_source_product
  ON ss_trending_products(source, product_id)
  WHERE product_id IS NOT NULL;
