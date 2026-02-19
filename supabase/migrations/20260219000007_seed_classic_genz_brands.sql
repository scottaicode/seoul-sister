-- ============================================================================
-- Seoul Sister Product Database — Classic K-beauty + Trending Gen-Z Brands
-- ~84 new products across 12 brands
-- Run in Supabase SQL Editor after 20260219000006
-- ============================================================================

INSERT INTO ss_products (
  name_en, name_ko, brand_en, brand_ko, category, subcategory,
  description_en, volume_ml, volume_display,
  price_krw, price_usd, rating_avg, review_count,
  is_verified, pao_months, shelf_life_months
) VALUES

-- ============================================================================
-- SKINFOOD (7 products) — Food-inspired K-beauty
-- ============================================================================

('Black Sugar Perfect First Serum The Light', '블랙슈가 퍼펙트 퍼스트 세럼 더 라이트',
 'Skinfood', '스킨푸드', 'serum', 'first serum',
 'A bestselling first-step serum with black sugar extract that exfoliates, hydrates, and brightens dull skin. Lightweight watery texture preps skin for better absorption of subsequent products.',
 120, '120ml', 20000, 15.50, 4.5, 6800, true, 12, 36),

('Royal Honey 100 Hour Moisture Cream', '로얄허니 100 아워 모이스처 크림',
 'Skinfood', '스킨푸드', 'moisturizer', NULL,
 'A rich moisturizer with Royal Jelly and propolis extract that provides up to 100 hours of moisture for extremely dry skin. Honey-infused texture nourishes and repairs the barrier.',
 100, '100ml', 25000, 19.00, 4.6, 5200, true, 12, 36),

('Egg White Pore Foam', '에그 화이트 포어 폼',
 'Skinfood', '스킨푸드', 'cleanser', 'foaming cleanser',
 'A pore-tightening foaming cleanser with real egg white extract that deeply cleanses, minimizes pores, and controls sebum. Creates dense, creamy foam for a satisfying cleansing experience.',
 150, '150ml', 12000, 9.00, 4.4, 7200, true, 12, 36),

('Carrot Carotene Calming Water Pad', '캐롯 카로틴 카밍 워터 패드',
 'Skinfood', '스킨푸드', 'toner', 'toner pad',
 'A calming toner pad with carrot seed oil and beta-carotene that soothes inflamed skin, delivers antioxidant protection, and lightly exfoliates. 60 pads for daily use.',
 NULL, '60 pads', 18000, 14.00, 4.5, 4800, true, 6, 24),

('Rice Wash Off Mask', '라이스 워시오프 마스크',
 'Skinfood', '스킨푸드', 'mask', 'wash-off mask',
 'An iconic brightening wash-off mask with finely ground rice bran that gently exfoliates dead skin cells, smooths texture, and reveals a brighter, more even complexion. K-beauty classic.',
 100, '100g', 10000, 8.00, 4.5, 8900, true, 6, 24),

('Black Sugar Honey Mask Wash Off', '블랙슈가 허니 마스크 워시오프',
 'Skinfood', '스킨푸드', 'mask', 'wash-off mask',
 'A nourishing exfoliating mask with black sugar granules and honey that buffs away dead skin while deeply moisturizing. Warm skin to melt sugar, then massage for gentle physical exfoliation.',
 100, '100g', 11000, 9.00, 4.5, 7600, true, 6, 24),

('Peach Cotton Multi Finish Powder', '피치 코튼 멀티 피니쉬 파우더',
 'Skinfood', '스킨푸드', 'sunscreen', 'setting powder',
 'A peach-extract setting powder with oil-control properties that mattifies, blurs pores, and sets makeup with a soft peach scent. Popular as a portable touch-up powder for K-beauty fans.',
 15, '15g', 12000, 9.50, 4.4, 5400, true, 12, 36),

-- ============================================================================
-- SECRET KEY (7 products) — Affordable K-beauty staples
-- ============================================================================

('Starting Treatment Essence Rose Edition', '스타팅 트리트먼트 에센스 로즈 에디션',
 'Secret Key', '시크릿 키', 'essence', 'first treatment',
 'A galactomyces ferment-based first treatment essence with damask rose water that brightens, refines skin texture, and boosts absorption of subsequent products. Cult-favorite dupe for luxury FTEs.',
 150, '150ml', 15000, 12.00, 4.5, 6200, true, 12, 36),

('Lemon Sparkling Cleansing Oil', '레몬 스파클링 클렌징 오일',
 'Secret Key', '시크릿 키', 'cleanser', 'cleansing oil',
 'An effervescent cleansing oil with lemon extract and carbonated water that dissolves makeup, sunscreen, and sebum with a fresh, sparkling sensation. Emulsifies and rinses clean.',
 150, '150ml', 13000, 10.00, 4.4, 4800, true, 12, 36),

