-- ============================================================================
-- Seoul Sister Product Database — Final Expansion to 650+ Products
-- ~75 new products: Additional from Atopalm, Numbuzin, d'Alba, OHUI,
-- Etude, Banila Co, Laka, Cosmica, Neogen, Heimish, and more
-- Run in Supabase SQL Editor after 20260219000010
-- ============================================================================

INSERT INTO ss_products (
  name_en, name_ko, brand_en, brand_ko, category, subcategory,
  description_en, volume_ml, volume_display,
  price_krw, price_usd, rating_avg, review_count,
  is_verified, pao_months, shelf_life_months
) VALUES

-- ============================================================================
-- NUMBUZIN (7 products) — Viral minimalist brand
-- ============================================================================

('No.3 Skin Softening Serum', '3번 스킨 소프트닝 세럼',
 'Numbuzin', '넘버즈인', 'serum', NULL,
 'A bestselling serum with Galactomyces Ferment Filtrate and 5% Niacinamide that softens, brightens, and refines skin texture. Viral on TikTok for its glass-skin effect.',
 50, '50ml', 20000, 15.50, 4.7, 8200, true, 6, 24),

('No.5 Vitamin-Niacinamide Concentrated Pad', '5번 비타민 나이아신아마이드 집중 패드',
 'Numbuzin', '넘버즈인', 'exfoliator', 'toner pad',
 'A brightening toner pad with Vitamin C and Niacinamide that fades dark spots and evens skin tone. 70 dual-textured pads for daily morning brightening routine.',
 NULL, '70 pads', 22000, 17.00, 4.6, 6800, true, 6, 24),

('No.1 Pure-Fit Cica Calming Toner', '1번 퓨어핏 시카 카밍 토너',
 'Numbuzin', '넘버즈인', 'toner', NULL,
 'A calming toner with Centella Asiatica that soothes redness, hydrates, and preps sensitive skin for treatment steps. Clean minimal formula.',
 200, '200ml', 18000, 14.00, 4.6, 4800, true, 12, 36),

('No.2 Soothing Green Serum', '2번 수딩 그린 세럼',
 'Numbuzin', '넘버즈인', 'serum', 'cica',
 'A soothing serum with Centella Asiatica and green tea that calms inflammation, reduces redness, and provides lightweight hydration for sensitive and acne-prone skin.',
 50, '50ml', 18000, 14.00, 4.5, 4200, true, 6, 24),

('No.4 Collagen Firming Cream', '4번 콜라겐 퍼밍 크림',
 'Numbuzin', '넘버즈인', 'moisturizer', 'anti-aging',
 'An anti-aging cream with peptide-collagen complex that firms, plumps fine lines, and provides deep moisture for mature and dry skin. Clean formula.',
 50, '50ml', 24000, 18.50, 4.5, 3200, true, 12, 36),

('No.3 Super Glowing Essence Toner', '3번 슈퍼 글로잉 에센스 토너',
 'Numbuzin', '넘버즈인', 'toner', 'essence toner',
 'An essence-toner hybrid with Galactomyces ferment that delivers glow, hydration, and skin smoothing from the first step. The toner version of the viral No.3 serum.',
 200, '200ml', 20000, 15.50, 4.6, 3800, true, 12, 36),

('No.1 Pure-Fit Cica Calming Cream', '1번 퓨어핏 시카 카밍 크림',
 'Numbuzin', '넘버즈인', 'moisturizer', 'cica cream',
 'A calming cream with Centella and Madecassoside that soothes irritated skin, repairs the barrier, and provides all-day comfort. Pairs with the No.1 Cica Toner.',
 50, '50ml', 22000, 17.00, 4.6, 3800, true, 12, 36),

-- ============================================================================
-- d'ALBA (7 products) — White truffle luxury-affordable brand
-- ============================================================================

('White Truffle First Spray Serum', '화이트 트러플 퍼스트 스프레이 세럼',
 'd''Alba', '달바', 'serum', 'mist serum',
 'A viral spray serum with Italian White Truffle extract that delivers instant hydration, nourishment, and glow in a fine mist format. Can be used as a toner, serum, or setting mist.',
 100, '100ml', 28000, 22.00, 4.7, 9200, true, 6, 24),

