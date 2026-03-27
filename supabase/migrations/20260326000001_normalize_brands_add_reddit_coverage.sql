-- ============================================================
-- Brand normalization + data quality fixes
-- Identified from Reddit r/koreanskincare thread analysis (Mar 26, 2026)
-- ============================================================

-- 1. "CNP Laboratory" (12 products) → "CNP" (46 existing)
UPDATE ss_products SET brand_en = 'CNP' WHERE brand_en = 'CNP Laboratory';

-- 2. "VT Cosmetics" (7 products) → "VT" (84 existing)
UPDATE ss_products SET brand_en = 'VT' WHERE brand_en = 'VT Cosmetics';

-- 3. "MEDIPEEL" (2 products) → "Medi-Peel" (28 existing)
UPDATE ss_products SET brand_en = 'Medi-Peel' WHERE brand_en = 'MEDIPEEL';

-- 4. "numbuzin" lowercase (1 product) → "Numbuzin" (59 existing)
UPDATE ss_products SET brand_en = 'Numbuzin' WHERE brand_en = 'numbuzin';
