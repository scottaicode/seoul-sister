-- Seed: Product-Ingredient links and retailer prices
-- This connects the 56 products to their key ingredients and adds price data

-- Fix: Populate ingredient name_en values (were NULL from initial seed)
UPDATE ss_ingredients SET name_en = 'Niacinamide (Vitamin B3)' WHERE name_inci = 'Niacinamide';
UPDATE ss_ingredients SET name_en = 'Hyaluronic Acid' WHERE name_inci = 'Sodium Hyaluronate';
UPDATE ss_ingredients SET name_en = 'Centella Asiatica Extract' WHERE name_inci = 'Centella Asiatica Extract';
UPDATE ss_ingredients SET name_en = 'Snail Mucin' WHERE name_inci = 'Snail Secretion Filtrate';
UPDATE ss_ingredients SET name_en = 'Propolis Extract' WHERE name_inci = 'Propolis Extract';
UPDATE ss_ingredients SET name_en = 'Rice Bran Extract' WHERE name_inci = 'Oryza Sativa (Rice) Bran Extract';
UPDATE ss_ingredients SET name_en = 'Green Tea Extract' WHERE name_inci = 'Camellia Sinensis Leaf Extract';
UPDATE ss_ingredients SET name_en = 'Mugwort Extract' WHERE name_inci = 'Artemisia Vulgaris Extract';
UPDATE ss_ingredients SET name_en = 'Retinol (Vitamin A)' WHERE name_inci = 'Retinol';
UPDATE ss_ingredients SET name_en = 'Salicylic Acid (BHA)' WHERE name_inci = 'Salicylic Acid';
UPDATE ss_ingredients SET name_en = 'Glycolic Acid (AHA)' WHERE name_inci = 'Glycolic Acid';
UPDATE ss_ingredients SET name_en = 'Ceramide NP' WHERE name_inci = 'Ceramide NP';
UPDATE ss_ingredients SET name_en = 'Squalane' WHERE name_inci = 'Squalane';
UPDATE ss_ingredients SET name_en = 'Panthenol (Vitamin B5)' WHERE name_inci = 'Panthenol';
UPDATE ss_ingredients SET name_en = 'Allantoin' WHERE name_inci = 'Allantoin';
UPDATE ss_ingredients SET name_en = 'Adenosine' WHERE name_inci = 'Adenosine';
UPDATE ss_ingredients SET name_en = 'Beta-Glucan' WHERE name_inci = 'Beta-Glucan';
UPDATE ss_ingredients SET name_en = 'Tranexamic Acid' WHERE name_inci = 'Tranexamic Acid';
UPDATE ss_ingredients SET name_en = 'Azelaic Acid' WHERE name_inci = 'Azelaic Acid';
UPDATE ss_ingredients SET name_en = 'Tea Tree Oil' WHERE name_inci = 'Melaleuca Alternifolia (Tea Tree) Leaf Oil';
UPDATE ss_ingredients SET name_en = 'Vitamin C' WHERE name_inci = 'Ascorbic Acid';
UPDATE ss_ingredients SET name_en = 'Matrixyl (Peptide)' WHERE name_inci = 'Palmitoyl Pentapeptide-4';
UPDATE ss_ingredients SET name_en = 'Alpha-Arbutin' WHERE name_inci = 'Alpha-Arbutin';
UPDATE ss_ingredients SET name_en = 'Licorice Root Extract' WHERE name_inci = 'Glycyrrhiza Glabra (Licorice) Root Extract';
UPDATE ss_ingredients SET name_en = 'Galactomyces Ferment Filtrate' WHERE name_inci = 'Galactomyces Ferment Filtrate';
UPDATE ss_ingredients SET name_en = 'Bifida Ferment Lysate' WHERE name_inci = 'Bifida Ferment Lysate';
UPDATE ss_ingredients SET name_en = 'Madecassoside' WHERE name_inci = 'Madecassoside';
UPDATE ss_ingredients SET name_en = 'PDRN (Polydeoxyribonucleotide)' WHERE name_inci = 'Polydeoxyribonucleotide';
UPDATE ss_ingredients SET name_en = 'Bakuchiol' WHERE name_inci = 'Bakuchiol';
UPDATE ss_ingredients SET name_en = 'Hydrolyzed Collagen' WHERE name_inci = 'Hydrolyzed Collagen';

