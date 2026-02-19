-- ============================================================================
-- Seoul Sister Product Database Expansion
-- Adds ~96 new products across 10 new brands + deepens 11 existing brands
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- ============================================================================
-- BATCH 1: New Brands — Heimish, Benton, Neogen, Medicube, TonyMoly (25)
-- ============================================================================

INSERT INTO ss_products (name_en, name_ko, brand_en, brand_ko, category, description_en, volume_ml, volume_display, price_usd, price_krw, image_url, pao_months, is_verified) VALUES

-- HEIMISH (5 products)
('All Clean Balm', '올 클린 밤', 'Heimish', '헤이미쉬', 'cleanser',
 'A sherbet-type cleansing balm that transforms from solid to oil on the skin, melting away waterproof makeup and impurities. Formulated with shea butter, coconut extract, and a botanical citrus herb oil blend.',
 120, '120ml', 17.99, 23400, 'https://heimish.us/cdn/shop/files/HMS01-CB_web_01_900x.jpg', 12, true),

('All Clean Green Foam', '올 클린 그린 폼', 'Heimish', '헤이미쉬', 'cleanser',
 'A gentle pH 5.5 foaming facial cleanser enriched with green tea water and mild amino acid surfactants that deeply cleanse pores without stripping the skin barrier.',
 150, '150ml', 10.80, 14000, 'https://heimish.us/cdn/shop/files/HMS01-GF_web_01_900x.jpg', 12, true),

('Bulgarian Rose Satin Cream', '불가리안 로즈 새틴 크림', 'Heimish', '헤이미쉬', 'moisturizer',
 'A luxurious anti-aging satin moisturizer formulated with 35% Bulgarian rose water, rose hip oil, and adenosine to deeply hydrate while improving elasticity.',
 50, '50ml', 32.40, 42100, 'https://heimish.us/cdn/shop/files/HMS09-CsRR_web_01_900x.jpg', 12, true),

('Artless Glow Base SPF 50+ PA+++', '아트리스 글로우 베이스 SPF50+', 'Heimish', '헤이미쉬', 'sunscreen',
 'A multifunctional tone-up base that acts as moisturizer, primer, highlighter, and SPF 50+ PA+++ sunscreen in a single lightweight formula with no white cast.',
 40, '40ml', 22.00, 28600, 'https://heimish.us/cdn/shop/files/HMS14-AGB_web_01_900x.jpg', 6, true),

('Marine Care Eye Cream', '마린 케어 아이 크림', 'Heimish', '헤이미쉬', 'eye_care',
 'A nourishing eye cream powered by deep-sea marine ingredients including seaweed extract and marine collagen to visibly reduce dark circles, puffiness, and fine lines.',
 30, '30ml', 28.80, 37400, 'https://heimish.us/cdn/shop/files/HMS16-IR_web_01_900x.jpg', 12, true),

-- BENTON (5 products)
('Snail Bee High Content Essence', '스네일 비 하이 콘텐츠 에센스', 'Benton', '벤튼', 'essence',
 'A multi-care essence combining snail mucin and bee venom with niacinamide and adenosine to repair damaged skin, improve texture, and even skin tone.',
 100, '100ml', 21.00, 27300, 'https://image.yesstyle.com/assets/items/1053/1053033529-1.jpg', 12, true),

('Aloe BHA Skin Toner', '알로에 BHA 스킨 토너', 'Benton', '벤튼', 'toner',
 'An exfoliating and hydrating toner combining 0.5% salicylic acid with aloe vera and snail filtrate to gently remove dead skin cells while soothing all skin types.',
 200, '200ml', 19.00, 24700, 'https://image.yesstyle.com/assets/items/1053/1053033537-1.jpg', 12, true),

('Deep Green Tea Toner', '딥 그린 티 토너', 'Benton', '벤튼', 'toner',
 'A lightweight antioxidant-rich toner with fermented deep green tea to balance oil production, minimize pores, and deliver long-lasting hydration without stickiness.',
 150, '150ml', 16.00, 20800, 'https://image.yesstyle.com/assets/items/1072/1072017942-1.jpg', 12, true),

('Fermentation Essence', '퍼멘테이션 에센스', 'Benton', '벤튼', 'essence',
 'A brightening essence powered by 70% galactomyces ferment filtrate with ceramides and hyaluronic acid to boost elasticity, suppleness, and moisture.',
 100, '100ml', 27.00, 35100, 'https://image.yesstyle.com/assets/items/1053/1053033545-1.jpg', 12, true),

('Goodbye Redness Centella Cica Gel', '굿바이 레드니스 센텔라 시카 젤', 'Benton', '벤튼', 'moisturizer',
 'A soothing gel moisturizer with centella asiatica and madecassoside to calm redness, repair the skin barrier, and reduce inflammation for acne-prone and sensitive skin.',
 100, '100g', 18.00, 23400, 'https://image.yesstyle.com/assets/items/1055/1055177049-1.jpg', 12, true),

-- NEOGEN (5 products)
('Bio-Peel Gauze Peeling Lemon', '바이오 필 가제 필링 레몬', 'Neogen', '네오젠', 'exfoliator',
 'Dual-textured gauze peeling pads combining AHA, lactic acid, glycolic acid, and vitamin C-rich lemon extract for both chemical and physical exfoliation. 30 pads.',
 200, '200ml / 30 pads', 27.00, 35100, 'https://neogenlab.us/cdn/shop/files/Bio-Peel-Gauze-Peeling-Lemon_main_900x.jpg', 6, true),