('Aloe Soothing Moist Toner', '알로에 수딩 모이스트 토너',
 'Secret Key', '시크릿 키', 'toner', NULL,
 'A hydrating toner with 95% aloe vera extract that instantly soothes, hydrates, and calms irritated skin. Budget-friendly, large-format toner perfect for daily multi-layering (7-skin method).',
 248, '248ml', 10000, 8.00, 4.4, 5600, true, 12, 36),

('Hyaluron Aqua Micro Peel Cream', '히알루론 아쿠아 마이크로 필 크림',
 'Secret Key', '시크릿 키', 'moisturizer', 'peeling cream',
 'A peeling moisturizer with hyaluronic acid and AHA that gently resurfaces dull skin while providing hydration. Dual function for those who want exfoliation built into their moisture step.',
 70, '70g', 15000, 12.00, 4.3, 3200, true, 12, 36),

('Rose Water Base Toner', '로즈 워터 베이스 토너',
 'Secret Key', '시크릿 키', 'toner', NULL,
 'A rose water-based hydrating toner with damask rose extract that delivers soothing hydration and subtle brightening. Lightweight, alcohol-free formula suitable for daily layering.',
 550, '550ml', 12000, 9.50, 4.4, 4200, true, 12, 36),

('Snail + EGF Repairing Gel Cream', '스네일 + EGF 리페어링 젤 크림',
 'Secret Key', '시크릿 키', 'moisturizer', 'gel cream',
 'An affordable gel cream with snail mucin and EGF (Epidermal Growth Factor) that repairs damaged skin, improves elasticity, and provides lightweight moisture for combination skin.',
 50, '50g', 14000, 11.00, 4.4, 3800, true, 12, 36),

('Witch Hazel Pore Clear Toner Pad', '위치하젤 포어 클리어 토너패드',
 'Secret Key', '시크릿 키', 'exfoliator', 'toner pad',
 'A pore-refining toner pad with witch hazel and tea tree that removes residual impurities after cleansing, tightens pores, and controls excess oil. 70 pads for AM/PM use.',
 NULL, '70 pads', 13000, 10.00, 4.4, 4100, true, 6, 24),

-- ============================================================================
-- MIZON (7 products) — Snail pioneer brand
-- ============================================================================

('Snail Repair Eye Cream', '스네일 리페어 아이 크림',
 'Mizon', '미즌', 'eye_care', NULL,
 'An eye cream with 80% snail mucin filtrate that targets dark circles, fine lines, and puffiness around the delicate eye area. Rich but non-greasy texture absorbs quickly.',
 25, '25ml', 15000, 12.00, 4.5, 5800, true, 6, 24),

('All In One Snail Repair Cream', '올인원 스네일 리페어 크림',
 'Mizon', '미즌', 'moisturizer', NULL,
 'A multi-functional cream with 92% snail mucin that repairs, hydrates, brightens, and improves skin elasticity in one step. Lightweight gel-cream texture suitable for all skin types.',
 75, '75ml', 18000, 14.00, 4.6, 9200, true, 12, 36),

('Snail Repair Intensive Ampoule', '스네일 리페어 인텐시브 앰플',
 'Mizon', '미즌', 'ampoule', NULL,
 'A concentrated ampoule with 80% snail mucin and peptides that intensively repairs, firms, and rejuvenates damaged, aging skin. Use as a booster before moisturizer for enhanced results.',
 30, '30ml', 22000, 17.00, 4.5, 4200, true, 6, 24),

('Good Night White Sleeping Mask', '굿나이트 화이트 슬리핑 마스크',
 'Mizon', '미즌', 'mask', 'sleeping mask',
 'A brightening sleeping mask with niacinamide and glutathione that works overnight to brighten dark spots, even skin tone, and hydrate. Wake up to visibly brighter, dewy skin.',
 80, '80ml', 16000, 12.50, 4.4, 5600, true, 6, 24),

('AHA 8% Peeling Serum', 'AHA 8% 필링 세럼',
 'Mizon', '미즌', 'serum', 'chemical exfoliant',
 'An 8% glycolic acid chemical exfoliant serum that dissolves dead skin cells, unclogs pores, and reveals smoother, brighter skin. Use 2-3 times weekly for best results.',
 50, '50ml', 14000, 11.00, 4.4, 6100, true, 6, 24),

('Black Snail All In One Cream', '블랙 스네일 올인원 크림',
 'Mizon', '미즌', 'moisturizer', NULL,
 'A premium multi-functional cream with 90% fermented Black Snail Mucin that provides intense repair, anti-aging, brightening, and moisture in one luxurious step. Richer than the original.',
 75, '75ml', 25000, 19.00, 4.6, 4800, true, 12, 36),

('Vita Lemon Calming Cream', '비타 레몬 카밍 크림',
 'Mizon', '미즌', 'moisturizer', 'vitamin cream',
 'A vitamin-rich calming cream with lemon extract and vitamin C that brightens dull skin, soothes irritation, and delivers antioxidant protection. Lightweight citrus-scented texture.',
 50, '50ml', 16000, 12.50, 4.4, 3200, true, 12, 36),