-- ============================================================================
-- Product-Ingredient Links (position = order in ingredient list, 1 = highest)
-- ============================================================================

-- Helper: Use name-based lookups via subqueries
-- Pattern: (SELECT id FROM ss_products WHERE name_en = '...'), (SELECT id FROM ss_ingredients WHERE name_inci = '...')

-- COSRX Advanced Snail 96 Mucin Power Essence
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Snail Secretion Filtrate'), 1, 96.0),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 3, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Allantoin'), 4, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Beta-Glucan'), 5, NULL);

-- COSRX Advanced Snail 92 All in One Cream
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 92 All in One Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Snail Secretion Filtrate'), 1, 92.0),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 92 All in One Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 92 All in One Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Adenosine'), 3, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 92 All in One Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Allantoin'), 4, NULL);

-- COSRX BHA Blackhead Power Liquid
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'BHA Blackhead Power Liquid'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Salicylic Acid'), 1, 4.0),
((SELECT id FROM ss_products WHERE name_en = 'BHA Blackhead Power Liquid'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'BHA Blackhead Power Liquid'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 3, NULL);

-- COSRX AHA/BHA Clarifying Treatment Toner
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'AHA/BHA Clarifying Treatment Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Glycolic Acid'), 1, 0.1),
((SELECT id FROM ss_products WHERE name_en = 'AHA/BHA Clarifying Treatment Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Salicylic Acid'), 2, 0.1),
((SELECT id FROM ss_products WHERE name_en = 'AHA/BHA Clarifying Treatment Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Allantoin'), 3, NULL);

-- COSRX Low pH Good Morning Gel Cleanser
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Low pH Good Morning Gel Cleanser'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Salicylic Acid'), 1, 0.5),
((SELECT id FROM ss_products WHERE name_en = 'Low pH Good Morning Gel Cleanser'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Camellia Sinensis Leaf Extract'), 2, NULL);

-- COSRX Full Fit Propolis Synergy Toner
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Full Fit Propolis Synergy Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Propolis Extract'), 1, 72.6),
((SELECT id FROM ss_products WHERE name_en = 'Full Fit Propolis Synergy Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Full Fit Propolis Synergy Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 3, NULL);

-- COSRX Propolis Light Ampule
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Propolis Light Ampule'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Propolis Extract'), 1, 73.5),
((SELECT id FROM ss_products WHERE name_en = 'Propolis Light Ampule'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Propolis Light Ampule'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 3, NULL);

-- Beauty of Joseon Glow Serum
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Glow Serum: Propolis + Niacinamide'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Propolis Extract'), 1, 60.0),
((SELECT id FROM ss_products WHERE name_en = 'Glow Serum: Propolis + Niacinamide'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 2, 2.0),
((SELECT id FROM ss_products WHERE name_en = 'Glow Serum: Propolis + Niacinamide'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 3, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Glow Serum: Propolis + Niacinamide'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Adenosine'), 4, NULL);

-- Beauty of Joseon Relief Sun
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Relief Sun: Rice + Probiotics SPF50+ PA++++'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Oryza Sativa (Rice) Bran Extract'), 1, 30.0),
((SELECT id FROM ss_products WHERE name_en = 'Relief Sun: Rice + Probiotics SPF50+ PA++++'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 2, NULL);

-- Beauty of Joseon Dynasty Cream
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Dynasty Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Oryza Sativa (Rice) Bran Extract'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Dynasty Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Ceramide NP'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Dynasty Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Squalane'), 3, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Dynasty Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Adenosine'), 4, NULL);

