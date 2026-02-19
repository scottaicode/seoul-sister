-- ============================================================================
-- Seoul Sister Product Database — Deepening Existing Brands (Part 2) +
-- New Brands (Peripera, CLIO, Romand, Hanyul, Frudia, Espoir)
-- ~126 new products
-- Run in Supabase SQL Editor after 20260219000009
-- ============================================================================

INSERT INTO ss_products (
  name_en, name_ko, brand_en, brand_ko, category, subcategory,
  description_en, volume_ml, volume_display,
  price_krw, price_usd, rating_avg, review_count,
  is_verified, pao_months, shelf_life_months
) VALUES

-- ============================================================================
-- KLAIRS (7 new products)
-- Existing: Supple Preparation Unscented Toner, Freshly Juiced Vitamin C Drop,
--   Midnight Blue Calming Cream, Fundamental Nourishing Eye Butter,
--   Soft Airy UV Essence SPF50+ PA++++
-- ============================================================================

('Rich Moist Soothing Cream', '리치 모이스트 수딩 크림',
 'Klairs', '클레어스', 'moisturizer', NULL,
 'A gentle moisturizing cream with Yeast-Derived Beta-Glucan and Ceramides that soothes sensitive skin while providing deep, lasting hydration. Fragrance-free, lightweight texture.',
 60, '60ml', 23000, 18.00, 4.6, 5800, true, 12, 36),

('Freshly Juiced Vitamin E Mask', '프레쉴리 쥬스드 비타민 E 마스크',
 'Klairs', '클레어스', 'mask', 'sleeping mask',
 'A nourishing overnight mask with Vitamin E and Niacinamide that rejuvenates tired, dull skin while you sleep. Rich cream-gel texture locks in moisture and antioxidant protection.',
 90, '90ml', 26000, 20.00, 4.5, 4200, true, 6, 24),

('Gentle Black Deep Cleansing Oil', '젠틀 블랙 딥 클렌징 오일',
 'Klairs', '클레어스', 'cleanser', 'cleansing oil',
 'A gentle cleansing oil with black bean and black sesame seed oil that dissolves makeup and sunscreen without stripping moisture. Emulsifies cleanly for double-cleansing step one.',
 150, '150ml', 20000, 15.50, 4.6, 4800, true, 12, 36),

('Rich Moist Soothing Serum', '리치 모이스트 수딩 세럼',
 'Klairs', '클레어스', 'serum', NULL,
 'A calming serum with rice bran, licorice root, and Centella Asiatica that instantly soothes redness and provides lightweight moisture. Perfect for sensitive and irritation-prone skin.',
 80, '80ml', 22000, 17.00, 4.5, 3800, true, 6, 24),

('Supple Preparation All-Over Lotion', '서플 프레퍼레이션 올오버 로션',
 'Klairs', '클레어스', 'moisturizer', 'lotion',
 'A lightweight full-body lotion with Ceramides and Panthenol that hydrates from face to toe. Mild, fragrance-free formula suitable for all skin types including babies.',
 250, '250ml', 18000, 14.00, 4.5, 3200, true, 12, 36),

('Midnight Blue Youth Activating Drop', '미드나이트 블루 유스 액티베이팅 드롭',
 'Klairs', '클레어스', 'serum', 'anti-aging',
 'An anti-aging serum concentrate with EGF (Epidermal Growth Factor) and Glutathione that activates cell renewal, reduces fine lines, and brightens. Uses same blue calming base.',
 20, '20ml', 28000, 22.00, 4.5, 2800, true, 6, 24),

('Mid-Day Blue UV Shield SPF50+ PA++++', '미드데이 블루 UV 쉴드 SPF50+',
 'Klairs', '클레어스', 'sunscreen', NULL,
 'A refreshing blue-tinted sunscreen with SPF50+ PA++++ and Guaiazulene that provides UV protection while calming skin. Lightweight, no white cast, re-applicable over makeup.',
 50, '50ml', 25000, 19.00, 4.5, 4200, true, 6, 24),

-- ============================================================================
-- SOME BY MI (7 new products)
-- Existing: AHA BHA PHA 30 Days Miracle Toner, Snail Truecica Miracle Repair
--   Serum, AHA BHA PHA 30 Days Miracle Cream, Yuja Niacin Brightening
--   Sleeping Mask, Galactomyces Pure Vitamin C Glow Serum
-- ============================================================================

('AHA BHA PHA 30 Days Miracle Serum', 'AHA BHA PHA 30 데이즈 미라클 세럼',
 'Some By Mi', '썸바이미', 'serum', 'acne treatment',
 'A triple acid serum with AHA (Glycolic), BHA (Salicylic), and PHA (Gluconolactone) that targets acne, enlarged pores, and rough texture. 30-day miracle system for clear skin.',
 50, '50ml', 19000, 15.00, 4.5, 6200, true, 6, 24),

('AHA BHA PHA 30 Days Miracle Cleansing Foam', 'AHA BHA PHA 30 데이즈 미라클 클렌징 폼',
 'Some By Mi', '썸바이미', 'cleanser', 'foaming cleanser',
 'A pH 5.5 cleansing foam with triple acids and Tea Tree that deeply cleanses acne-prone skin, removes excess sebum, and prevents breakouts. Part of the Miracle system.',
 100, '100ml', 10000, 8.00, 4.4, 5800, true, 12, 36),

('Truecica Mineral 100 Calming Suncream SPF50+ PA++++', '트루시카 미네랄 100 카밍 선크림',
 'Some By Mi', '썸바이미', 'sunscreen', NULL,
 'A 100% mineral (physical) sunscreen with Centella Asiatica that provides SPF50+ PA++++ protection while calming sensitive, acne-prone skin. Zinc oxide-based, gentle formula.',
 50, '50ml', 18000, 14.00, 4.5, 5200, true, 6, 24),

('Yuja Niacin 30 Days Brightening Toner', '유자 나이아신 30 데이즈 브라이트닝 토너',
 'Some By Mi', '썸바이미', 'toner', 'brightening',
 'A brightening toner with Yuja (Citron) extract and 5% Niacinamide that targets dull, uneven skin tone and dark spots. 30-day visible brightening results.',
 150, '150ml', 16000, 12.50, 4.5, 4800, true, 12, 36),