-- ============================================================================
-- HOLIKA HOLIKA (7 products) — Playful, accessible K-beauty
-- ============================================================================

('Good Cera Super Ceramide Cream', '굿 세라 슈퍼 세라마이드 크림',
 'Holika Holika', '홀리카홀리카', 'moisturizer', 'barrier cream',
 'A ceramide-rich barrier cream with 5 types of ceramides and hyaluronic acid that deeply strengthens and moisturizes dry, barrier-compromised skin. K-beauty drugstore hero product.',
 60, '60ml', 18000, 14.00, 4.6, 7200, true, 12, 36),

('Aloe 99% Soothing Gel', '알로에 99% 수딩 젤',
 'Holika Holika', '홀리카홀리카', 'moisturizer', 'soothing gel',
 'A multi-use soothing gel with 99% Jeju aloe vera that cools, hydrates, and calms irritated, sun-exposed skin. Can be used on face, body, and hair. Iconic K-beauty aloe gel.',
 250, '250ml', 7000, 5.50, 4.5, 11200, true, 12, 36),

('Pig-Nose Clear Black Head 3-Step Kit', '피그노즈 클리어 블랙헤드 3스텝 키트',
 'Holika Holika', '홀리카홀리카', 'exfoliator', 'pore care',
 'A fun 3-step blackhead removal kit: Step 1 opens pores, Step 2 charcoal strip removes blackheads, Step 3 toner pad tightens pores. Iconic K-beauty packaging.',
 NULL, '3-step kit', 3000, 2.50, 4.2, 8900, true, 6, 24),

('Smooth Egg Skin Peeling Gel', '스무스 에그 스킨 필링 젤',
 'Holika Holika', '홀리카홀리카', 'exfoliator', 'peeling gel',
 'A peeling gel with egg extracts that rolls away dead skin cells and impurities, leaving skin smooth and egg-like. Gentle enough for sensitive skin, satisfying visible dead skin removal.',
 140, '140ml', 12000, 9.50, 4.4, 5600, true, 12, 36),

('Skin & Good Cera Ultra Emulsion', '스킨 앤 굿 세라 울트라 에멀전',
 'Holika Holika', '홀리카홀리카', 'moisturizer', 'emulsion',
 'A lightweight ceramide emulsion that strengthens the moisture barrier and provides balanced hydration for normal to combination skin. Layer under cream for extra moisture in winter.',
 130, '130ml', 16000, 12.50, 4.5, 4200, true, 12, 36),

('Gold Kiwi Vita C+ Brightening Serum', '골드 키위 비타C+ 브라이트닝 세럼',
 'Holika Holika', '홀리카홀리카', 'serum', 'brightening',
 'A vitamin C brightening serum with gold kiwi extract rich in natural vitamin C that fades dark spots, evens skin tone, and delivers antioxidant glow. Affordable vitamin C option.',
 45, '45ml', 18000, 14.00, 4.4, 3800, true, 6, 24),

('Prime Youth Black Snail Repair Emulsion', '프라임유스 블랙 스네일 리페어 에멀전',
 'Holika Holika', '홀리카홀리카', 'moisturizer', 'emulsion',
 'An anti-aging emulsion with fermented black snail mucin, adenosine, and peptides that firms, brightens, and repairs aging skin. Medium-weight texture bridges serum and cream.',
 160, '160ml', 22000, 17.00, 4.5, 3200, true, 12, 36),

-- ============================================================================
-- IT'S SKIN (7 products) — Dermatologist-backed affordable brand
-- ============================================================================

('Power 10 Formula VE Effector', '파워10 포뮬러 VE 이펙터',
 'It''s Skin', '잇츠스킨', 'serum', 'vitamin E',
 'A vitamin E concentrate serum from the iconic Power 10 line that deeply nourishes dry, dull skin with antioxidant protection. Mix with other Power 10 formulas for customized treatment.',
 30, '30ml', 12000, 9.50, 4.5, 5600, true, 6, 24),

('Power 10 Formula VC Effector', '파워10 포뮬러 VC 이펙터',
 'It''s Skin', '잇츠스킨', 'serum', 'vitamin C',
 'A vitamin C brightening serum from the Power 10 line with ascorbic acid that fades dark spots, brightens dull skin, and provides antioxidant defense. Affordable entry to vitamin C.',
 30, '30ml', 12000, 9.50, 4.4, 6800, true, 6, 24),

('Prestige Creme D''Escargot', '프레스티지 크렘 데스까르고',
 'It''s Skin', '잇츠스킨', 'moisturizer', 'snail cream',
 'A luxurious snail cream with 21% snail mucin and EGF that repairs damaged skin, reduces fine lines, and improves elasticity. Rich yet non-sticky texture for overnight nourishment.',
 60, '60ml', 35000, 27.00, 4.5, 4200, true, 12, 36),

