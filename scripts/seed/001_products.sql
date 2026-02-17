-- ============================================================
-- Seoul Sister K-Beauty Intelligence Platform
-- Seed File 001: Products, Ingredients, Retailers, Conflicts
-- ============================================================
-- Run this after all migrations have been applied.
-- All tables are prefixed with ss_
-- IDs use gen_random_uuid() for portability across environments.
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1: RETAILERS
-- ============================================================

INSERT INTO ss_retailers (id, name, website, country, trust_score, ships_international)
VALUES
  (gen_random_uuid(), 'Olive Young',  'https://www.oliveyoung.co.kr',  'South Korea', 95, true),
  (gen_random_uuid(), 'Soko Glam',    'https://www.sokoglam.com',      'USA',         90, true),
  (gen_random_uuid(), 'YesStyle',     'https://www.yesstyle.com',      'Hong Kong',   85, true),
  (gen_random_uuid(), 'Stylevana',    'https://www.stylevana.com',     'Hong Kong',   82, true),
  (gen_random_uuid(), 'Amazon',       'https://www.amazon.com',        'USA',         70, true),
  (gen_random_uuid(), 'iHerb',        'https://www.iherb.com',         'USA',         80, true);


-- ============================================================
-- SECTION 2: INGREDIENTS
-- 30 key K-beauty actives and functional ingredients
-- safety_rating:     1 (most irritating) to 5 (safest)
-- comedogenic_rating: 0 (non-comedogenic) to 5 (highly comedogenic)
-- ============================================================

-- Use CTEs with named UUIDs so we can reference them in ingredient_conflicts below
WITH ingredient_ids AS (
  SELECT
    gen_random_uuid() AS niacinamide_id,
    gen_random_uuid() AS hyaluronic_acid_id,
    gen_random_uuid() AS centella_id,
    gen_random_uuid() AS snail_id,
    gen_random_uuid() AS propolis_id,
    gen_random_uuid() AS rice_bran_id,
    gen_random_uuid() AS green_tea_id,
    gen_random_uuid() AS mugwort_id,
    gen_random_uuid() AS retinol_id,
    gen_random_uuid() AS salicylic_acid_id,
    gen_random_uuid() AS glycolic_acid_id,
    gen_random_uuid() AS ceramide_id,
    gen_random_uuid() AS squalane_id,
    gen_random_uuid() AS panthenol_id,
    gen_random_uuid() AS allantoin_id,
    gen_random_uuid() AS adenosine_id,
    gen_random_uuid() AS beta_glucan_id,
    gen_random_uuid() AS tranexamic_acid_id,
    gen_random_uuid() AS azelaic_acid_id,
    gen_random_uuid() AS tea_tree_id,
    gen_random_uuid() AS vitamin_c_id,
    gen_random_uuid() AS peptide_id,
    gen_random_uuid() AS arbutin_id,
    gen_random_uuid() AS licorice_id,
    gen_random_uuid() AS galactomyces_id,
    gen_random_uuid() AS bifida_id,
    gen_random_uuid() AS madecassoside_id,
    gen_random_uuid() AS pdrn_id,
    gen_random_uuid() AS bakuchiol_id,
    gen_random_uuid() AS collagen_id
),

-- Insert ingredients and capture their IDs via RETURNING, then reference in conflicts.
-- Because standard SQL CTEs with INSERT...RETURNING work in PostgreSQL, we use that pattern.

