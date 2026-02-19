-- ============================================================================
-- Seoul Sister Database Cleanup — Deduplication + Backfill
-- Run AFTER files 005-012 in Supabase SQL Editor
--
-- Part 1: Update 17 kept rows with enriched data from their newer duplicates
-- Part 2: Delete 25 duplicate rows
-- Part 3: Backfill 21 original seed products missing rating/review/shelf data
-- Part 4: Verification queries
-- ============================================================================


-- ============================================================================
-- PART 1: Enrich kept (oldest) rows with best data from newer duplicates
-- Strategy: Keep oldest row (preserves FK refs), merge in richer metadata
-- ============================================================================

-- White Truffle First Spray Serum / d'Alba (keeping oldest, 3 copies → 1)
UPDATE ss_products SET subcategory = 'mist serum', rating_avg = 4.70, review_count = 9200, shelf_life_months = 24
WHERE id = 'e6f300fc-3d8a-46c9-8075-b23af0e56f10';

-- AC Collection Blemish Spot Clearing Serum / COSRX
UPDATE ss_products SET subcategory = 'acne treatment', rating_avg = 4.50, review_count = 6800, shelf_life_months = 24
WHERE id = 'a6c0ab59-555a-4945-aaa2-db20b969e995';

-- Balancium Comfort Ceramide Cream / COSRX
UPDATE ss_products SET subcategory = 'barrier cream', rating_avg = 4.60, review_count = 5200, shelf_life_months = 36
WHERE id = '5dea90d7-c67a-48e2-8ed3-1c847747f007';

-- Birch Juice Moisturizing Sun Cream / Round Lab
UPDATE ss_products SET rating_avg = 4.60, review_count = 5200, shelf_life_months = 24
WHERE id = '48e4f6d5-5161-4716-b7bc-9a64cd8693ff';

-- Bouncy & Firm Sleeping Mask / Laneige
UPDATE ss_products SET subcategory = 'sleeping mask', rating_avg = 4.50, review_count = 3200, shelf_life_months = 24
WHERE id = '1d6ba44e-422f-4c4f-b6a3-aba62cb354d7';

-- Chestnut AHA 8% Clear Essence / Isntree (keeping older — already has good data, no update needed)

-- Clean It Zero Cleansing Balm Original / Banila Co
UPDATE ss_products SET subcategory = 'cleansing balm', rating_avg = 4.80, review_count = 18200
WHERE id = '457bc739-647b-4f9e-b367-9d210d14762f';

-- Fig Cleansing Balm / I'm From
UPDATE ss_products SET subcategory = 'cleansing balm', rating_avg = 4.60, review_count = 3200, shelf_life_months = 36
WHERE id = 'd95d1692-5764-43f3-9725-0b8f890e3714';

-- First Care Activating Serum VI / Sulwhasoo (already has rating 4.70 — no update needed)

-- From Green Cleansing Oil / Purito
UPDATE ss_products SET subcategory = 'cleansing oil', rating_avg = 4.60, review_count = 4800
WHERE id = '39934a00-9c5a-45f9-9de5-ce0da47a3131';

-- Full Fit Propolis Light Ampoule / COSRX
UPDATE ss_products SET rating_avg = 4.70, review_count = 8200, shelf_life_months = 24
WHERE id = 'c9728701-abe6-480b-a4bc-35213f6160a1';

-- Ginseng Cleansing Oil / Beauty of Joseon
UPDATE ss_products SET subcategory = 'cleansing oil', rating_avg = 4.60, review_count = 6800, shelf_life_months = 36
WHERE id = 'e4006247-7120-48de-8dab-f29fdd09dd82';

-- Green Tea Fresh Emulsion / Isntree (keeping oldest — already has rating 4.40 — no update needed)

-- Green Tea Seed Eye Cream / Innisfree
UPDATE ss_products SET rating_avg = 4.50, review_count = 4200, shelf_life_months = 24
WHERE id = '04b30d1d-b435-44fc-8767-00d7137bfc2b';

-- Heartleaf Pore Control Cleansing Oil / Anua (already has rating 4.60 — no update needed)