('Real Cica Micellar Cleansing Foam', '리얼 시카 미셀라 클렌징 폼', 'Neogen', '네오젠', 'cleanser',
 'A gentle micellar foaming cleanser infused with centella asiatica complex to deeply cleanse while calming sensitive and irritated skin.',
 200, '200ml', 16.00, 20800, 'https://neogenlab.us/cdn/shop/files/Real-Cica-Micellar-Cleansing-Foam_main_900x.jpg', 12, true),

('Dermalogy Collagen Lifting Cream', '더마로지 콜라겐 리프팅 크림', 'Neogen', '네오젠', 'moisturizer',
 'A firming moisturizer with double collagen formula plus panthenol, adenosine, and ceramide to strengthen the skin barrier and visibly plump fine lines.',
 50, '50ml', 25.20, 32800, 'https://neogenlab.us/cdn/shop/files/Collagen-Lifting-Cream_main_900x.jpg', 12, true),

('Real Ferment Micro Serum', '리얼 퍼멘트 마이크로 세럼', 'Neogen', '네오젠', 'serum',
 'An intensive gel serum with 61% fermented ingredients including bifida ferment lysate and rice ferment filtrate to boost elasticity and create a luminous glow.',
 30, '30ml', 38.00, 49400, 'https://neogenlab.us/cdn/shop/files/Real-Ferment-Micro-Serum_main_900x.jpg', 12, true),

('A-Clear Soothing Spot Patch', '에이 클리어 수딩 스팟 패치', 'Neogen', '네오젠', 'spot_treatment',
 'Ultra-thin hydrocolloid blemish patches (24 per pack) that absorb impurities from active breakouts while protecting from external irritants.',
 10, '24 patches', 9.00, 11700, 'https://neogenlab.us/cdn/shop/files/A-Clear-Soothing-Spot-Patch_main_900x.jpg', 12, true),

-- MEDICUBE (5 products)
('Red Erasing Cream 2.0', '레드 이레이징 크림 2.0', 'Medicube', '메디큐브', 'moisturizer',
 'A dermatologist-developed redness-calming moisturizer combining centella asiatica, tranexamic acid, and niacinamide to soothe inflammation and even skin tone.',
 50, '50ml', 25.20, 32800, 'https://medicube.us/cdn/shop/files/medicube-red-erasing-cream-2-50ml_1800x.jpg', 12, true),

('PDRN Pink Peptide Serum', 'PDRN 핑크 펩타이드 세럼', 'Medicube', '메디큐브', 'serum',
 'A regenerative serum powered by salmon-derived PDRN and peptides to stimulate skin renewal, improve texture, and promote a plump, youthful complexion.',
 30, '30ml', 26.00, 33800, 'https://medicube.us/cdn/shop/files/pdrn-pink-peptide-serum-30ml_1800x.jpg', 6, true),

('Zero Pore Pad 2.0', '제로 포어 패드 2.0', 'Medicube', '메디큐브', 'exfoliator',
 'Dual-textured facial toner pads (70 pads) combining 4.5% AHA lactic acid and 0.45% BHA salicylic acid to exfoliate dead skin cells and visibly minimize pores.',
 130, '70 pads', 21.00, 27300, 'https://medicube.us/cdn/shop/files/medicube-zero-pore-pads-2_1800x.jpg', 6, true),

('Collagen Niacinamide Jelly Cream', '콜라겐 나이아신아마이드 젤리 크림', 'Medicube', '메디큐브', 'moisturizer',
 'A best-selling jelly-type moisturizer featuring freeze-dried hydrolyzed collagen and niacinamide to strengthen the skin barrier and deliver 24-hour hydration.',
 110, '110ml', 39.00, 50700, 'https://medicube.us/cdn/shop/files/collagen-niacinamide-jelly-cream-110ml_1800x.jpg', 12, true),

('Deep Vita C Ampoule 2.0', '딥 비타 C 앰플 2.0', 'Medicube', '메디큐브', 'ampoule',
 'A water-based vitamin C ampoule with 14.5% pure ascorbic acid that reduces hyperpigmentation and enhances radiance. Comes as 3 x 10g vials to preserve potency.',
 30, '3 x 10g vials', 31.80, 41300, 'https://medicube.us/cdn/shop/files/deep-vita-c-ampoule-2-30g_1800x.jpg', 6, true),

-- TONYMOLY (5 products)
('Wonder Ceramide Mochi Water Cream', '원더 세라마이드 모찌 워터 크림', 'TonyMoly', '토니모리', 'moisturizer',
 'A cooling gel-type moisturizer infused with 5,000 ppb ceramide complex, centella asiatica, and hyaluronic acid to restore the moisture barrier and deliver dewy hydration.',
 100, '100ml', 13.00, 16900, 'https://tonymoly.us/cdn/shop/files/Wonder-Ceramide-Mochi-Water-Cream-100ml_900x.jpg', 12, true),

('Panda''s Dream Eye Patch', '판다의 꿈 아이 패치', 'TonyMoly', '토니모리', 'eye_care',
 'Bamboo-infused hydrogel eye patches that visibly reduce dark circles, puffiness, and fine lines. Enriched with bamboo extract, vitamin B3, and collagen.',
 20, '1 pair', 5.00, 6500, 'https://tonymoly.us/cdn/shop/files/Pandas-Dream-Eye-Patch_900x.jpg', 12, true),

('The Chok Chok Green Tea Watery Cream', '더 촉촉 그린티 워터리 크림', 'TonyMoly', '토니모리', 'moisturizer',
 'A lightweight gel-cream moisturizer with fermented Korean green tea delivering antioxidant protection and intense hydration without any heavy or greasy feel.',
 60, '60ml', 24.50, 31900, 'https://tonymoly.us/cdn/shop/files/The-Chok-Chok-Green-Tea-Watery-Cream_900x.jpg', 12, true),