('Retinol Intense Reactivating Serum', '레티놀 인텐스 리액티베이팅 세럼',
 'Some By Mi', '썸바이미', 'serum', 'retinol',
 'A retinol serum with encapsulated retinol and bakuchiol that targets fine lines, wrinkles, and loss of firmness while minimizing irritation. Gradual-release technology for sensitive skin.',
 30, '30ml', 22000, 17.00, 4.4, 3800, true, 6, 24),

('Super Matcha Pore Clean Cleansing Gel', '슈퍼 말차 포어 클린 클렌징 젤',
 'Some By Mi', '썸바이미', 'cleanser', 'gel cleanser',
 'A matcha-powered gel cleanser with BHA that deep-cleans pores, controls sebum, and provides antioxidant protection. Creates a satisfying foam for oily and acne-prone skin.',
 100, '100ml', 12000, 9.50, 4.4, 4200, true, 12, 36),

('V10 Hyal Antioxidant Sunscreen SPF50+ PA++++', 'V10 히알 안티옥시던트 선스크린',
 'Some By Mi', '썸바이미', 'sunscreen', NULL,
 'An antioxidant-rich sunscreen with 10 vitamins and hyaluronic acid that provides SPF50+ PA++++ protection while hydrating and protecting against environmental damage. Lightweight daily wear.',
 40, '40ml', 18000, 14.00, 4.5, 3200, true, 6, 24),

-- ============================================================================
-- MISSHA (7 new products)
-- Existing: Time Revolution The First Treatment Essence RX, M Perfect Cover
--   BB Cream SPF42, Chogongjin Geum Sul Overnight Cream, Vita C Plus
--   Erasing Cream, Time Revolution Night Repair Ampoule 5X
-- ============================================================================

('Time Revolution Artemisia Treatment Essence', '타임 레볼루션 아르테미시아 트리트먼트 에센스',
 'Missha', '미샤', 'essence', 'first treatment',
 'A calming first treatment essence with 100% Artemisia Annua (Mugwort) extract fermented for optimal bioavailability that soothes redness, strengthens the barrier, and hydrates sensitive skin.',
 150, '150ml', 28000, 22.00, 4.6, 6800, true, 12, 36),

('Vita C Plus Spot Correcting Concentrate Ampoule', '비타C 플러스 스팟 코렉팅 앰플',
 'Missha', '미샤', 'ampoule', 'vitamin C',
 'A concentrated vitamin C ampoule with Ascorbyl Tetraisopalmitate (stable C derivative) and Guaiazulene that targets stubborn dark spots and uneven pigmentation. Gentle, non-irritating formula.',
 30, '30ml', 25000, 19.00, 4.5, 4200, true, 6, 24),

('Super Aqua Cell Renew Snail Cream', '슈퍼 아쿠아 셀 리뉴 스네일 크림',
 'Missha', '미샤', 'moisturizer', 'snail cream',
 'A snail cream with 70% Snail Mucin extract that repairs, hydrates, and improves skin elasticity. EGF and stem cell extract boost cell renewal for youthful, bouncy skin.',
 52, '52ml', 32000, 25.00, 4.5, 5200, true, 12, 36),

('Bee Pollen Renew Ampouler', '비 폴렌 리뉴 앰플러',
 'Missha', '미샤', 'ampoule', NULL,
 'A nourishing ampoule with 80% Bee Pollen extract that deeply nourishes, revitalizes, and gives tired skin a healthy glow. Natural honey-like nutrients replenish depleted skin.',
 40, '40ml', 30000, 23.00, 4.5, 3200, true, 6, 24),

('Chogongjin Sosaeng Cream', '초공진 소생 크림',
 'Missha', '미샤', 'moisturizer', 'luxury anti-aging',
 'A premium anti-aging cream from the Chogongjin line with 30+ Korean medicinal herbs including ginseng, deer antler, and red pine that regenerates aging skin at a fraction of luxury prices.',
 60, '60ml', 55000, 42.00, 4.5, 2800, true, 12, 36),

('All Around Safe Block Aqua Sun Gel SPF50+ PA++++', '올 어라운드 세이프 블록 아쿠아 선 젤',
 'Missha', '미샤', 'sunscreen', NULL,
 'A lightweight aqua sun gel with SPF50+ PA++++ that provides broad-spectrum UV protection with a refreshing, non-sticky finish. Affordable daily sunscreen for all skin types.',
 50, '50ml', 12000, 9.50, 4.5, 8200, true, 6, 24),

('Glow Skin Balm', '글로우 스킨 밤',
 'Missha', '미샤', 'moisturizer', 'balm',
 'A glow-boosting moisture balm with pearl and mushroom extracts that delivers instant luminosity and deep nourishment. Multi-use as a moisturizer, makeup primer, or highlighter.',
 50, '50ml', 28000, 22.00, 4.4, 2800, true, 12, 36),

-- ============================================================================
-- BENTON (7 new products)
-- Existing: Snail Bee High Content Essence, Snail Bee High Content Steam Cream,
--   Aloe BHA Skin Toner, Deep Green Tea Toner, Goodbye Redness Centella Gel
-- ============================================================================

('Snail Bee High Content Skin', '스네일 비 하이 콘텐트 스킨',
 'Benton', '벤튼', 'toner', NULL,
 'A hydrating toner with Snail Secretion Filtrate and Bee Venom that preps skin, soothes redness, and provides anti-aging benefits from the first step. Foundation of the Snail Bee line.',
 150, '150ml', 17000, 13.00, 4.6, 4800, true, 12, 36),

('Snail Bee High Content Lotion', '스네일 비 하이 콘텐트 로션',
 'Benton', '벤튼', 'moisturizer', 'lotion',
 'A lightweight lotion with 57% Snail Secretion Filtrate and Bee Venom that moisturizes, repairs, and improves skin texture. Ideal for oily and combination skin as a standalone moisturizer.',
 120, '120ml', 20000, 15.50, 4.5, 3800, true, 12, 36),

('Deep Green Tea Lotion', '딥 그린티 로션',
 'Benton', '벤튼', 'moisturizer', 'lotion',
 'A green tea hydrating lotion with 50% Jeju Green Tea Water that provides lightweight moisture, antioxidant protection, and sebum control. Perfect for oily skin in warm weather.',
 120, '120ml', 18000, 14.00, 4.5, 3200, true, 12, 36),

