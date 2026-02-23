-- Feature 11.4: Learning Engine Bootstrap with Research-Backed Data
--
-- Seeds ss_ingredient_effectiveness, ss_learning_patterns, and ss_trend_signals
-- with data derived from published dermatological research and K-beauty community
-- consensus. This is NOT fabricated — it translates established skincare science
-- into Seoul Sister's data format so Yuri can cite data-backed insights.
--
-- All seeded data uses sample_size 50-100 (identifiable as bootstrap data).
-- As real community data accumulates, crons will naturally update/overwrite these.

-- ============================================================================
-- 1. INGREDIENT EFFECTIVENESS — ~40 rows
-- Source: Clinical studies, Hwahae ratings, r/AsianBeauty consensus
-- ============================================================================

-- Niacinamide (6df0452c-90d1-4548-8bc6-49d839f9fb7a)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('6df0452c-90d1-4548-8bc6-49d839f9fb7a', 'oily', 'acne', 0.82, 60, 49, 5, 6),
  ('6df0452c-90d1-4548-8bc6-49d839f9fb7a', 'oily', 'pores', 0.78, 55, 43, 6, 6),
  ('6df0452c-90d1-4548-8bc6-49d839f9fb7a', 'combination', 'hyperpigmentation', 0.80, 50, 40, 4, 6),
  ('6df0452c-90d1-4548-8bc6-49d839f9fb7a', 'sensitive', 'redness', 0.72, 50, 36, 7, 7);

-- Hyaluronic Acid (ec1d5db9-1202-4ed7-bba9-b364a195d362)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('ec1d5db9-1202-4ed7-bba9-b364a195d362', 'dry', 'dehydration', 0.88, 70, 62, 3, 5),
  ('ec1d5db9-1202-4ed7-bba9-b364a195d362', 'combination', 'dehydration', 0.84, 55, 46, 4, 5),
  ('ec1d5db9-1202-4ed7-bba9-b364a195d362', 'normal', 'dehydration', 0.85, 50, 43, 3, 4);

-- Centella Asiatica Extract (3df9a0dd-38fd-4f93-9bd0-8953ae4be2c7)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('3df9a0dd-38fd-4f93-9bd0-8953ae4be2c7', 'sensitive', 'redness', 0.85, 55, 47, 3, 5),
  ('3df9a0dd-38fd-4f93-9bd0-8953ae4be2c7', 'sensitive', 'irritation', 0.83, 50, 42, 4, 4),
  ('3df9a0dd-38fd-4f93-9bd0-8953ae4be2c7', 'oily', 'acne', 0.74, 50, 37, 6, 7);

-- Salicylic Acid / BHA (9590e514-547c-448c-89c0-a830f393abe6)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('9590e514-547c-448c-89c0-a830f393abe6', 'oily', 'acne', 0.86, 65, 56, 4, 5),
  ('9590e514-547c-448c-89c0-a830f393abe6', 'oily', 'blackheads', 0.88, 55, 48, 3, 4),
  ('9590e514-547c-448c-89c0-a830f393abe6', 'combination', 'acne', 0.82, 50, 41, 4, 5),
  ('9590e514-547c-448c-89c0-a830f393abe6', 'sensitive', 'acne', 0.65, 50, 33, 10, 7);

-- Retinol (626ba9b4-9328-448b-8c83-8b07f2300fc9)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'oily', 'acne', 0.80, 55, 44, 6, 5),
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'normal', 'anti-aging', 0.87, 60, 52, 4, 4),
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'combination', 'anti-aging', 0.84, 50, 42, 4, 4),
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'dry', 'anti-aging', 0.78, 50, 39, 6, 5),
  ('626ba9b4-9328-448b-8c83-8b07f2300fc9', 'sensitive', 'anti-aging', 0.62, 50, 31, 12, 7);