('Green Tea Watery Cream', '그린티 워터리 크림',
 'It''s Skin', '잇츠스킨', 'moisturizer', 'gel cream',
 'A lightweight water-based cream with green tea extract that hydrates, soothes, and controls excess oil for combination and oily skin. Fresh gel texture perfect for summer.',
 50, '50ml', 14000, 11.00, 4.4, 3800, true, 12, 36),

('Hyaluronic Acid Moisture Cream', '히알루로닉 에시드 모이스처 크림',
 'It''s Skin', '잇츠스킨', 'moisturizer', NULL,
 'A deep-hydrating cream with hyaluronic acid and ceramides that provides 72-hour moisture for dry, dehydrated skin. Soft, whipped texture absorbs well and plumps fine lines.',
 50, '50ml', 16000, 12.50, 4.5, 3200, true, 12, 36),

('Collagen Nutrition Cream', '콜라겐 뉴트리션 크림',
 'It''s Skin', '잇츠스킨', 'moisturizer', 'anti-aging',
 'An anti-aging cream with marine collagen, Baobab seed oil, and adenosine that firms sagging skin, reduces wrinkles, and provides deep nourishment. For mature and dry skin types.',
 50, '50ml', 18000, 14.00, 4.4, 2800, true, 12, 36),

('Power 10 Formula GF Effector', '파워10 포뮬러 GF 이펙터',
 'It''s Skin', '잇츠스킨', 'serum', 'anti-aging',
 'A growth factor serum from the Power 10 line that targets fine lines, loss of firmness, and dull skin with EGF and peptide complex. Budget-friendly anti-aging entry point.',
 30, '30ml', 12000, 9.50, 4.4, 4200, true, 6, 24),

-- ============================================================================
-- MAMONDE (7 products) — AmorePacific flower-powered brand
-- ============================================================================

('Rose Water Toner', '로즈 워터 토너',
 'Mamonde', '마몽드', 'toner', NULL,
 'A hydrating toner with 90% Damask Rose Water that soothes, hydrates, and imparts a subtle rosy glow. Natural rose scent and lightweight texture make it perfect for daily multi-layering.',
 250, '250ml', 16000, 12.50, 4.6, 8200, true, 12, 36),

('Flower Lab Essence Mask Rose', '플라워 랩 에센스 마스크 로즈',
 'Mamonde', '마몽드', 'mask', 'sheet mask',
 'A sheet mask infused with Damask Rose extract essence that deeply hydrates, soothes, and imparts a natural glow in 15 minutes. Soft, adherent sheet for comfortable wear.',
 NULL, '1 sheet', 2500, 2.00, 4.5, 5600, true, 6, 24),

('Ceramide Light Cream', '세라마이드 라이트 크림',
 'Mamonde', '마몽드', 'moisturizer', NULL,
 'A lightweight ceramide cream with 5 types of ceramides extracted from lotus flowers that strengthens the moisture barrier without heaviness. Ideal for normal to combination skin year-round.',
 50, '50ml', 22000, 17.00, 4.6, 4800, true, 12, 36),

('Petal Spa Oil To Foam', '페탈 스파 오일 투 폼',
 'Mamonde', '마몽드', 'cleanser', 'oil-to-foam',
 'A dual-phase cleanser that transforms from oil to foam for complete double-cleansing in one step. Rose and Jasmine petal oils dissolve makeup, then foam lifts away impurities.',
 175, '175ml', 20000, 15.50, 4.5, 3800, true, 12, 36),

('Red Energy Recovery Serum', '레드 에너지 리커버리 세럼',
 'Mamonde', '마몽드', 'serum', 'anti-aging',
 'An anti-aging recovery serum with Red Bean extract and pomegranate flower that revitalizes tired, stressed skin, improves elasticity, and reduces fine lines. Warm red color from natural ingredients.',
 50, '50ml', 35000, 27.00, 4.5, 3200, true, 6, 24),

('Enriched Nutri Cream', '인리치드 뉴트리 크림',
 'Mamonde', '마몽드', 'moisturizer', 'nourishing cream',
 'A rich nourishing cream with Camellia oil and shea butter that intensely moisturizes and protects dry, mature skin during winter. Velvety texture melts in without greasiness.',
 50, '50ml', 28000, 22.00, 4.5, 2800, true, 12, 36),

('Floral Hydro Eye Gel Cream', '플로럴 하이드로 아이 젤 크림',
 'Mamonde', '마몽드', 'eye_care', NULL,
 'A lightweight eye gel cream with Narcissus extract that hydrates, depuffs, and brightens the delicate eye area. Cooling gel texture absorbs quickly without creasing under concealer.',
 20, '20ml', 22000, 17.00, 4.4, 2800, true, 6, 24),