('White Truffle Nourishing Treatment Mask', '화이트 트러플 너리싱 트리트먼트 마스크',
 'd''Alba', '달바', 'mask', 'cream mask',
 'A luxury cream mask with White Truffle and peptides that delivers intensive overnight nourishment, anti-aging, and glow. Apply as a sleeping pack or 15-minute wash-off mask.',
 100, '100ml', 28000, 22.00, 4.6, 4800, true, 6, 24),

('White Truffle Return Oil Cream', '화이트 트러플 리턴 오일 크림',
 'd''Alba', '달바', 'moisturizer', NULL,
 'An oil-cream hybrid with White Truffle extract and Squalane that deeply nourishes dry, mature skin while creating a luminous glow finish. Rich yet non-greasy.',
 50, '50ml', 32000, 25.00, 4.6, 3800, true, 12, 36),

('Waterfull Essence Sun Cream SPF50+ PA++++', '워터풀 에센스 선크림 SPF50+',
 'd''Alba', '달바', 'sunscreen', NULL,
 'A hydrating essence-type sunscreen with White Truffle and SPF50+ PA++++ that provides UV protection with a dewy, non-greasy finish. Doubles as a moisturizer.',
 50, '50ml', 25000, 19.00, 4.6, 5200, true, 6, 24),

('White Truffle Vital Spray Serum', '화이트 트러플 바이탈 스프레이 세럼',
 'd''Alba', '달바', 'serum', 'mist serum',
 'The vitalizing version of the spray serum with added Vitamin C and White Truffle that brightens, energizes, and hydrates tired skin. Quick-absorbing mist format.',
 100, '100ml', 28000, 22.00, 4.5, 3200, true, 6, 24),

('White Truffle Anti Wrinkle Eye Cream', '화이트 트러플 안티 링클 아이 크림',
 'd''Alba', '달바', 'eye_care', NULL,
 'An anti-wrinkle eye cream with White Truffle, Adenosine, and peptides that targets crow feet, dark circles, and loss of firmness around the eye area.',
 30, '30ml', 30000, 23.00, 4.5, 2800, true, 6, 24),

('White Truffle Double Serum & Cream', '화이트 트러플 더블 세럼 앤 크림',
 'd''Alba', '달바', 'moisturizer', 'serum-cream',
 'A dual-layer product with serum and cream phases that provides both hydration and nourishment from White Truffle. Pump dispenses both layers together for a complete routine in one step.',
 70, '70ml', 35000, 27.00, 4.5, 3200, true, 12, 36),

-- ============================================================================
-- ETUDE (7 products) — Playful affordable K-beauty
-- ============================================================================

('SoonJung pH 5.5 Relief Toner', '순정 pH 5.5 릴리프 토너',
 'Etude', '에뛰드', 'toner', NULL,
 'A minimal-ingredient toner with pH 5.5 and Panthenol that soothes and hydrates sensitive, compromised skin. From the dermatologist-tested SoonJung line. Fragrance-free, hypoallergenic.',
 200, '200ml', 12000, 9.50, 4.6, 7200, true, 12, 36),

('SoonJung 2x Barrier Intensive Cream', '순정 2x 배리어 인텐시브 크림',
 'Etude', '에뛰드', 'moisturizer', 'barrier cream',
 'A barrier cream with 2x Panthenol and Madecassoside that intensively soothes and strengthens damaged, sensitive skin. Minimal formula, clinically tested for irritation-free use.',
 60, '60ml', 16000, 12.50, 4.7, 8200, true, 12, 36),

('SoonJung 10-Free Moist Emulsion', '순정 10-프리 모이스트 에멀전',
 'Etude', '에뛰드', 'moisturizer', 'emulsion',
 'A lightweight emulsion free from 10 common irritants that hydrates sensitive skin without triggering reactions. pH 5.5 balanced, non-comedogenic.',
 130, '130ml', 14000, 11.00, 4.5, 5200, true, 12, 36),

('Fixing Tint', '픽싱 틴트',
 'Etude', '에뛰드', 'lip_care', 'lip tint',
 'A high-pigment lip tint with fixing technology that locks in color for up to 12 hours without transferring. Lightweight, non-drying formula with matte-to-velvet finish.',
 4, '4g', 10000, 8.00, 4.5, 6800, true, 12, 36),