('Fermentation Eye Cream', '퍼먼테이션 아이크림',
 'Benton', '벤튼', 'eye_care', NULL,
 'A fermented eye cream with Galactomyces Ferment Filtrate and ceramides that targets dark circles, fine lines, and dryness around the delicate eye area. Clean, fragrance-free formula.',
 30, '30ml', 22000, 17.00, 4.5, 2800, true, 6, 24),

('Goodbye Redness Centella Cica Serum', '굿바이 레드니스 센텔라 시카 세럼',
 'Benton', '벤튼', 'serum', 'cica',
 'A redness-targeting serum with 80% Centella Asiatica extract and Madecassoside that calms inflammation, soothes rosacea-prone skin, and strengthens the barrier. Lightweight gel-serum texture.',
 30, '30ml', 20000, 15.50, 4.6, 3800, true, 6, 24),

('Honest Cleansing Foam', '어니스트 클렌징 폼',
 'Benton', '벤튼', 'cleanser', 'foaming cleanser',
 'A gentle foaming cleanser with saponin-rich natural ingredients that cleanses without stripping the skin barrier. Low pH 5.5 formula suitable for all skin types including sensitive.',
 150, '150ml', 14000, 11.00, 4.5, 3200, true, 12, 36),

('Aloe Propolis Soothing Gel', '알로에 프로폴리스 수딩 젤',
 'Benton', '벤튼', 'moisturizer', 'soothing gel',
 'A soothing gel with 80% Aloe and 10% Propolis that calms irritation, heals blemishes, and provides lightweight hydration. Multi-purpose for face and body, popular as after-sun care.',
 100, '100ml', 14000, 11.00, 4.6, 7200, true, 12, 36),

-- ============================================================================
-- PURITO (5 new products)
-- Existing: Centella Green Level Recovery Cream, Dermide Cica Barrier Sleeping
--   Pack, Centella Unscented Sun SPF50+, Daily Go-To Sunscreen SPF50+,
--   Oat-in Calming Gel Cream
-- ============================================================================

('From Green Cleansing Oil', '프롬 그린 클렌징 오일',
 'Purito', '퓨리토', 'cleanser', 'cleansing oil',
 'A clean cleansing oil with Olive, Jojoba, and Sweet Almond oils that gently dissolves makeup and SPF without residue. Fragrance-free, suitable for sensitive and acne-prone skin.',
 200, '200ml', 20000, 15.50, 4.6, 4800, true, 12, 36),

('Centella Green Level Buffet Serum', '센텔라 그린 레벨 버핏 세럼',
 'Purito', '퓨리토', 'serum', NULL,
 'A multi-ingredient serum with Centella Asiatica, Niacinamide, and 3 peptides that provides comprehensive skincare — calming, brightening, and anti-aging in one step. Clean formula.',
 60, '60ml', 22000, 17.00, 4.6, 5200, true, 6, 24),

('Defence Barrier pH Cleanser', '디펜스 배리어 pH 클렌저',
 'Purito', '퓨리토', 'cleanser', 'gel cleanser',
 'A pH 5.5 gel cleanser with 0.5% BHA and Tea Tree extract that gently cleanses pores while protecting the moisture barrier. Low-foam formula for daily use on sensitive skin.',
 150, '150ml', 16000, 12.50, 4.5, 3800, true, 12, 36),

('Dermide Cica Barrier Cream', '더마이드 시카 배리어 크림',
 'Purito', '퓨리토', 'moisturizer', 'barrier cream',
 'A barrier-repair cream with ceramides, Centella, and panthenol that strengthens compromised skin. Richer daily version of the Sleeping Pack for dry and very sensitive skin.',
 80, '80ml', 22000, 17.00, 4.6, 3200, true, 12, 36),

('Cica Clearing BB Cream SPF38 PA+++', '시카 클리어링 BB크림 SPF38',
 'Purito', '퓨리토', 'sunscreen', 'BB cream',
 'A clean BB cream with Centella Asiatica and SPF38 PA+++ that provides light coverage, UV protection, and skin-calming benefits. Fragrance-free, suitable for sensitive skin.',
 30, '30ml', 18000, 14.00, 4.4, 4200, true, 6, 24),

-- ============================================================================
-- TORRIDEN (5 new products)
-- Existing: DIVE-IN Low Molecular Hyaluronic Acid Serum, Balanceful Cica
--   Cleansing Gel, DIVE-IN Low Molecular Hyaluronic Acid Toner, DIVE-IN
--   Low Molecular Hyaluronic Acid Cream, Cellmazing Firming Ampoule
-- ============================================================================

('DIVE-IN Low Molecular Hyaluronic Acid Pad', 'DIVE-IN 저분자 히알루로닉 에시드 패드',
 'Torriden', '토리든', 'exfoliator', 'hydrating pad',
 'Hydrating toner pads soaked in 5-molecular-weight Hyaluronic Acid that deliver deep hydration and gentle exfoliation. 80 dual-textured pads for AM/PM use.',
 NULL, '80 pads', 22000, 17.00, 4.6, 4800, true, 6, 24),

('DIVE-IN Low Molecular Hyaluronic Acid Soothing Cream', 'DIVE-IN 저분자 히알루로닉 에시드 수딩크림',
 'Torriden', '토리든', 'moisturizer', NULL,
 'A soothing cream from the DIVE-IN line with 5D Hyaluronic Acid Complex and Panthenol that calms sensitive skin while providing intense multi-layer hydration. Lightweight yet nourishing.',
 100, '100ml', 25000, 19.00, 4.6, 3800, true, 12, 36),

('Cellmazing Vita Tone-Up Sun Cream SPF50+ PA++++', '셀마징 비타 톤업 선크림',
 'Torriden', '토리든', 'sunscreen', NULL,
 'A tone-up sunscreen with SPF50+ PA++++ and Vitamin C that brightens skin tone while providing broad-spectrum UV protection. Natural pink tone-up effect without white cast.',
 60, '60ml', 22000, 17.00, 4.5, 4200, true, 6, 24),

('Balanceful Cica Calming Cream', '밸런스풀 시카 카밍 크림',
 'Torriden', '토리든', 'moisturizer', 'cica cream',
 'A calming cream with Centella and green plant complex that soothes irritated, redness-prone skin and strengthens the barrier. Oil-free formula for sensitive and oily skin.',
 80, '80ml', 24000, 18.50, 4.5, 3200, true, 12, 36),

