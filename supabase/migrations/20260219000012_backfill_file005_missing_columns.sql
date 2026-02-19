-- ============================================================================
-- Backfill missing columns for 30 products from migration file 005
-- File 005 omitted: subcategory, rating_avg, review_count, shelf_life_months
-- Run AFTER files 005-011 in Supabase SQL Editor
-- ============================================================================

-- HEIMISH (6 products)
UPDATE ss_products SET subcategory = 'calming toner', rating_avg = 4.6, review_count = 5400, shelf_life_months = 36
WHERE name_en = 'Matcha Biome Redness Relief Hydrating Toner' AND brand_en = 'Heimish';

UPDATE ss_products SET subcategory = 'gel moisturizer', rating_avg = 4.5, review_count = 4800, shelf_life_months = 36
WHERE name_en = 'Matcha Biome Oil-Free Calming Gel Moisturizer' AND brand_en = 'Heimish';

UPDATE ss_products SET subcategory = 'barrier cream', rating_avg = 4.6, review_count = 3600, shelf_life_months = 36
WHERE name_en = 'Matcha Biome Intensive Repair Cream' AND brand_en = 'Heimish';

UPDATE ss_products SET subcategory = 'nourishing cream', rating_avg = 4.5, review_count = 2800, shelf_life_months = 36
WHERE name_en = 'Marine Care Deep Moisture Nourishing Melting Cream' AND brand_en = 'Heimish';

UPDATE ss_products SET subcategory = 'exfoliating essence', rating_avg = 4.4, review_count = 3200, shelf_life_months = 24
WHERE name_en = 'All Clean Low pH AHA/PHA Hydro Vegan Essence' AND brand_en = 'Heimish';

UPDATE ss_products SET subcategory = 'wash-off mask', rating_avg = 4.5, review_count = 4100, shelf_life_months = 36
WHERE name_en = 'Black Tea Mask Pack' AND brand_en = 'Heimish';

-- THE FACE SHOP (6 products)
UPDATE ss_products SET subcategory = 'soothing gel', rating_avg = 4.5, review_count = 12400, shelf_life_months = 36
WHERE name_en = 'Jeju Aloe 95% Fresh Soothing Gel' AND brand_en = 'The Face Shop';

UPDATE ss_products SET subcategory = 'foam cleanser', rating_avg = 4.4, review_count = 5600, shelf_life_months = 36
WHERE name_en = 'Jeju Aloe Fresh Soothing Foam Cleanser' AND brand_en = 'The Face Shop';

UPDATE ss_products SET subcategory = 'foam cleanser', rating_avg = 4.3, review_count = 7800, shelf_life_months = 36
WHERE name_en = 'Herb Day 365 Master Blending Cleansing Foam' AND brand_en = 'The Face Shop';

UPDATE ss_products SET subcategory = 'anti-aging serum', rating_avg = 4.5, review_count = 2400, shelf_life_months = 24
WHERE name_en = 'The Therapy Royal Made Oil Blending Serum' AND brand_en = 'The Face Shop';

UPDATE ss_products SET subcategory = 'anti-aging cream', rating_avg = 4.6, review_count = 3200, shelf_life_months = 36
WHERE name_en = 'Yehwadam Hwansaenggo Ultimate Rejuvenating Cream' AND brand_en = 'The Face Shop';

UPDATE ss_products SET subcategory = NULL, rating_avg = 4.4, review_count = 8200, shelf_life_months = 24
WHERE name_en = 'Natural Sun Eco Mild Watery Sun Cream SPF45 PA+++' AND brand_en = 'The Face Shop';

-- GOODAL (6 products)
UPDATE ss_products SET subcategory = 'brightening toner', rating_avg = 4.6, review_count = 8800, shelf_life_months = 36
WHERE name_en = 'Green Tangerine Vita C Dark Spot Toner' AND brand_en = 'Goodal';

UPDATE ss_products SET subcategory = 'calming serum', rating_avg = 4.5, review_count = 4600, shelf_life_months = 24
WHERE name_en = 'Heartleaf Calming Moisture Serum' AND brand_en = 'Goodal';

UPDATE ss_products SET subcategory = 'toner pad', rating_avg = 4.5, review_count = 5200, shelf_life_months = 24
WHERE name_en = 'Heartleaf Calming Moisture Toner Pad' AND brand_en = 'Goodal';