('Double Lasting Foundation SPF42 PA++', '더블 래스팅 파운데이션 SPF42',
 'Etude', '에뛰드', 'sunscreen', 'foundation SPF',
 'A long-wearing foundation with SPF42 PA++ and 24-hour coverage that resists humidity, sebum, and mask transfer. Natural semi-matte finish with 20+ shade options.',
 30, '30ml', 22000, 17.00, 4.5, 5800, true, 12, 36),

('Play Color Eyes Palette', '플레이 컬러 아이즈 팔레트',
 'Etude', '에뛰드', 'eye_care', 'eyeshadow',
 'A 10-shade eyeshadow palette with playful, trendy K-beauty color combinations. Includes mattes, shimmers, and glitters with soft, blendable texture.',
 NULL, '6g', 24000, 18.50, 4.5, 5200, true, 24, 36),

('SoonJung Lip Balm', '순정 립밤',
 'Etude', '에뛰드', 'lip_care', 'lip balm',
 'A hypoallergenic lip balm from the SoonJung sensitive skin line with Panthenol and Madecassoside that soothes, heals, and protects chapped, sensitive lips. Fragrance-free.',
 3, '3.5g', 6000, 5.00, 4.5, 3800, true, 12, 36),

-- ============================================================================
-- BANILA CO (7 products) — Cleansing balm pioneer
-- ============================================================================

('Clean It Zero Cleansing Balm Original', '클린잇 제로 클렌징 밤 오리지널',
 'Banila Co', '바닐라코', 'cleanser', 'cleansing balm',
 'The iconic sherbet-textured cleansing balm that dissolves all makeup, sunscreen, and impurities on contact. Transforms from balm to oil to milky water for a clean rinse. #1 selling balm in Korea.',
 100, '100ml', 22000, 17.00, 4.8, 18200, true, 12, 36),

('Clean It Zero Cleansing Balm Purifying', '클린잇 제로 클렌징 밤 퓨리파잉',
 'Banila Co', '바닐라코', 'cleanser', 'cleansing balm',
 'The acne-prone skin version of the iconic balm with BHA and tea tree that dissolves impurities while calming inflammation and preventing breakouts. Same sherbet texture.',
 100, '100ml', 22000, 17.00, 4.6, 6800, true, 12, 36),

('Clean It Zero Cleansing Balm Nourishing', '클린잇 제로 클렌징 밤 너리싱',
 'Banila Co', '바닐라코', 'cleanser', 'cleansing balm',
 'The dry skin version of the iconic balm with added Ceramides and Shea Butter that cleanses while nourishing and strengthening the moisture barrier.',
 100, '100ml', 22000, 17.00, 4.6, 5200, true, 12, 36),

('Covericious Power Fit Cushion SPF50+ PA++++', '커버리셔스 파워핏 쿠션 SPF50+',
 'Banila Co', '바닐라코', 'sunscreen', 'cushion SPF',
 'A full-coverage cushion compact with SPF50+ PA++++ that provides flawless coverage with a natural semi-matte finish. Long-wearing formula for oily and combination skin.',
 14, '14g', 28000, 22.00, 4.5, 4800, true, 12, 36),

('Dear Hydration Boosting Cream', '디어 하이드레이션 부스팅 크림',
 'Banila Co', '바닐라코', 'moisturizer', NULL,
 'A hydration-boosting cream with hyaluronic acid and ceramides that provides deep moisture and strengthens the barrier for dry and dehydrated skin.',
 50, '50ml', 28000, 22.00, 4.5, 3200, true, 12, 36),

('Clean It Zero Pore Clarifying Foam Cleanser', '클린잇 제로 포어 클래리파잉 폼 클렌저',
 'Banila Co', '바닐라코', 'cleanser', 'foaming cleanser',
 'A pore-clarifying foam cleanser with BHA that deeply cleanses pores as the second cleansing step after the balm. Creates dense, micro-foam for thorough cleansing.',
 150, '150ml', 16000, 12.50, 4.5, 3800, true, 12, 36),