('DIVE-IN Cleansing Water', 'DIVE-IN 클렌징 워터',
 'Torriden', '토리든', 'cleanser', 'cleansing water',
 'A no-rinse cleansing water with 5D Hyaluronic Acid that gently removes light makeup and impurities while hydrating. Perfect for morning cleanse or quick nighttime cleanse.',
 400, '400ml', 18000, 14.00, 4.5, 3200, true, 12, 36),

-- ============================================================================
-- ROUND LAB (5 new products)
-- Existing: 1025 Dokdo Toner, Birch Juice Moisturizing Cream, 1025 Dokdo
--   Cleanser, Soybean Nourishing Cream, Pine Calming Cica Serum
-- ============================================================================

('1025 Dokdo Lotion', '1025 독도 로션',
 'Round Lab', '라운드랩', 'moisturizer', 'lotion',
 'A lightweight lotion from the bestselling Dokdo line with mineral-rich deep sea water from Dokdo Island that hydrates, balances oil-water, and maintains the moisture barrier.',
 200, '200ml', 20000, 15.50, 4.6, 5800, true, 12, 36),

('1025 Dokdo Cleansing Oil', '1025 독도 클렌징 오일',
 'Round Lab', '라운드랩', 'cleanser', 'cleansing oil',
 'A clean cleansing oil with Dokdo deep sea water and plant-derived oils that dissolves makeup and sunscreen without residue. Low-irritation formula for sensitive skin.',
 200, '200ml', 18000, 14.00, 4.5, 4200, true, 12, 36),

('Birch Juice Moisturizing Sun Cream SPF50+ PA++++', '자작나무 수액 모이스처라이징 선크림',
 'Round Lab', '라운드랩', 'sunscreen', NULL,
 'A moisturizing sunscreen with Birch sap and SPF50+ PA++++ that hydrates dry skin while providing full UV protection. Rich, non-greasy formula with no white cast.',
 50, '50ml', 20000, 15.50, 4.6, 5200, true, 6, 24),

('Pine Calming Cica Sleeping Mask', '소나무 카밍 시카 슬리핑 마스크',
 'Round Lab', '라운드랩', 'mask', 'sleeping mask',
 'An overnight calming mask with Pine Extract and Centella Asiatica that soothes irritation, repairs the barrier, and deeply hydrates while you sleep. From the Pine Calming line.',
 80, '80ml', 22000, 17.00, 4.5, 2800, true, 6, 24),

('Soybean Nourishing Cleansing Oil', '콩 너리싱 클렌징 오일',
 'Round Lab', '라운드랩', 'cleanser', 'cleansing oil',
 'A nourishing cleansing oil with Korean Soybean extract that dissolves makeup while delivering nutrition and moisture. Emulsifies into a milky texture and rinses clean.',
 200, '200ml', 18000, 14.00, 4.5, 3200, true, 12, 36),

-- ============================================================================
-- SKIN1004 (5 new products)
-- Existing: Madagascar Centella Ampoule, Madagascar Centella Tone Brightening
--   Capsule Ampoule, Madagascar Centella Soothing Cream, Centella Light
--   Cleansing Oil, Madagascar Centella Air-Fit Suncream SPF50+
-- ============================================================================

('Madagascar Centella Toning Toner', '마다가스카르 센텔라 토닝 토너',
 'Skin1004', '스킨1004', 'toner', NULL,
 'A toning toner with 67.3% Madagascar Centella Water that soothes, hydrates, and mildly exfoliates with PHA for brighter, smoother skin. Clean, minimal formula.',
 210, '210ml', 18000, 14.00, 4.6, 4800, true, 12, 36),

('Madagascar Centella Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++', '마다가스카르 센텔라 히알루-시카 워터핏 선세럼',
 'Skin1004', '스킨1004', 'sunscreen', 'sun serum',
 'A serum-type sunscreen with Centella and Hyaluronic Acid that provides SPF50+ PA++++ with lightweight, hydrating wear. Serum texture absorbs instantly with zero white cast.',
 50, '50ml', 20000, 15.50, 4.6, 5800, true, 6, 24),

('Madagascar Centella Tea-Trica Relief Ampoule', '마다가스카르 센텔라 티트리카 릴리프 앰플',
 'Skin1004', '스킨1004', 'ampoule', 'acne care',
 'A blemish-relief ampoule with Centella and Tea Tree Oil (Tea-Trica complex) that targets active breakouts, calms inflammation, and prevents acne scars. For oily, acne-prone skin.',
 30, '30ml', 20000, 15.50, 4.5, 3800, true, 6, 24),

('Madagascar Centella Poremizing Fresh Ampoule', '마다가스카르 센텔라 포어마이징 프레쉬 앰플',
 'Skin1004', '스킨1004', 'ampoule', 'pore care',
 'A pore-tightening ampoule with Centella and AHA/BHA/PHA that minimizes enlarged pores, controls sebum, and smooths skin texture. Fresh, non-sticky formula.',
 30, '30ml', 20000, 15.50, 4.5, 3200, true, 6, 24),

('Madagascar Centella Watergel Daily Sun Block SPF50+ PA++++', '마다가스카르 센텔라 워터젤 데일리 선블록',
 'Skin1004', '스킨1004', 'sunscreen', NULL,
 'A water-gel type daily sunblock with Centella extract and SPF50+ PA++++ protection. Ultra-lightweight, non-sticky formula for everyday use on all skin types.',
 50, '50ml', 18000, 14.00, 4.6, 4200, true, 6, 24),

-- ============================================================================
-- TONYMOLY (5 new products)
-- Existing: The Chok Chok Green Tea Watery Cream, Panda Dream So Cool Eye
--   Stick, Vital Vita 12 Synergy Ampoule, I'm Real Red Wine Sheet Mask,
--   Floria Nutra Energy 100 Hour Cream
-- ============================================================================

('Intense Care Gold 24K Snail Cream', '인텐스 케어 골드 24K 스네일 크림',
 'TonyMoly', '토니모리', 'moisturizer', 'snail cream',
 'A luxury-feel cream with 45% Snail Mucin and 24K Gold that repairs, firms, and brightens aging skin. Gold particles provide antioxidant benefits while snail mucin heals and hydrates.',
 45, '45ml', 25000, 19.00, 4.5, 5200, true, 12, 36),

