-- Phase 10.3b: Remove non-skincare products from ss_trending_products.
-- Run this ONCE in Supabase SQL Editor to clean up existing data.
-- After this, the daily cron will automatically filter non-skincare products.
--
-- Products removed: supplements, hair care, beauty devices, EMS massagers.
-- K-beauty cosmetics (lip tints, cushions, cheek balms) are kept.

DELETE FROM ss_trending_products
WHERE source = 'olive_young'
AND product_id IS NULL
AND (
  -- Non-skincare brands (supplements, hair tools, devices)
  LOWER(source_product_brand) IN (
    'foodology', 'flimeal', 'lacto-fit', 'lactofit',
    'bb lab', 'vodana', 'hugrab'
  )
  -- Supplements & ingestibles
  OR source_product_name ~* '\bjelly\b.*\bstick'
  OR source_product_name ~* '\bprotein\s+shake'
  OR source_product_name ~* '\bprobiotics?\b'
  OR source_product_name ~* '\bday[\s-]*supply\b'
  OR source_product_name ~* '\bcollagen\b.*\bstick'
  OR source_product_name ~* '\binner\s+dot\b'
  -- Hair care & styling tools
  OR source_product_name ~* '\bhair\s+(styler|dryer|curler|iron|straightener|roller|clip)\b'
  OR source_product_name ~* '\bshampoo\b'
  OR source_product_name ~* '\bhair\s+(treatment|oil|ampoule|tonic|serum|essence)\b'
  OR source_product_name ~* '\bscalp\b'
  OR source_product_name ~* '\broot\s+enhancer'
  OR source_product_name ~* '\bdamage\s+(repair|treatment)\b'
  -- Beauty devices / tools
  OR source_product_name ~* '\bems\b'
  OR source_product_name ~* '\bmassager\b'
  OR source_product_name ~* '\bbooster\s+pro\b'
  OR source_product_name ~* '\bleg[\s-]*scene\b'
  OR source_product_name ~* '\bnmode\s+pro\b'
  OR source_product_name ~* '\bleeds\s+line\b'
  OR source_product_name ~* '\bhigh\s+focus\s+shot\b'
  OR source_product_name ~* '\bage-r\b.*\b(pro|plus)\b'
);