('Lip Draw Matte Blast Stick', '립 드로우 매트 블래스트 스틱',
 'Banila Co', '바닐라코', 'lip_care', 'lipstick',
 'A matte lipstick with intense color payoff and comfortable wear that glides on with a single swipe. Creamy formula prevents drying or cracking.',
 4, '4.2g', 18000, 14.00, 4.4, 3200, true, 12, 36),

-- ============================================================================
-- NEOGEN (7 products) — Dermatologist-backed clean brand
-- ============================================================================

('Real Ferment Micro Essence', '리얼 퍼먼트 마이크로 에센스',
 'Neogen', '네오젠', 'essence', 'first treatment',
 'A bestselling fermented essence with 93% naturally fermented ingredients including rice, Bifida, and yeast ferment that brightens, hydrates, and refines skin texture. Korean FTE alternative.',
 150, '150ml', 30000, 23.00, 4.7, 7200, true, 12, 36),

('Bio-Peel Gauze Peeling Wine', '바이오 필 거즈 필링 와인',
 'Neogen', '네오젠', 'exfoliator', 'peeling pad',
 'A wine-extract exfoliating gauze pad with cross-hatched texture that physically and chemically exfoliates dead skin cells. Resveratrol from wine extract provides antioxidant brightening.',
 NULL, '30 pads', 25000, 19.00, 4.6, 6800, true, 6, 24),

('Bio-Peel Gauze Peeling Green Tea', '바이오 필 거즈 필링 그린티',
 'Neogen', '네오젠', 'exfoliator', 'peeling pad',
 'A green tea version of the iconic gauze peeling pad that gently exfoliates while delivering antioxidants and soothing sensitive skin. 3-layer pad design.',
 NULL, '30 pads', 25000, 19.00, 4.6, 5800, true, 6, 24),

('Real Ferment Micro Serum', '리얼 퍼먼트 마이크로 세럼',
 'Neogen', '네오젠', 'serum', NULL,
 'A concentrated fermented serum with Bifida Ferment Lysate and Saccharomyces that intensively brightens, firms, and hydrates. Pairs with Real Ferment Micro Essence.',
 30, '30ml', 28000, 22.00, 4.6, 3800, true, 6, 24),

('Dermalogy Real Vita C Serum', '더마로지 리얼 비타 C 세럼',
 'Neogen', '네오젠', 'serum', 'vitamin C',
 'A stabilized vitamin C serum with 22% Pure Vitamin C and Niacinamide that brightens dark spots, evens skin tone, and provides antioxidant protection. Airless pump preserves potency.',
 32, '32ml', 25000, 19.00, 4.5, 4200, true, 6, 24),

('Probiotics Youth Repair Cream', '프로바이오틱스 유스 리페어 크림',
 'Neogen', '네오젠', 'moisturizer', NULL,
 'An anti-aging cream with probiotics, ceramides, and peptides that strengthens the skin microbiome, repairs the barrier, and firms for youthful resilience.',
 50, '50ml', 32000, 25.00, 4.5, 2800, true, 12, 36),

('Day-Light Protection Airy Sun Stick SPF50+ PA++++', '데이라이트 프로텍션 에어리 선스틱',
 'Neogen', '네오젠', 'sunscreen', 'sun stick',
 'A lightweight sun stick with SPF50+ PA++++ that provides easy, on-the-go UV protection. Non-sticky formula can be applied over makeup. Portable, mess-free format.',
 22, '22g', 20000, 15.50, 4.5, 3800, true, 6, 24),

-- ============================================================================
-- OHUI (7 products) — LG luxury brand
-- ============================================================================

('The First Geniture Cell Essential Source', '더 퍼스트 제니튜어 셀 에센셜 소스',
 'OHUI', '오휘', 'essence', 'luxury essence',
 'A luxury first-step essence with stem cell technology that activates skin renewal at the cellular level. LG flagship anti-aging innovation for visible rejuvenation.',
 120, '120ml', 110000, 85.00, 4.6, 3800, true, 12, 36),

('Age Recovery Cream', '에이지 리커버리 크림',
 'OHUI', '오휘', 'moisturizer', 'luxury anti-aging',
 'A premium anti-aging cream with collagen peptides and stem cell extracts that firms, plumps wrinkles, and restores youthful vitality. LG luxury skincare flagship.',
 50, '50ml', 95000, 73.00, 4.6, 2800, true, 12, 36),