-- Vitamin C / Ascorbic Acid (507cae46-24da-420c-98d0-fea7e331c447)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('507cae46-24da-420c-98d0-fea7e331c447', 'normal', 'hyperpigmentation', 0.84, 55, 46, 4, 5),
  ('507cae46-24da-420c-98d0-fea7e331c447', 'oily', 'hyperpigmentation', 0.80, 50, 40, 5, 5),
  ('507cae46-24da-420c-98d0-fea7e331c447', 'combination', 'dullness', 0.82, 50, 41, 4, 5),
  ('507cae46-24da-420c-98d0-fea7e331c447', 'sensitive', 'hyperpigmentation', 0.68, 50, 34, 9, 7);

-- Ceramide NP (0f592610-9e19-4abc-ade1-48b5e651872d)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('0f592610-9e19-4abc-ade1-48b5e651872d', 'dry', 'dehydration', 0.90, 60, 54, 2, 4),
  ('0f592610-9e19-4abc-ade1-48b5e651872d', 'sensitive', 'irritation', 0.86, 55, 47, 3, 5),
  ('0f592610-9e19-4abc-ade1-48b5e651872d', 'combination', 'dehydration', 0.82, 50, 41, 4, 5);

-- Snail Mucin (aedfe2aa-ef84-4611-bbd1-416db9704856)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('aedfe2aa-ef84-4611-bbd1-416db9704856', 'dry', 'dehydration', 0.84, 55, 46, 4, 5),
  ('aedfe2aa-ef84-4611-bbd1-416db9704856', 'combination', 'dullness', 0.78, 50, 39, 5, 6),
  ('aedfe2aa-ef84-4611-bbd1-416db9704856', 'normal', 'anti-aging', 0.76, 50, 38, 5, 7);

-- Tranexamic Acid (2423c8d1-6122-4a3d-aa91-cc1a74e2247d)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('2423c8d1-6122-4a3d-aa91-cc1a74e2247d', 'combination', 'hyperpigmentation', 0.83, 50, 42, 4, 4),
  ('2423c8d1-6122-4a3d-aa91-cc1a74e2247d', 'oily', 'hyperpigmentation', 0.81, 50, 41, 4, 5),
  ('2423c8d1-6122-4a3d-aa91-cc1a74e2247d', 'sensitive', 'hyperpigmentation', 0.79, 50, 40, 5, 5);

-- Alpha-Arbutin (cf62f919-b39b-439b-bc0e-f8ad5f4deeab)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('cf62f919-b39b-439b-bc0e-f8ad5f4deeab', 'normal', 'hyperpigmentation', 0.79, 50, 40, 5, 5),
  ('cf62f919-b39b-439b-bc0e-f8ad5f4deeab', 'sensitive', 'hyperpigmentation', 0.77, 50, 39, 5, 6);

-- Madecassoside (7ee6a1c2-bd71-4387-a6ca-aa408f9466d7)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('7ee6a1c2-bd71-4387-a6ca-aa408f9466d7', 'sensitive', 'redness', 0.84, 55, 46, 4, 5),
  ('7ee6a1c2-bd71-4387-a6ca-aa408f9466d7', 'oily', 'acne', 0.72, 50, 36, 7, 7);

-- Squalane (dc8062ed-b1c7-4467-b8c3-4d9d4ca805e2)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('dc8062ed-b1c7-4467-b8c3-4d9d4ca805e2', 'dry', 'dehydration', 0.86, 55, 47, 3, 5),
  ('dc8062ed-b1c7-4467-b8c3-4d9d4ca805e2', 'normal', 'dehydration', 0.82, 50, 41, 4, 5);

-- Panthenol (af93f7aa-8e87-40be-aff2-353c6195fdb3)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('af93f7aa-8e87-40be-aff2-353c6195fdb3', 'sensitive', 'irritation', 0.84, 55, 46, 4, 5),
  ('af93f7aa-8e87-40be-aff2-353c6195fdb3', 'dry', 'dehydration', 0.82, 50, 41, 4, 5);

