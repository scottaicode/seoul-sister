-- ============================================================
-- Fix Bailey's ss_user_products inventory mappings
-- User ID: 551569d3-aed0-4feb-a340-47bfb146a835
--
-- Origin: The May 3 Phase 1 routine save (broken pre-v10.3.2)
-- wrote bad product_id mappings to ss_user_products. Devices and
-- actions ("Ice roller", "Cool water rinse", "LED mask",
-- "Shower/cleanse") got assigned to whatever DB product
-- resolveProductByName fuzzy-matched. Real owned products got
-- mapped to wrong DB IDs (e.g. Acwell Licorice → I'm From Rice
-- Toner, Anua Heartleaf → Medicube Exosome Shot).
--
-- Symptom on the routine page: ownership join surfaces device
-- custom_names on the wrong DB-backed steps. Step 9 (Beauty of
-- Joseon sunscreen) shows heading "Ice roller or cold spoon"
-- because the ownership map has Beauty of Joseon's UUID mapped
-- to "Ice roller or cold spoon" custom_name.
--
-- This script:
-- 1. NULLs product_id on devices/actions (they aren't products)
-- 2. Fixes wrong product_id mappings on real owned products
-- 3. Verification SELECT at the bottom
--
-- Run in Supabase Studio SQL Editor.
-- ============================================================

BEGIN;

-- 1. Devices and actions: NULL out product_id (they're not products).
-- These rows still exist as inventory items but don't pollute ownership joins.
UPDATE ss_user_products
SET product_id = NULL,
    updated_at = NOW()
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND custom_name IN (
    'Cool water rinse',
    'Ice roller or cold spoon',
    'LED mask — Blue (Mon/Wed/Fri) or Red (Tue/Thu/Sat/Sun)',
    'Shower / cleanse',
    'Pimple patches'  -- Pimple patches: keep as inventory but the right product_id pointer is the COSRX Acne Pimple Master Patch which is set below
  );

-- Re-set Pimple patches correctly (it was right before but we just NULLed it)
UPDATE ss_user_products
SET product_id = '2c7c736f-0429-4971-a85e-f00519eb01f1',  -- COSRX Acne Pimple Master Patch
    updated_at = NOW()
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND custom_name = 'Pimple patches';

-- 2. Real owned products: fix wrong product_id mappings.
-- Acwell Licorice Toner: was pointing at I'm From Rice Toner
UPDATE ss_user_products
SET product_id = '3beba1aa-b03c-4d4e-a37d-2abb1cc8050a',  -- Acwell Licorice pH Balancing Cleansing Toner
    updated_at = NOW()
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND custom_name = 'Acwell Licorice pH Balancing Toner';

-- Medicube PDRN Pink Peptide Serum: was pointing at Medicube Exosome Shot
UPDATE ss_user_products
SET product_id = 'f2452824-63df-4885-93de-b4752dfa7a1f',  -- Medicube PDRN Pink Peptide Serum (actual)
    updated_at = NOW()
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND custom_name = 'Medicube PDRN Pink Peptide Serum';

-- Illiyoon Ceramide Ato Concentration Cream: was pointing at CNP Invisible Peeling Booster
UPDATE ss_user_products
SET product_id = 'aeb68155-76a8-47aa-8255-967475237633',  -- Illiyoon Ceramide Ato Concentrate Cream (closest DB match)
    updated_at = NOW()
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND custom_name = 'Illiyoon Ceramide Ato Concentration Cream';

-- Anua Heartleaf 70% Rice Ceramide Serum: no exact DB match — NULL it (custom)
UPDATE ss_user_products
SET product_id = NULL,
    updated_at = NOW()
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND custom_name = 'Anua Heartleaf 70% Rice Ceramide Serum';

-- Medicube PDRN Pink Peptide Eye Cream: no exact DB match — NULL it (custom)
UPDATE ss_user_products
SET product_id = NULL,
    updated_at = NOW()
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND custom_name = 'Medicube PDRN Pink Peptide Eye Cream';

-- COSRX BHA Blackhead Power Liquid: already correct (added May 4 via v10.3.3 path).
-- Verify it's still pointing at the right product_id, no-op if it is.
UPDATE ss_user_products
SET product_id = 'dd11bde0-86b5-40e6-9782-0540dcc0f914',
    updated_at = NOW()
WHERE user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
  AND custom_name = 'COSRX BHA Blackhead Power Liquid'
  AND product_id != 'dd11bde0-86b5-40e6-9782-0540dcc0f914';

COMMIT;

-- ============================================================
-- VERIFICATION (run separately to confirm)
-- ============================================================
-- SELECT
--   custom_name,
--   custom_brand,
--   category,
--   product_id,
--   p.name_en AS db_product_name,
--   p.brand_en AS db_brand_name
-- FROM ss_user_products up
-- LEFT JOIN ss_products p ON p.id = up.product_id
-- WHERE up.user_id = '551569d3-aed0-4feb-a340-47bfb146a835'
--   AND up.status = 'active'
-- ORDER BY up.created_at;