UPDATE ss_products SET subcategory = NULL, rating_avg = 4.5, review_count = 6400, shelf_life_months = 24
WHERE name_en = 'Heartleaf Calming Tone Up Sun Cream SPF50+ PA++++' AND brand_en = 'Goodal';

UPDATE ss_products SET subcategory = 'exfoliating ampoule', rating_avg = 4.4, review_count = 3200, shelf_life_months = 24
WHERE name_en = 'Apple AHA Clearing Ampoule' AND brand_en = 'Goodal';

UPDATE ss_products SET subcategory = 'brightening serum', rating_avg = 4.4, review_count = 3800, shelf_life_months = 24
WHERE name_en = 'Lemon Vita C Clear Serum' AND brand_en = 'Goodal';

-- MEDICUBE (6 products)
UPDATE ss_products SET subcategory = 'collagen serum', rating_avg = 4.6, review_count = 9200, shelf_life_months = 24
WHERE name_en = 'Triple Collagen Serum 4.0' AND brand_en = 'Medicube';

UPDATE ss_products SET subcategory = 'collagen toner', rating_avg = 4.5, review_count = 5400, shelf_life_months = 36
WHERE name_en = 'Triple Collagen Toner 4.0' AND brand_en = 'Medicube';

UPDATE ss_products SET subcategory = 'capsule cream', rating_avg = 4.5, review_count = 6800, shelf_life_months = 36
WHERE name_en = 'PDRN Pink Collagen Capsule Cream' AND brand_en = 'Medicube';

UPDATE ss_products SET subcategory = 'toner pad', rating_avg = 4.4, review_count = 5600, shelf_life_months = 24
WHERE name_en = 'PDRN Pink Collagen Gel Toner Pad' AND brand_en = 'Medicube';

UPDATE ss_products SET subcategory = 'anti-aging cream', rating_avg = 4.5, review_count = 4200, shelf_life_months = 36
WHERE name_en = 'Triple Collagen Cream' AND brand_en = 'Medicube';

UPDATE ss_products SET subcategory = 'PDRN ampoule', rating_avg = 4.5, review_count = 7200, shelf_life_months = 24
WHERE name_en = 'Exosome Shot PDRN Pink Collagen 2000 Serum' AND brand_en = 'Medicube';

-- ISNTREE (6 products)
UPDATE ss_products SET subcategory = 'chemical exfoliant', rating_avg = 4.5, review_count = 6200, shelf_life_months = 24
WHERE name_en = 'Chestnut AHA 8% Clear Essence' AND brand_en = 'Isntree';

UPDATE ss_products SET subcategory = 'anti-aging ampoule', rating_avg = 4.6, review_count = 4800, shelf_life_months = 24
WHERE name_en = 'TW-Real Bifida Collagen Ampoule' AND brand_en = 'Isntree';

UPDATE ss_products SET subcategory = 'soothing gel', rating_avg = 4.5, review_count = 5400, shelf_life_months = 36
WHERE name_en = 'Aloe Soothing Gel Fresh Type' AND brand_en = 'Isntree';

UPDATE ss_products SET subcategory = 'milk cleanser', rating_avg = 4.5, review_count = 3600, shelf_life_months = 36
WHERE name_en = 'Yam Root Vegan Milk Cleanser' AND brand_en = 'Isntree';

UPDATE ss_products SET subcategory = 'milky toner', rating_avg = 4.5, review_count = 3200, shelf_life_months = 36
WHERE name_en = 'Yam Root Vegan Milk Toner' AND brand_en = 'Isntree';

UPDATE ss_products SET subcategory = 'hydrating serum', rating_avg = 4.7, review_count = 7800, shelf_life_months = 24
WHERE name_en = 'Ultra-Low Molecular Hyaluronic Acid Serum' AND brand_en = 'Isntree';


-- ============================================================================
-- Verify backfill: all 30 products should now have non-NULL rating_avg
-- ============================================================================
SELECT name_en, brand_en, subcategory, rating_avg, review_count, shelf_life_months
FROM ss_products
WHERE brand_en IN ('Heimish', 'The Face Shop', 'Goodal', 'Medicube', 'Isntree')
ORDER BY brand_en, name_en;