-- Beauty of Joseon Revive Eye Serum
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Revive Eye Serum: Ginseng + Retinal'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Retinol'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Revive Eye Serum: Ginseng + Retinal'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Adenosine'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Revive Eye Serum: Ginseng + Retinal'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Palmitoyl Pentapeptide-4'), 3, NULL);

-- Dr. Jart+ Ceramidin Cream
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Ceramidin Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Ceramide NP'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Ceramidin Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Ceramidin Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 3, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Ceramidin Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Allantoin'), 4, NULL);

-- Dr. Jart+ Cicapair Tiger Grass Cream
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Cicapair Tiger Grass Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Cicapair Tiger Grass Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Madecassoside'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Cicapair Tiger Grass Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 3, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Cicapair Tiger Grass Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 4, NULL);

-- Etude House SoonJung 2x Barrier Intensive Cream
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'SoonJung 2x Barrier Intensive Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 1, 10.0),
((SELECT id FROM ss_products WHERE name_en = 'SoonJung 2x Barrier Intensive Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Madecassoside'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'SoonJung 2x Barrier Intensive Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 3, NULL);

-- Etude House SoonJung pH 5.5 Relief Toner
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'SoonJung pH 5.5 Relief Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'SoonJung pH 5.5 Relief Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'SoonJung pH 5.5 Relief Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Beta-Glucan'), 3, NULL);

-- Anua Heartleaf 77% Soothing Toner
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Heartleaf 77% Soothing Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Heartleaf 77% Soothing Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Heartleaf 77% Soothing Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 3, NULL);

-- Anua Peach 70% Niacinamide Serum
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Peach 70% Niacinamide Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 1, 10.0),
((SELECT id FROM ss_products WHERE name_en = 'Peach 70% Niacinamide Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Peach 70% Niacinamide Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 3, NULL);

-- Banila Co Clean It Zero
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Clean It Zero Cleansing Balm Original'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Clean It Zero Cleansing Balm Original'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Ceramide NP'), 2, NULL);

-- d'Alba White Truffle First Spray Serum
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'White Truffle First Spray Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'White Truffle First Spray Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'White Truffle First Spray Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Adenosine'), 3, NULL);

-- I'm From Mugwort Essence
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Mugwort Essence'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Artemisia Vulgaris Extract'), 1, 91.35),
((SELECT id FROM ss_products WHERE name_en = 'Mugwort Essence'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Allantoin'), 2, NULL);

-- I'm From Rice Toner
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Rice Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Oryza Sativa (Rice) Bran Extract'), 1, 77.78),
((SELECT id FROM ss_products WHERE name_en = 'Rice Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Rice Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 3, NULL);

-- Innisfree Green Tea Seed Serum
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Green Tea Seed Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Camellia Sinensis Leaf Extract'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Green Tea Seed Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Green Tea Seed Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Beta-Glucan'), 3, NULL);

-- Innisfree Daily UV Protection Cream
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Daily UV Protection Cream SPF35 PA++'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Daily UV Protection Cream SPF35 PA++'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL);

-- Innisfree Jeju Volcanic Pore Cleansing Foam
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Jeju Volcanic Pore Cleansing Foam'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Salicylic Acid'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Jeju Volcanic Pore Cleansing Foam'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Camellia Sinensis Leaf Extract'), 2, NULL);

-- Isntree Hyaluronic Acid Toner
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Hyaluronic Acid Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Hyaluronic Acid Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Hyaluronic Acid Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Beta-Glucan'), 3, NULL);

-- Isntree Green Tea Fresh Emulsion
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Green Tea Fresh Emulsion'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Camellia Sinensis Leaf Extract'), 1, 80.0),
((SELECT id FROM ss_products WHERE name_en = 'Green Tea Fresh Emulsion'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 2, NULL);

-- Klairs Freshly Juiced Vitamin Drop
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Freshly Juiced Vitamin Drop'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Ascorbic Acid'), 1, 5.0),
((SELECT id FROM ss_products WHERE name_en = 'Freshly Juiced Vitamin Drop'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Freshly Juiced Vitamin Drop'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 3, NULL);

-- Klairs Midnight Blue Calming Cream
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Midnight Blue Calming Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Midnight Blue Calming Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Midnight Blue Calming Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Ceramide NP'), 3, NULL);

-- Klairs Supple Preparation Unscented Toner
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Supple Preparation Unscented Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Supple Preparation Unscented Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Supple Preparation Unscented Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 3, NULL);

-- Laneige Water Sleeping Mask
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Water Sleeping Mask'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Water Sleeping Mask'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Beta-Glucan'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Water Sleeping Mask'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 3, NULL);