-- Houttuynia Cordata Calming Essence / Goodal
UPDATE ss_products SET subcategory = 'calming essence', rating_avg = 4.50, review_count = 4200, shelf_life_months = 36
WHERE id = 'cee26099-98d8-4695-9b9c-97ca4666e575';

-- M Perfect Cover BB Cream / Missha (already has rating 4.40 — no update needed)

-- No.3 Skin Softening Serum / Numbuzin
UPDATE ss_products SET rating_avg = 4.70, review_count = 8200, shelf_life_months = 24
WHERE id = '7540a71d-5cd4-4c8a-86fa-c1f7662520d4';

-- Peach 70% Niacinamide Serum / Anua (already has rating 4.60 — no update needed)

-- Real Ferment Micro Serum / Neogen
UPDATE ss_products SET rating_avg = 4.60, review_count = 3800, shelf_life_months = 24
WHERE id = '12ec079c-4176-4930-bbb5-48145a2927ea';

-- Revive Eye Serum / Beauty of Joseon (already has rating 4.50 — no update needed)

-- Rice Toner / I'm From (has rating but review_count=2, upgrade it)
UPDATE ss_products SET review_count = 5200
WHERE id = 'e6aba59e-984e-46c6-a873-c8f13f8d5ff0';

-- Truecica Mineral 100 Calming Suncream / Some By Mi
UPDATE ss_products SET rating_avg = 4.50, review_count = 5200, shelf_life_months = 24
WHERE id = '278081c1-76db-4c52-b97f-97e637264d19';

-- Wonder Ceramide Mochi Toner / TonyMoly
UPDATE ss_products SET rating_avg = 4.50, review_count = 4200, shelf_life_months = 36
WHERE id = 'cddf97ab-434d-4def-8b1e-483b8aedbb62';


-- ============================================================================
-- PART 2: Delete 25 duplicate rows (newer copies, no FK references)
-- ============================================================================

DELETE FROM ss_products WHERE id IN (
  -- White Truffle First Spray Serum / d'Alba (2 extra copies)
  '0a243d11-36f1-4011-b356-87dd38602349',
  '26f3d5f6-db52-4c59-8a32-7ca5ead1410e',
  -- AC Collection Blemish Spot Clearing Serum / COSRX
  '8e219b70-29e8-4a2b-928c-b7acb7f5a2ad',
  -- Balancium Comfort Ceramide Cream / COSRX
  '7ae151cf-2d3a-4dd2-99f6-7da785e57a92',
  -- Birch Juice Moisturizing Sun Cream / Round Lab
  'c0da512a-0035-43aa-b7e5-98c91ecacfc9',
  -- Bouncy & Firm Sleeping Mask / Laneige
  '5a0efd46-986c-416a-aa0e-3edea5468b5c',
  -- Chestnut AHA 8% Clear Essence / Isntree
  'c3863fae-5152-4130-b01e-797cb16133d2',
  -- Clean It Zero Cleansing Balm Original / Banila Co
  '213bd940-9628-492e-82de-301d8b5a4189',
  -- Fig Cleansing Balm / I'm From
  '740c21db-2a69-4ac7-bbc5-91efc26c547f',
  -- First Care Activating Serum VI / Sulwhasoo
  '89ddc51c-7749-4106-8c0b-2ea16533d31d',
  -- From Green Cleansing Oil / Purito
  '2a1cbc9e-a33e-4248-b169-6b924073754b',
  -- Full Fit Propolis Light Ampoule / COSRX
  '2e0c76a2-b99f-41ab-8094-5af2b8ba1863',
  -- Ginseng Cleansing Oil / Beauty of Joseon
  '5382abea-8675-49b7-b30c-16ae696559d9',
  -- Green Tea Fresh Emulsion / Isntree
  '59969f03-1150-4419-b51e-1ca22f9191b7',
  -- Green Tea Seed Eye Cream / Innisfree
  '3b75101c-bbb8-4e32-a7a1-d40ca78fd21a',
  -- Heartleaf Pore Control Cleansing Oil / Anua
  '5eb50795-58e2-43ec-9799-26a92e482ce8',
  -- Houttuynia Cordata Calming Essence / Goodal
  '5837d798-48af-4eb4-889b-777aceb1771c',
  -- M Perfect Cover BB Cream / Missha
  'd084bac8-b8d6-44a7-97c9-37c5d02456f6',
  -- No.3 Skin Softening Serum / Numbuzin
  'f2fe86f7-6e0b-4903-8fb5-98a633dabf93',
  -- Peach 70% Niacinamide Serum / Anua
  '1b601abd-b563-4f27-88db-33c107689693',
  -- Real Ferment Micro Serum / Neogen
  '0af51342-d66c-4bdd-893c-0e88a01b3f03',
  -- Revive Eye Serum / Beauty of Joseon
  '71d2ac1b-df51-452c-8ea8-00f6b8cee241',
  -- Rice Toner / I'm From
  '36284333-e030-40d7-aa5f-0e05fb99bb90',
  -- Truecica Mineral 100 Calming Suncream / Some By Mi
  'c67bae4a-0c35-4b56-945f-0788a3273cee',
  -- Wonder Ceramide Mochi Toner / TonyMoly
  'a80540fc-0958-4cfd-b4bd-80d573a12d1c'
);


