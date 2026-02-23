-- Phase 10.3b: Remove non-skincare products from ss_trending_products.
-- Run this ONCE in Supabase SQL Editor to clean up existing data.
-- After this, the daily cron will automatically filter non-skincare products.
--
-- Products removed: supplements, hair care, beauty devices, EMS massagers.
-- K-beauty cosmetics (lip tints, cushions, cheek balms) are kept.
--
-- NOTE: PostgreSQL uses \m (word start) and \M (word end) instead of \b.
-- The first version of this script used \b which silently failed to match.

DELETE FROM ss_trending_products
WHERE source = 'olive_young'
AND product_id IS NULL
AND (
  -- Non-skincare brands (supplements, hair tools, devices)
  LOWER(source_product_brand) IN (
    'foodology', 'flimeal', 'lacto-fit', 'lactofit',
    'bb lab', 'vodana', 'hugrab', 'beaund', 'labo-h'
  )
  -- Supplements & ingestibles
  OR source_product_name ~* '\mjelly\M.*\mstick'
  OR source_product_name ~* '\mprotein\s+shake'
  OR source_product_name ~* '\mprobiotics?\M'
  OR source_product_name ~* '\mday[\s-]*supply\M'
  OR source_product_name ~* '\mcollagen\M.*\mstick'
  OR source_product_name ~* '\minner\s+dot\M'
  -- Hair care & styling tools
  OR source_product_name ~* '\mhair\s+(styler|dryer|curler|iron|straightener|roller|clip)\M'
  OR source_product_name ~* '\mshampoo\M'
  OR source_product_name ~* '\mhair\s+(treatment|oil|ampoule|tonic|serum|essence)\M'
  OR source_product_name ~* '\mscalp\M'
  OR source_product_name ~* '\mroot\s+enhancer'
  OR source_product_name ~* '\mdamage\s+(repair|treatment)\M'
  -- Beauty devices / tools
  OR source_product_name ~* '\mems\M'
  OR source_product_name ~* '\mmassager\M'
  OR source_product_name ~* '\mbooster\s+pro\M'
  OR source_product_name ~* 'leg[\s-]*scene'
  OR source_product_name ~* 'nmode\s+pro'
  OR source_product_name ~* 'leeds\s+line'
  OR source_product_name ~* '\mhigh\s+focus\s+shot\M'
  OR source_product_name ~* 'age-r\M.*\m(pro|plus)\M'
);