-- Laneige Lip Sleeping Mask
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Lip Sleeping Mask'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Lip Sleeping Mask'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Ascorbic Acid'), 2, NULL);

-- Laneige Cream Skin Toner & Moisturizer
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Cream Skin Toner & Moisturizer'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Ceramide NP'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Cream Skin Toner & Moisturizer'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL);

-- Missha Time Revolution First Treatment Essence
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Time Revolution The First Treatment Essence RX'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Bifida Ferment Lysate'), 1, 90.0),
((SELECT id FROM ss_products WHERE name_en = 'Time Revolution The First Treatment Essence RX'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Time Revolution The First Treatment Essence RX'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Adenosine'), 3, NULL);

-- Numbuzin No.3 Skin Softening Serum
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'No.3 Skin Softening Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Galactomyces Ferment Filtrate'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'No.3 Skin Softening Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'No.3 Skin Softening Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 3, NULL);

-- Numbuzin No.5 Vitamin Niacinamide Serum
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'No.5 Vitamin Niacinamide Concentrated Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 1, 10.0),
((SELECT id FROM ss_products WHERE name_en = 'No.5 Vitamin Niacinamide Concentrated Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Ascorbic Acid'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'No.5 Vitamin Niacinamide Concentrated Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Tranexamic Acid'), 3, NULL);

-- Skin1004 Madagascar Centella Ampoule
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Madagascar Centella Ampoule'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 1, 99.9),
((SELECT id FROM ss_products WHERE name_en = 'Madagascar Centella Ampoule'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Madecassoside'), 2, NULL);

-- Skin1004 Hyalu-Cica Water-Fit Sun Serum
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 3, NULL);

-- Purito Centella Green Level Unscented Sun
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Centella Green Level Unscented Sun SPF50+ PA++++'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Centella Green Level Unscented Sun SPF50+ PA++++'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 2, NULL);

-- Round Lab Dokdo Toner
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Dokdo Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Dokdo Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'Dokdo Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Beta-Glucan'), 3, NULL);

-- Torriden DIVE-IN Hyaluronic Acid Serum
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'DIVE-IN Low Molecular Hyaluronic Acid Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'DIVE-IN Low Molecular Hyaluronic Acid Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'DIVE-IN Low Molecular Hyaluronic Acid Serum'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Allantoin'), 3, NULL);