('Miracle Moisture Cleansing Foam', '미라클 모이스처 클렌징 폼',
 'OHUI', '오휘', 'cleanser', NULL,
 'A luxury cleansing foam with amino acid surfactants and hyaluronic acid that cleanses without stripping. Creates a dense, creamy foam with moisture-retaining technology.',
 200, '200ml', 30000, 23.00, 4.5, 3200, true, 12, 36),

('Extreme White Sleeping Mask', '익스트림 화이트 슬리핑 마스크',
 'OHUI', '오휘', 'mask', 'sleeping mask',
 'A luxury overnight brightening mask with White Ginseng and Niacinamide that targets deep pigmentation and dullness while you sleep. Wake up to visibly brighter, more even skin.',
 100, '100ml', 48000, 37.00, 4.5, 2800, true, 6, 24),

('Miracle Aqua Eye Serum', '미라클 아쿠아 아이 세럼',
 'OHUI', '오휘', 'eye_care', NULL,
 'A hydrating eye serum with hyaluronic acid and peptides that targets dark circles, fine lines, and dehydration around the delicate eye area. Lightweight liquid texture.',
 20, '20ml', 55000, 42.00, 4.5, 2200, true, 6, 24),

('Ultimate Cover CC Cushion SPF50+ PA+++', '얼티밋 커버 CC 쿠션 SPF50+',
 'OHUI', '오휘', 'sunscreen', 'cushion SPF',
 'A luxury CC cushion with SPF50+ PA+++ that color-corrects, provides coverage, and protects from UV. Skin-like finish with anti-aging skincare benefits.',
 15, '15g', 55000, 42.00, 4.5, 3200, true, 12, 36),

('Cell Power No.1 Essence', '셀 파워 넘버원 에센스',
 'OHUI', '오휘', 'essence', 'cell renewal',
 'A cell-activating essence with LG proprietary stem cell technology that boosts skin renewal, improves texture, and delivers anti-aging moisture from the first step.',
 70, '70ml', 85000, 65.00, 4.6, 2200, true, 12, 36),

-- ============================================================================
-- ATOPALM (7 products) — Derma barrier brand
-- ============================================================================

('MLE Cream', 'MLE 크림',
 'Atopalm', '아토팜', 'moisturizer', 'barrier cream',
 'The flagship barrier cream with patented MLE (Multi-Lamellar Emulsion) technology that perfectly mimics the skin lipid structure for optimal barrier repair. Clinically proven for eczema-prone skin.',
 65, '65ml', 25000, 19.00, 4.7, 8200, true, 12, 36),

('MLE Lotion', 'MLE 로션',
 'Atopalm', '아토팜', 'moisturizer', 'lotion',
 'A daily body lotion with MLE technology that provides barrier-strengthening moisture for dry, sensitive, and atopic skin. Lightweight enough for face and body use.',
 200, '200ml', 18000, 14.00, 4.6, 5800, true, 12, 36),

('Soothing Gel Lotion', '수딩 젤 로션',
 'Atopalm', '아토팜', 'moisturizer', 'gel lotion',
 'A cooling gel lotion that soothes heat-rashed, sun-exposed, and irritated skin while providing barrier-strengthening hydration. Multi-use for face and body.',
 120, '120ml', 15000, 12.00, 4.6, 3800, true, 12, 36),

('Top to Toe Wash', '탑 투 토 워시',
 'Atopalm', '아토팜', 'cleanser', 'body wash',
 'A gentle all-in-one wash with MLE technology that cleanses hair, face, and body without disrupting the moisture barrier. Fragrance-free, suitable for babies and sensitive adults.',
 300, '300ml', 16000, 12.50, 4.6, 4800, true, 12, 36),

('Intensive Moisturizing Balm', '인텐시브 모이스처라이징 밤',
 'Atopalm', '아토팜', 'moisturizer', 'balm',
 'An ultra-rich balm with MLE technology for extremely dry, cracked, and eczema-prone skin that provides intensive barrier repair and lasting protection. Can be used on face and body.',
 40, '40ml', 22000, 17.00, 4.6, 3200, true, 12, 36),