inserted_ingredients AS (
  INSERT INTO ss_ingredients (
    id, name_inci, name_ko, function, description,
    safety_rating, comedogenic_rating, is_fragrance, is_active,
    common_concerns
  )
  SELECT * FROM (VALUES

    -- 1. Niacinamide
    ((SELECT niacinamide_id FROM ingredient_ids),
     'Niacinamide',
     '나이아신아마이드',
     'brightening, pore-minimizing, barrier-support',
     'Vitamin B3 derivative that reduces hyperpigmentation, minimizes pore appearance, regulates sebum production, and strengthens the skin barrier. One of the most well-researched and well-tolerated actives in K-beauty.',
     5, 0, false, true,
     ARRAY['hyperpigmentation', 'large pores', 'oily skin', 'uneven skin tone']),

    -- 2. Hyaluronic Acid
    ((SELECT hyaluronic_acid_id FROM ingredient_ids),
     'Sodium Hyaluronate',
     '히알루론산',
     'humectant, hydration',
     'A powerful humectant that holds up to 1000x its weight in water. K-beauty products often use multiple molecular weights (high, medium, low) for surface-to-deep hydration. Low molecular weight penetrates deeper; high molecular weight sits on the surface for a plumping effect.',
     5, 0, false, false,
     ARRAY['dehydration', 'dryness', 'fine lines', 'dull skin']),

    -- 3. Centella Asiatica Extract
    ((SELECT centella_id FROM ingredient_ids),
     'Centella Asiatica Extract',
     '센텔라 아시아티카 추출물',
     'soothing, healing, anti-inflammatory',
     'Derived from the Gotu Kola plant, cica is one of the defining ingredients of K-beauty. Rich in madecassoside, asiaticoside, and asiatic acid. Calms inflammation, accelerates wound healing, strengthens the barrier, and reduces redness. Suitable for the most sensitive skin.',
     5, 0, false, true,
     ARRAY['redness', 'sensitivity', 'acne-prone skin', 'compromised barrier', 'post-procedure recovery']),

    -- 4. Snail Secretion Filtrate
    ((SELECT snail_id FROM ingredient_ids),
     'Snail Secretion Filtrate',
     '달팽이 점액 여과물',
     'healing, moisturizing, anti-aging',
     'Contains a complex mix of glycoproteins, hyaluronic acid, glycolic acid, copper peptides, and antimicrobial peptides. Promotes skin healing, hydration, and collagen synthesis. A cornerstone K-beauty ingredient popularized globally by COSRX.',
     5, 0, false, true,
     ARRAY['acne scars', 'fine lines', 'dryness', 'dullness', 'uneven texture']),

    -- 5. Propolis Extract
    ((SELECT propolis_id FROM ingredient_ids),
     'Propolis Extract',
     '프로폴리스 추출물',
     'antioxidant, antibacterial, soothing',
     'A resinous substance collected by bees with potent antibacterial and antioxidant properties. In K-beauty, typically used as an essence or serum ingredient. Calms acne-prone skin, provides rich hydration, and promotes a healthy skin glow. Particularly popular in Korean ampoules.',
     5, 0, false, true,
     ARRAY['acne', 'dullness', 'antioxidant protection', 'dehydration']),

    -- 6. Rice Bran Extract
    ((SELECT rice_bran_id FROM ingredient_ids),
     'Oryza Sativa (Rice) Bran Extract',
     '쌀겨 추출물',
     'brightening, antioxidant, moisturizing',
     'Rich in ferulic acid, vitamin E, and niacinamide precursors. Long used in traditional Korean beauty rituals (쌀뜨물, rice water). Brightens skin tone, provides antioxidant protection, and delivers gentle exfoliation. Associated with the coveted "porcelain skin" ideal.',
     5, 0, false, false,
     ARRAY['hyperpigmentation', 'dullness', 'uneven skin tone', 'antioxidant protection']),

    -- 7. Green Tea Extract
    ((SELECT green_tea_id FROM ingredient_ids),
     'Camellia Sinensis Leaf Extract',
     '녹차 추출물',
     'antioxidant, soothing, sebum-control',
     'Rich in EGCG (epigallocatechin gallate) and other polyphenols. Provides strong antioxidant protection against UV and environmental damage. Calms inflamed skin, reduces sebum production, and has mild antimicrobial properties. Innisfree built an entire product line around Jeju green tea.',
     5, 0, false, false,
     ARRAY['oily skin', 'antioxidant protection', 'redness', 'acne-prone skin']),

    -- 8. Mugwort Extract
    ((SELECT mugwort_id FROM ingredient_ids),
     'Artemisia Vulgaris Extract',
     '쑥 추출물',
     'soothing, anti-inflammatory, antioxidant',
     'Mugwort (쑥, ssuk) is a traditional Korean medicinal herb. Rich in flavonoids and volatile oils with potent anti-inflammatory and antioxidant properties. Excellent for calming sensitive, reactive skin. COSRX and I''m From popularized mugwort essence globally.',
     5, 0, false, false,
     ARRAY['redness', 'sensitivity', 'eczema-prone skin', 'acne-prone skin']),

    -- 9. Retinol
    ((SELECT retinol_id FROM ingredient_ids),
     'Retinol',
     '레티놀',
     'anti-aging, exfoliating, acne-control',
     'A vitamin A derivative that accelerates cell turnover, stimulates collagen synthesis, and reduces fine lines, wrinkles, and acne. One of the most evidence-backed anti-aging ingredients. Requires careful introduction (start low, go slow). Photosensitizing -- use at night. Avoid during pregnancy.',
     2, 2, false, true,
     ARRAY['fine lines', 'wrinkles', 'acne', 'hyperpigmentation', 'uneven texture']),

    -- 10. Salicylic Acid
    ((SELECT salicylic_acid_id FROM ingredient_ids),
     'Salicylic Acid',
     '살리실산',
     'exfoliating, acne-fighting, pore-clearing',
     'A beta-hydroxy acid (BHA) that is oil-soluble, allowing it to penetrate into pores and dissolve sebum. Exfoliates the skin surface and inside pores, making it highly effective for blackheads, whiteheads, and acne. Anti-inflammatory properties reduce redness around blemishes.',
     3, 0, false, true,
     ARRAY['blackheads', 'whiteheads', 'acne', 'large pores', 'oily skin']),

    -- 11. Glycolic Acid
    ((SELECT glycolic_acid_id FROM ingredient_ids),
     'Glycolic Acid',
     '글리콜산',
     'exfoliating, brightening, anti-aging',
     'The smallest alpha-hydroxy acid (AHA), derived from sugarcane. Deeply exfoliates the skin surface, stimulates collagen production, and improves skin texture and tone. At low concentrations acts as a gentle exfoliant; higher concentrations are more aggressive. Photosensitizing -- use SPF.',
     3, 0, false, true,
     ARRAY['dull skin', 'uneven texture', 'hyperpigmentation', 'fine lines', 'rough skin']),

    -- 12. Ceramide NP
    ((SELECT ceramide_id FROM ingredient_ids),
     'Ceramide NP',
     '세라마이드',
     'barrier-repair, moisturizing',
     'Ceramides are lipids that make up approximately 50% of the skin''s barrier (stratum corneum). Ceramide NP (Non-hydroxy fatty acid/Phytosphingosine) is one of the most common skin-identical ceramides. Restores a compromised barrier, reduces transepidermal water loss (TEWL), and relieves dryness and sensitivity.',
     5, 0, false, false,
     ARRAY['dry skin', 'sensitive skin', 'eczema-prone skin', 'compromised barrier', 'dehydration']),

    -- 13. Squalane
    ((SELECT squalane_id FROM ingredient_ids),
     'Squalane',
     '스쿠알란',
     'emollient, moisturizing, antioxidant',
     'A stable, hydrogenated form of squalene (originally derived from sharks; now predominantly plant-derived from sugarcane or olives). Lightweight, non-greasy oil that mimics the skin''s natural sebum. Excellent emollient and antioxidant. Non-comedogenic and suitable for all skin types.',
     5, 1, false, false,
     ARRAY['dryness', 'dehydration', 'oily skin (in balance)', 'sensitive skin']),

    -- 14. Panthenol
    ((SELECT panthenol_id FROM ingredient_ids),
     'Panthenol',
     '판테놀',
     'soothing, moisturizing, healing',
     'Pro-vitamin B5 that converts to pantothenic acid in the skin. A well-tolerated, gentle humectant and emollient that soothes irritation, promotes wound healing, and restores moisture. Found in countless K-beauty formulations as a supportive ingredient. Very low sensitization potential.',
     5, 0, false, false,
     ARRAY['irritation', 'redness', 'dryness', 'sensitivity', 'compromised barrier']),

    -- 15. Allantoin
    ((SELECT allantoin_id FROM ingredient_ids),
     'Allantoin',
     '알란토인',
     'soothing, healing, keratolytic',
     'Derived from the comfrey plant (or synthesized). Has soothing, anti-irritant, and mild keratolytic properties that soften and condition the skin. Accelerates cell regeneration and wound healing. An extremely well-tolerated ingredient used in sensitive skin formulations across K-beauty.',
     5, 0, false, false,
     ARRAY['redness', 'irritation', 'sensitivity', 'rough skin', 'acne-prone skin']),

    -- 16. Adenosine
    ((SELECT adenosine_id FROM ingredient_ids),
     'Adenosine',
     '아데노신',
     'anti-aging, firming, soothing',
     'A naturally occurring nucleoside with anti-inflammatory and anti-aging properties. Stimulates collagen synthesis, reduces wrinkle depth, and improves skin elasticity. Approved by the Korean Ministry of Food and Drug Safety (MFDS) as a functional anti-wrinkle ingredient. Very commonly found in K-beauty anti-aging products.',
     5, 0, false, true,
     ARRAY['fine lines', 'wrinkles', 'loss of firmness', 'redness']),

    -- 17. Beta-Glucan
    ((SELECT beta_glucan_id FROM ingredient_ids),
     'Beta-Glucan',
     '베타글루칸',
     'soothing, moisturizing, immune-supporting',
     'A polysaccharide derived from yeast, mushrooms, or oats. A powerful humectant often compared to hyaluronic acid in its water-binding capacity, with the added benefit of calming skin inflammation and supporting the skin''s immune response. Excellent for sensitive, reactive, or post-procedure skin.',
     5, 0, false, false,
     ARRAY['sensitivity', 'redness', 'dehydration', 'dryness', 'compromised barrier']),

    -- 18. Tranexamic Acid
    ((SELECT tranexamic_acid_id FROM ingredient_ids),
     'Tranexamic Acid',
     '트라넥삼산',
     'brightening, anti-hyperpigmentation',
     'Originally a pharmaceutical agent, tranexamic acid inhibits the interaction between keratinocytes and melanocytes, reducing melanin synthesis. Effective for melasma, post-inflammatory hyperpigmentation, and sun spots. Well-tolerated even by sensitive skin. Popular in Korean brightening treatments.',
     5, 0, false, true,
     ARRAY['melasma', 'hyperpigmentation', 'dark spots', 'uneven skin tone']),

    -- 19. Azelaic Acid
    ((SELECT azelaic_acid_id FROM ingredient_ids),
     'Azelaic Acid',
     '아젤라산',
     'brightening, acne-fighting, anti-rosacea',
     'A dicarboxylic acid with a triple action: anti-inflammatory (reduces redness and rosacea), antimicrobial (targets acne-causing bacteria), and melanin-inhibiting (fades dark spots). Well-tolerated by sensitive skin and safe for use during pregnancy. Often used in Korean spot treatments and brightening serums.',
     4, 0, false, true,
     ARRAY['rosacea', 'acne', 'hyperpigmentation', 'redness', 'uneven skin tone']),

    -- 20. Tea Tree Oil
    ((SELECT tea_tree_id FROM ingredient_ids),
     'Melaleuca Alternifolia (Tea Tree) Leaf Oil',
     '티트리 오일',
     'antimicrobial, acne-fighting, purifying',
     'An essential oil with well-established antimicrobial and anti-inflammatory properties. Effective against acne-causing bacteria (C. acnes). Commonly used in spot treatments and cleansers. Can be irritating at high concentrations; K-beauty typically formulates at lower, gentler levels (1-5%).',
     3, 1, true, true,
     ARRAY['acne', 'blemishes', 'oily skin', 'blackheads']),

    -- 21. Vitamin C (Ascorbic Acid)
    ((SELECT vitamin_c_id FROM ingredient_ids),
     'Ascorbic Acid',
     '비타민 C',
     'brightening, antioxidant, collagen-synthesis',
     'The gold standard antioxidant and brightening ingredient. Inhibits tyrosinase (reducing melanin production), neutralizes free radicals, and stimulates collagen synthesis. Unstable at high pH and in oxidizing conditions -- K-beauty innovates heavily in stable vitamin C derivatives (ascorbyl glucoside, ethyl ascorbic acid). Pure L-ascorbic acid requires low pH formulations.',
     3, 0, false, true,
     ARRAY['hyperpigmentation', 'dullness', 'uneven skin tone', 'fine lines', 'antioxidant protection']),

    -- 22. Peptides (Palmitoyl Pentapeptide-4)
    ((SELECT peptide_id FROM ingredient_ids),
     'Palmitoyl Pentapeptide-4',
     '팔미토일 펜타펩타이드',
     'anti-aging, collagen-stimulating, firming',
     'Also known as Matrixyl. A fatty acid chain joined to five amino acids that signal the skin to produce more collagen, elastin, and hyaluronic acid. A cornerstone anti-aging active in K-beauty serums and creams. Well-tolerated by all skin types with no sensitization risk.',
     5, 0, false, true,
     ARRAY['fine lines', 'wrinkles', 'loss of firmness', 'anti-aging']),

    -- 23. Arbutin
    ((SELECT arbutin_id FROM ingredient_ids),
     'Alpha-Arbutin',
     '알부틴',
     'brightening, anti-hyperpigmentation',
     'A glycosylated hydroquinone derivative that inhibits tyrosinase without the irritation or risk of hydroquinone. Alpha-arbutin is the more stable and potent form versus beta-arbutin. Effective for fading dark spots and achieving an even skin tone. A mainstay of Korean brightening essences and serums.',
     5, 0, false, true,
     ARRAY['hyperpigmentation', 'dark spots', 'uneven skin tone', 'melasma']),

    -- 24. Licorice Root Extract
    ((SELECT licorice_id FROM ingredient_ids),
     'Glycyrrhiza Glabra (Licorice) Root Extract',
     '감초 뿌리 추출물',
     'brightening, anti-inflammatory, antioxidant',
     'Contains glabridin and liquirtin, which inhibit tyrosinase and disperse melanin. Also has anti-inflammatory and antioxidant properties. A gentler alternative to hydroquinone for brightening. Well-tolerated by sensitive skin. Commonly paired with niacinamide and vitamin C in Korean brightening formulas.',
     5, 0, false, false,
     ARRAY['hyperpigmentation', 'dark spots', 'redness', 'dullness']),

    -- 25. Galactomyces Ferment Filtrate
    ((SELECT galactomyces_id FROM ingredient_ids),
     'Galactomyces Ferment Filtrate',
     '갈락토미세스 발효 여과물',
     'brightening, pore-minimizing, hydrating',
     'A yeast-derived ferment (a byproduct of sake fermentation) rich in vitamins, amino acids, and minerals. Brightens skin, minimizes pores, and improves overall skin texture. One of the most iconic K-beauty ingredients, found in the famous SK-II Facial Treatment Essence and widely adopted in Korean brands.',
     5, 0, false, true,
     ARRAY['dullness', 'large pores', 'uneven texture', 'dehydration']),

    -- 26. Bifida Ferment Lysate
    ((SELECT bifida_id FROM ingredient_ids),
     'Bifida Ferment Lysate',
     '비피다 발효 여과물',
     'barrier-repair, anti-aging, probiotic',
     'A probiotic-derived ferment from Bifida bacteria. Strengthens the skin''s microbiome and barrier function, reduces transepidermal water loss, and has anti-aging benefits. Very well-tolerated. Associated with the "skin microbiome" trend in K-beauty. Featured prominently in Lancôme Génifique and many Korean serums.',
     5, 0, false, true,
     ARRAY['sensitive skin', 'compromised barrier', 'aging skin', 'redness']),

    -- 27. Madecassoside
    ((SELECT madecassoside_id FROM ingredient_ids),
     'Madecassoside',
     '마데카소사이드',
     'soothing, healing, anti-inflammatory',
     'A purified triterpene saponin extracted from Centella Asiatica. The most potent and isolated form of cica''s active components. Accelerates wound healing, reduces inflammation, and strengthens the dermal matrix. Often used in post-procedure skincare and sensitive skin formulations at higher purities than raw centella extract.',
     5, 0, false, true,
     ARRAY['redness', 'sensitivity', 'acne', 'post-procedure recovery', 'compromised barrier']),

    -- 28. PDRN (Polydeoxyribonucleotide)
    ((SELECT pdrn_id FROM ingredient_ids),
     'Polydeoxyribonucleotide',
     'PDRN (폴리데옥시리보뉴클레오타이드)',
     'regenerating, healing, anti-aging',
     'Extracted from salmon or trout sperm DNA. Originally used in medical aesthetics for wound healing and skin rejuvenation (sold as Placentex injections). Topical PDRN stimulates tissue regeneration, activates purinergic receptors to promote fibroblast proliferation, and significantly improves skin elasticity. A major 2024-2025 trend in Korean dermatology and skincare.',
     5, 0, false, true,
     ARRAY['aging skin', 'fine lines', 'loss of firmness', 'skin regeneration', 'acne scars']),

    -- 29. Bakuchiol
    ((SELECT bakuchiol_id FROM ingredient_ids),
     'Bakuchiol',
     '바쿠치올',
     'anti-aging, brightening, retinol-alternative',
     'A meroterpene derived from the seeds of Psoralea corylifolia (babchi plant). Functions similarly to retinol by upregulating type I, III, and IV collagen and reducing MMP expression, but without the irritation. Safe for use during pregnancy. An increasingly popular K-beauty ingredient for those who cannot tolerate retinol.',
     5, 1, false, true,
     ARRAY['fine lines', 'wrinkles', 'hyperpigmentation', 'sensitive skin', 'pregnancy-safe anti-aging']),

    -- 30. Collagen (Hydrolyzed)
    ((SELECT collagen_id FROM ingredient_ids),
     'Hydrolyzed Collagen',
     '가수분해 콜라겐',
     'moisturizing, film-forming, anti-aging (topical)',
     'Protein hydrolysate of collagen broken into smaller peptide fragments. Topically, hydrolyzed collagen acts as a humectant and forms a moisture-retaining film on the skin surface. Collagen molecules are too large to penetrate the skin, but hydrolyzed fragments and tripeptides may offer modest penetration. A beloved K-beauty marketing and formulation ingredient.',
     5, 0, false, false,
     ARRAY['dryness', 'fine lines', 'loss of firmness', 'dehydration'])

  ) AS v(id, name_inci, name_ko, function, description,
          safety_rating, comedogenic_rating, is_fragrance, is_active,
          common_concerns)
  RETURNING id, name_inci
)