-- Torriden SOLID-IN Ceramide Moisturizing Cream
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'SOLID-IN Ceramide Moisturizing Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Ceramide NP'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'SOLID-IN Ceramide Moisturizing Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'SOLID-IN Ceramide Moisturizing Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Panthenol'), 3, NULL),
((SELECT id FROM ss_products WHERE name_en = 'SOLID-IN Ceramide Moisturizing Cream'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Squalane'), 4, NULL);

-- Some By Mi AHA BHA PHA 30 Days Miracle Toner
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'AHA BHA PHA 30 Days Miracle Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Glycolic Acid'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'AHA BHA PHA 30 Days Miracle Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Salicylic Acid'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'AHA BHA PHA 30 Days Miracle Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 3, NULL),
((SELECT id FROM ss_products WHERE name_en = 'AHA BHA PHA 30 Days Miracle Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Melaleuca Alternifolia (Tea Tree) Leaf Oil'), 4, NULL),
((SELECT id FROM ss_products WHERE name_en = 'AHA BHA PHA 30 Days Miracle Toner'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 5, NULL);

-- Sulwhasoo First Care Activating Serum VI
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'First Care Activating Serum VI'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Niacinamide'), 1, NULL),
((SELECT id FROM ss_products WHERE name_en = 'First Care Activating Serum VI'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Sodium Hyaluronate'), 2, NULL),
((SELECT id FROM ss_products WHERE name_en = 'First Care Activating Serum VI'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Adenosine'), 3, NULL);

-- ONE THING Centella Asiatica Extract
INSERT INTO ss_product_ingredients (product_id, ingredient_id, position, concentration_pct) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Centella Asiatica Extract' AND brand_en = 'ONE THING'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Centella Asiatica Extract'), 1, 99.9),
((SELECT id FROM ss_products WHERE name_en = 'Centella Asiatica Extract' AND brand_en = 'ONE THING'), (SELECT id FROM ss_ingredients WHERE name_inci = 'Madecassoside'), 2, NULL);

-- ============================================================================
-- Product Prices (multiple retailers per product for price comparison)
-- ============================================================================

-- COSRX Advanced Snail 96 Mucin Power Essence (bestseller - all retailers)
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_retailers WHERE name = 'Olive Young'), 25.00, 16900, 'https://global.oliveyoung.com/product/cosrx-snail-96', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 21.99, NULL, 'https://amazon.com/dp/B00PBX3L7K', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_retailers WHERE name = 'YesStyle'), 19.99, NULL, 'https://yesstyle.com/cosrx-snail-96', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_retailers WHERE name = 'Soko Glam'), 25.00, NULL, 'https://sokoglam.com/products/cosrx-snail-96', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_retailers WHERE name = 'iHerb'), 20.49, NULL, 'https://iherb.com/pr/cosrx-snail-96', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Advanced Snail 96 Mucin Power Essence'), (SELECT id FROM ss_retailers WHERE name = 'Stylevana'), 18.99, NULL, 'https://stylevana.com/cosrx-snail-96', true, now());

-- Beauty of Joseon Glow Serum
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Glow Serum: Propolis + Niacinamide'), (SELECT id FROM ss_retailers WHERE name = 'Olive Young'), 12.00, 12000, 'https://global.oliveyoung.com/product/boj-glow-serum', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Glow Serum: Propolis + Niacinamide'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 16.99, NULL, 'https://amazon.com/dp/boj-glow', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Glow Serum: Propolis + Niacinamide'), (SELECT id FROM ss_retailers WHERE name = 'YesStyle'), 14.50, NULL, 'https://yesstyle.com/boj-glow-serum', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Glow Serum: Propolis + Niacinamide'), (SELECT id FROM ss_retailers WHERE name = 'Soko Glam'), 17.00, NULL, 'https://sokoglam.com/products/boj-glow-serum', true, now());

-- Beauty of Joseon Relief Sun
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Relief Sun: Rice + Probiotics SPF50+ PA++++'), (SELECT id FROM ss_retailers WHERE name = 'Olive Young'), 10.00, 11000, 'https://global.oliveyoung.com/product/boj-relief-sun', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Relief Sun: Rice + Probiotics SPF50+ PA++++'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 18.00, NULL, 'https://amazon.com/dp/boj-relief-sun', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Relief Sun: Rice + Probiotics SPF50+ PA++++'), (SELECT id FROM ss_retailers WHERE name = 'Stylevana'), 11.99, NULL, 'https://stylevana.com/boj-relief-sun', true, now());

-- Torriden DIVE-IN Serum
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'DIVE-IN Low Molecular Hyaluronic Acid Serum'), (SELECT id FROM ss_retailers WHERE name = 'Olive Young'), 14.00, 15000, 'https://global.oliveyoung.com/product/torriden-dive-in', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'DIVE-IN Low Molecular Hyaluronic Acid Serum'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 19.00, NULL, 'https://amazon.com/dp/torriden-dive-in', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'DIVE-IN Low Molecular Hyaluronic Acid Serum'), (SELECT id FROM ss_retailers WHERE name = 'YesStyle'), 15.99, NULL, 'https://yesstyle.com/torriden-dive-in', true, now());