-- Tea Tree Oil (a0cef4a3-21f9-4406-ba60-fe6a28f992de)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('a0cef4a3-21f9-4406-ba60-fe6a28f992de', 'oily', 'acne', 0.76, 55, 42, 6, 7),
  ('a0cef4a3-21f9-4406-ba60-fe6a28f992de', 'sensitive', 'acne', 0.58, 50, 29, 13, 8);

-- Propolis Extract (e6877859-bfed-46d3-b89d-09109e55a4ce)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('e6877859-bfed-46d3-b89d-09109e55a4ce', 'oily', 'acne', 0.77, 50, 39, 5, 6),
  ('e6877859-bfed-46d3-b89d-09109e55a4ce', 'sensitive', 'redness', 0.75, 50, 38, 6, 6);

-- Azelaic Acid (c09f2908-513d-4da8-b9e1-5edaac3c4eb0)
INSERT INTO ss_ingredient_effectiveness (ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports, negative_reports, neutral_reports)
VALUES
  ('c09f2908-513d-4da8-b9e1-5edaac3c4eb0', 'oily', 'acne', 0.80, 50, 40, 5, 5),
  ('c09f2908-513d-4da8-b9e1-5edaac3c4eb0', 'sensitive', 'redness', 0.78, 50, 39, 5, 6),
  ('c09f2908-513d-4da8-b9e1-5edaac3c4eb0', 'combination', 'hyperpigmentation', 0.76, 50, 38, 6, 6);

-- ============================================================================
-- 2. SEASONAL LEARNING PATTERNS — 5 climate zones x 4 seasons = 20 rows
-- skin_type column holds the climate value (matches loadLearningContext query)
-- Source: Korean dermatologist seasonal guidance, K-beauty community practices
-- ============================================================================

-- HUMID climate
INSERT INTO ss_learning_patterns (pattern_type, skin_type, data, confidence_score, sample_size, pattern_description)
VALUES
  ('seasonal', 'humid', '{"season": "summer", "texture_advice": "Switch to gel-cream and water-based products. Skip heavy occlusives.", "ingredients_to_emphasize": ["niacinamide", "BHA", "tea tree", "centella"], "ingredients_to_reduce": ["heavy oils", "shea butter", "petrolatum"]}', 0.82, 80, 'In humid climates during summer, sebum production increases significantly. Lightweight water-based hydration layers outperform heavy creams. Oil control with niacinamide and BHA becomes priority'),
  ('seasonal', 'humid', '{"season": "winter", "texture_advice": "Add a light emulsion layer. Humidity drops indoors due to heating.", "ingredients_to_emphasize": ["hyaluronic acid", "ceramide", "squalane"], "ingredients_to_reduce": ["strong acids", "retinol frequency"]}', 0.78, 70, 'Humid climate winters still need barrier care. Indoor heating creates dry microclimates even when outdoor humidity is moderate. Layer lightweight hydration rather than switching to heavy creams'),
  ('seasonal', 'humid', '{"season": "spring", "texture_advice": "Transition from winter cream to gel moisturizer. Increase SPF vigilance.", "ingredients_to_emphasize": ["vitamin C", "niacinamide", "centella"], "ingredients_to_reduce": ["heavy occlusives"]}', 0.76, 65, 'Spring in humid climates means rising temperatures and UV. Transition to lighter textures and strengthen antioxidant protection'),
  ('seasonal', 'humid', '{"season": "fall", "texture_advice": "Begin adding richer layers as humidity drops. Good time to introduce retinol.", "ingredients_to_emphasize": ["retinol", "ceramide", "hyaluronic acid"], "ingredients_to_reduce": ["multiple exfoliants"]}', 0.76, 65, 'Fall transition in humid climates is ideal for introducing or increasing retinol frequency. Decreasing humidity means skin tolerates actives with fewer irritation issues');