('Wonder Ceramide Mochi Toner', '원더 세라마이드 모찌 토너',
 'TonyMoly', '토니모리', 'toner', NULL,
 'A ceramide toner with mochi-like bouncy texture that delivers deep hydration and barrier strengthening. Five types of ceramides + rice extract for plump, resilient skin.',
 500, '500ml', 16000, 12.50, 4.5, 4200, true, 12, 36),

('Tako Pore Blackhead Scrub Stick', '타코 포어 블랙헤드 스크럽 스틱',
 'TonyMoly', '토니모리', 'exfoliator', 'scrub stick',
 'A twist-up scrub stick with volcanic ash and walnut shell powder that physically exfoliates blackheads and clears pores. Fun octopus packaging, portable for on-the-go use.',
 NULL, '1 stick', 8000, 6.50, 4.3, 5800, true, 12, 36),

('My Sunny All-In-One Sun SPF47 PA+++', '마이 써니 올인원 선 SPF47',
 'TonyMoly', '토니모리', 'sunscreen', NULL,
 'A lightweight all-in-one sunscreen with SPF47 PA+++ that moisturizes and protects in one step. Budget-friendly daily sun protection suitable for all skin types.',
 50, '50ml', 10000, 8.00, 4.4, 5200, true, 6, 24),

('Vital Vita 12 Brightening Ampoule', '바이탈 비타 12 브라이트닝 앰플',
 'TonyMoly', '토니모리', 'ampoule', 'brightening',
 'A brightening ampoule with 12 vitamins and synergy ingredients that targets dullness, dark spots, and uneven skin tone. Affordable vitamin cocktail for radiant skin.',
 30, '30ml', 14000, 11.00, 4.4, 3800, true, 6, 24),

-- ============================================================================
-- NATURE REPUBLIC (5 new products)
-- Existing: Soothing & Moisture Aloe Vera 92% Gel, Snail Solution Cream,
--   Vitapair C Serum, Super Aqua Max Combination Watery Cream, Real
--   Squeeze Aloe Sheet Mask
-- ============================================================================

('Vitapair C Dark Spot Serum', '비타페어 C 다크스팟 세럼',
 'Nature Republic', '네이처리퍼블릭', 'serum', 'brightening',
 'A concentrated dark spot serum with Vitamin C, Niacinamide, and Glutathione that targets stubborn hyperpigmentation. More potent than the regular Vitapair C Serum.',
 30, '30ml', 22000, 17.00, 4.5, 3800, true, 6, 24),

('Good Skin Ampoule Hyaluronic Acid', '굿 스킨 앰플 히알루로닉 에시드',
 'Nature Republic', '네이처리퍼블릭', 'ampoule', NULL,
 'A pure hyaluronic acid ampoule from the Good Skin line that provides intense, multi-layer hydration. Single-ingredient simplicity for maximum hydrating effect.',
 30, '30ml', 12000, 9.50, 4.5, 4200, true, 6, 24),

('Forest Garden Chamomile Cleansing Oil', '포레스트 가든 캐모마일 클렌징 오일',
 'Nature Republic', '네이처리퍼블릭', 'cleanser', 'cleansing oil',
 'A soothing cleansing oil with Chamomile extract that dissolves makeup and impurities while calming sensitive, irritated skin. Lightweight formula emulsifies and rinses clean.',
 200, '200ml', 14000, 11.00, 4.5, 5200, true, 12, 36),

('Herb Blending Eye Cream', '허브 블렌딩 아이 크림',
 'Nature Republic', '네이처리퍼블릭', 'eye_care', NULL,
 'An herbal eye cream with 20 types of herb extracts that targets dark circles, fine lines, and puffiness. Affordable eye cream with natural ingredients.',
 25, '25ml', 16000, 12.50, 4.4, 3200, true, 6, 24),

('Real Nature Green Tea Mask Sheet', '리얼 네이처 그린티 마스크 시트',
 'Nature Republic', '네이처리퍼블릭', 'mask', 'sheet mask',
 'A hydrating sheet mask with Jeju Green Tea extract that provides antioxidant protection, soothes, and hydrates. One of the best-selling affordable K-beauty sheet masks globally.',
 NULL, '1 sheet', 1500, 1.50, 4.4, 8200, true, 6, 24),

-- ============================================================================
-- PYUNKANG YUL (5 new products)
-- Existing: Essence Toner, Moisture Cream, Nutrition Cream, ATO Mild Sun
--   Cream SPF45, Low pH Pore Deep Cleansing Foam
-- ============================================================================

('Calming Moisture Serum', '카밍 모이스처 세럼',
 'Pyunkang Yul', '편강율', 'serum', NULL,
 'A minimal-ingredient calming serum with Centella and Coptis Japonica root that soothes and hydrates sensitive skin. Based on Korean herbal medicine principles.',
 100, '100ml', 22000, 17.00, 4.6, 3800, true, 6, 24),

('Acne Facial Cleanser', '아크네 페이셜 클렌저',
 'Pyunkang Yul', '편강율', 'cleanser', NULL,
 'A gentle acne cleanser with Tea Tree and Centella that cleanses acne-prone skin without stripping. pH 5.5, no harsh ingredients, dermatologist-tested.',
 120, '120ml', 12000, 9.50, 4.5, 3200, true, 12, 36),

('ACNE Spot Cream', '아크네 스팟 크림',
 'Pyunkang Yul', '편강율', 'spot_treatment', NULL,
 'A targeted acne spot treatment with herbal extracts from Korean traditional medicine that reduces blemish size and inflammation overnight. Clean, minimal ingredients.',
 15, '15ml', 14000, 11.00, 4.4, 3800, true, 6, 24),

('Black Tea Time Reverse Eye Cream', '블랙티 타임 리버스 아이 크림',
 'Pyunkang Yul', '편강율', 'eye_care', NULL,
 'An anti-aging eye cream with fermented Black Tea and adenosine that targets crow feet, dark circles, and under-eye sagging. Concentrated formula based on herbal medicine.',
 20, '20ml', 20000, 15.50, 4.5, 2800, true, 6, 24),

