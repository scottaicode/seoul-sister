-- v10.8.19 (Bailey feedback, May 27 2026): add tinted as a sunscreen attribute.
-- Bailey: "Can we add tinted as an option for sunscreen". Tinted sunscreens are
-- a meaningful K-beauty distinction (tone-up creams, tinted balm sunscreens, etc.)
-- and worth its own filter rather than burying it in description text.
--
-- NULL means "not yet classified" — backfill will populate ~672 sunscreen rows.
-- Non-sunscreen products stay NULL (irrelevant for them).

ALTER TABLE ss_products
  ADD COLUMN IF NOT EXISTS is_tinted BOOLEAN;

COMMENT ON COLUMN ss_products.is_tinted IS
  'Whether this sunscreen has a tint (tinted sunscreens, tone-up creams, BB-style coverage). Only meaningful for category=sunscreen. NULL = unclassified.';

-- Partial index for the common filter query (sunscreens WHERE is_tinted = X).
-- Small index (only ~672 sunscreen rows), no cost on writes.
CREATE INDEX IF NOT EXISTS idx_ss_products_sunscreen_tinted
  ON ss_products (is_tinted)
  WHERE category = 'sunscreen' AND is_tinted IS NOT NULL;