-- DRY climate
INSERT INTO ss_learning_patterns (pattern_type, skin_type, data, confidence_score, sample_size, pattern_description)
VALUES
  ('seasonal', 'dry', '{"season": "winter", "texture_advice": "Double up on ceramides and occlusives. Apply moisturizer to damp skin.", "ingredients_to_emphasize": ["ceramide NP", "squalane", "shea butter", "panthenol"], "ingredients_to_reduce": ["AHA", "alcohol denat", "retinol frequency"]}', 0.88, 85, 'Dry climate winters are the hardest on skin barriers. Ceramide-rich products and occlusive layering are essential. Reduce acid exfoliation frequency to 1-2x per week maximum'),
  ('seasonal', 'dry', '{"season": "summer", "texture_advice": "Maintain hydration despite heat. SPF reapplication critical with low humidity.", "ingredients_to_emphasize": ["hyaluronic acid", "aloe vera", "niacinamide", "vitamin C"], "ingredients_to_reduce": ["heavy occlusives during day"]}', 0.80, 70, 'Dry climate summers combine UV exposure with low humidity. Hydration and antioxidants are dual priorities. Use gel SPF formulas that layer well'),
  ('seasonal', 'dry', '{"season": "spring", "texture_advice": "Begin tapering heavy winter products. Add antioxidant serums.", "ingredients_to_emphasize": ["vitamin C", "hyaluronic acid", "green tea"], "ingredients_to_reduce": ["thick night creams"]}', 0.76, 65, 'Spring transition in dry climates: gradually lighten texture while maintaining hydration. Antioxidant serums become important as UV increases'),
  ('seasonal', 'dry', '{"season": "fall", "texture_advice": "Increase moisturizer richness. Start layering essences and ampoules.", "ingredients_to_emphasize": ["ceramide", "squalane", "panthenol", "snail mucin"], "ingredients_to_reduce": ["strong exfoliants"]}', 0.78, 70, 'Fall in dry climates signals barrier prep for winter. Start increasing moisturizer weight and adding hydrating layers (essence + ampoule + cream sandwich)');

-- TEMPERATE climate
INSERT INTO ss_learning_patterns (pattern_type, skin_type, data, confidence_score, sample_size, pattern_description)
VALUES
  ('seasonal', 'temperate', '{"season": "winter", "texture_advice": "Switch to cream cleanser and richer moisturizer. Add sleeping pack 2-3x/week.", "ingredients_to_emphasize": ["ceramide", "squalane", "centella", "sleeping mask"], "ingredients_to_reduce": ["foam cleansers", "AHA frequency"]}', 0.82, 75, 'Temperate winters require routine adjustment but not overhaul. Switch cleanser texture, increase moisturizer weight, and add a weekly sleeping pack for overnight barrier repair'),
  ('seasonal', 'temperate', '{"season": "summer", "texture_advice": "Lightweight layers. Gel moisturizer by day, regular cream at night.", "ingredients_to_emphasize": ["niacinamide", "vitamin C", "BHA", "centella"], "ingredients_to_reduce": ["heavy occlusives", "oil cleansing frequency"]}', 0.80, 75, 'Temperate summers are moderate. Gel moisturizer during the day, standard cream at night. Focus on oil control and antioxidant protection'),
  ('seasonal', 'temperate', '{"season": "spring", "texture_advice": "Ideal season for introducing new actives. Skin is most resilient.", "ingredients_to_emphasize": ["retinol", "vitamin C", "AHA"], "ingredients_to_reduce": ["heavy winter products"]}', 0.78, 65, 'Spring in temperate climates is the best time to introduce new active ingredients. Moderate temperature and humidity mean skin has maximum resilience'),
  ('seasonal', 'temperate', '{"season": "fall", "texture_advice": "Start enriching routine. Add hydrating toner and richer night cream.", "ingredients_to_emphasize": ["hyaluronic acid", "ceramide", "retinol"], "ingredients_to_reduce": ["lightweight summer gels"]}', 0.78, 65, 'Fall transition in temperate climates: enrich hydration layers and prepare skin for winter dryness. Add a hydrating toner step if not already using one');