-- Dr. Jart+ Ceramidin Cream
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Ceramidin Cream'), (SELECT id FROM ss_retailers WHERE name = 'Soko Glam'), 48.00, NULL, 'https://sokoglam.com/products/dr-jart-ceramidin-cream', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Ceramidin Cream'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 36.99, NULL, 'https://amazon.com/dp/drjart-ceramidin', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Ceramidin Cream'), (SELECT id FROM ss_retailers WHERE name = 'Olive Young'), 34.00, 38000, 'https://global.oliveyoung.com/product/drjart-ceramidin', true, now());

-- Laneige Water Sleeping Mask
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Water Sleeping Mask'), (SELECT id FROM ss_retailers WHERE name = 'Soko Glam'), 29.00, NULL, 'https://sokoglam.com/products/laneige-water-sleeping-mask', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Water Sleeping Mask'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 27.99, NULL, 'https://amazon.com/dp/laneige-water-mask', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Water Sleeping Mask'), (SELECT id FROM ss_retailers WHERE name = 'Olive Young'), 22.00, 25000, 'https://global.oliveyoung.com/product/laneige-water-mask', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Water Sleeping Mask'), (SELECT id FROM ss_retailers WHERE name = 'Stylevana'), 21.50, NULL, 'https://stylevana.com/laneige-water-sleeping-mask', true, now());

-- Sulwhasoo First Care Activating Serum VI
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'First Care Activating Serum VI'), (SELECT id FROM ss_retailers WHERE name = 'Soko Glam'), 99.00, NULL, 'https://sokoglam.com/products/sulwhasoo-first-care', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'First Care Activating Serum VI'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 89.00, NULL, 'https://amazon.com/dp/sulwhasoo-first-care', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'First Care Activating Serum VI'), (SELECT id FROM ss_retailers WHERE name = 'Olive Young'), 72.00, 85000, 'https://global.oliveyoung.com/product/sulwhasoo-first-care', true, now());

-- Skin1004 Madagascar Centella Ampoule
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Madagascar Centella Ampoule'), (SELECT id FROM ss_retailers WHERE name = 'Olive Young'), 11.00, 12000, 'https://global.oliveyoung.com/product/skin1004-centella', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Madagascar Centella Ampoule'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 16.00, NULL, 'https://amazon.com/dp/skin1004-centella', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Madagascar Centella Ampoule'), (SELECT id FROM ss_retailers WHERE name = 'YesStyle'), 12.50, NULL, 'https://yesstyle.com/skin1004-centella', true, now());

-- Klairs Freshly Juiced Vitamin Drop
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Freshly Juiced Vitamin Drop'), (SELECT id FROM ss_retailers WHERE name = 'Soko Glam'), 23.00, NULL, 'https://sokoglam.com/products/klairs-vitamin-drop', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Freshly Juiced Vitamin Drop'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 21.50, NULL, 'https://amazon.com/dp/klairs-vitamin-drop', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Freshly Juiced Vitamin Drop'), (SELECT id FROM ss_retailers WHERE name = 'YesStyle'), 18.99, NULL, 'https://yesstyle.com/klairs-vitamin-drop', true, now());

-- Round Lab Dokdo Toner
INSERT INTO ss_product_prices (product_id, retailer_id, price_usd, price_krw, url, in_stock, last_checked) VALUES
((SELECT id FROM ss_products WHERE name_en = 'Dokdo Toner'), (SELECT id FROM ss_retailers WHERE name = 'Olive Young'), 12.00, 14000, 'https://global.oliveyoung.com/product/roundlab-dokdo', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Dokdo Toner'), (SELECT id FROM ss_retailers WHERE name = 'Amazon'), 16.50, NULL, 'https://amazon.com/dp/roundlab-dokdo', true, now()),
((SELECT id FROM ss_products WHERE name_en = 'Dokdo Toner'), (SELECT id FROM ss_retailers WHERE name = 'Stylevana'), 13.99, NULL, 'https://stylevana.com/roundlab-dokdo', true, now());