('Calming Deep Moisture Toner', '카밍 딥 모이스처 토너',
 'Pyunkang Yul', '편강율', 'toner', NULL,
 'A deeper-hydrating version of the cult Essence Toner with Coptis Japonica root extract that calms and provides intensive moisture for very dry and sensitive skin.',
 200, '200ml', 16000, 12.50, 4.6, 4200, true, 12, 36),

-- ============================================================================
-- I'M FROM (5 new products)
-- Existing: Rice Toner, Mugwort Essence, Honey Mask, Fig Boosting Essence,
--   Vitamin Tree Water Gel
-- ============================================================================

('Rice Serum', '쌀 세럼',
 'I''m From', '아임프롬', 'serum', 'brightening',
 'A brightening serum with 73% Korean Yeoju Rice Bran extract and Niacinamide that fades dark spots, evens skin tone, and provides a rice-water glow. Pairs with Rice Toner.',
 30, '30ml', 22000, 17.00, 4.6, 4800, true, 6, 24),

('Mugwort Cream', '쑥 크림',
 'I''m From', '아임프롬', 'moisturizer', 'cica cream',
 'A calming cream with 73.55% Ganghwa Island Mugwort extract that soothes irritated, redness-prone skin and strengthens the moisture barrier. Pairs with Mugwort Essence.',
 50, '50ml', 24000, 18.50, 4.6, 3800, true, 12, 36),

('Fig Cleansing Balm', '무화과 클렌징 밤',
 'I''m From', '아임프롬', 'cleanser', 'cleansing balm',
 'A fig-based cleansing balm with Korean Fig extract that gently dissolves makeup and impurities. Sherbet-to-oil texture melts into skin. Rich in amino acids for nourishing cleanse.',
 100, '100g', 22000, 17.00, 4.6, 3200, true, 12, 36),

('Beet Energy Ampoule', '비트 에너지 앰플',
 'I''m From', '아임프롬', 'ampoule', NULL,
 'An energizing ampoule with 73% Korean Beet extract that revitalizes dull, tired skin with natural antioxidants, minerals, and vitamins. Gives skin a natural rosy glow.',
 30, '30ml', 22000, 17.00, 4.5, 2800, true, 6, 24),

('Pear Serum', '배 세럼',
 'I''m From', '아임프롬', 'serum', NULL,
 'A hydrating serum with 78% Korean Naju Pear extract that provides lightweight moisture, soothing, and gentle brightening. Watery texture perfect for oily and combination skin.',
 50, '50ml', 20000, 15.50, 4.5, 3200, true, 6, 24),

-- ============================================================================
-- PERIPERA (7 new products) — Gen Z lip & color brand
-- ============================================================================

('Ink Mood Glowy Tint', '잉크 무드 글로이 틴트',
 'Peripera', '페리페라', 'lip_care', 'lip tint',
 'A viral glowy lip tint with glass-like shine and buildable color that lasts 8+ hours. Hydrating formula with Jojoba oil and Shea butter. Multiple K-pop-inspired shades.',
 4, '4g', 12000, 9.50, 4.6, 8200, true, 12, 36),

('Ink V Shading', '잉크 V 쉐이딩',
 'Peripera', '페리페라', 'moisturizer', 'contour',
 'A natural-looking contour stick with buildable coverage that creates soft V-line facial contouring. Blends seamlessly for a natural, sculpted look. K-beauty contouring essential.',
 9, '9.5g', 12000, 9.50, 4.4, 4800, true, 12, 36),

('Sunnyproof Tone Up Sun Cream SPF50+ PA++++', '써니프루프 톤업 선크림 SPF50+',
 'Peripera', '페리페라', 'sunscreen', 'tone-up SPF',
 'A tone-up sunscreen with SPF50+ PA++++ that brightens skin tone with a lavender-pink tint while providing UV protection. Lightweight, works as makeup base for dewy look.',
 50, '50ml', 14000, 11.00, 4.5, 5200, true, 6, 24),

('Double Longwear Cover Concealer', '더블 롱웨어 커버 컨실러',
 'Peripera', '페리페라', 'moisturizer', 'concealer',
 'A high-coverage liquid concealer with a doe-foot applicator that covers dark circles, blemishes, and redness. Long-wearing formula with skincare ingredients. 10+ inclusive shades.',
 5, '5.5g', 10000, 8.00, 4.5, 6200, true, 12, 36),

('All Take Mood Like Palette', '올 테이크 무드 라이크 팔레트',
 'Peripera', '페리페라', 'eye_care', 'eyeshadow',
 'A versatile eyeshadow palette with 8 curated shades (mattes, shimmers, glitters) in trendy Korean color combinations. Soft, blendable textures with high color payoff.',
 NULL, '7.2g', 22000, 17.00, 4.5, 3800, true, 24, 36),

('Ink the Velvet Tint', '잉크 더 벨벳 틴트',
 'Peripera', '페리페라', 'lip_care', 'lip tint',
 'The iconic velvet lip tint with intense matte color and 12-hour wear. Lightweight, non-drying formula with moisturizing core. One of the best-selling K-beauty lip products globally.',
 4, '4g', 10000, 8.00, 4.6, 12200, true, 12, 36),

('Ink Fitting Shadow Palette', '잉크 핏팅 섀도우 팔레트',
 'Peripera', '페리페라', 'eye_care', 'eyeshadow',
 'A compact 4-shade eyeshadow palette with perfectly curated Korean-trending colors. Buttery smooth texture with buildable pigmentation for daily K-beauty eye looks.',
 NULL, '3.2g', 12000, 9.50, 4.5, 4200, true, 24, 36),

-- ============================================================================
-- CLIO (6 new products) — Professional K-beauty color brand
-- ============================================================================

('Kill Cover Founwear Cushion SPF50+ PA+++', '킬커버 파운웨어 쿠션 SPF50+',
 'CLIO', '클리오', 'sunscreen', 'cushion SPF',
 'A professional-grade cushion with SPF50+ PA+++ and full coverage that lasts up to 48 hours. Semi-matte finish, 40+ shade range. One of Korea best-selling cushion foundations.',
 15, '15g', 32000, 25.00, 4.7, 11200, true, 12, 36),

('Pro Eye Palette', '프로 아이 팔레트',
 'CLIO', '클리오', 'eye_care', 'eyeshadow',
 'A professional 10-shade eye palette with curated warm and cool tones. Includes mattes, shimmers, and a statement glitter. Buttery formula rivals luxury palettes.',
 NULL, '6g', 34000, 26.00, 4.6, 7200, true, 24, 36),