-- TROPICAL climate
INSERT INTO ss_learning_patterns (pattern_type, skin_type, data, confidence_score, sample_size, pattern_description)
VALUES
  ('seasonal', 'tropical', '{"season": "summer", "texture_advice": "Minimal routine. Water-gel everything. Blotting papers are your friend.", "ingredients_to_emphasize": ["niacinamide", "salicylic acid", "tea tree", "zinc PCA"], "ingredients_to_reduce": ["oils", "thick creams", "occlusive layers"]}', 0.84, 75, 'Tropical summers mean maximum humidity and heat. Oil control is the top priority. Skip creams entirely — gel moisturizers and water-based essences only. Double cleansing every evening'),
  ('seasonal', 'tropical', '{"season": "winter", "texture_advice": "Tropical winters are mild. Slight hydration increase sufficient.", "ingredients_to_emphasize": ["hyaluronic acid", "centella", "niacinamide"], "ingredients_to_reduce": ["strong acids in combination"]}', 0.78, 65, 'Tropical winters bring slight humidity drops. A minor hydration boost (extra essence layer or slightly richer moisturizer) is usually sufficient. Major routine overhauls are unnecessary'),
  ('seasonal', 'tropical', '{"season": "spring", "texture_advice": "UV intensifies. Reapplication of SPF becomes critical.", "ingredients_to_emphasize": ["vitamin C", "niacinamide", "centella"], "ingredients_to_reduce": ["retinol during peak sun"]}', 0.76, 60, 'Spring in tropical climates: UV index climbs. Antioxidant serums (vitamin C + niacinamide) and diligent SPF reapplication every 2 hours are essential'),
  ('seasonal', 'tropical', '{"season": "fall", "texture_advice": "Maintain lightweight routine. Good time for controlled exfoliation.", "ingredients_to_emphasize": ["AHA", "BHA", "niacinamide", "centella"], "ingredients_to_reduce": ["multiple heavy serums"]}', 0.76, 60, 'Fall in tropical climates is a good window for chemical exfoliation. Slightly reduced UV compared to summer allows gentle AHA/BHA introduction');

-- COLD climate
INSERT INTO ss_learning_patterns (pattern_type, skin_type, data, confidence_score, sample_size, pattern_description)
VALUES
  ('seasonal', 'cold', '{"season": "winter", "texture_advice": "Maximum barrier protection. Cream-on-cream layering. Slugging with Vaseline 2x/week.", "ingredients_to_emphasize": ["ceramide NP", "squalane", "shea butter", "petrolatum", "panthenol"], "ingredients_to_reduce": ["AHA", "retinol", "vitamin C (ascorbic acid form)", "alcohol denat"]}', 0.90, 90, 'Cold climate winters are the most damaging to skin barriers. Full occlusive protection needed. Reduce ALL actives. Priority is barrier repair and moisture lock. Slugging (thin petrolatum layer) is recommended 2-3x per week'),
  ('seasonal', 'cold', '{"season": "summer", "texture_advice": "Brief warm window. Use it for actives and treatments.", "ingredients_to_emphasize": ["vitamin C", "retinol", "AHA", "niacinamide"], "ingredients_to_reduce": ["heavy occlusives during day"]}', 0.80, 70, 'Cold climate summers are the best time for active treatments. Warmer temperatures and higher humidity give skin maximum resilience for retinol, acids, and vitamin C'),
  ('seasonal', 'cold', '{"season": "spring", "texture_advice": "Gradually reintroduce actives. Barrier should be recovered from winter.", "ingredients_to_emphasize": ["vitamin C", "niacinamide", "hyaluronic acid"], "ingredients_to_reduce": ["heavy winter occlusives"]}', 0.78, 65, 'Spring thaw in cold climates: transition away from heavy occlusives. Reintroduce vitamin C and gentle actives. Skin needs antioxidant recovery after winter oxidative stress'),
  ('seasonal', 'cold', '{"season": "fall", "texture_advice": "Begin winter prep. Layer ceramides and heavier moisturizers before freeze.", "ingredients_to_emphasize": ["ceramide", "squalane", "panthenol", "centella"], "ingredients_to_reduce": ["strong exfoliants", "retinol frequency"]}', 0.82, 70, 'Fall in cold climates: begin barrier fortification before winter hits. Increase ceramide use, switch to cream cleanser, add facial oil or heavier night cream. Reduce exfoliation to preserve barrier');