-- ============================================================================
-- JUMISO (7 products) — Gen Z trending brand
-- ============================================================================

('All Day Vitamin Brightening & Balancing Facial Serum', '올 데이 비타민 브라이트닝 세럼',
 'Jumiso', '주미소', 'serum', 'brightening',
 'A viral brightening serum with 5% Ascorbic Acid and 2% Niacinamide that fades dark spots, evens skin tone, and delivers antioxidant glow. Stable vitamin C formula at affordable price.',
 30, '30ml', 18000, 14.00, 4.7, 8200, true, 6, 24),

('Have a Good Cream Snail & Centella', '해브 어 굿 크림 스네일 앤 센텔라',
 'Jumiso', '주미소', 'moisturizer', NULL,
 'A soothing repair cream with Snail Mucin and Centella Asiatica that calms irritation, heals blemishes, and provides balanced hydration. Gen Z favorite for acne-prone skin.',
 50, '50ml', 16000, 12.50, 4.6, 5800, true, 12, 36),

('Waterfull Hyaluronic Cream', '워터풀 히알루로닉 크림',
 'Jumiso', '주미소', 'moisturizer', NULL,
 'A deep-hydration cream with 3 types of hyaluronic acid and glacial water that provides 72-hour moisture for dehydrated skin. Bouncy water-gel texture plumps and dewifies.',
 50, '50ml', 18000, 14.00, 4.6, 4200, true, 12, 36),

('Yes I Am Toner AHA 5%', '예스 아이앰 토너 AHA 5%',
 'Jumiso', '주미소', 'toner', 'exfoliating toner',
 'A 5% AHA exfoliating toner with Glycolic and Lactic acids that gently resurfaces dull skin, minimizes pores, and promotes cell turnover. Low-irritation formula for weekly use.',
 150, '150ml', 16000, 12.50, 4.5, 3800, true, 12, 36),

('AWE Sun Airy-fit Daily Moisturizer SPF50+ PA++++', '어썬 에어리핏 데일리 모이스처라이저',
 'Jumiso', '주미소', 'sunscreen', NULL,
 'A lightweight moisturizing sunscreen with SPF50+ PA++++ that doubles as a daily moisturizer. No white cast, dewy finish, works beautifully under makeup. Viral on TikTok.',
 50, '50ml', 16000, 12.50, 4.7, 7800, true, 6, 24),

('Have a Good Cream Vitamin C 5%', '해브 어 굿 크림 비타민C 5%',
 'Jumiso', '주미소', 'moisturizer', 'vitamin cream',
 'A vitamin C moisturizer with 5% ascorbic acid and niacinamide that brightens, hydrates, and protects against environmental damage. Pairs with the Vitamin Serum for enhanced brightening.',
 50, '50ml', 18000, 14.00, 4.5, 3200, true, 12, 36),

('First Skin Brightening Toner', '퍼스트 스킨 브라이트닝 토너',
 'Jumiso', '주미소', 'toner', 'brightening',
 'A brightening first-step toner with rice ferment, niacinamide, and glutathione that evens skin tone and preps for better serum absorption. Transparent, watery texture.',
 200, '200ml', 18000, 14.00, 4.5, 3400, true, 12, 36),

-- ============================================================================
-- MARY & MAY (7 products) — Trending clean vegan brand
-- ============================================================================

('Idebenone + Blackberry Complex Intensive Total Care Cream', '이데베논 블랙베리 인텐시브 토탈케어 크림',
 'Mary & May', '메리앤메이', 'moisturizer', 'anti-aging',
 'An antioxidant-rich cream with Idebenone (most potent antioxidant) and blackberry complex that fights free radicals, firms skin, and provides deep nourishment. Vegan certified.',
 50, '50ml', 22000, 17.00, 4.6, 4800, true, 12, 36),

('Wash Off Pack Lemon Niacinamide Glow', '워시오프팩 레몬 나이아신아마이드 글로우',
 'Mary & May', '메리앤메이', 'mask', 'wash-off mask',
 'A brightening wash-off mask with 10% Niacinamide and lemon extract that visibly brightens dull skin, fades dark spots, and delivers glow in 5-10 minutes. Vegan, cruelty-free.',
 125, '125g', 15000, 12.00, 4.6, 5200, true, 6, 24),

('Cica Soothing Sun Cream SPF50+ PA++++', '시카 수딩 선크림 SPF50+ PA++++',
 'Mary & May', '메리앤메이', 'sunscreen', NULL,
 'A vegan soothing sunscreen with Centella Asiatica, SPF50+ PA++++ protection, and no white cast. Calms sensitive skin while protecting from UV damage. Lightweight daily formula.',
 50, '50ml', 18000, 14.00, 4.6, 5400, true, 6, 24),