('Kill Lash Superproof Mascara', '킬래쉬 슈퍼프루프 마스카라',
 'CLIO', '클리오', 'eye_care', 'mascara',
 'A waterproof mascara with microfiber technology that lengthens, volumizes, and curls lashes that last all day without smudging. Even survives Korean summers and monsoon season.',
 7, '7g', 18000, 14.00, 4.5, 6800, true, 6, 24),

('Stay Perfect Cover Concealer', '스테이 퍼펙트 커버 컨실러',
 'CLIO', '클리오', 'moisturizer', 'concealer',
 'A high-coverage concealer with up to 24-hour wear that covers dark circles, blemishes, and redness without creasing. Buildable formula with a natural finish.',
 5, '5ml', 15000, 12.00, 4.5, 5200, true, 12, 36),

('Crystal Glam Tints', '크리스탈 글램 틴트',
 'CLIO', '클리오', 'lip_care', 'lip tint',
 'A crystal-infused lip tint with glass-like shine and high-impact color. Hydrating formula with plumping effect. K-beauty lip product with premium department store quality.',
 3, '3.4g', 18000, 14.00, 4.5, 4200, true, 12, 36),

('Veganwear Cover Concealer', '비건웨어 커버 컨실러',
 'CLIO', '클리오', 'moisturizer', 'concealer',
 'A vegan, clean-formula concealer with plant-derived coverage that conceals imperfections while caring for skin. Cruelty-free with no animal-derived ingredients.',
 5, '5ml', 16000, 12.50, 4.4, 3200, true, 12, 36),

-- ============================================================================
-- ROMAND (6 new products) — Trendy color brand
-- ============================================================================

('Juicy Lasting Tint', '쥬시 래스팅 틴트',
 'Romand', '롬앤', 'lip_care', 'lip tint',
 'A juicy, glass-like lip tint with intense shine and natural color that lasts through eating and drinking. Fruit extract-infused formula hydrates while delivering K-pop-worthy lips.',
 5, '5.5g', 12000, 9.50, 4.7, 9800, true, 12, 36),

('Glasting Melting Balm', '글래스팅 멜팅 밤',
 'Romand', '롬앤', 'lip_care', 'lip balm',
 'A melting lip balm with glass-like shine and sheer tint that moisturizes, plumps, and adds a natural flush of color. Crystal clear formula with Vitamin E and ceramides.',
 3, '3.5g', 12000, 9.50, 4.6, 5800, true, 12, 36),

('Better Than Palette', '베러 댄 팔레트',
 'Romand', '롬앤', 'eye_care', 'eyeshadow',
 'A curated 10-shade eyeshadow palette with romantic, trend-forward color stories. Mix of mattes, shimmers, and glitters with silky texture and long-lasting wear.',
 NULL, '7.5g', 28000, 22.00, 4.6, 6200, true, 24, 36),

('Blur Fudge Tint', '블러 퍼지 틴트',
 'Romand', '롬앤', 'lip_care', 'lip tint',
 'A matte lip tint with soft-focus blur effect that creates the K-beauty glass-like finish. Weightless formula feels like nothing on lips while delivering intense, long-lasting color.',
 5, '5g', 12000, 9.50, 4.6, 7200, true, 12, 36),

('See-Through Matte Tint', '시스루 매트 틴트',
 'Romand', '롬앤', 'lip_care', 'lip tint',
 'A see-through matte tint with weightless, breathable color that gives lips a natural, just-bitten look. Zero-transfer formula for mask-wearing.',
 3, '3.8g', 12000, 9.50, 4.5, 4800, true, 12, 36),

('Better Than Cheek', '베러 댄 치크',
 'Romand', '롬앤', 'moisturizer', 'blush',
 'A powder blush with micro-fine particles that deliver natural, seamless color. Buildable from sheer wash to vivid flush. Romantic K-beauty color palette.',
 4, '4g', 12000, 9.50, 4.5, 4200, true, 24, 36),

-- ============================================================================
-- HANYUL (6 new products) — AmorePacific heritage brand
-- ============================================================================

('Pure Artemisia Cleansing Foam', '순수 쑥 클렌징 폼',
 'Hanyul', '한율', 'cleanser', NULL,
 'A gentle foaming cleanser with Korean Mugwort (Artemisia) that cleanses without stripping while soothing sensitive skin. Traditional Korean herbal approach to daily cleansing.',
 180, '180ml', 20000, 15.50, 4.5, 4200, true, 12, 36),

('Yoja Sleeping Mask', '효자 슬리핑 마스크',
 'Hanyul', '한율', 'mask', 'sleeping mask',
 'A nourishing overnight mask with fermented Yoja (Citron) from Goheung that deeply hydrates, brightens, and restores skin vitality while you sleep. Traditional Korean fermentation.',
 60, '60ml', 30000, 23.00, 4.5, 3200, true, 6, 24),

('White Chrysanthemum Radiance Sunscreen SPF50+ PA++++', '백국 래디언스 선스크린',
 'Hanyul', '한율', 'sunscreen', NULL,
 'A brightening sunscreen with White Chrysanthemum extract and SPF50+ PA++++ that provides UV protection while delivering a radiant, luminous finish. Korean heritage suncare.',
 50, '50ml', 25000, 19.00, 4.5, 3800, true, 6, 24),

('Artemisia Calming Essence', '쑥 카밍 에센스',
 'Hanyul', '한율', 'essence', NULL,
 'A calming essence with fermented Artemisia from Ganghwa Island that soothes redness, strengthens the barrier, and provides herbal nourishment. Korean traditional medicine in modern skincare.',
 150, '150ml', 35000, 27.00, 4.6, 3800, true, 12, 36),

('Rice Essential Skin Softening Toner', '쌀 에센셜 스킨 소프닝 토너',
 'Hanyul', '한율', 'toner', NULL,
 'A softening toner with Korean Rice water and fermented ingredients that preps skin for better absorption while providing hydration and gentle brightening.',
 200, '200ml', 28000, 22.00, 4.5, 3200, true, 12, 36),