('Daytime Under Makeup Moisture Cream SPF30', '데이타임 언더 메이크업 모이스처 크림 SPF30',
 'Atopalm', '아토팜', 'sunscreen', 'moisturizer SPF',
 'A moisturizing day cream with SPF30 and MLE technology that protects sensitive skin from UV while providing barrier-strengthening hydration under makeup.',
 40, '40ml', 22000, 17.00, 4.5, 2800, true, 6, 24),

('Maternity Care Body Oil', '마터니티 케어 바디 오일',
 'Atopalm', '아토팜', 'oil', 'body oil',
 'A gentle body oil with MLE technology designed for stretching skin during pregnancy. Nourishes, strengthens skin elasticity, and prevents moisture loss. Fragrance-free, dermatologist-tested.',
 120, '120ml', 28000, 22.00, 4.5, 2200, true, 12, 36),

-- ============================================================================
-- LAKA (6 products) — Gender-neutral K-beauty brand
-- ============================================================================

('Fruity Glam Tint', '프루티 글램 틴트',
 'Laka', '라카', 'lip_care', 'lip tint',
 'A gender-neutral lip tint with glass-like gloss and natural fruit-inspired shades. Hydrating formula with Jojoba and Rosehip oils. Korea first gender-neutral beauty brand.',
 4, '4.5g', 16000, 12.50, 4.5, 4200, true, 12, 36),

('Bonding Lip Oil', '본딩 립 오일',
 'Laka', '라카', 'lip_care', 'lip oil',
 'A nourishing lip oil with Argan, Meadowfoam, and Baobab oils that delivers intense moisture with a mirror-like shine. Gender-neutral shades for everyday wear.',
 3, '3.2g', 14000, 11.00, 4.5, 3200, true, 12, 36),

('Just Eye Palette', '저스트 아이 팔레트',
 'Laka', '라카', 'eye_care', 'eyeshadow',
 'A gender-neutral eyeshadow palette with 4 curated everyday shades. Natural, wearable colors suitable for all genders and skin tones. Minimalist packaging.',
 NULL, '4.8g', 22000, 17.00, 4.4, 2800, true, 24, 36),

('Watery Sheer Lipstick', '워터리 쉬어 립스틱',
 'Laka', '라카', 'lip_care', 'lipstick',
 'A sheer, buildable lipstick with watery texture that delivers natural color and hydration. Perfect for the K-beauty natural lip look. Gender-neutral shade range.',
 3, '3.5g', 18000, 14.00, 4.4, 2400, true, 12, 36),

('Soothing Vegan Sun Cream SPF50+ PA++++', '수딩 비건 선크림 SPF50+',
 'Laka', '라카', 'sunscreen', NULL,
 'A vegan, gender-neutral sunscreen with Centella Asiatica and SPF50+ PA++++ that protects and soothes all skin types. Clean formula with minimal ingredients.',
 50, '50ml', 20000, 15.50, 4.5, 2800, true, 6, 24),

('Wild Brow Shaper', '와일드 브로우 쉐이퍼',
 'Laka', '라카', 'eye_care', 'brow product',
 'A gender-neutral brow pencil with natural, hair-like strokes that define and fill brows without looking overdone. Ultra-fine tip for precise application.',
 NULL, '0.07g', 14000, 11.00, 4.4, 3200, true, 24, 36),

-- ============================================================================
-- Additional products to reach 650+ total (~20 more)
-- ============================================================================

-- Goodal (expanding from 6 in file 005)
('Green Tangerine Vita C Dark Spot Serum', '청귤 비타C 잡티 세럼',
 'Goodal', '구달', 'serum', 'vitamin c serum',
 'A brightening serum with Green Tangerine extract and 70% Vita C complex that targets dark spots, hyperpigmentation, and dullness. Lightweight, fast-absorbing formula suitable for daily use.',
 30, '30ml', 22000, 17.00, 4.6, 9500, true, 6, 24),

('Houttuynia Cordata Calming Essence', '어성초 카밍 에센스',
 'Goodal', '구달', 'essence', 'calming essence',
 'A soothing essence with Houttuynia Cordata extract that calms irritated and sensitive skin. Anti-inflammatory properties help reduce redness and restore skin balance.',
 150, '150ml', 18000, 14.00, 4.5, 4200, true, 12, 36),