('Egg Pore Tightening Cooling Pack', '에그 포어 타이트닝 쿨링 팩', 'TonyMoly', '토니모리', 'mask',
 'A refreshing cooling gel pack with egg white extract and kaolin clay to tighten enlarged pores, absorb excess sebum, and leave skin calm and smooth.',
 30, '30g', 10.00, 13000, 'https://tonymoly.us/cdn/shop/files/Egg-Pore-Tightening-Cooling-Pack_900x.jpg', 12, true),

('Wonder Ceramide Mochi Toner', '원더 세라마이드 모찌 토너', 'TonyMoly', '토니모리', 'toner',
 'A thick viscous ceramide toner with mochi-like texture combining ceramide NP, niacinamide, panthenol, and hyaluronic acid to repair the moisture barrier.',
 300, '300ml', 18.00, 23400, 'https://tonymoly.us/cdn/shop/files/Wonder-Ceramide-Mochi-Toner-300ml_900x.jpg', 12, true);


-- ============================================================================
-- BATCH 2: New Brands — Goodal, Pyunkang Yul, Belif, The Face Shop, Nature Republic (25)
-- ============================================================================

INSERT INTO ss_products (name_en, name_ko, brand_en, brand_ko, category, description_en, volume_ml, volume_display, price_usd, price_krw, image_url, pao_months, is_verified) VALUES