-- Capture returned IDs for use in conflicts section below
-- (Stored temporarily via a view-like approach in the same transaction)
SELECT id, name_inci INTO TEMPORARY TABLE temp_ingredient_ids FROM inserted_ingredients;


-- ============================================================
-- SECTION 3: INGREDIENT CONFLICTS
-- 5 well-known ingredient interaction warnings
-- severity: 'low' | 'medium' | 'high'
-- ============================================================

INSERT INTO ss_ingredient_conflicts (
  id,
  ingredient_a_id,
  ingredient_b_id,
  severity,
  description,
  recommendation
)
VALUES

  -- Conflict 1: Retinol + AHA (Glycolic Acid) -- HIGH
  (gen_random_uuid(),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Retinol'),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Glycolic Acid'),
   'high',
   'Using retinol and AHAs (like glycolic acid) together significantly increases risk of irritation, redness, peeling, and a compromised skin barrier. Both are potent exfoliants/actives -- layering them can cause over-exfoliation and photosensitivity.',
   'Use on alternate nights (skin cycling: retinol night, then AHA night, then recovery nights). Never apply both in the same routine. Always apply SPF the following morning.'),

  -- Conflict 2: Retinol + BHA (Salicylic Acid) -- MEDIUM
  (gen_random_uuid(),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Retinol'),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Salicylic Acid'),
   'medium',
   'Combining retinol and salicylic acid (BHA) in the same routine can lead to over-exfoliation, especially for sensitive or dry skin types. Salicylic acid''s low pH may also reduce retinol''s effectiveness. The combination is more tolerable than retinol + AHA but still warrants caution.',
   'Alternate use: apply salicylic acid in the AM (if needed) and retinol PM, or use on different nights. If your skin is not sensitive, some users tolerate layering with a buffer moisturizer in between. Monitor for irritation.'),

  -- Conflict 3: Retinol + Vitamin C (Ascorbic Acid) -- MEDIUM
  (gen_random_uuid(),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Retinol'),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Ascorbic Acid'),
   'medium',
   'Pure L-ascorbic acid (vitamin C) requires an acidic pH (around 3.5) to remain stable and effective, while retinol works optimally at a higher pH. Using them together in the same step may render one or both ingredients less effective. Additionally, combining two potent actives can increase irritation risk for sensitive skin.',
   'Use vitamin C in the AM (where its antioxidant benefits pair perfectly with SPF) and retinol in the PM. This also avoids the photosensitizing effect of retinol during daytime.'),

  -- Conflict 4: AHA + Vitamin C -- LOW
  (gen_random_uuid(),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Glycolic Acid'),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Ascorbic Acid'),
   'low',
   'Both AHAs and vitamin C (L-ascorbic acid) are acidic and work at low pH. While they are not chemically incompatible, layering both in the same routine can be unnecessarily irritating for sensitive skin types. Some formulations intentionally combine them, but higher-strength versions of each should not be stacked.',
   'If you use both, apply vitamin C first (it needs the lowest pH), then wait a few minutes before applying the AHA. For sensitive skin, use on alternate days. Most people tolerate this combination well at moderate concentrations.'),

  -- Conflict 5: Niacinamide + Vitamin C -- LOW (largely debunked)
  (gen_random_uuid(),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Niacinamide'),
   (SELECT id FROM temp_ingredient_ids WHERE name_inci = 'Ascorbic Acid'),
   'low',
   'An old theory suggested that niacinamide and vitamin C react to form niacin (nicotinic acid), which causes skin flushing. Modern research shows this reaction requires temperatures far exceeding those present on human skin and takes far longer than any skincare routine. The combination is generally considered safe and even synergistic for brightening. However, users who experience flushing should separate them as a precaution.',
   'This conflict is largely debunked and most users can safely layer niacinamide and vitamin C. If you experience flushing or irritation, try applying vitamin C in the AM and niacinamide PM. Choose a stable vitamin C derivative (e.g., ascorbyl glucoside) to eliminate any theoretical concern.');


