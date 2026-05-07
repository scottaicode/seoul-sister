-- ============================================================
-- Migration: add_haruharu_fragrance_free_toner
-- Date: 2026-05-07
--
-- Adds the missing fragrance-free variant of Haruharu Wonder's bestselling
-- Black Rice Hyaluronic Toner. The original (with essential oils) was seeded
-- Feb 19 in 20260219000007_seed_classic_genz_brands.sql but the FF variant
-- was never added.
--
-- Triggered by: May 6 2026 Reddit response draft for r/KoreanBeauty post
-- "K-beauty products for dry skin" (post 1t5vbuz). OP listed the Haruharu
-- Black Rice toner; AriaStar correctly suggested grabbing the fragrance-free
-- version instead since OP self-described as sensitive. The FF variant wasn't
-- in the catalog so the recommendation read as a brand-existence claim
-- without a backing product row to ground future references against.
--
-- Idempotent — checks for existing row before insert.
-- INCI ingestion handled separately via:
--   npx tsx scripts/enrich-stub-products.ts --product-id <new_uuid>
-- ============================================================

INSERT INTO ss_products (
  name_en, name_ko, brand_en, brand_ko, category, subcategory,
  description_en, volume_ml, volume_display,
  price_krw, price_usd, rating_avg, review_count,
  is_verified, pao_months, shelf_life_months
)
SELECT
  'Black Rice Hyaluronic Toner Plus (Fragrance-Free)', '흑미 히알루로닉 토너 플러스',
  'Haruharu Wonder', '하루하루원더', 'toner', NULL,
  'The fragrance-free reformulation of the bestselling Black Rice Hyaluronic Toner. Same fermented Black Rice extract and hyaluronic acid hydration without essential oils — gentler choice for sensitive or reactive skin types. EWG Green Grade.',
  150, '150ml', 18000, 14.00, 4.6, 3400, true, 12, 36
WHERE NOT EXISTS (
  SELECT 1 FROM ss_products
  WHERE brand_en = 'Haruharu Wonder'
    AND name_en = 'Black Rice Hyaluronic Toner Plus (Fragrance-Free)'
);