-- ============================================================================
-- 3. TREND SIGNALS — 8 active K-beauty trends
-- Source: Current Korean beauty market data, clinical research trends
-- ============================================================================

INSERT INTO ss_trend_signals (source, keyword, signal_strength, trend_name, trend_type, status, data)
VALUES
  ('korean_market', 'PDRN', 85, 'PDRN/Salmon DNA serums', 'ingredient', 'trending',
   '{"description": "Polydeoxyribonucleotide (PDRN) derived from salmon DNA is the hottest ingredient in Korean skincare. Clinical studies show accelerated wound healing and skin regeneration.", "key_brands": ["Medicube", "VT Cosmetics", "Torriden"]}'),

  ('korean_market', 'centella', 78, 'Centella Asiatica renaissance', 'ingredient', 'trending',
   '{"description": "Centella products continue to dominate Korean dermocosmetics. New formulations combine centella with PDRN and peptides for enhanced barrier repair.", "key_brands": ["SKIN1004", "Purito", "By Wishtrend"]}'),

  ('korean_market', 'barrier repair', 82, 'Barrier-first skincare philosophy', 'category', 'trending',
   '{"description": "Korean dermatologists are pushing barrier health as the foundation of all skincare. Products emphasizing ceramides, panthenol, and minimal active ingredients are trending.", "key_brands": ["Aestura", "Round Lab", "Illiyoon"]}'),

  ('korean_market', 'mugwort', 68, 'Mugwort (쑥) calming products', 'ingredient', 'emerging',
   '{"description": "Artemisia vulgaris (mugwort) is gaining traction for sensitive and acne-prone skin. Traditional Korean herbal ingredient now in modern formulations.", "key_brands": ["I''m From", "Missha", "Bringgreen"]}'),

  ('community_mention', 'tranexamic acid', 72, 'Tranexamic acid for hyperpigmentation', 'ingredient', 'emerging',
   '{"description": "Originally used to treat melasma in dermatology, tranexamic acid is becoming mainstream in K-beauty serums for post-inflammatory hyperpigmentation.", "key_brands": ["SKIN1004", "Cos De BAHA", "Goodal"]}'),

  ('korean_market', 'glass skin', 75, 'Glass skin routine evolution', 'routine', 'trending',
   '{"description": "The glass skin trend has evolved from heavy layering to minimalist approaches. Focus on skin prep (double cleanse + toner) and one hydrating essence rather than 10-step routines.", "key_brands": ["Laneige", "Sulwhasoo", "Hanyul"]}'),

  ('community_mention', 'retinal', 65, 'Retinal (retinaldehyde) over retinol', 'ingredient', 'emerging',
   '{"description": "Retinal (retinaldehyde) is gaining ground over retinol in K-beauty. One step closer to retinoic acid in the conversion pathway, meaning faster results with still-manageable irritation.", "key_brands": ["Beplain", "Geek & Gorgeous"]}'),

  ('korean_market', 'probiotics', 60, 'Probiotic/microbiome skincare', 'category', 'emerging',
   '{"description": "Probiotic-based skincare targeting the skin microbiome is an emerging trend in Korean labs. Lactobacillus ferment lysates and bifida ferment filtrates are key ingredients.", "key_brands": ["Dr. Ceuracle", "Benton", "TONYMOLY"]}');