('Houttuynia Cordata + Tea Tree Serum', '어성초 티트리 세럼',
 'Mary & May', '메리앤메이', 'serum', 'acne care',
 'A blemish-fighting serum with Heartleaf and Tea Tree extracts that targets active breakouts, calms inflammation, and prevents future acne. Clean vegan formula for sensitive acne-prone skin.',
 30, '30ml', 18000, 14.00, 4.6, 4800, true, 6, 24),

('Tranexamic Acid + Glutathione Eye Cream', '트라넥사믹 에시드 글루타치온 아이크림',
 'Mary & May', '메리앤메이', 'eye_care', NULL,
 'A brightening eye cream with Tranexamic Acid, Glutathione, and Niacinamide that targets dark circles, fine lines, and puffiness. Lightweight gel-cream for the delicate eye area.',
 12, '12g', 16000, 12.50, 4.5, 3200, true, 6, 24),

('6 Peptide Complex Serum', '6 펩타이드 컴플렉스 세럼',
 'Mary & May', '메리앤메이', 'serum', 'anti-aging',
 'An anti-aging serum with 6 peptide complex including Copper Tripeptide-1, Acetyl Hexapeptide-8, and Palmitoyl Pentapeptide-4 that firms, smooths fine lines, and boosts collagen production.',
 30, '30ml', 20000, 15.50, 4.5, 3800, true, 6, 24),

('Calendula Peptide Ageless Sleeping Mask', '카렌듈라 펩타이드 에이지리스 슬리핑 마스크',
 'Mary & May', '메리앤메이', 'mask', 'sleeping mask',
 'An overnight sleeping mask with real Calendula petals and peptides that repairs, firms, and hydrates skin while you sleep. Wake up to plumper, smoother skin with reduced fine lines.',
 110, '110g', 18000, 14.00, 4.5, 3400, true, 6, 24),

-- ============================================================================
-- TIRTIR (7 products) — TikTok viral brand
-- ============================================================================

('Mask Fit Red Cushion', '마스크핏 레드 쿠션',
 'TIRTIR', '티르티르', 'moisturizer', 'cushion foundation',
 'The #1 viral K-beauty cushion foundation with buildable coverage, dewy finish, and 40+ shade range. 50-hour wear with mask-proof formula. Broke the internet with shade inclusivity.',
 18, '18g', 28000, 22.00, 4.7, 15200, true, 12, 36),

('Ceramic Milk Ampoule Toner', '세라믹 밀크 앰플 토너',
 'TIRTIR', '티르티르', 'toner', NULL,
 'A milky ceramide toner with 5 ceramide complex and hyaluronic acid that strengthens the moisture barrier and provides creamy hydration. Rich texture for dry and sensitive skin.',
 130, '130ml', 22000, 17.00, 4.5, 4200, true, 12, 36),

('Collagen Core Glow Essence', '콜라겐 코어 글로우 에센스',
 'TIRTIR', '티르티르', 'essence', NULL,
 'A collagen-boosting essence with 10,000ppm collagen extract and peptides that delivers deep hydration, improves skin elasticity, and creates a glass-skin glow from within.',
 50, '50ml', 25000, 19.00, 4.5, 3800, true, 12, 36),

('Our Vegan Cica Cream', '아워 비건 시카 크림',
 'TIRTIR', '티르티르', 'moisturizer', 'cica cream',
 'A vegan cica cream with Centella Asiatica and panthenol that calms irritated, sensitive skin and strengthens the barrier. Clean formula free from 20 irritants.',
 50, '50ml', 20000, 15.50, 4.5, 3400, true, 12, 36),

('Mask Fit All Cover Cushion', '마스크핏 올커버 쿠션',
 'TIRTIR', '티르티르', 'moisturizer', 'cushion foundation',
 'The full-coverage sister to the Red Cushion with matte finish for oily skin. Same viral 40+ shade range, 50-hour wear, and mask-proof formula with maximum coverage.',
 18, '18g', 28000, 22.00, 4.6, 8900, true, 12, 36),

('SOS Double Glow Serum', 'SOS 더블 글로우 세럼',
 'TIRTIR', '티르티르', 'serum', 'brightening',
 'A dual-glow serum with niacinamide and vitamin C that targets dullness, dark spots, and uneven skin tone. Creates a luminous base for the viral cushion application.',
 30, '30ml', 20000, 15.50, 4.5, 3200, true, 6, 24),

('Milk Skin Toner', '밀크 스킨 토너',
 'TIRTIR', '티르티르', 'toner', NULL,
 'A milky brightening toner with rice milk and niacinamide that gently exfoliates, brightens, and provides creamy hydration. Creates the "milk skin" look trending on Korean social media.',
 150, '150ml', 20000, 15.50, 4.5, 3800, true, 12, 36),

-- ============================================================================
-- THANK YOU FARMER (7 products) — Premium clean brand
-- ============================================================================