('Optimizing Serum', '옵티마이징 세럼',
 'Hanyul', '한율', 'serum', NULL,
 'A skin-optimizing serum with Korean Artemisia and traditional herbal complex that balances, strengthens, and revitalizes skin for optimal condition. AmorePacific herbal expertise.',
 60, '60ml', 42000, 32.00, 4.5, 2800, true, 6, 24),

-- ============================================================================
-- FRUDIA (7 new products) — Fruit-powered affordable brand
-- ============================================================================

('Citrus Brightening Cream', '시트러스 브라이트닝 크림',
 'Frudia', '프루디아', 'moisturizer', 'brightening',
 'A brightening cream with 61% Jeju Citrus extract (tangerine, orange, lemon) and Niacinamide that targets dullness and uneven skin tone while providing fresh hydration.',
 55, '55ml', 18000, 14.00, 4.5, 4200, true, 12, 36),

('Pomegranate Nutri-Moisturizing Cream', '석류 뉴트리 모이스처라이징 크림',
 'Frudia', '프루디아', 'moisturizer', 'anti-aging',
 'An anti-aging cream with 63% Pomegranate extract rich in natural antioxidants that nourishes, firms, and restores vitality to mature, dull skin. Fruit-powered anti-aging.',
 55, '55ml', 20000, 15.50, 4.5, 3200, true, 12, 36),

('Blueberry Hydrating Serum', '블루베리 하이드레이팅 세럼',
 'Frudia', '프루디아', 'serum', NULL,
 'A hydrating serum with 71% Blueberry extract that delivers intense antioxidant hydration, protects from environmental damage, and gives skin a healthy blue-berry glow.',
 50, '50ml', 18000, 14.00, 4.5, 3800, true, 6, 24),

('Green Grape Pore Control Toner', '청포도 포어 컨트롤 토너',
 'Frudia', '프루디아', 'toner', 'pore care',
 'A pore-refining toner with 78.5% Green Grape extract and BHA that controls sebum, minimizes pores, and provides antioxidant protection. Fresh, lightweight formula for oily skin.',
 195, '195ml', 16000, 12.50, 4.4, 4800, true, 12, 36),

('Avocado Relief Cream', '아보카도 릴리프 크림',
 'Frudia', '프루디아', 'moisturizer', NULL,
 'A nourishing relief cream with 67% Avocado extract and ceramides that soothes and deeply moisturizes dry, sensitive, barrier-damaged skin. Rich, buttery texture.',
 55, '55ml', 18000, 14.00, 4.5, 3200, true, 12, 36),

('Peach Repairing Cream', '피치 리페어링 크림',
 'Frudia', '프루디아', 'moisturizer', NULL,
 'A repair cream with 67% Peach extract and Centella that soothes redness, calms sensitivity, and repairs damaged skin. Light, non-sticky gel-cream texture.',
 55, '55ml', 18000, 14.00, 4.5, 2800, true, 12, 36),

('Ultra UV Shield Sun Essence SPF50+ PA++++', '울트라 UV 쉴드 선 에센스 SPF50+',
 'Frudia', '프루디아', 'sunscreen', NULL,
 'A lightweight sun essence with SPF50+ PA++++ and fruit extracts that provides broad-spectrum UV protection with a dewy, non-greasy finish. Affordable daily sunscreen.',
 50, '50ml', 16000, 12.50, 4.4, 4200, true, 6, 24),

-- ============================================================================
-- ESPOIR (6 new products) — AmorePacific color cosmetics brand
-- ============================================================================

('Couture Lip Tint Velvet', '꾸뛰르 립 틴트 벨벳',
 'Espoir', '에스쁘아', 'lip_care', 'lip tint',
 'A luxurious velvet lip tint with high-fashion-inspired shades and all-day wear. Creamy formula with weightless matte finish. Professional makeup artist brand from AmorePacific.',
 8, '8.5g', 20000, 15.50, 4.5, 4800, true, 12, 36),

('Pro Tailor Foundation Be Glow SPF25 PA++', '프로 테일러 파운데이션 비 글로우',
 'Espoir', '에스쁘아', 'moisturizer', 'foundation',
 'A glow-finish foundation with SPF25 PA++ and skincare ingredients that provides medium-to-full coverage with a natural, dewy finish. Professional-grade K-beauty base.',
 30, '30ml', 35000, 27.00, 4.5, 3800, true, 12, 36),

('Real Eye Palette All New', '리얼 아이 팔레트 올 뉴',
 'Espoir', '에스쁘아', 'eye_care', 'eyeshadow',
 'A professional 10-shade eyeshadow palette with trend-forward Korean color curation. Includes matte, shimmer, and glitter finishes with exceptional blendability.',
 NULL, '8.9g', 38000, 29.00, 4.6, 3200, true, 24, 36),

('Water Splash Sun Cream SPF50+ PA++++', '워터 스플래쉬 선 크림 SPF50+',
 'Espoir', '에스쁘아', 'sunscreen', NULL,
 'A refreshing water-splash sunscreen with SPF50+ PA++++ that provides full UV protection with a cooling, hydrating sensation. Perfect as a makeup base for dewy look.',
 60, '60ml', 25000, 19.00, 4.5, 4200, true, 6, 24),

('Colorful Nude Lip Pencil', '컬러풀 누드 립 펜슬',
 'Espoir', '에스쁘아', 'lip_care', 'lip liner',
 'A creamy lip pencil with precise application that defines, shapes, and fills lips with natural-looking nude shades. Long-lasting formula prevents feathering.',
 1, '1.1g', 14000, 11.00, 4.4, 2800, true, 24, 36),

('No Wear Power Matte Lipstick', '노웨어 파워 매트 립스틱',
 'Espoir', '에스쁘아', 'lip_care', 'lipstick',
 'A power matte lipstick with comfortable, non-drying wear that delivers intense color with a soft-focus blur effect. Professional formula, 12-hour staying power.',
 3, '3.5g', 25000, 19.00, 4.5, 3200, true, 24, 36);


-- ============================================================================
-- Verify counts
-- ============================================================================
SELECT brand_en, COUNT(*) AS count
FROM ss_products
WHERE brand_en IN ('Klairs','Some By Mi','Missha','Benton','Purito','Torriden','Round Lab','Skin1004','TonyMoly','Nature Republic','Pyunkang Yul','I''m From','Peripera','CLIO','Romand','Hanyul','Frudia','Espoir')
GROUP BY brand_en ORDER BY brand_en;
