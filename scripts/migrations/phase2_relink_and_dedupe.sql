-- Phase 2 (July 29 2026) — relink stale custom entries, fix corrupted data.
--
-- MEASURED FIRST, THEN WRITTEN. Every unlinked row was probed against the CURRENT
-- resolver before this file was written. The result corrected two assumptions:
--
--   * Only 2 of 25 unlinked rows relink today, not "most of the Korean ones".
--   * Brand-CASING is NOT a resolver bug. Search uses ilike, so `brand_en ILIKE
--     'anua'` already returns all 242 rows regardless of casing, and a probe
--     confirmed "AESTURA Atobarrier 365 Cream" (4-product minority casing)
--     resolves cleanly to "Aestura" (103 products). Casing is a DISPLAY
--     inconsistency across 108 products / 52 brands, not a matching failure.
--
-- Applied here: only what was verified. See PHASE-2-RESULTS.md for the full
-- decomposition and the residual measurement.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Relink the two entries that resolve cleanly today
-- ---------------------------------------------------------------------------
-- Both predate 2026-07-21 (the v11.10.0 resolver fix), which is why they were
-- saved as custom entries at the time and would NOT be saved that way now.
-- Guarded on the exact stored name AND on the target product still existing,
-- so re-running is a no-op and a renamed catalog row cannot mislink.
--
-- Per the wrong-product discipline (v10.7.0 / v10.8.13): EXACT verified pairs
-- only, never a fuzzy sweep. Each pair below was confirmed by running the live
-- resolver and inspecting both sides by hand.

-- "Round Lab Dokdo Cleanser"  ->  Round Lab | 1025 Dokdo Cleanser
UPDATE ss_user_products
SET product_id = 'd6d9d67c-e5ae-4fe6-b08f-1e4cf397867f',
    updated_at = now()
WHERE id = 'a0f960c2-0e5e-4784-b161-d62a767b247f'
  AND product_id IS NULL
  AND custom_name = 'Round Lab Dokdo Cleanser'
  AND EXISTS (SELECT 1 FROM ss_products p
              WHERE p.id = 'd6d9d67c-e5ae-4fe6-b08f-1e4cf397867f'
                AND p.name_en = '1025 Dokdo Cleanser');

-- "Anua Heartleaf 77% Soothing Toner"  ->  Anua | Heartleaf 77% Soothing Toner
UPDATE ss_user_products
SET product_id = '2dac8c46-8a67-4b6c-9e46-6c5bc1f0c4cc',
    updated_at = now()
WHERE id = '30a5d0ac-248b-4be4-bd7b-fe64d7c11067'
  AND product_id IS NULL
  AND custom_name = 'Anua Heartleaf 77% Soothing Toner'
  AND EXISTS (SELECT 1 FROM ss_products p
              WHERE p.id = '2dac8c46-8a67-4b6c-9e46-6c5bc1f0c4cc'
                AND p.name_en = 'Heartleaf 77% Soothing Toner');

-- ---------------------------------------------------------------------------
-- 2. Fix the corrupted brand attribution
-- ---------------------------------------------------------------------------
-- One row carries custom_brand "I'm From" on a product whose name is an Anua
-- product ("Anua Heartleaf 70% Rice Ceramide"). Yuri reads custom_brand as fact,
-- so this tells her the user owns an I'm From product they do not own. Correct
-- the brand; the product itself is genuinely absent from the catalog, so it
-- stays a custom entry.

UPDATE ss_user_products
SET custom_brand = 'Anua',
    updated_at = now()
WHERE id = 'c86b77e8-43ab-40db-a552-3062b1d4a4ba'
  AND custom_brand = 'I''m From'
  AND custom_name ILIKE 'Anua%';

-- ---------------------------------------------------------------------------
-- 3. Normalize brand casing (display consistency, NOT a matching fix)
-- ---------------------------------------------------------------------------
-- 108 products across 52 brands sit under a minority-cased spelling of a brand
-- that also exists in a majority casing (Aestura 103 vs AESTURA 4, Mediheal 137
-- vs MEDIHEAL 2, Skinfood 95 vs SKINFOOD 4, Round Lab 96 vs ROUND LAB 6...).
--
-- This does NOT change what resolves — ilike already ignores case. It matters
-- because brand_en is rendered to users and to Yuri, and because a brand facet
-- built on the raw column would list the same brand twice.
--
-- Rule: adopt the casing used by the most products in each group. Ties are left
-- alone rather than guessed at.

WITH ranked AS (
  SELECT brand_en,
         lower(brand_en) AS k,
         count(*) AS n,
         row_number() OVER (
           PARTITION BY lower(brand_en)
           ORDER BY count(*) DESC, brand_en
         ) AS rk
  FROM ss_products
  WHERE brand_en IS NOT NULL
  GROUP BY brand_en
),
canonical AS (
  SELECT k, brand_en AS winner, n AS winner_n FROM ranked WHERE rk = 1
),
has_tie AS (
  -- Never rewrite a group whose top two casings are equally common.
  SELECT r.k FROM ranked r JOIN canonical c ON c.k = r.k
  WHERE r.rk = 2 AND r.n = c.winner_n
)
UPDATE ss_products p
SET brand_en = c.winner,
    updated_at = now()
FROM canonical c
WHERE lower(p.brand_en) = c.k
  AND p.brand_en <> c.winner
  AND c.k NOT IN (SELECT k FROM has_tie);

COMMIT;

-- Verification:
--   -- Expect 0 rows: no brand should remain in two casings (except ties).
--   SELECT lower(brand_en), count(DISTINCT brand_en)
--   FROM ss_products WHERE brand_en IS NOT NULL
--   GROUP BY lower(brand_en) HAVING count(DISTINCT brand_en) > 1;
--
--   -- Expect the two relinked rows to show product_id populated.
--   SELECT custom_name, product_id FROM ss_user_products
--   WHERE id IN ('a0f960c2-0e5e-4784-b161-d62a767b247f',
--                '30a5d0ac-248b-4be4-bd7b-fe64d7c11067');
--
--   -- Expect 'Anua', not "I'm From".
--   SELECT custom_brand, custom_name FROM ss_user_products
--   WHERE id = 'c86b77e8-43ab-40db-a552-3062b1d4a4ba';