('Sun Project Water Sun Cream SPF50+ PA+++', '선 프로젝트 워터 선크림 SPF50+ PA+++',
 'Thank You Farmer', '땡큐파머', 'sunscreen', NULL,
 'A lightweight watery sunscreen with SPF50+ PA+++ that hydrates while protecting from UV damage. No white cast, no pilling, works perfectly as a makeup base. K-beauty sunscreen favorite.',
 50, '50ml', 20000, 15.50, 4.6, 6800, true, 6, 24),

('True Water Deep Serum', '트루 워터 딥 세럼',
 'Thank You Farmer', '땡큐파머', 'serum', NULL,
 'A deep-hydration serum with 7 types of hyaluronic acid and Dandelion extract that provides multi-layer moisture from deep within. Lightweight water-gel texture for plump, dewy skin.',
 60, '60ml', 28000, 22.00, 4.6, 3800, true, 6, 24),

('Rice Pure Clay Mask to Foam', '라이스 퓨어 클레이 마스크 투 폼',
 'Thank You Farmer', '땡큐파머', 'mask', 'clay mask',
 'A dual-use product that works as a clay mask (3 min) or foaming cleanser. Korean rice extract and white clay purify pores while brightening without stripping moisture.',
 150, '150ml', 20000, 15.50, 4.5, 3200, true, 12, 36),

('Back To Iceland Cleansing Water', '백투 아이슬란드 클렌징 워터',
 'Thank You Farmer', '땡큐파머', 'cleanser', 'cleansing water',
 'A refreshing cleansing water with Iceland Moss extract that gently removes makeup and impurities without rubbing or rinsing. Soothes and hydrates while cleansing for sensitive skin.',
 260, '260ml', 22000, 17.00, 4.5, 2800, true, 12, 36),

('Miracle Age Repair Cream', '미라클 에이지 리페어 크림',
 'Thank You Farmer', '땡큐파머', 'moisturizer', 'anti-aging',
 'A premium anti-aging cream with 64% fermented complex and shea butter that repairs, firms, and deeply nourishes aging skin. Clinical tests show improved elasticity in 4 weeks.',
 50, '50ml', 38000, 29.00, 4.5, 2200, true, 12, 36),

('True Water Light Gel Cream', '트루 워터 라이트 젤 크림',
 'Thank You Farmer', '땡큐파머', 'moisturizer', 'gel cream',
 'A lightweight gel cream with Dandelion extract and hyaluronic acid that provides weightless hydration for oily and combination skin. Fresh, cooling texture perfect for hot weather.',
 50, '50ml', 26000, 20.00, 4.5, 3400, true, 12, 36),

('Rice Pure Essential Toner', '라이스 퓨어 에센셜 토너',
 'Thank You Farmer', '땡큐파머', 'toner', NULL,
 'A brightening toner with Korean rice extract and niacinamide that evens skin tone, hydrates, and refines texture. Milky-watery texture delivers nutrients from the first step.',
 200, '200ml', 22000, 17.00, 4.5, 2800, true, 12, 36),

-- ============================================================================
-- HARUHARU WONDER (7 products) — Clean fermented brand
-- ============================================================================

('Black Rice Hyaluronic Toner', '흑미 히알루로닉 토너',
 'Haruharu Wonder', '하루하루원더', 'toner', NULL,
 'A bestselling hydrating toner with fermented Black Rice extract and hyaluronic acid that provides deep moisture, brightening, and anti-aging benefits in the first step. EWG Green Grade.',
 150, '150ml', 18000, 14.00, 4.7, 7200, true, 12, 36),

('Black Rice Hyaluronic Anti-Wrinkle Serum', '흑미 히알루로닉 안티링클 세럼',
 'Haruharu Wonder', '하루하루원더', 'serum', 'anti-aging',
 'An anti-wrinkle serum with fermented Black Rice, Adenosine, and 6 types of hyaluronic acid that smooths fine lines, firms sagging skin, and delivers deep hydration. Clean, EWG-verified.',
 50, '50ml', 22000, 17.00, 4.6, 4800, true, 6, 24),

('Black Rice Moisture Airyfit Daily Sunscreen SPF50+ PA++++', '흑미 모이스처 에어리핏 데일리 선스크린',
 'Haruharu Wonder', '하루하루원더', 'sunscreen', NULL,
 'A clean daily sunscreen with fermented Black Rice and Centella that provides SPF50+ PA++++ protection with no white cast. Lightweight, moisturizing formula for year-round use.',
 50, '50ml', 18000, 14.00, 4.6, 5200, true, 6, 24),

('Black Rice Bakuchiol Eye Cream', '흑미 바쿠치올 아이크림',
 'Haruharu Wonder', '하루하루원더', 'eye_care', NULL,
 'A natural retinol-alternative eye cream with Bakuchiol and fermented Black Rice that targets dark circles, fine lines, and loss of firmness around the eyes. Gentle enough for sensitive skin.',
 15, '15ml', 20000, 15.50, 4.5, 2800, true, 6, 24),