-- Heimish (expanding from 6 in file 005)
('Bulgarian Rose Water Mist Serum', '불가리안 로즈 워터 미스트 세럼',
 'Heimish', '헤이미시', 'mist', 'facial mist',
 'A hydrating mist serum infused with Bulgarian Damask Rose Water that refreshes and moisturizes throughout the day. Fine mist spray delivers instant hydration boost.',
 80, '80ml', 16000, 12.50, 4.5, 3800, true, 6, 24),

('Moringa Cleansing Balm', '모링가 클렌징 밤',
 'Heimish', '헤이미시', 'cleanser', 'cleansing balm',
 'A gentle sherbet-to-oil cleansing balm with Moringa seed oil that dissolves makeup, sunscreen, and impurities without stripping. Eco-friendly refillable packaging.',
 120, '120ml', 18000, 14.00, 4.6, 5200, true, 12, 36),

-- Isntree (expanding from 6 in file 005)
('Green Tea Fresh Toner', '그린티 프레시 토너',
 'Isntree', '이즈앤트리', 'toner', 'hydrating toner',
 'An 80% Green Tea Water toner with antioxidant and sebum-controlling properties. Gently hydrates and refines pores for oily and combination skin types. Lightweight watery texture.',
 200, '200ml', 16000, 13.00, 4.6, 6800, true, 12, 36),

('Chestnut AHA 8% Clear Essence', '밤 AHA 8% 클리어 에센스',
 'Isntree', '이즈앤트리', 'exfoliator', 'chemical exfoliant',
 'An 8% Glycolic Acid essence derived from chestnut shells for gentle chemical exfoliation. Improves skin texture, fades dark spots, and unclogs pores. pH 3.5-4.0 for optimal efficacy.',
 100, '100ml', 17000, 13.50, 4.5, 4500, true, 6, 24),

-- Medicube (expanding from 6 in file 005)
('Red Erasing Cream', '레드 이레이징 크림',
 'Medicube', '메디큐브', 'moisturizer', 'redness relief',
 'A specialized cream targeting facial redness with Centella Asiatica and Madecassoside. Strengthens the skin barrier while visibly reducing redness and irritation. Dermatologist tested.',
 100, '100ml', 32000, 25.00, 4.5, 5600, true, 12, 36),

('Zero Pore Serum', '제로 포어 세럼',
 'Medicube', '메디큐브', 'serum', 'pore care serum',
 'A pore-minimizing serum with Niacinamide and Willow Bark Extract that tightens enlarged pores and controls excess sebum. Lightweight gel texture absorbs instantly.',
 30, '30ml', 28000, 22.00, 4.4, 4800, true, 6, 24),

-- The Face Shop (expanding from 6 in file 005)
('Yehwadam Hwansaenggo Rejuvenating Cream', '예화담 환생고 크림',
 'The Face Shop', '더페이스샵', 'moisturizer', 'anti-aging cream',
 'A premium anti-aging cream with 7 traditional Korean herbal ingredients that rejuvenate and firm mature skin. Rich, nourishing texture with herbal fragrance.',
 50, '50ml', 45000, 35.00, 4.6, 3800, true, 12, 36),

('Rice Water Bright Light Cleansing Oil', '쌀뜨물 브라이트 라이트 클렌징 오일',
 'The Face Shop', '더페이스샵', 'cleanser', 'cleansing oil',
 'A rice water-infused cleansing oil that gently removes makeup while brightening. Lightweight oil transforms to milky emulsion on contact with water. Leaves skin clear and luminous.',
 150, '150ml', 12000, 9.50, 4.5, 7200, true, 12, 36),

-- Skin&Lab (new brand)
('Red Cream', '레드 크림',
 'Skin&Lab', '스킨앤랩', 'moisturizer', 'antioxidant cream',
 'An antioxidant-rich cream with Rose Hip Oil, Vitamin E, and Pomegranate extract that nourishes and protects aging skin. Lightweight yet deeply moisturizing formula.',
 50, '50ml', 28000, 22.00, 4.5, 3600, true, 12, 36),