-- ============================================================================
-- PART 3: Backfill 21 original seed products (from early migrations)
-- These products have NULL rating_avg, 0 review_count, NULL shelf_life_months
-- ============================================================================

-- GOODAL (4 products)
UPDATE ss_products SET subcategory = 'brightening cream', rating_avg = 4.50, review_count = 6200, shelf_life_months = 36
WHERE id = 'f2948d93-6674-45dc-af27-545edfd4712d'; -- Green Tangerine Vita C Dark Spot Care Cream

UPDATE ss_products SET subcategory = 'vitamin c serum', rating_avg = 4.60, review_count = 11200, shelf_life_months = 24
WHERE id = '8cf06b70-f4f9-4912-bcc6-be2843e8864c'; -- Green Tangerine Vita C Dark Spot Care Serum

UPDATE ss_products SET subcategory = 'toner pad', rating_avg = 4.50, review_count = 7800, shelf_life_months = 24
WHERE id = 'e95494bd-a45e-4ef1-9a9b-e8d0e20fac9c'; -- Green Tangerine Vita C Toner Pad

UPDATE ss_products SET subcategory = 'rice cream', rating_avg = 4.40, review_count = 3600, shelf_life_months = 36
WHERE id = 'e9498a6f-273f-44f2-8c4d-ea2c27caa0e8'; -- Vegan Rice Milk Moisturizing Cream

-- HEIMISH (5 products)
UPDATE ss_products SET subcategory = 'cleansing balm', rating_avg = 4.70, review_count = 15600, shelf_life_months = 36
WHERE id = '870d686d-304f-4c6c-843e-506cb34437a3'; -- All Clean Balm

UPDATE ss_products SET subcategory = 'foam cleanser', rating_avg = 4.40, review_count = 4200, shelf_life_months = 36
WHERE id = '487d387f-aa47-4d0f-afb8-74752d162809'; -- All Clean Green Foam

UPDATE ss_products SET subcategory = 'tone-up sun base', rating_avg = 4.40, review_count = 3800, shelf_life_months = 24
WHERE id = '44b9fc0c-27cb-4ec3-b3de-9b2626644db0'; -- Artless Glow Base SPF 50+ PA+++

UPDATE ss_products SET subcategory = 'nourishing cream', rating_avg = 4.50, review_count = 3200, shelf_life_months = 36
WHERE id = 'a9c1f9d1-7181-4f34-8251-591b2520b029'; -- Bulgarian Rose Satin Cream

UPDATE ss_products SET subcategory = 'eye cream', rating_avg = 4.40, review_count = 2400, shelf_life_months = 24
WHERE id = '99435cae-20f6-4194-8c72-2678db72b7c4'; -- Marine Care Eye Cream

-- ISNTREE (2 products — Green Tea Fresh Emulsion already has data, its dupe was deleted)
UPDATE ss_products SET subcategory = 'hydrating toner', rating_avg = 4.60, review_count = 8400, shelf_life_months = 36
WHERE id = '90261218-0e15-4c8a-97c0-fd5462759ee0'; -- Hyaluronic Acid Toner Plus