-- GOODAL (5 products)
('Green Tangerine Vita C Dark Spot Care Serum', '청귤 비타C 잡티케어 세럼', 'Goodal', '구달', 'serum',
 'A brightening serum formulated with 70% green tangerine extract and niacinamide to visibly reduce dark spots and hyperpigmentation. Free from 18 harmful ingredients.',
 40, '40ml', 23.66, 30700, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1112714085/1/A.jpg', 12, true),

('Houttuynia Cordata Calming Essence', '어성초 칼밍 에센스', 'Goodal', '구달', 'essence',
 'A soothing essence composed of 97.5% Jeju Houttuynia cordata extract that calms redness, reduces irritation, and strengthens the skin barrier for sensitive skin.',
 150, '150ml', 26.60, 34500, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1113845025/1/A.jpg', 12, true),

('Vegan Rice Milk Moisturizing Cream', '비건 라이스 밀크 모이스처라이징 크림', 'Goodal', '구달', 'moisturizer',
 'A lightweight vegan-certified moisturizing cream enriched with rice milk extract to deliver long-lasting hydration and a smooth, luminous finish.',
 70, '70ml', 16.80, 21800, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1110212995/1/A.jpg', 12, true),

('Green Tangerine Vita C Toner Pad', '청귤 비타C 토너 패드', 'Goodal', '구달', 'exfoliator',
 'A 5-in-1 vitamin C toner pad that exfoliates, brightens, tones, moisturizes, and detoxifies. Each pad contains 67% Jeju green tangerine extract with AHA/BHA.',
 175, '70 pads', 23.80, 30900, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1076219118/1/A.jpg', 6, true),

('Green Tangerine Vita C Dark Spot Care Cream', '청귤 비타C 잡티케어 크림', 'Goodal', '구달', 'moisturizer',
 'A water-rich brightening cream with stabilized vitamin C, 5% niacinamide, and alpha arbutin to fade dark spots and deliver up to 72-hour hydration.',
 50, '50ml', 24.00, 22400, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1125269695/1/A.jpg', 12, true),

-- PYUNKANG YUL (5 products)
('Essence Toner', '에센스 토너', 'Pyunkang Yul', '편강율', 'toner',
 'A bestselling essence-toner hybrid with 91.3% astragalus membranaceus root extract delivering concentrated 24-hour hydration with a minimal ingredient formula.',
 200, '200ml', 19.99, 25900, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1060395495/1/A.jpg', 12, true),

('Moisture Serum', '모이스처 세럼', 'Pyunkang Yul', '편강율', 'serum',
 'A lightweight lotion-serum formulated with oriental herbs and olive oil to restore oil-water balance. Calms and cools while providing deep hydration.',
 100, '100ml', 20.00, 26000, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1060395500/1/A.jpg', 12, true),

('ATO Cream Blue Label', 'ATO 크림 블루 라벨', 'Pyunkang Yul', '편강율', 'moisturizer',
 'A ceramide-rich moisturizer with hyaluronic acid that forms a protective barrier to lock in moisture and soothe irritated and atopic-prone skin.',
 120, '120ml', 21.82, 28300, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1078867032/1/A.jpg', 12, true),

('Nutrition Cream', '영양 크림', 'Pyunkang Yul', '편강율', 'moisturizer',
 'A rich nourishing cream with Mongolian milk vetch root extract, shea butter, and beeswax to deliver intense moisture and strengthen the skin barrier.',
 100, '100ml', 28.79, 37400, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1060395500/1/A.jpg', 12, true),

('Calming Moisture Barrier Cream', '칼밍 모이스처 배리어 크림', 'Pyunkang Yul', '편강율', 'moisturizer',
 'A barrier-strengthening cream featuring cica, tea tree extract, and honeysuckle flower to calm breakout-prone and sensitive skin while preventing moisture loss.',
 50, '50ml', 17.99, 23300, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1097776359/1/A.jpg', 12, true),

-- BELIF (5 products)
('The True Cream Aqua Bomb', '더 트루 크림 아쿠아 밤', 'belif', '벨리프', 'moisturizer',
 'A bestselling lightweight gel moisturizer with hyaluronic acid, niacinamide, and Lady''s Mantle extract that delivers an instant cooling burst of hydration. Boosts moisture by 231%.',
 50, '50ml', 38.00, 49400, 'https://img.yesstyle.com/ys1060679323/1/A.jpg', 12, true),

('The True Cream Moisturizing Bomb', '더 트루 크림 모이스처라이징 밤', 'belif', '벨리프', 'moisturizer',
 'A rich gel-cream delivering up to 48 hours of intensive moisture with ceramide and peptide to reinforce the skin barrier for dry to normal skin.',
 50, '50ml', 38.00, 49400, 'https://img.yesstyle.com/ys1060679334/1/A.jpg', 12, true),

('Hungarian Water Essence', '헝가리 워터 에센스', 'belif', '벨리프', 'essence',
 'A lightweight hydrating essence inspired by the legendary 14th-century Hungarian Water recipe, featuring rosemary and 20 botanicals to improve skin texture.',
 75, '75ml', 48.00, 62400, 'https://img.yesstyle.com/ys1060679345/1/A.jpg', 12, true),

('Numero 10 Essence', '넘버 10 에센스', 'belif', '벨리프', 'essence',
 'A 10-second rapid-absorption essence with Rose of Jericho extract that instantly floods skin with intense moisture right after cleansing.',
 75, '75ml', 34.00, 44200, 'https://img.yesstyle.com/ys1060679356/1/A.jpg', 12, true),

('Aqua Bomb Sleeping Mask', '아쿠아 밤 슬리핑 마스크', 'belif', '벨리프', 'mask',
 'An overnight sleeping mask with the same iconic cooling gel texture as the Aqua Bomb, delivering extra niacinamide hydration while you sleep.',
 75, '75ml', 38.00, 49400, 'https://img.yesstyle.com/ys1067624676/1/A.jpg', 6, true),

-- THE FACE SHOP (5 products)
('Rice Water Bright Foaming Cleanser', '미감수 브라이트 클렌징폼', 'The Face Shop', '더페이스샵', 'cleanser',
 'A gentle foaming cleanser enriched with rice water and ceramide that softly removes impurities without stripping the skin''s moisture barrier.',
 150, '150ml', 11.99, 15500, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1038281940/1/A.jpg', 12, true),

('Yehwadam Plum Flower Revitalizing Serum', '예화담 매화 활력 세럼', 'The Face Shop', '더페이스샵', 'serum',
 'A revitalizing anti-aging serum from the heritage Yehwadam line with white ginseng, lotus flower, and plum flower extracts to brighten and restore vitality.',
 45, '45ml', 30.00, 39000, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1115378195/1/A.jpg', 12, true),

('Rice & Ceramide Moisturizing Cream', '쌀 세라마이드 모이스처라이징 크림', 'The Face Shop', '더페이스샵', 'moisturizer',
 'A brightening and hydrating moisturizer combining rice extract and ceramide to strengthen the skin barrier while improving radiance.',
 50, '50ml', 14.00, 18200, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1055071735/1/A.jpg', 12, true),

('Dr. Belmeur Advanced Cica Recovery Cream', '닥터 벨뮤어 시카 리커버리 크림', 'The Face Shop', '더페이스샵', 'moisturizer',
 'A dermatologically tested recovery cream with Centella Asiatica, ceramide, and panthenol that soothes and repairs sensitized and damaged skin.',
 50, '50ml', 37.40, 48600, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1063027195/1/A.jpg', 12, true),

('Yehwadam Hwansaenggo Rejuvenating Serum', '예화담 환생고 세럼', 'The Face Shop', '더페이스샵', 'serum',
 'A premium anti-aging serum powered by 12 traditional Korean herbs including red ginseng and lotus to restore skin balance and natural radiance.',
 45, '45ml', 38.00, 49400, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1115378200/1/A.jpg', 12, true),

-- NATURE REPUBLIC (5 products)
('Aloe Vera 92% Soothing Gel', '알로에베라 92% 수딩젤', 'Nature Republic', '네이처 리퍼블릭', 'moisturizer',
 'The iconic multi-use soothing gel with 92% Aloe Vera extract to instantly hydrate and calm skin, sunburn, and irritation. Vegan certified, used worldwide.',
 300, '300ml', 9.00, 11700, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1050166159/1/A.jpg', 12, true),

('Snail Solution Foam Cleanser', '스네일 솔루션 폼 클렌저', 'Nature Republic', '네이처 리퍼블릭', 'cleanser',
 'A cream-to-foam cleanser powered by 1,000ppm French snail mucin that thoroughly removes impurities while delivering intense moisture and promoting skin healing.',
 150, '150ml', 15.50, 20100, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1050132386/1/A.jpg', 12, true),

('Vitapair C Glow Reveal Ampoule', '비타페어C 글로우 리빌 앰플', 'Nature Republic', '네이처 리퍼블릭', 'ampoule',
 'A triple-function vitamin C ampoule with niacinamide, retinol, and panthenol that brightens, smooths, and repairs skin targeting dark spots and dullness.',
 24, '24ml', 20.00, 26000, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1102899640/1/A.jpg', 6, true),

('Green Derma Mild Cica Cream', '그린 더마 마일드 시카 크림', 'Nature Republic', '네이처 리퍼블릭', 'moisturizer',
 'A ceramide-enriched soothing cream with Centella Asiatica and madecassoside that calms redness and repairs the skin barrier for sensitive and reactive skin.',
 50, '50ml', 16.50, 21400, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1102899645/1/A.jpg', 12, true),

('Ginseng Royal Silk Essence', '인삼 로얄 실크 에센스', 'Nature Republic', '네이처 리퍼블릭', 'essence',
 'A luxurious anti-aging essence infused with six-year-old red ginseng, royal jelly, and silk amino acids to moisturize and improve skin texture and firmness.',
 40, '40ml', 29.80, 38700, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1117065934/1/A.jpg', 12, true);


-- ============================================================================
-- BATCH 3: Missing Categories — eye_care, oil, mist, spot_treatment (11 unique)
-- ============================================================================

INSERT INTO ss_products (name_en, name_ko, brand_en, brand_ko, category, description_en, volume_ml, volume_display, price_usd, price_krw, image_url, pao_months, is_verified) VALUES

-- EYE CARE (3 unique — others in Batch 4)
('Green Tea Seed Eye Cream', '그린티 씨드 아이크림', 'Innisfree', '이니스프리', 'eye_care',
 'A silky eye cream infused with Jeju green tea extract and green tea seed oil that delivers intense hydration to the delicate eye area, targeting dryness and fine lines.',
 30, '30ml', 22.00, 28600, 'https://us.innisfree.com/cdn/shop/files/green-tea-seed-eye-cream-30ml.jpg', 12, true),

('TEN Revolution Real Eye Cream For Face', '텐 레볼루션 리얼 아이크림 포 페이스', 'A.H.C', '에이에이치씨', 'eye_care',
 'A versatile eye cream with human stem cell culture fluid, collagen, 16 vitamins, and 11 types of hyaluronic acid that can be applied to the entire face.',
 30, '30ml', 11.00, 14300, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1119717778/1/A.jpg', 12, true),

('Moistfull Collagen Eye Cream', '모이스트풀 콜라겐 아이크림', 'Etude', '에뛰드', 'eye_care',
 'An EWG Green verified eye cream enriched with 63.6% Super Collagen Water that plumps and moisturizes the delicate eye area, preventing fine lines.',
 28, '28ml', 27.60, 35900, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1089345234/1/A.jpg', 12, true),

-- OIL (2 unique)
('Full Fit Propolis Light Ampoule', '풀핏 프로폴리스 라이트 앰플', 'COSRX', '코스알엑스', 'oil',
 'A glow-boosting concentrate with 83% Black Bee Propolis Extract that repairs damaged skin, reduces redness, and delivers intensive nourishment with a lightweight finish.',
 30, '30ml', 28.00, 36400, 'https://www.cosrx.com/cdn/shop/products/full-fit-propolis-light-ampoule.jpg', 12, true),

('Fundamental Watery Oil Drop', '펀더멘탈 워터리 오일 드롭', 'Klairs', '클레어스', 'oil',
 'A water-based facial oil serum with green tea, ceramide, peptides, and ferment extracts that provides oil-like nourishment without any greasy residue.',
 50, '50ml', 31.00, 40300, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1080234567/1/A.jpg', 12, true),

-- MIST (4 unique)
('Cream Skin Mist', '크림 스킨 미스트', 'Laneige', '라네즈', 'mist',
 'A portable hydrating facial mist with White Tea Leaf Extract, Ceramide Complex, and Peptides that delivers creamy moisturization in a lightweight spray format.',
 120, '120ml', 32.00, 41600, 'https://us.laneige.com/cdn/shop/products/cream-skin-mist-120ml.jpg', 12, true),

('Centella Water Alcohol-Free Toner Mist', '센텔라 워터 알코올 프리 토너', 'COSRX', '코스알엑스', 'mist',
 'A gentle spray-type toner with 82% mineral water and 10% Centella Asiatica leaf water that calms redness and soothes sensitive skin as an anytime mist.',
 150, '150ml', 17.00, 22100, 'https://www.cosrx.com/cdn/shop/products/centella-water-alcohol-free-toner-150ml.jpg', 12, true),

('SoonJung pH 5.5 Relief Toner Mist', '순정 pH 5.5 릴리프 토너', 'Etude', '에뛰드', 'mist',
 'A pH-balanced hydrating toner mist with 97% naturally derived ingredients, panthenol, and madecassoside that strengthens the skin barrier and soothes sensitized skin.',
 200, '200ml', 20.00, 26000, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1078234512/1/A.jpg', 12, true),

('Fundamental Ampule Mist', '펀더멘탈 앰플 미스트', 'Klairs', '클레어스', 'mist',
 'A nourishing facial mist with 82% green tea leaf water and botanical extracts including cucumber, rice, mugwort, and kelp for lasting hydration.',
 125, '125ml', 27.00, 35100, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1085678345/1/A.jpg', 12, true),

-- SPOT TREATMENT (2 unique — others in Batch 4)
('AC Collection Blemish Spot Clearing Serum', 'AC 컬렉션 블레미시 스팟 클리어링 세럼', 'COSRX', '코스알엑스', 'spot_treatment',
 'A multifunctional acne serum with 4% niacinamide, propolis extract, and CentellAC-RX Complex that clears red and dark acne spots and rebuilds the skin barrier.',
 40, '40ml', 27.00, 35100, 'https://www.cosrx.com/cdn/shop/products/ac-collection-blemish-spot-clearing-serum-40ml.jpg', 12, true),

('Sulfur 3% Clean Gel', '설퍼 3% 클린 젤', 'By Wishtrend', '바이위시트렌드', 'spot_treatment',
 'A hydrating acne spot treatment gel with 3% colloidal sulfur that penetrates pores to control sebum and dry out blemishes, balanced with sodium hyaluronate.',
 30, '30g', 22.00, 28600, 'https://wishtrend.com/cdn/shop/products/sulfur-3-clean-gel-30g.jpg', 12, true);


-- ============================================================================
-- BATCH 4: Deepen Existing Brands (35 products)
-- ============================================================================

INSERT INTO ss_products (name_en, name_ko, brand_en, brand_ko, category, description_en, volume_ml, volume_display, price_usd, price_krw, image_url, pao_months, is_verified) VALUES

-- COSRX (3 new: eye_care, moisturizer, spot_treatment)
('Advanced Snail Peptide Eye Cream', '어드밴스드 스네일 펩타이드 아이 크림', 'COSRX', '코스알엑스', 'eye_care',
 'Lightweight eye cream with 73.7% snail mucin and 5-type peptide complex that targets dark circles, puffiness, and fine lines while firming the under-eye area.',
 25, '25ml', 25.00, 29000, 'https://www.cosrx.com/cdn/shop/products/Advanced_Snail_Peptide_Eye_Cream.jpg', 12, true),

('Balancium Comfort Ceramide Cream', '밸런시움 컴포트 세라마이드 크림', 'COSRX', '코스알엑스', 'moisturizer',
 'Matte balm-type moisturizer with Ceramide NP and 50% Centella Asiatica Leaf Water that strengthens the skin barrier and provides comfort without greasy residue.',
 80, '80g', 26.00, 29000, 'https://www.cosrx.com/cdn/shop/products/Balancium_Comfort_Ceramide_Cream.jpg', 12, true),

('Acne Pimple Master Patch', '아크네 핌플 마스터 패치', 'COSRX', '코스알엑스', 'spot_treatment',
 'Hydrocolloid spot patches in three sizes that absorb impurities and create a moist healing environment to flatten whiteheads and pimples overnight. 24 patches.',
 1, '24 patches', 6.00, 4500, 'https://www.cosrx.com/cdn/shop/products/Acne_Pimple_Master_Patch.jpg', 36, true),

-- DR. JART+ (2 new: moisturizer, essence)
('Ceramidin Skin Barrier Moisturizing Cream', '세라마이딘 크림', 'Dr. Jart+', '닥터자르트', 'moisturizer',
 'Fast-absorbing cushiony moisturizer with 5-Ceramide complex plus Panthenol that deeply hydrates, strengthens the skin barrier, and boosts elasticity.',
 50, '50ml', 45.00, 52000, 'https://www.sephora.com/productimages/sku/s2499685-main-zoom.jpg', 12, true),

('Vital Hydra Solution Hydro Plump Treatment Essence', '바이탈 하이드라 솔루션 에센스', 'Dr. Jart+', '닥터자르트', 'essence',
 'Liquid treatment essence with multi-weight Hyaluronic Acid that floods skin with all-day plumping hydration and preps skin to absorb subsequent layers.',
 150, '150ml', 34.00, 39000, 'https://www.sephora.com/productimages/sku/s2591637-main-zoom.jpg', 12, true),

-- SULWHASOO (3 new: serum, eye_care, mask)
('First Care Activating Serum VI', '퍼스트 케어 액티베이팅 세럼', 'Sulwhasoo', '설화수', 'serum',
 'Iconic pre-serum booster with 500-Hour Aged Ginseng and Korean Herb Extracts that primes skin for absorption while visibly reducing fine lines and dullness.',
 60, '60ml', 89.00, 105000, 'https://us.sulwhasoo.com/cdn/shop/products/first-care-activating-serum-vi-60ml.jpg', 12, true),

('Concentrated Ginseng Rejuvenating Eye Cream', '자음생 아이크림', 'Sulwhasoo', '설화수', 'eye_care',
 'Luxurious anti-aging eye cream with Korean Ginseng and peptide complex that visibly improves puffiness, wrinkles, and dark circles in 4 weeks.',
 15, '15ml', 120.00, 140000, 'https://us.sulwhasoo.com/cdn/shop/products/concentrated-ginseng-rejuvenating-eye-cream-15ml.jpg', 12, true),

('Overnight Vitalizing Mask', '여윤팩', 'Sulwhasoo', '설화수', 'mask',
 'Sleeping mask with Nutritive RED Elixir containing jujube and pomegranate extracts that delivers overnight nourishment for visibly vitalized and glowing skin.',
 120, '120ml', 54.00, 63000, 'https://us.sulwhasoo.com/cdn/shop/products/overnight-vitalizing-mask-120ml.jpg', 12, true),

-- LANEIGE (3 new: lip_care, toner, sunscreen)
('Lip Glowy Balm Berry', '립 글로이 밤 베리', 'Laneige', '라네즈', 'lip_care',
 'Sheer tinted lip balm with Berry Mix and Shea Butter that instantly moisturizes, adds a dewy glass-like shine, and keeps lips soft throughout the day.',
 10, '10g', 19.00, 18000, 'https://us.laneige.com/cdn/shop/products/lip-glowy-balm-berry-10g.jpg', 24, true),

('Cream Skin Cerapeptide Toner & Moisturizer', '크림 스킨 세라펩타이드', 'Laneige', '라네즈', 'toner',
 'Milky toner-moisturizer hybrid with Ceramides and Peptides delivering creamy hydration in a lightweight, refillable format while visibly firming skin.',
 170, '170ml', 36.00, 36000, 'https://us.laneige.com/cdn/shop/products/cream-skin-cerapeptide-170ml.jpg', 12, true),

('Neo Cushion Matte SPF42 PA++', '네오 쿠션 매트', 'Laneige', '라네즈', 'sunscreen',
 'Next-generation cushion foundation with SPF42 PA++ in a refillable compact delivering buildable natural matte coverage with broad-spectrum sun protection.',
 15, '15g', 30.00, 33000, 'https://us.laneige.com/cdn/shop/products/neo-cushion-matte-15g.jpg', 24, true),

-- INNISFREE (2 new: mask, serum — eye_care already in Batch 3)
('Super Volcanic Pore Clay Mask', '슈퍼 화산송이 모공 마스크', 'Innisfree', '이니스프리', 'mask',
 'Deep-cleansing wash-off clay mask with Jeju Volcanic Clusters and AHA that minimizes pores, absorbs excess sebum, and gently exfoliates.',
 100, '100ml', 20.00, 20000, 'https://us.innisfree.com/cdn/shop/files/super-volcanic-pore-clay-mask-100ml.jpg', 24, true),

('Retinol Cica Moisture Recovery Serum', '레티놀 시카 모이스처 리커버리 세럼', 'Innisfree', '이니스프리', 'serum',
 'Fragrance-free beginner retinol serum with Cica and Salicylic Acid that smooths texture, minimizes pores, and resurfaces for a clearer complexion.',
 30, '30ml', 37.00, 39000, 'https://us.innisfree.com/cdn/shop/files/retinol-cica-serum-30ml.jpg', 12, true),

-- ANUA (3 new: serum, oil, moisturizer)
('Peach 70% Niacinamide Serum', '피치 70% 나이아신아마이드 세럼', 'Anua', '아누아', 'serum',
 'Brightening serum with 70% upcycled Jeju peach extract and Niacinamide that evens skin tone and reduces dark spots for a lightweight glass-skin glow.',
 30, '30ml', 22.00, 26000, 'https://anua.com/cdn/shop/files/peach-70-niacinamide-serum-30ml.jpg', 12, true),

('Heartleaf Pore Control Cleansing Oil', '하트리프 포어 컨트롤 클렌징 오일', 'Anua', '아누아', 'oil',
 'Lightweight cleansing oil with Heartleaf Extract that thoroughly dissolves makeup, blackheads, and sebum while calming sensitivity in a non-greasy formula.',
 200, '200ml', 25.00, 28000, 'https://anua.com/cdn/shop/files/heartleaf-cleansing-oil-200ml.jpg', 12, true),

('Heartleaf 70% Intense Calming Cream', '하트리프 70% 인텐스 카밍 크림', 'Anua', '아누아', 'moisturizer',
 'Soothing cream with 70% Heartleaf and Ceramides that calms redness-prone skin while delivering lasting hydration in a non-sticky, breathable texture.',
 50, '50ml', 26.00, 29000, 'https://anua.com/cdn/shop/files/heartleaf-70-calming-cream-50ml.jpg', 12, true),

-- BEAUTY OF JOSEON (3 new: oil, serum, eye_care)
('Ginseng Cleansing Oil', '인삼 클렌징오일', 'Beauty of Joseon', '조선미녀', 'oil',
 'First-cleanser with 50% soybean oil and ginseng seed oil that dissolves waterproof makeup and sunscreen via micellar technology while nourishing skin.',
 210, '210ml', 17.00, 20000, 'https://beautyofjoseon.com/cdn/shop/products/ginseng-cleansing-oil-210ml.jpg', 12, true),

('Calming Serum: Green Tea + Panthenol', '카밍 세럼 : 녹차 + 판테놀', 'Beauty of Joseon', '조선미녀', 'serum',
 'Ultra-soothing serum with Green Tea Extract and Panthenol that calms UV-irritated, sensitive, and acne-prone skin with lightweight, lasting hydration.',
 30, '30ml', 16.00, 18000, 'https://beautyofjoseon.com/cdn/shop/products/calming-serum-green-tea-panthenol-30ml.jpg', 12, true),

('Revive Eye Serum: Ginseng + Retinal', '리바이브 아이 세럼 : 인삼 + 레티날', 'Beauty of Joseon', '조선미녀', 'eye_care',
 'Potent eye serum with Korean Ginseng and encapsulated Retinal plus Niacinamide that reduces puffiness, fine lines, and dark circles.',
 30, '30ml', 18.00, 22000, 'https://beautyofjoseon.com/cdn/shop/products/revive-eye-serum-ginseng-retinal-30ml.jpg', 12, true),

-- I'M FROM (3 new: mask, toner, cleanser)
('Mugwort Mask', '쑥 마스크', 'I''m From', '아임프롬', 'mask',
 'Concentrated gel wash-off mask with Mugwort and Tea Tree that rapidly cools heated or irritated skin, soothes redness, and calms breakouts.',
 110, '110g', 30.00, 30000, 'https://www.wishtrend.com/cdn/shop/products/im-from-mugwort-mask-110g.jpg', 24, true),

('Rice Toner', '라이스 토너', 'I''m From', '아임프롬', 'toner',
 'Milky glow-boosting toner with 77.78% Yeoju rice extract and Niacinamide that brightens dull skin and stimulates collagen while locking in moisture.',
 150, '150ml', 24.00, 28000, 'https://www.wishtrend.com/cdn/shop/products/im-from-rice-toner-150ml.jpg', 12, true),

('Fig Cleansing Balm', '피그 클렌징 밤', 'I''m From', '아임프롬', 'cleanser',
 'Sherbet-texture cleansing balm with 7.8% fig oil water containing ficin and lipase that melts into oil to dissolve makeup then emulsifies for thorough cleansing.',
 100, '100ml', 24.00, 24000, 'https://www.wishtrend.com/cdn/shop/products/im-from-fig-cleansing-balm-100ml.jpg', 12, true),

-- MISSHA (3 new: sunscreen, essence, spot_treatment)
('M Perfect Cover BB Cream SPF42 PA+++', 'M 퍼펙트 커버 BB크림', 'Missha', '미샤', 'sunscreen',
 'Bestselling Korean BB cream with SPF42 PA+++ delivering buildable full-coverage color correction with a luminous finish and broad-spectrum sun protection.',
 50, '50ml', 19.00, 15000, 'https://misshaus.com/cdn/shop/products/m-perfect-cover-bb-cream-50ml.jpg', 24, true),

('Artemisia Calming Essence', '아르테미시아 카밍 에센스', 'Missha', '미샤', 'essence',
 'Single-hero-ingredient essence with 100% double-fermented Artemisia Annua Extract from Ganghwa Island that soothes redness and balances sensitive skin.',
 150, '150ml', 28.00, 24000, 'https://misshaus.com/cdn/shop/products/artemisia-calming-essence-150ml.jpg', 12, true),

('Vita C Plus Spot Correcting Ampoule', '비타 C 플러스 스팟 코렉팅 앰플', 'Missha', '미샤', 'spot_treatment',
 'Brightening ampoule with 33% Vita C Liposome Formula encapsulating 99% pure Vitamin C that targets dark spots and discoloration in a dual-action formula.',
 30, '30ml', 28.00, 39000, 'https://misshaus.com/cdn/shop/products/vita-c-plus-spot-ampoule-30ml.jpg', 12, true),

-- D'ALBA (3 new: mist, sunscreen, cleanser)
('White Truffle First Spray Serum', '화이트 트러플 퍼스트 스프레이 세럼', 'd''Alba', '달바', 'mist',
 'Globally bestselling all-in-one vegan serum mist with Italian White Truffle Extract that hydrates, tightens pores, and imparts a glass-skin glow. Over 20 million bottles sold.',
 100, '100ml', 25.00, 29000, 'https://dalba.com/cdn/shop/products/white-truffle-first-spray-serum-100ml.jpg', 12, true),

('Waterfull Tone-Up Sunscreen SPF50+ PA++++', '워터풀 톤업 선크림', 'd''Alba', '달바', 'sunscreen',
 'Tone-up sunscreen with SPF50+ PA++++ and White Truffle Extract that instantly brightens with a soft pink-tinted veil and delivers broad-spectrum protection.',
 50, '50ml', 25.00, 24000, 'https://dalba.com/cdn/shop/products/waterfull-tone-up-sunscreen-50ml.jpg', 12, true),

('Peptide No-Sebum Mild Gel Cleanser', '펩타이드 노-세붐 마일드 젤 클렌저', 'd''Alba', '달바', 'cleanser',
 'Peptide-infused luxury gel cleanser with Italian White Truffle that deep-cleanses pores, controls sebum, and delivers anti-aging benefits while preserving moisture.',
 150, '150ml', 20.00, 24000, 'https://dalba.com/cdn/shop/products/peptide-no-sebum-mild-gel-cleanser-150ml.jpg', 12, true),

-- SOME BY MI (3 new: exfoliator, sunscreen, moisturizer)
('AHA BHA PHA 30 Days Miracle Truecica Clear Pad', 'AHA BHA PHA 30일 미라클 트루시카 클리어 패드', 'Some By Mi', '썸바이미', 'exfoliator',
 'Exfoliating toner pads with AHA, BHA, PHA acids and Centella Asiatica (70 pads) that gently clear dead skin cells, refine pores, and smooth texture.',
 150, '70 pads', 22.00, 24000, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1078923456/1/A.jpg', 12, true),

('Truecica Mineral Calming Tone-Up Suncream SPF50+ PA++++', '트루시카 미네랄 카밍 톤업 선크림', 'Some By Mi', '썸바이미', 'sunscreen',
 'Physical mineral sunscreen with SPF50+ PA++++ and Centella Asiatica that calms sensitive skin, delivers brightening tone-up, and provides gentle UV protection.',
 50, '50ml', 18.00, 19000, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1082345678/1/A.jpg', 12, true),

('Yuja Niacin Brightening Moisture Gel Cream', '유자 나이아신 브라이트닝 모이스처 젤 크림', 'Some By Mi', '썸바이미', 'moisturizer',
 'Brightening gel-cream with 10,000 ppm Citron Extract, 5% Niacinamide, and 10 vitamins that evens skin tone and provides cool, refreshing hydration.',
 100, '100ml', 22.00, 24000, 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1085678901/1/A.jpg', 12, true),

-- ISNTREE (3 new: toner, moisturizer, ampoule)
('Hyaluronic Acid Toner Plus', '하이알루로닉 에시드 토너 플러스', 'Isntree', '이즈앤트리', 'toner',
 'Deeply hydrating toner with multi-weight Hyaluronic Acid molecules delivering layered moisture that plumps fine lines and leaves a dewy bouncy finish.',
 200, '200ml', 20.00, 22000, 'https://theisntree.com/cdn/shop/products/isntree-hyaluronic-acid-toner-plus-200ml.jpg', 12, true),

('Green Tea Fresh Emulsion', '그린티 프레쉬 에멀젼', 'Isntree', '이즈앤트리', 'moisturizer',
 'Lightweight emulsion with Green Tea Extract that controls excess sebum and provides antioxidant protection with balanced hydration for oily and combination skin.',
 120, '120ml', 17.00, 18000, 'https://theisntree.com/cdn/shop/products/isntree-green-tea-fresh-emulsion-120ml.jpg', 12, true),

('Spot Saver Mugwort Ampoule', '스팟 세이버 머그워트 앰플', 'Isntree', '이즈앤트리', 'ampoule',
 'Targeted soothing ampoule with Mugwort Extract and Niacinamide that calms irritated skin, reduces redness, and fades post-acne marks.',
 50, '50ml', 22.00, 25000, 'https://theisntree.com/cdn/shop/products/isntree-spot-saver-mugwort-ampoule-50ml.jpg', 12, true);


-- ============================================================================
-- Verify results
-- ============================================================================
SELECT
  'Total products' as metric,
  COUNT(*) as value
FROM ss_products
UNION ALL
SELECT
  'Total brands',
  COUNT(DISTINCT brand_en)
FROM ss_products
UNION ALL
SELECT
  'Total categories',
  COUNT(DISTINCT category)
FROM ss_products;