('Vitamin C Brightening Serum', '비타민C 브라이트닝 세럼',
 'Skin&Lab', '스킨앤랩', 'serum', 'vitamin c serum',
 'A stabilized Vitamin C serum with 10% Ascorbic Acid that brightens, firms, and protects against environmental damage. Ferulic Acid and Vitamin E enhance antioxidant efficacy.',
 30, '30ml', 25000, 19.50, 4.4, 2800, true, 6, 24),

-- Dewytree (new brand)
('Ultra Vitalizing Snail Cream', '울트라 바이탈라이징 스네일 크림',
 'Dewytree', '듀이트리', 'moisturizer', 'snail cream',
 'A multi-functional cream with 70% Snail Mucin filtrate that repairs, hydrates, and firms. Addresses fine lines, acne scars, and dullness with Korean snail mucin technology.',
 80, '80ml', 28000, 22.00, 4.5, 3400, true, 12, 36),

('AC Dew Blemish Spot', 'AC 듀 블레미쉬 스팟',
 'Dewytree', '듀이트리', 'spot_treatment', NULL,
 'A targeted blemish spot treatment with Salicylic Acid, Tea Tree, and Centella that dries out active breakouts overnight. Clear formula disappears on application.',
 15, '15ml', 12000, 9.50, 4.3, 2600, true, 6, 24),

-- Sidmool (new brand)
('Royal Honey Peptide Deep Moisture Cream', '로열 허니 펩타이드 딥 모이스처 크림',
 'Sidmool', '시드물', 'moisturizer', 'peptide cream',
 'A deeply nourishing cream combining Royal Jelly, Honey, and Peptides for anti-aging and hydration. Indie Korean brand known for high-concentration active formulas at accessible prices.',
 50, '50ml', 18000, 14.00, 4.6, 2200, true, 12, 36),

('Dr. Troub Skin Returning Niaten Serum', '닥터 트러브 나이아텐 세럼',
 'Sidmool', '시드물', 'serum', 'niacinamide serum',
 'A 10% Niacinamide serum that brightens, reduces pore size, and controls sebum production. Beloved in Korean skincare communities for its high concentration and low price.',
 30, '30ml', 10000, 8.00, 4.5, 4200, true, 6, 24),

-- Apieu (new brand)
('Madecassoside Cica Gel', '마데카소사이드 시카 젤',
 'Apieu', '어퓨', 'moisturizer', 'cica gel',
 'A lightweight cica gel with Madecassoside that soothes irritated skin and strengthens the barrier. Non-sticky gel texture perfect for oily and combination skin types.',
 130, '130ml', 12000, 9.50, 4.4, 5800, true, 12, 36),

('Juicy Pang Water Blusher', '쥬시 팡 워터 블러셔',
 'Apieu', '어퓨', 'lip_care', 'blush',
 'A water-based liquid blush that delivers a natural, dewy flush of color. Buildable formula with a juicy, translucent finish popular for the K-beauty fresh-faced look.',
 NULL, '9g', 8000, 6.50, 4.4, 6200, true, 24, 36),

-- Numbuzin (expanding — one more)
('No.2 Superbicol Serum', 'No.2 수퍼비콜 세럼',
 'Numbuzin', '넘버즈인', 'serum', 'collagen serum',
 'A collagen-boosting serum with Super Collagen and Peptides that firms and plumps aging skin. Popular for visible improvement in skin elasticity and fine lines within weeks.',
 50, '50ml', 26000, 20.00, 4.5, 5200, true, 6, 24),

-- Banila Co (expanding — one more)
('Dear Hydration Skin Softening Toner', '디어 하이드레이션 스킨 소프트닝 토너',
 'Banila Co', '바닐라코', 'toner', 'hydrating toner',
 'A deeply hydrating toner with Ceramides and Bamboo Water that softens and preps skin for the next steps. Splash mask technique compatible for intensive hydration.',
 200, '200ml', 18000, 14.00, 4.4, 3200, true, 12, 36);


-- ============================================================================
-- Verify final count
-- ============================================================================
SELECT COUNT(*) AS total_products FROM ss_products;

SELECT brand_en, COUNT(*) AS count
FROM ss_products
GROUP BY brand_en
ORDER BY count DESC
LIMIT 30;