('Maqui Berry Anti-Oxidant Cream', '마키베리 안티옥시던트 크림',
 'Haruharu Wonder', '하루하루원더', 'moisturizer', 'antioxidant',
 'An antioxidant-rich cream with Maqui Berry (highest ORAC value superfruit) that protects skin from environmental stressors and provides deep nourishment. Deep purple hue from natural berry pigment.',
 50, '50ml', 25000, 19.00, 4.5, 2800, true, 12, 36),

('Black Rice Hyaluronic Cream', '흑미 히알루로닉 크림',
 'Haruharu Wonder', '하루하루원더', 'moisturizer', NULL,
 'A nourishing cream from the Black Rice line with fermented Black Rice, ceramides, and hyaluronic acid that deeply moisturizes, brightens, and strengthens the skin barrier. Clean formula.',
 50, '50ml', 24000, 18.50, 4.6, 3400, true, 12, 36),

('Black Rice Facial Cleansing Oil', '흑미 페이셜 클렌징 오일',
 'Haruharu Wonder', '하루하루원더', 'cleanser', 'cleansing oil',
 'A clean cleansing oil with fermented Black Rice oil that dissolves makeup, sunscreen, and impurities. Lightweight formula emulsifies and rinses clean without residue. EWG Green Grade.',
 150, '150ml', 18000, 14.00, 4.5, 3200, true, 12, 36),

-- ============================================================================
-- NACIFIC (7 products) — Natural Pacific clean brand
-- ============================================================================

('Fresh Herb Origin Serum', '프레쉬 허브 오리진 세럼',
 'Nacific', '나시픽', 'serum', NULL,
 'A bestselling multi-herb serum with 56.7% natural botanical extracts including chamomile, calendula, and allantoin that soothes, brightens, and delivers antioxidant protection. Clean formula.',
 50, '50ml', 20000, 15.50, 4.6, 6200, true, 6, 24),

('Real Floral Toner Rose', '리얼 플로럴 토너 로즈',
 'Nacific', '나시픽', 'toner', NULL,
 'A hydrating toner with real Rose petals floating inside (96% Damask Rose Water) that soothes, hydrates, and provides a subtle rosy glow. Beautiful on the vanity and effective on the skin.',
 180, '180ml', 17000, 13.00, 4.5, 4800, true, 12, 36),

('Phyto Niacin Whitening Essence', '파이토 나이아신 화이트닝 에센스',
 'Nacific', '나시픽', 'essence', 'brightening',
 'A potent brightening essence with 5% Niacinamide and phyto-complex that targets hyperpigmentation, melasma, and uneven skin tone. Clinically proven to brighten within 2 weeks.',
 50, '50ml', 22000, 17.00, 4.5, 5200, true, 12, 36),

('Fresh Herb Origin Cleansing Oil', '프레쉬 허브 오리진 클렌징 오일',
 'Nacific', '나시픽', 'cleanser', 'cleansing oil',
 'A herbal cleansing oil with Olive, Sunflower, and Jojoba oils blended with fresh herb extracts that dissolves makeup and sebum without stripping. Emulsifies cleanly for a fresh finish.',
 150, '150ml', 18000, 14.00, 4.5, 3800, true, 12, 36),

('Jeju Artemisia Essence', '제주 아르테미시아 에센스',
 'Nacific', '나시픽', 'essence', NULL,
 'A calming essence with 100% Jeju Artemisia (Mugwort) extract that soothes redness, strengthens the barrier, and hydrates sensitive skin. Single-ingredient purity for clean skincare fans.',
 150, '150ml', 25000, 19.00, 4.6, 3400, true, 12, 36),

('Vita Ceramide Moisture Cream', '비타 세라마이드 모이스처 크림',
 'Nacific', '나시픽', 'moisturizer', NULL,
 'A ceramide moisturizer enriched with Vitamin E that strengthens the skin barrier, prevents moisture loss, and provides lasting comfort for dry and sensitive skin. Clean, fragrance-free formula.',
 50, '50ml', 22000, 17.00, 4.5, 3200, true, 12, 36),

('Uyu Cream (Milk Cream)', '우유 크림',
 'Nacific', '나시픽', 'moisturizer', 'brightening cream',
 'A viral milk cream with milk protein extract and niacinamide that brightens, hydrates, and delivers a glass-skin finish. Creates the coveted "milk skin" look popular in Korean skincare.',
 50, '50ml', 18000, 14.00, 4.5, 4200, true, 12, 36);


-- ============================================================================
-- Verify counts
-- ============================================================================
SELECT brand_en, COUNT(*) AS count
FROM ss_products
WHERE brand_en IN ('Skinfood','Secret Key','Mizon','Holika Holika','It''s Skin','Mamonde','Jumiso','Mary & May','TIRTIR','Thank You Farmer','Haruharu Wonder','Nacific')
GROUP BY brand_en ORDER BY brand_en;