-- ============================================================
-- SECTION 4: PRODUCTS
-- 55 real K-beauty products across all major categories
-- ============================================================

INSERT INTO ss_products (
  id, name_en, name_ko, brand_en, category, description_en,
  price_krw, price_usd, volume_ml, volume_display,
  is_verified, rating_avg, review_count
)
VALUES

  -- ==================
  -- COSRX (7 products)
  -- ==================
  (gen_random_uuid(),
   'Advanced Snail 96 Mucin Power Essence',
   '어드밴스드 스네일 96 뮤신 파워 에센스',
   'COSRX', 'essence',
   'A cult-favorite lightweight essence formulated with 96% snail secretion filtrate. Deeply hydrates, accelerates skin healing, fades acne scars, and improves overall skin texture without feeling sticky. Suitable for all skin types. One of the bestselling K-beauty products globally.',
   18000, 25.00, 100, '100ml', true, 4.8, 4800),

  (gen_random_uuid(),
   'Low pH Good Morning Gel Cleanser',
   '로우 pH 굿 모닝 젤 클렌저',
   'COSRX', 'cleanser',
   'A low pH (5.0-6.0) gel cleanser that maintains the skin''s natural acid mantle while gently removing impurities and excess sebum. Contains tea tree oil and betaine salicylate for mild exfoliation. The gold standard for pH-balanced morning cleansing in the Korean skincare community.',
   9000, 12.00, 150, '150ml', true, 4.7, 3600),

  (gen_random_uuid(),
   'AHA/BHA Clarifying Treatment Toner',
   'AHA/BHA 클래리파잉 트리트먼트 토너',
   'COSRX', 'toner',
   'A chemical exfoliating toner combining AHA (glycolic and lactic acid) and BHA (betaine salicylate) to resurface the skin, minimize pores, and improve skin texture. Gentle enough for regular use. Contains niacinamide for brightening and barrier support.',
   14000, 18.00, 150, '150ml', true, 4.5, 1200),

  (gen_random_uuid(),
   'Advanced Snail 92 All in One Cream',
   '어드밴스드 스네일 92 올인원 크림',
   'COSRX', 'moisturizer',
   'A multitasking cream formulated with 92% snail secretion filtrate. Combines hydration, healing, and anti-aging benefits in one product. Lightweight texture suitable for all skin types. Perfect for minimalist routines or as a finishing moisturizer.',
   15000, 20.00, NULL, '100g', true, 4.7, 2900),

  (gen_random_uuid(),
   'BHA Blackhead Power Liquid',
   'BHA 블랙헤드 파워 리퀴드',
   'COSRX', 'exfoliator',
   'A leave-on BHA exfoliator formulated with 4% betaine salicylate (a gentler, pH-adjusted form of salicylic acid). Penetrates pores to dissolve blackheads and whiteheads. Dramatically improves pore congestion with consistent use. One of the bestselling K-beauty exfoliants worldwide.',
   14000, 19.00, 100, '100ml', true, 4.6, 2800),

  -- ==================
  -- Innisfree (3 products)
  -- ==================
  (gen_random_uuid(),
   'Green Tea Seed Serum',
   '그린티 씨드 세럼',
   'Innisfree', 'serum',
   'An iconic Innisfree serum powered by Jeju green tea seed extract and green tea water. Delivers multiple layers of hydration while providing antioxidant protection. Known for its lightweight, non-sticky texture and fresh green tea scent. A staple in Korean hydrating routines.',
   28000, 35.00, 80, '80ml', true, 4.5, 2200),

  (gen_random_uuid(),
   'Jeju Volcanic Pore Cleansing Foam',
   '제주 화산송이 모공 클렌징 폼',
   'Innisfree', 'cleanser',
   'A classic pore-purifying foam cleanser infused with Jeju volcanic clusters that absorb excess sebum and impurities deep within pores. Creates a dense, creamy lather that leaves skin feeling thoroughly clean without over-drying. Beloved by oily and combination skin types.',
   8500, 11.00, 150, '150ml', true, 4.4, 1900),

  (gen_random_uuid(),
   'Daily UV Protection Cream SPF35 PA++',
   '데일리 UV 프로텍션 크림 SPF35 PA++',
   'Innisfree', 'sunscreen',
   'A lightweight daily moisturizer and sun protector combining SPF35 PA++ protection with green tea and hyaluronic acid hydration. A great entry-level Korean sunscreen for everyday use. Non-greasy and suitable for layering under makeup.',
   15000, 18.00, 50, '50ml', true, 4.3, 850),

  -- ==================
  -- Laneige (3 products)
  -- ==================
  (gen_random_uuid(),
   'Water Sleeping Mask',
   '워터 슬리핑 마스크',
   'Laneige', 'mask',
   'The iconic overnight gel mask that delivers intensive hydration while you sleep using Laneige''s WATER-SLEEPING technology. Formulated with Moisture Wrap (amino acids + evening primrose extract) and Squalane. Wakes up to baby-soft, plump, glowing skin. One of the bestselling Korean overnight masks globally.',
   32000, 29.00, NULL, '70g', true, 4.7, 5000),

  (gen_random_uuid(),
   'Lip Sleeping Mask',
   '립 슬리핑 마스크',
   'Laneige', 'lip_care',
   'A cult-status overnight lip treatment formulated with murumuru and shea butters, vitamin C, and antioxidant berry extracts. Deeply nourishes and repairs dry, chapped lips overnight. Available in multiple scents and tints. One of the most popular lip products in Korean and global beauty.',
   17000, 24.00, NULL, '20g', true, 4.8, 4500),

  (gen_random_uuid(),
   'Cream Skin Toner & Moisturizer',
   '크림 스킨 토너 앤 모이스처라이저',
   'Laneige', 'toner',
   'A hybrid toner-moisturizer that blurs the line between steps. Formulated with white leaf tea water and a blend of amino acids. Delivers a burst of creamy hydration in toner form that eliminates the need for a separate moisturizer in warmer months. Perfect for dewy, glass-skin application with the layering patting method.',
   38000, 33.00, 150, '150ml', true, 4.6, 1600),

  -- ==================
  -- Sulwhasoo (2 products)
  -- ==================
  (gen_random_uuid(),
   'First Care Activating Serum VI',
   '퍼스트 케어 액티베이팅 세럼 VI',
   'Sulwhasoo', 'essence',
   'Sulwhasoo''s hero product -- a first-step essence formulated with the brand''s exclusive JAUM Activator complex (Korean medicinal herb blend: rehmannia, scrophularia, cnidium, Solomon''s seal, and white peony). Prepares skin to better absorb subsequent products. Associated with the "chok chok" dewy skin ideal. A luxury K-beauty staple.',
   130000, 99.00, 90, '90ml', true, 4.7, 1800),

  (gen_random_uuid(),
   'Concentrated Ginseng Renewing Cream',
   '자음생 크림',
   'Sulwhasoo', 'moisturizer',
   'A luxurious anti-aging cream formulated with Korean red ginseng and the brand''s Ginsenomics technology that extracts active ginsenosides. Firms, lifts, and deeply nourishes mature skin. The epitome of Korean hanbang (한방, herbal) beauty in a modern cream format.',
   280000, 205.00, NULL, '60g', true, 4.6, 920),

  -- ==================
  -- Missha (2 products)
  -- ==================
  (gen_random_uuid(),
   'Time Revolution The First Treatment Essence RX',
   '타임 레볼루션 더 퍼스트 트리트먼트 에센스 RX',
   'Missha', 'essence',
   'A landmark K-beauty product that pioneered the affordable alternative to SK-II''s Facial Treatment Essence. Formulated with 80% Saccharomyces ferment filtrate (similar to galactomyces). Brightens, refines pores, and delivers intensive anti-aging hydration. Iconic in the K-beauty dupe community.',
   52000, 47.00, 150, '150ml', true, 4.6, 2400),

  (gen_random_uuid(),
   'M Perfect Cover BB Cream SPF42 PA+++',
   'M 퍼펙트 커버 BB 크림 SPF42 PA+++',
   'Missha', 'sunscreen',
   'One of the original Korean BB creams that sparked the global BB cream trend. Provides buildable medium coverage with SPF42 PA+++ sun protection, skincare benefits, and a natural satin finish. Available in multiple shades. A staple in Korean daily makeup routines.',
   12000, 9.00, 50, '50ml', true, 4.4, 3200),

  -- ==================
  -- Klairs (3 products)
  -- ==================
  (gen_random_uuid(),
   'Supple Preparation Unscented Toner',
   '서플 프레퍼레이션 언센티드 토너',
   'Klairs', 'toner',
   'A gentle, hydrating toner formulated without fragrance, alcohol, essential oils, or irritants. Enriched with sodium hyaluronate, beta-glucan, and centella asiatica. Perfect for sensitive skin and as a first step in a layered hydration routine. A top recommendation for beginners to Korean skincare.',
   18000, 22.00, 180, '180ml', true, 4.7, 2800),

  (gen_random_uuid(),
   'Freshly Juiced Vitamin Drop',
   '프레쉴리 쥬스드 비타민 드롭',
   'Klairs', 'serum',
   'A beginner-friendly vitamin C serum formulated with 5% ascorbic acid -- a low enough concentration to minimize irritation while still delivering brightening and antioxidant benefits. Water-based texture that layers easily. An excellent entry point for those new to vitamin C serums.',
   22000, 22.00, 35, '35ml', true, 4.4, 1500),

  (gen_random_uuid(),
   'Midnight Blue Calming Cream',
   '미드나잇 블루 카밍 크림',
   'Klairs', 'moisturizer',
   'A soothing moisturizer with a distinctive blue color from guaiazulene (derived from chamomile). Formulated with centella asiatica, beta-glucan, and allantoin to calm irritated, red, and sensitized skin. Originally developed for post-laser and post-procedure care. A go-to for acne-prone and reactive skin.',
   22000, 24.00, NULL, '60g', true, 4.6, 1900),

  -- ==================
  -- Some By Mi (2 products)
  -- ==================
  (gen_random_uuid(),
   'AHA BHA PHA 30 Days Miracle Toner',
   'AHA BHA PHA 30 데이즈 미라클 토너',
   'Some By Mi', 'toner',
   'A triple-acid exfoliating toner that combines AHA (glycolic acid), BHA (salicylic acid), and PHA (gluconolactone) with tea tree oil and niacinamide. Designed to be used in a 30-day skin transformation routine. Highly popular for acne-prone skin -- delivers visible texture and clarity improvements.',
   14000, 15.00, 150, '150ml', true, 4.5, 2600),

  (gen_random_uuid(),
   'Truecica Mineral 100 Calming Suncream SPF50+ PA++++',
   '트루시카 미네랄 100 카밍 선크림',
   'Some By Mi', 'sunscreen',
   'A mineral (physical) sunscreen formulated with 100% mineral UV filters (zinc oxide + titanium dioxide) suitable for even the most reactive and acne-prone skin. Enriched with centella asiatica and truecica complex for a soothing, calming effect. Does not leave significant white cast on fair-medium skin tones.',
   18000, 19.00, 50, '50ml', true, 4.3, 980),

  -- ==================
  -- Etude House (2 products)
  -- ==================
  (gen_random_uuid(),
   'SoonJung pH 5.5 Relief Toner',
   '순정 pH 5.5 릴리프 토너',
   'Etude House', 'toner',
   'A soothing, pH-balanced (5.5) toner formulated with panthenol (3%) and madecassoside. Free of irritants including fragrance, colorants, alcohol, and parabens. Designed for damaged, sensitive, or compromised skin. Excellent as a calming first layer in any routine.',
   15000, 16.00, 180, '180ml', true, 4.6, 1700),

  (gen_random_uuid(),
   'SoonJung 2x Barrier Intensive Cream',
   '순정 2x 배리어 인텐시브 크림',
   'Etude House', 'moisturizer',
   'A gentle, fragrance-free barrier repair cream from the SoonJung line. Contains panthenol, madecassoside, and beta-glucan to restore a weakened skin barrier and lock in moisture. Lightweight gel-cream texture suitable for oily to combination sensitive skin. Beloved by minimalist and sensitive skin communities.',
   18000, 20.00, NULL, '60g', true, 4.6, 1400),

  -- ==================
  -- Purito (2 products)
  -- ==================
  (gen_random_uuid(),
   'Centella Green Level Unscented Sun SPF50+ PA++++',
   '센텔라 그린 레벨 언센티드 선 SPF50+ PA++++',
   'Purito', 'sunscreen',
   'One of the most recommended K-beauty sunscreens for sensitive skin. Chemical UV filter formula (Uvinul A Plus + Uvinul T 150 + Tinosorb S) with 0% fragrance and a lightweight, watery finish. Centella asiatica complex provides calming and anti-inflammatory benefits. Dermatologist-tested.',
   15000, 17.00, 60, '60ml', true, 4.6, 3200),

  (gen_random_uuid(),
   'From Green Cleansing Oil',
   '프롬 그린 클렌징 오일',
   'Purito', 'cleanser',
   'A gentle yet effective cleansing oil for the first step of a double cleanse. Formulated with lightweight plant oils (safflower, macadamia, jojoba) that emulsify with water without leaving a greasy residue. Removes sunscreen, light makeup, and sebum efficiently. Fragrance-free for sensitive skin.',
   17000, 18.00, 200, '200ml', true, 4.5, 880),

  -- ==================
  -- Beauty of Joseon (3 products)
  -- ==================
  (gen_random_uuid(),
   'Glow Serum: Propolis + Niacinamide',
   '글로우 세럼: 프로폴리스 + 나이아신아마이드',
   'Beauty of Joseon', 'serum',
   'A lightweight brightening serum combining 63.7% propolis extract with 2% niacinamide. Deeply hydrates, brightens uneven skin tone, and delivers antioxidant protection. One of the most well-rated K-beauty serums for its ingredient quality at the price point. A cult-favorite for all skin types.',
   17000, 18.00, 30, '30ml', true, 4.8, 4200),

  (gen_random_uuid(),
   'Dynasty Cream',
   '한율 자음윤크림',
   'Beauty of Joseon', 'moisturizer',
   'A rich yet non-greasy cream inspired by traditional Korean hanbang skincare. Formulated with rice bran water, niacinamide, and orchid extract. Brightens, hydrates, and adds a luminous finish that captures the "golden ratio skin" ideal. Rapidly gained global cult status for its glass-skin effect.',
   16000, 17.00, NULL, '50g', true, 4.7, 3100),

  (gen_random_uuid(),
   'Relief Sun: Rice + Probiotics SPF50+ PA++++',
   '릴리프 선: 라이스 + 프로바이오틱스 SPF50+ PA++++',
   'Beauty of Joseon', 'sunscreen',
   'A beloved chemical sunscreen formulated with rice bran extract and probiotics alongside SPF50+ PA++++ protection. Has a milky, moisturizing texture with a natural finish suitable for all skin tones. One of the most recommended Korean sunscreens globally for its elegant texture and zero white cast.',
   17000, 18.00, 50, '50ml', true, 4.8, 5000),

  -- ==================
  -- Anua (2 products)
  -- ==================
  (gen_random_uuid(),
   'Heartleaf 77% Soothing Toner',
   '어성초 77% 수딩 토너',
   'Anua', 'toner',
   'A soothing toner formulated with 77% heartleaf (Houttuynia cordata, 어성초) extract -- a traditional Korean herb with potent antibacterial and anti-inflammatory properties. Also contains niacinamide and hyaluronic acid. Minimizes redness, calms breakouts, and hydrates irritated skin. A breakout star in Korean skincare.',
   18000, 19.00, 250, '250ml', true, 4.7, 3800),

  (gen_random_uuid(),
   'Heartleaf Pore Control Cleansing Oil',
   '어성초 모공 클렌징 오일',
   'Anua', 'cleanser',
   'A pore-focused cleansing oil with heartleaf extract that effectively breaks down sebum plugs, sunscreen, and makeup. Has an innovative lightweight texture that rinses cleanly without leaving a residue. Suitable for oily and acne-prone skin. A highly-rated Korean double cleanse first step.',
   19000, 20.00, 200, '200ml', true, 4.6, 1700),

  -- ==================
  -- Isntree (2 products)
  -- ==================
  (gen_random_uuid(),
   'Hyaluronic Acid Toner',
   '히알루론산 토너',
   'Isntree', 'toner',
   'A hydration-focused toner formulated with 6 types of hyaluronic acid at varying molecular weights (high, medium, low, acetyl, sodium, and crosspolymer) to deliver multi-depth hydration. Provides intense yet lightweight moisture without any heaviness. A cornerstone Korean hydrating toner for all skin types.',
   19000, 20.00, 200, '200ml', true, 4.6, 1800),

  (gen_random_uuid(),
   'Green Tea Fresh Emulsion',
   '그린티 프레시 에멀젼',
   'Isntree', 'moisturizer',
   'A lightweight emulsion powered by fresh green tea extract and a blend of fermented ingredients. Provides balanced hydration without heaviness -- perfect for humid climates or oily skin types that find traditional creams too rich. Absorbs quickly and leaves a refreshing, dewy finish.',
   22000, 22.00, 150, '150ml', true, 4.4, 720),

  -- ==================
  -- Torriden (2 products)
  -- ==================
  (gen_random_uuid(),
   'DIVE-IN Low Molecular Hyaluronic Acid Serum',
   '다이브인 로우 몰레큘러 히알루론산 세럼',
   'Torriden', 'serum',
   'A bestselling Korean hydrating serum formulated with 5 types of low-molecular hyaluronic acid that penetrate deeper skin layers for intense, lasting hydration. Also contains niacinamide and madecassoside. Fragrance-free and suitable for all skin types including sensitive. One of the highest-rated Korean serums for dehydrated skin.',
   19000, 20.00, 50, '50ml', true, 4.7, 3600),

  (gen_random_uuid(),
   'DIVE-IN Cleansing Foam',
   '다이브인 클렌징 폼',
   'Torriden', 'cleanser',
   'A gentle pH-balanced second cleanse foam that complements the DIVE-IN hydrating line. Low-irritant formula with hyaluronic acid to maintain moisture levels after cleansing. Creates a soft, cushiony lather that cleanses without stripping the skin''s natural oils.',
   13000, 14.00, 150, '150ml', true, 4.5, 940),

  -- ==================
  -- Skin1004 (2 products)
  -- ==================
  (gen_random_uuid(),
   'Madagascar Centella Ampoule',
   '마다가스카르 센텔라 암풀',
   'Skin1004', 'ampoule',
   'A high-concentration centella asiatica ampoule formulated with centella asiatica water as its base (rather than plain water). Contains madecassoside, asiaticoside, and asiatic acid for powerful soothing, healing, and anti-inflammatory benefits. Fragrance-free and minimal ingredient list. An outstanding value for the cica category.',
   15000, 14.00, 100, '100ml', true, 4.7, 4100),

  (gen_random_uuid(),
   'Centella Light Cleansing Oil',
   '센텔라 라이트 클렌징 오일',
   'Skin1004', 'cleanser',
   'A featherlight cleansing oil based on centella asiatica water and lightweight mineral oil. Gently but effectively removes sunscreen and makeup. Rinses away completely without a greasy film. A gentle, calming first-cleanse option for sensitive and acne-prone skin types.',
   17000, 15.00, 200, '200ml', true, 4.5, 1100),

  -- ==================
  -- Round Lab (2 products)
  -- ==================
  (gen_random_uuid(),
   'Dokdo Toner',
   '독도 토너',
   'Round Lab', 'toner',
   'Named after the Korean island of Dokdo, this toner is formulated with Dokdo deep sea water rich in minerals. Delivers multi-layered hydration, strengthens the skin barrier, and refines skin texture. Minimalist formula with hyaluronic acid and ceramide. A beloved choice for dry and sensitive skin in the Korean community.',
   15000, 16.00, 500, '500ml', true, 4.5, 1300),

  (gen_random_uuid(),
   'Birch Juice Moisturizing Cream',
   '자작나무 수분 크림',
   'Round Lab', 'moisturizer',
   'A hydrating cream formulated with birch tree sap (자작나무 수액) as the base liquid instead of plain water. Rich in amino acids, minerals, and antioxidants from the sap. Provides deep, long-lasting hydration suitable for dry and combination skin. The lightweight gel-cream texture is ideal for layering.',
   18000, 19.00, NULL, '80g', true, 4.4, 820),

  -- ==================
  -- Dr. Jart+ (2 products)
  -- ==================
  (gen_random_uuid(),
   'Ceramidin Cream',
   '세라마이딘 크림',
   'Dr. Jart+', 'moisturizer',
   'A heavyweight barrier-repair cream formulated with a 5-ceramide complex and panthenol. Designed to rebuild a compromised skin barrier, lock in moisture, and soothe dry and eczema-prone skin. Rich, nourishing texture ideal for dry skin or as an occlusive final step in colder months. A dermatologist-developed cult product.',
   38000, 48.00, NULL, '50g', true, 4.7, 2100),

  (gen_random_uuid(),
   'Cicapair Tiger Grass Cream',
   '시카페어 타이거 그래스 크림',
   'Dr. Jart+', 'moisturizer',
   'A color-correcting, redness-neutralizing moisturizer formulated with centella asiatica (tiger grass), which earned the "cicapair" branding. The green-tinted cream visually cancels redness while delivering centella''s proven anti-inflammatory benefits. A breakthrough product that brought cica to mainstream Western beauty.',
   52000, 52.00, NULL, '50g', true, 4.5, 2900),

  -- ==================
  -- Banila Co (1 product)
  -- ==================
  (gen_random_uuid(),
   'Clean It Zero Cleansing Balm Original',
   '클린 잇 제로 클렌징 밤 오리지널',
   'Banila Co', 'cleanser',
   'The original Korean cleansing balm that popularized the cleansing balm format globally. A solid balm that transforms into a silky oil on contact with skin, melting away even waterproof makeup and SPF. Emulsifies with water for a clean rinse. The benchmark by which all Korean cleansing balms are measured.',
   18000, 20.00, NULL, '100g', true, 4.7, 4600),

  -- ==================
  -- Numbuzin (2 products)
  -- ==================
  (gen_random_uuid(),
   'No.3 Skin Softening Serum',
   '넘버즈인 3번 세럼',
   'Numbuzin', 'serum',
   'A brightening serum formulated with galactomyces ferment filtrate (73.88%), niacinamide, and a vitamin complex. Refines pores, brightens dullness, and provides an overall skin clarity improvement. Has a watery essence-like texture that absorbs without residue. A rising star in the K-beauty brightening category.',
   28000, 28.00, 50, '50ml', true, 4.6, 1600),

  (gen_random_uuid(),
   'No.5 Vitamin Niacinamide Concentrated Serum',
   '넘버즈인 5번 비타민 나이아신아마이드 컨센트레이트 세럼',
   'Numbuzin', 'serum',
   'A concentrated brightening serum combining niacinamide (10%), 3 forms of vitamin C derivatives, and 9 vitamin complexes. Targets hyperpigmentation, uneven skin tone, and dullness. More potent than No.3 -- designed for those who want maximum brightening power without pure ascorbic acid irritation.',
   35000, 34.00, 30, '30ml', true, 4.5, 980),

  -- ==================
  -- I'm From (2 products)
  -- ==================
  (gen_random_uuid(),
   'Mugwort Essence',
   '아임프롬 쑥 에센스',
   'I''m From', 'essence',
   'A soothing essence formulated with 100% mugwort (쑥) extract as the base, not water. Contains 68.1% mugwort complex and zero alcohol. Calms sensitive, reactive, and acne-prone skin with powerful anti-inflammatory and antioxidant benefits. A defining product of the mugwort-in-K-beauty trend.',
   34000, 36.00, 75, '75ml', true, 4.7, 1900),

  (gen_random_uuid(),
   'Rice Toner',
   '아임프롬 라이스 토너',
   'I''m From', 'toner',
   'A clarifying toner formulated with 77.78% rice bran extract from Hwangdo rice. Brightens skin tone, gently exfoliates with naturally occurring AHAs, and smooths rough texture. Has a unique slightly thick, serum-like consistency despite being a toner. A top performer in the Korean brightening toner category.',
   33000, 35.00, 150, '150ml', true, 4.6, 2300),

  -- ==================
  -- d'Alba (1 product)
  -- ==================
  (gen_random_uuid(),
   'White Truffle First Spray Serum',
   '달바 화이트 트러플 퍼스트 스프레이 세럼',
   'd''Alba', 'serum',
   'An innovative spray-format serum that delivers a fine mist of white truffle extract, hyaluronic acid, and niacinamide directly to the skin. Provides hydration, brightening, and a dewy refresh in seconds. Can be used over makeup as a setting and hydration spray. A unique format that highlights Korean skincare innovation.',
   42000, 42.00, 100, '100ml', true, 4.5, 1200),

  -- ==================
  -- ONE THING (1 product)
  -- ==================
  (gen_random_uuid(),
   'Centella Asiatica Extract',
   '원씽 병풀 추출물',
   'ONE THING', 'essence',
   'A single-ingredient 100% centella asiatica extract in a convenient dropper bottle. Exemplifies the Korean skincare philosophy of ingredient transparency. Can be used as a concentrated booster mixed into other products or applied directly to troubled spots. A minimalist''s dream for sensitive skin care.',
   12000, 12.00, 150, '150ml', true, 4.6, 2800),

  -- ==================
  -- Skin1004 (additional) / other brands fill to 55 total
  -- ==================

  -- ==================
  -- COSRX (2 additional)
  -- ==================
  (gen_random_uuid(),
   'Propolis Light Ampule',
   '프로폴리스 라이트 앰플',
   'COSRX', 'ampoule',
   'An ultra-lightweight ampoule formulated with 83.25% black bee propolis extract. Provides antioxidant protection, intense hydration, and a luminous, honey-like glow without heaviness. Perfect for dry or dull skin needing a nutrient boost. Pairs beautifully with the Snail 96 Essence.',
   22000, 24.00, 35, '35ml', true, 4.6, 1400),

  (gen_random_uuid(),
   'Full Fit Propolis Synergy Toner',
   '풀핏 프로폴리스 시너지 토너',
   'COSRX', 'toner',
   'A hydrating propolis toner formulated with black bee propolis extract and niacinamide. Delivers a burst of antioxidant-rich hydration as a first step in the routine. Has a slightly tacky, honey-water feel that absorbs within minutes. Excellent for dry and combination skin types.',
   19000, 20.00, 150, '150ml', true, 4.5, 1100),

  -- ==================
  -- Beauty of Joseon (additional)
  -- ==================
  (gen_random_uuid(),
   'Revive Eye Serum: Ginseng + Retinal',
   '리바이브 아이 세럼: 인삼 + 레티날',
   'Beauty of Joseon', 'serum',
   'An eye serum combining ginseng root extract with retinal (retinaldehyde -- a more potent retinoid that converts to retinoic acid in the skin). Targets under-eye fine lines, dark circles, and loss of firmness. Formulated at levels appropriate for the delicate eye area.',
   20000, 20.00, 30, '30ml', true, 4.5, 980),

  -- ==================
  -- Skin1004 (additional sunscreen)
  -- ==================
  (gen_random_uuid(),
   'Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++',
   '하이알루-시카 워터핏 선 세럼 SPF50+ PA++++',
   'Skin1004', 'sunscreen',
   'A serum-textured chemical sunscreen with a watery, weightless formula. Combines hyaluronic acid and centella asiatica with SPF50+ PA++++ protection. Leaves no white cast and gives a natural dewy finish. A standout Korean sunscreen especially popular with oily skin types in warm, humid climates.',
   18000, 16.00, 50, '50ml', true, 4.7, 3400),

  -- ==================
  -- Klairs (additional)
  -- ==================
  (gen_random_uuid(),
   'Rich Moist Soothing Tencel Sheet Mask',
   '리치 모이스트 수딩 텐셀 시트 마스크',
   'Klairs', 'mask',
   'A tencel sheet mask soaked in a calming essence of beta-glucan, hyaluronic acid, and centella asiatica. The TENCEL material adheres closely to the skin and delivers moisture without slipping. Perfect for a weekly hydration boost or calming irritated skin post-sun exposure. A gentle, reliable K-beauty sheet mask.',
   2500, 3.00, 25, '25ml', true, 4.5, 2200),

  -- ==================
  -- Purito (additional)
  -- ==================
  (gen_random_uuid(),
   'Comfy Water Sun Block SPF50+ PA++++',
   '컴피 워터 선 블락 SPF50+ PA++++',
   'Purito', 'sunscreen',
   'A water-based chemical sunscreen with an incredibly lightweight serum texture. Uses Uvinul-based modern UV filters that leave no white cast. Formulated with panthenol and centella for additional skin benefits. One of the most recommended Korean sunscreens for normal to oily skin due to its non-greasy, comfortable finish.',
   17000, 18.00, 60, '60ml', true, 4.6, 2100),

  -- ==================
  -- Anua (additional)
  -- ==================
  (gen_random_uuid(),
   'Peach 70% Niacinamide Serum',
   '복숭아 70% 나이아신아마이드 세럼',
   'Anua', 'serum',
   'A brightening serum formulated with 70% peach extract and 10% niacinamide. Targets hyperpigmentation, dark spots, and uneven skin tone with a dual-brightening approach. The peach extract provides antioxidants and gentle skin-conditioning while the niacinamide reduces melanin transfer. A breakout hit for Anua in the brightening category.',
   22000, 22.00, 30, '30ml', true, 4.6, 2200),

  -- ==================
  -- Laneige (additional)
  -- ==================
  (gen_random_uuid(),
   'Bouncy & Firm Sleeping Mask',
   '바운시 앤 펌 슬리핑 마스크',
   'Laneige', 'mask',
   'An overnight firming treatment formulated with tripeptide-5, bounce complex (polyglutamic acid), and IPMP (isopentyldiols, moisture retaining agents). Works while you sleep to visibly firm and plump the skin by morning. Ideal for aging or sagging skin concerns. Richer than the Water Sleeping Mask.',
   42000, 38.00, NULL, '60g', true, 4.4, 680),

  -- ==================
  -- Torriden (additional)
  -- ==================
  (gen_random_uuid(),
   'SOLID-IN Ceramide Moisturizing Cream',
   '솔리드인 세라마이드 모이스처라이징 크림',
   'Torriden', 'moisturizer',
   'A barrier-repair cream formulated with 5 types of ceramides, hyaluronic acid, and madecassoside. Delivers rich, lasting moisture without feeling occlusive or greasy. A step up from the DIVE-IN line for dry skin or winter months. Fragrance-free and tested for sensitive skin.',
   23000, 23.00, NULL, '50g', true, 4.5, 780),

  -- ==================
  -- Round Lab (additional sunscreen)
  -- ==================
  (gen_random_uuid(),
   'Birch Juice Moisturizing Sun Cream SPF50+ PA++++',
   '자작나무 수분 선크림 SPF50+ PA++++',
   'Round Lab', 'sunscreen',
   'A moisturizing sunscreen that uses Round Lab''s signature birch tree sap as its base. Provides SPF50+ PA++++ protection with a hydrating, satin finish. Suitable for dry to combination skin. One of the more hydrating Korean sunscreens -- often recommended for those who want sun protection and moisture in one step.',
   19000, 19.00, 50, '50ml', true, 4.4, 1100);


-- ============================================================
-- Cleanup temporary table
-- ============================================================
DROP TABLE IF EXISTS temp_ingredient_ids;

COMMIT;