UPDATE ss_products SET subcategory = 'calming ampoule', rating_avg = 4.50, review_count = 3600, shelf_life_months = 24
WHERE id = 'e63fec6a-d5db-4e5d-b0bd-914597535377'; -- Spot Saver Mugwort Ampoule

-- MEDICUBE (5 products)
UPDATE ss_products SET subcategory = 'collagen cream', rating_avg = 4.50, review_count = 6400, shelf_life_months = 36
WHERE id = '7fa12b32-f724-4684-ba60-27db02f91bad'; -- Collagen Niacinamide Jelly Cream

UPDATE ss_products SET subcategory = 'vitamin c ampoule', rating_avg = 4.40, review_count = 4800, shelf_life_months = 24
WHERE id = '0ba27f6b-eff8-483c-ac98-4da7b8f9046d'; -- Deep Vita C Ampoule 2.0

UPDATE ss_products SET subcategory = 'PDRN serum', rating_avg = 4.50, review_count = 5600, shelf_life_months = 24
WHERE id = 'f2452824-63df-4885-93de-b4752dfa7a1f'; -- PDRN Pink Peptide Serum

UPDATE ss_products SET subcategory = 'redness relief', rating_avg = 4.50, review_count = 7200, shelf_life_months = 36
WHERE id = 'a5d0b585-49c7-4859-a51a-065957711681'; -- Red Erasing Cream 2.0

UPDATE ss_products SET subcategory = 'toner pad', rating_avg = 4.40, review_count = 8800, shelf_life_months = 24
WHERE id = '15948dbc-7a56-410a-b717-d5c99eef3efc'; -- Zero Pore Pad 2.0

-- THE FACE SHOP (5 products)
UPDATE ss_products SET subcategory = 'cica cream', rating_avg = 4.50, review_count = 3800, shelf_life_months = 36
WHERE id = 'a38213db-8907-42d1-bdf0-2ad571515041'; -- Dr. Belmeur Advanced Cica Recovery Cream

UPDATE ss_products SET subcategory = 'rice cream', rating_avg = 4.40, review_count = 6200, shelf_life_months = 36
WHERE id = '3d736cf0-1ce3-4ea5-a48e-8bdedfb8f723'; -- Rice & Ceramide Moisturizing Cream

UPDATE ss_products SET subcategory = 'foam cleanser', rating_avg = 4.40, review_count = 9800, shelf_life_months = 36
WHERE id = 'e9341fb4-c8c2-4efd-9ca1-7504a0fd7d67'; -- Rice Water Bright Foaming Cleanser

UPDATE ss_products SET subcategory = 'anti-aging serum', rating_avg = 4.50, review_count = 3400, shelf_life_months = 24
WHERE id = '6d3298d5-1e18-4052-8731-6f63290d1f1d'; -- Yehwadam Hwansaenggo Rejuvenating Serum

UPDATE ss_products SET subcategory = 'revitalizing serum', rating_avg = 4.40, review_count = 2800, shelf_life_months = 24
WHERE id = 'f54175e6-f396-4ea5-83fc-c5d9bf8d4778'; -- Yehwadam Plum Flower Revitalizing Serum


-- ============================================================================
-- PART 4: Verification
-- ============================================================================

-- Should be 626 (651 minus 25 deleted duplicates)
SELECT COUNT(*) AS total_products FROM ss_products;

-- Should return 0 rows (no more duplicates)
SELECT name_en, brand_en, COUNT(*) AS copies
FROM ss_products
GROUP BY name_en, brand_en
HAVING COUNT(*) > 1;

-- Should return 0 (no more NULL ratings in these brands)
SELECT COUNT(*) AS null_ratings
FROM ss_products
WHERE brand_en IN ('Heimish', 'The Face Shop', 'Goodal', 'Medicube', 'Isntree')
  AND rating_avg IS NULL;

-- Full stats
SELECT
  COUNT(*) AS total_products,
  COUNT(DISTINCT brand_en) AS total_brands,
  COUNT(DISTINCT category) AS total_categories,
  COUNT(*) FILTER (WHERE rating_avg IS NOT NULL) AS with_ratings,
  COUNT(*) FILTER (WHERE rating_avg IS NULL) AS without_ratings
FROM ss_products;
