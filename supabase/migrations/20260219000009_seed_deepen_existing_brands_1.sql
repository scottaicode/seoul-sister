-- ============================================================================
-- Seoul Sister Product Database — Deepening Existing Brands (Part 1)
-- ~52 new products for COSRX, Laneige, Innisfree, Dr. Jart+, Sulwhasoo,
-- Anua, Beauty of Joseon
-- Run in Supabase SQL Editor after 20260219000008
-- ============================================================================

INSERT INTO ss_products (
  name_en, name_ko, brand_en, brand_ko, category, subcategory,
  description_en, volume_ml, volume_display,
  price_krw, price_usd, rating_avg, review_count,
  is_verified, pao_months, shelf_life_months
) VALUES

-- ============================================================================
-- COSRX (8 new products)
-- Existing: Advanced Snail 96, BHA Blackhead Power Liquid, Low pH Good Morning,
--   AHA/BHA Clarifying Treatment Toner, Snail Mucin Dual Eye Cream
-- ============================================================================

('Full Fit Propolis Light Ampoule', '풀핏 프로폴리스 라이트 앰플',
 'COSRX', '코스알엑스', 'ampoule', NULL,
 'A glow-boosting ampoule with 83.25% Black Bee Propolis extract and 2% honey extract that deeply nourishes and gives skin a natural honey glow. Lightweight, non-sticky formula.',
 30, '30ml', 23000, 18.00, 4.7, 8200, true, 6, 24),

('AC Collection Blemish Spot Clearing Serum', 'AC 컬렉션 블레미쉬 스팟 클리어링 세럼',
 'COSRX', '코스알엑스', 'serum', 'acne treatment',
 'A targeted blemish serum with Niacinamide, BHA, and AHA that clears active breakouts, fades post-acne marks, and prevents future blemishes. From the AC Collection for acne-prone skin.',
 40, '40ml', 20000, 15.50, 4.5, 6800, true, 6, 24),

('Balancium Comfort Ceramide Cream', '밸런시움 컴포트 세라마이드 크림',
 'COSRX', '코스알엑스', 'moisturizer', 'barrier cream',
 'A ceramide barrier cream with Centella Asiatica and Mung Bean that strengthens compromised skin barriers, soothes irritation, and provides lasting comfort. For sensitive and dry skin.',
 80, '80ml', 25000, 19.00, 4.6, 5200, true, 12, 36),

('The Vitamin C 23 Serum', '더 비타민 C 23 세럼',
 'COSRX', '코스알엑스', 'serum', 'vitamin C',
 'A potent 23% pure Vitamin C (Ascorbic Acid) serum that targets dark spots, wrinkles, and dullness. Lightweight, stable formula with visible brightening results within 3 weeks.',
 20, '20ml', 23000, 18.00, 4.5, 7200, true, 6, 24),

('The Retinol 0.1 Cream', '더 레티놀 0.1 크림',
 'COSRX', '코스알엑스', 'moisturizer', 'retinol',
 'A beginner-friendly retinol cream with 0.1% Retinaldehyde and squalane that smooths fine lines, refines texture, and boosts cell turnover without excessive irritation.',
 20, '20ml', 23000, 18.00, 4.5, 5800, true, 6, 24),

('Oil-Free Ultra-Moisturizing Lotion with Birch Sap', '오일프리 울트라 모이스처라이징 로션',
 'COSRX', '코스알엑스', 'moisturizer', 'lotion',
 'A lightweight oil-free lotion with 70% Birch Sap that deeply hydrates oily, combination, and acne-prone skin without clogging pores. Fresh, quick-absorbing texture.',
 100, '100ml', 17000, 13.00, 4.6, 6200, true, 12, 36),

('Pure Fit Cica Serum', '퓨어핏 시카 세럼',
 'COSRX', '코스알엑스', 'serum', 'cica',
 'A calming serum with 76% Centella Asiatica extract and panthenol that soothes redness, repairs the barrier, and provides lightweight hydration for sensitive and acne-prone skin.',
 30, '30ml', 22000, 17.00, 4.6, 4800, true, 6, 24),

('Advanced Snail Radiance Dual Essence', '어드밴스드 스네일 래디언스 듀얼 에센스',
 'COSRX', '코스알엑스', 'essence', NULL,
 'A dual-phase essence combining snail mucin water and niacinamide oil that brightens, hydrates, and repairs. Shake to blend both phases, then apply for radiant, dewy skin.',
 80, '80ml', 25000, 19.00, 4.5, 3800, true, 12, 36),

-- ============================================================================
-- LANEIGE (8 new products)
-- Existing: Water Sleeping Mask, Lip Sleeping Mask, Cream Skin Refiner,
--   Water Bank Blue Hyaluronic Cream, Neo Cushion Matte SPF42
-- ============================================================================

('Water Bank Blue Hyaluronic Serum', '워터뱅크 블루 히알루로닉 세럼',
 'Laneige', '라네즈', 'serum', NULL,
 'A hydrating serum with Blue Hyaluronic Acid exclusive to Laneige that provides deep moisture penetration. Multi-molecular weight hyaluronic acid hydrates at every skin layer.',
 50, '50ml', 38000, 29.00, 4.6, 5200, true, 6, 24),

('Water Bank Blue Hyaluronic Essence', '워터뱅크 블루 히알루로닉 에센스',
 'Laneige', '라네즈', 'essence', NULL,
 'A lightweight hydrating essence with Blue Hyaluronic Acid technology that preps skin for better absorption of subsequent products. Watery texture sinks in instantly.',
 120, '120ml', 35000, 27.00, 4.6, 4800, true, 12, 36),

('Lip Glowy Balm', '립 글로이 밤',
 'Laneige', '라네즈', 'lip_care', NULL,
 'A tinted lip balm with Berry Fruit Complex that provides sheer color, glossy shine, and lasting moisture. Available in multiple shades for everyday lip care with a hint of color.',
 10, '10g', 18000, 14.00, 4.5, 7200, true, 12, 36),

('Bouncy & Firm Sleeping Mask', '바운시 앤 펌 슬리핑 마스크',
 'Laneige', '라네즈', 'mask', 'sleeping mask',
 'A firming overnight mask with peptides and Green Tea probiotics that lifts, firms, and bounces back sagging skin while you sleep. Part of the anti-aging sleeping mask collection.',
 60, '60ml', 32000, 25.00, 4.5, 3200, true, 6, 24),

('Radian-C Cream', '래디안-C 크림',
 'Laneige', '라네즈', 'moisturizer', 'brightening',
 'A brightening cream with stabilized Vitamin C and Caffeine that targets dark spots, dullness, and uneven skin tone while providing moisture. Clinical brightening in a creamy texture.',
 30, '30ml', 35000, 27.00, 4.5, 3800, true, 12, 36),

('Water Sleeping Mask EX', '워터 슬리핑 마스크 EX',
 'Laneige', '라네즈', 'mask', 'sleeping mask',
 'The upgraded version of the iconic sleeping mask with Probiotics Complex and Squalane that delivers enhanced overnight hydration, barrier repair, and morning glow. 33% better moisture.',
 70, '70ml', 32000, 25.00, 4.7, 6800, true, 6, 24),

('Cream Skin Cerapeptide Refiner', '크림 스킨 세라펩타이드 리파이너',
 'Laneige', '라네즈', 'toner', 'cream toner',
 'An upgraded toner-in-cream with Ceramides and 5 Peptides that combines the hydration of a cream with the lightness of a toner. Firming and barrier-strengthening in one step.',
 170, '170ml', 35000, 27.00, 4.6, 5200, true, 12, 36),

('Glowy Makeup Serum', '글로이 메이크업 세럼',
 'Laneige', '라네즈', 'serum', 'makeup prep',
 'A makeup-prep serum with micro-capsule technology that creates a luminous, dewy base for flawless makeup application. Hydrates, smooths, and adds glow all day.',
 30, '30ml', 30000, 23.00, 4.5, 3200, true, 12, 36),

-- ============================================================================
-- INNISFREE (8 new products)
-- Existing: Green Tea Seed Serum, Jeju Volcanic Pore Cleansing Foam,
--   Green Tea Seed Hyaluronic Cream, Retinol Cica Repair Ampoule,
--   Dewy Glow Tone Up Cream SPF50+
-- ============================================================================

('Green Tea Seed Hyaluronic Toner', '그린티 씨드 히알루로닉 토너',
 'Innisfree', '이니스프리', 'toner', NULL,
 'A hydrating toner with Jeju Green Tea seeds and hyaluronic acid that provides multi-layer moisture from the first step. Triple-HA technology delivers deep, lasting hydration.',
 170, '170ml', 18000, 14.00, 4.6, 6800, true, 12, 36),

('Green Tea Seed Eye Cream', '그린티 씨드 아이 크림',
 'Innisfree', '이니스프리', 'eye_care', NULL,
 'A moisture-rich eye cream with Jeju Green Tea seeds that hydrates, brightens, and reduces puffiness around the delicate eye area. Suitable for younger skin concerned about early signs of aging.',
 30, '30ml', 22000, 17.00, 4.5, 4200, true, 6, 24),

('Jeju Volcanic Color Clay Mask', '제주 화산송이 컬러 클레이 마스크',
 'Innisfree', '이니스프리', 'mask', 'clay mask',
 'A customizable clay mask with Jeju volcanic cluster clay available in 7 color variants targeting different skin concerns. Deep cleansing, pore tightening, and sebum control.',
 70, '70ml', 12000, 9.50, 4.5, 7800, true, 6, 24),

('Daily UV Defense Sunscreen SPF36 PA+++', '데일리 UV 디펜스 선스크린 SPF36 PA+++',
 'Innisfree', '이니스프리', 'sunscreen', NULL,
 'A daily sunscreen with SPF36 PA+++ and Jeju Green Tea extract that provides lightweight UV protection for everyday use. No white cast, suitable under makeup.',
 50, '50ml', 16000, 12.50, 4.5, 5600, true, 6, 24),

('Black Tea Youth Enhancing Ampoule', '블랙티 유스 인핸싱 앰플',
 'Innisfree', '이니스프리', 'ampoule', 'anti-aging',
 'An anti-aging ampoule with Jeju fermented Black Tea that targets fine lines, loss of firmness, and dullness. Fermented for 80+ hours to concentrate antioxidant polyphenols.',
 30, '30ml', 30000, 23.00, 4.5, 3200, true, 6, 24),

('Intensive Hydrating Serum with Green Tea Seed', '인텐시브 하이드레이팅 세럼 위드 그린티 씨드',
 'Innisfree', '이니스프리', 'serum', NULL,
 'An upgraded hydrating serum with concentrated Jeju Green Tea seed extract and beauty green tea water that provides intensive moisture for dehydrated, dull skin.',
 80, '80ml', 25000, 19.00, 4.6, 5200, true, 6, 24),

('Super Volcanic Pore Clay Mask 2X', '슈퍼 화산송이 모공 클레이 마스크 2X',
 'Innisfree', '이니스프리', 'mask', 'clay mask',
 'An upgraded volcanic clay mask with 2X more volcanic ash and AHA that provides deeper pore cleansing, stronger sebum control, and smoother texture. 6 sebum-controlling ingredients.',
 100, '100ml', 15000, 12.00, 4.5, 8200, true, 6, 24),

('Cherry Blossom Tone Up Cream', '체리블라썸 톤업 크림',
 'Innisfree', '이니스프리', 'moisturizer', 'tone-up cream',
 'A tone-up moisturizer with Jeju cherry blossom extract that instantly brightens skin tone with a pink-white glow while providing hydration. Popular as a makeup base.',
 50, '50ml', 20000, 15.50, 4.4, 5800, true, 12, 36),

-- ============================================================================
-- DR. JART+ (7 new products)
-- Existing: Cicapair Tiger Grass Re.pair Cream, Ceramidin Cream, Vital Hydra
--   Solution Biome Essence, Cicapair Tiger Grass Color Correcting SPF30,
--   Dermask Water Jet Vital Hydra Solution
-- ============================================================================

('Cicapair Tiger Grass Camo Drops SPF35 PA++', '시카페어 타이거 그래스 카모 드롭스',
 'Dr. Jart+', '닥터자르트', 'sunscreen', 'color correcting',
 'Color-correcting serum drops with SPF35 PA++ that transform from green to beige to neutralize redness while providing sun protection. Customizable coverage, lightweight formula.',
 30, '30ml', 42000, 32.00, 4.6, 5200, true, 6, 24),

('Ceramidin Liquid', '세라마이딘 리퀴드',
 'Dr. Jart+', '닥터자르트', 'toner', 'ceramide toner',
 'A ceramide-infused liquid toner that strengthens the moisture barrier from the first step. 5 Cera-Barrier complex creates a protective shield for dry and sensitive skin.',
 150, '150ml', 35000, 27.00, 4.6, 6800, true, 12, 36),

('Ceramidin Serum', '세라마이딘 세럼',
 'Dr. Jart+', '닥터자르트', 'serum', 'barrier care',
 'A ceramide serum with 5 Cera-Barrier complex and panthenol that intensively repairs and strengthens the damaged skin barrier. Layer before Ceramidin Cream for maximum repair.',
 40, '40ml', 40000, 31.00, 4.6, 4200, true, 6, 24),

('Dermask Micro Jet Brightening Solution', '더마스크 마이크로젯 브라이트닝 솔루션',
 'Dr. Jart+', '닥터자르트', 'mask', 'sheet mask',
 'A brightening sheet mask with Glutathione and Niacinamide delivered through micro-jet technology for deeper penetration. Visible brightening after a single use.',
 NULL, '1 sheet', 5000, 4.00, 4.5, 5800, true, 6, 24),

('Vital Hydra Solution Capsule Ampoule', '바이탈 하이드라 솔루션 캡슐 앰플',
 'Dr. Jart+', '닥터자르트', 'ampoule', NULL,
 'A hydrating ampoule with Panthenol, Trehalose, and Hyaluronic Acid capsules that burst on application to deliver targeted deep moisture for dehydrated, dull skin.',
 30, '30ml', 38000, 29.00, 4.5, 3800, true, 6, 24),

('Every Sun Day Sun Fluid SPF50+ PA++++', '에브리 선 데이 선 플루이드 SPF50+',
 'Dr. Jart+', '닥터자르트', 'sunscreen', NULL,
 'A lightweight daily sun fluid with SPF50+ PA++++ that provides broad-spectrum protection with a non-greasy, weightless finish. Suitable for sensitive skin, no white cast.',
 30, '30ml', 28000, 22.00, 4.5, 4200, true, 6, 24),

('Ctrl-A Teatreement Cleansing Foam', 'Ctrl-A 티트리트먼트 클렌징 폼',
 'Dr. Jart+', '닥터자르트', 'cleanser', 'acne cleanser',
 'An acne-fighting cleansing foam with Tea Tree extract and Salicylic Acid that deeply cleanses pores, controls sebum, and prevents breakouts. pH-balanced for acne-prone skin.',
 120, '120ml', 22000, 17.00, 4.5, 4800, true, 12, 36),

-- ============================================================================
-- SULWHASOO (7 new products)
-- Existing: First Care Activating Serum, Concentrated Ginseng Renewing Cream,
--   Essential Balancing Emulsion, Perfecting Cushion SPF50+, Overnight
--   Vitalizing Mask, Bloomstay Vitalizing Cream, Ginseng Eye Cream
-- ============================================================================

('Concentrated Ginseng Renewing Serum', '자음생 에센스',
 'Sulwhasoo', '설화수', 'serum', 'luxury anti-aging',
 'A premium anti-aging serum with Korean Red Ginseng Saponin that stimulates collagen production, firms sagging skin, and restores youthful resilience. Core Sulwhasoo anti-aging treatment.',
 50, '50ml', 160000, 123.00, 4.7, 4800, true, 6, 24),

('Essential Balancing Water', '자음수',
 'Sulwhasoo', '설화수', 'toner', NULL,
 'A hydrating balancing water (toner) with Korean herbal complex that provides essential moisture and prepares skin for the full Sulwhasoo ritual. Foundation step of the Jaum line.',
 125, '125ml', 52000, 40.00, 4.6, 3800, true, 12, 36),

('Clarifying Mask EX', '옥용팩 EX',
 'Sulwhasoo', '설화수', 'mask', 'peel-off mask',
 'A Korean herbal peel-off mask with Polygala Root and White Jade that lifts away dead skin cells and impurities, revealing smoother, brighter skin underneath. K-beauty luxury classic.',
 120, '120ml', 48000, 37.00, 4.5, 3200, true, 6, 24),

('Snowise Brightening Serum', '설미백 브라이트닝 세럼',
 'Sulwhasoo', '설화수', 'serum', 'brightening',
 'A brightening serum with White Ginseng extract and SONO technology that targets deep pigmentation and uneven skin tone. Korean herbal approach to brightening for luxury skincare fans.',
 50, '50ml', 120000, 92.00, 4.5, 2200, true, 6, 24),

('Gentle Cleansing Oil', '순행 클렌징 오일',
 'Sulwhasoo', '설화수', 'cleanser', 'cleansing oil',
 'A luxurious cleansing oil with herbal extracts that dissolves makeup, sunscreen, and impurities while nourishing skin. Emulsifies into a milky texture and rinses clean without residue.',
 200, '200ml', 45000, 35.00, 4.6, 4200, true, 12, 36),

('Essential Lip Serum Stick', '진설 립 세럼 스틱',
 'Sulwhasoo', '설화수', 'lip_care', NULL,
 'A nourishing lip serum in a stick format with Camellia seed oil and Korean medicinal herb extracts that heals, hydrates, and plumps dry, chapped lips. Luxurious lip care.',
 3, '3g', 38000, 29.00, 4.5, 2800, true, 12, 36),

('Concentrated Ginseng Renewing Eye Cream EX', '자음생 아이크림 EX',
 'Sulwhasoo', '설화수', 'eye_care', NULL,
 'The upgraded luxury eye cream with 10X concentrated ginseng extract that targets all signs of eye-area aging — wrinkles, dark circles, sagging, and loss of firmness.',
 20, '20ml', 130000, 100.00, 4.6, 2200, true, 6, 24),

-- ============================================================================
-- ANUA (7 new products)
-- Existing: Heartleaf 77% Soothing Toner, Heartleaf 80% Soothing Ampoule,
--   Heartleaf 77% Clear Pad, Niacinamide 10% + TXA 4% Dark Spot Serum,
--   Heartleaf Pore Control Cleansing Oil
-- ============================================================================

('Heartleaf Quercetinol Pore Deep Cleansing Foam', '어성초 퀘르세티놀 포어 딥 클렌징 폼',
 'Anua', '아누아', 'cleanser', 'foaming cleanser',
 'A pore-deep cleansing foam with Heartleaf extract and Quercetinol that removes impurities from deep within pores while maintaining the skin moisture barrier. pH 5.5 formula.',
 150, '150ml', 18000, 14.00, 4.6, 5200, true, 12, 36),

('Heartleaf 70% Daily Relief Lotion', '어성초 70% 데일리 릴리프 로션',
 'Anua', '아누아', 'moisturizer', 'lotion',
 'A lightweight daily lotion with 70% Heartleaf extract that soothes, hydrates, and repairs without heaviness. Perfect for oily and combination skin that needs calming hydration.',
 200, '200ml', 22000, 17.00, 4.6, 4800, true, 12, 36),

('Peach 70% Niacin Serum', '피치 70% 나이아신 세럼',
 'Anua', '아누아', 'serum', 'brightening',
 'A brightening serum with 70% Peach extract and 10% Niacinamide that targets dull skin, hyperpigmentation, and enlarged pores. Sweet peach extract delivers antioxidant and brightening benefits.',
 30, '30ml', 20000, 15.50, 4.5, 4200, true, 6, 24),

('Heartleaf 80% Moisture Soothing Cream', '어성초 80% 모이스처 수딩 크림',
 'Anua', '아누아', 'moisturizer', 'cica cream',
 'A rich soothing cream with 80% Heartleaf extract and ceramides that calms severe redness, repairs the barrier, and provides deep moisture for very dry and sensitive skin.',
 100, '100ml', 26000, 20.00, 4.6, 3800, true, 12, 36),

('Birch 70% Moisture Boosting Serum', '자작나무 70% 모이스처 부스팅 세럼',
 'Anua', '아누아', 'serum', NULL,
 'A hydration-boosting serum with 70% Birch Sap and 4 types of hyaluronic acid that provides deep multi-layer moisture for dehydrated, dull skin. Fresh, lightweight formula.',
 30, '30ml', 20000, 15.50, 4.5, 3200, true, 6, 24),

('BHA 2% Gentle Exfoliating Toner', 'BHA 2% 젠틀 엑스폴리에이팅 토너',
 'Anua', '아누아', 'toner', 'exfoliating toner',
 'A 2% BHA (Salicylic Acid) exfoliating toner with Heartleaf extract that unclogs pores, controls sebum, and prevents blackheads while soothing inflammation. Gentle enough for regular use.',
 150, '150ml', 20000, 15.50, 4.5, 4200, true, 12, 36),

('Heartleaf Real Sun Protection Cream SPF50+ PA++++', '어성초 리얼 선 프로텍션 크림',
 'Anua', '아누아', 'sunscreen', NULL,
 'A soothing daily sunscreen with Heartleaf extract and SPF50+ PA++++ that calms sensitive skin while providing full UV protection. No white cast, lightweight, suitable under makeup.',
 50, '50ml', 20000, 15.50, 4.6, 5800, true, 6, 24),

-- ============================================================================
-- BEAUTY OF JOSEON (7 new products)
-- Existing: Glow Serum (Propolis + Niacinamide), Dynasty Cream, Relief Sun
--   SPF50+, Revive Serum (Ginseng + Snail Mucin), Calming Serum
--   (Green Tea + Panthenol)
-- ============================================================================

('Ginseng Cleansing Oil', '인삼 클렌징 오일',
 'Beauty of Joseon', '조선미녀', 'cleanser', 'cleansing oil',
 'A gentle cleansing oil with Ginseng seed oil and soybean oil that dissolves makeup, sunscreen, and impurities while nourishing skin. K-beauty heritage ingredients in modern format.',
 210, '210ml', 16000, 12.50, 4.6, 6800, true, 12, 36),

('Matte Sun Stick: Mugwort + Camelia SPF50+ PA++++', '매트 선스틱: 쑥 + 동백',
 'Beauty of Joseon', '조선미녀', 'sunscreen', 'sun stick',
 'A matte-finish sun stick with SPF50+ PA++++ and mugwort + camellia oil that provides portable UV protection without shine. Easy reapplication over makeup for oily skin.',
 18, '18g', 16000, 12.50, 4.5, 5200, true, 6, 24),

('Glow Deep Serum: Rice + Alpha-Arbutin', '글로우 딥 세럼: 쌀 + 알파 알부틴',
 'Beauty of Joseon', '조선미녀', 'serum', 'brightening',
 'A potent brightening serum with Rice extract and 2% Alpha-Arbutin that targets stubborn dark spots, melasma, and post-inflammatory hyperpigmentation. Deeper brightening than the original Glow Serum.',
 30, '30ml', 14000, 11.00, 4.6, 5800, true, 6, 24),

('Red Bean Refreshing Pore Mask', '팥 리프레싱 포어 마스크',
 'Beauty of Joseon', '조선미녀', 'mask', 'wash-off mask',
 'A pore-cleansing wash-off mask with Korean red bean (Adzuki) and BHA that draws out impurities, tightens pores, and controls excess sebum. Traditional Korean ingredient in modern skincare.',
 140, '140ml', 12000, 9.50, 4.5, 4200, true, 6, 24),

('Ginseng Eye Cream', '인삼 아이크림',
 'Beauty of Joseon', '조선미녀', 'eye_care', NULL,
 'An eye cream with Ginseng root water and retinal that targets fine lines, dark circles, and puffiness. Korean herbal anti-aging ingredients at an affordable price point.',
 20, '20ml', 14000, 11.00, 4.5, 4800, true, 6, 24),

('Ginseng Essence Water', '인삼 에센스 워터',
 'Beauty of Joseon', '조선미녀', 'toner', 'essence toner',
 'An essence-in-toner with 80% Ginseng water that preps and hydrates while delivering anti-aging ginseng benefits from the first step. Lightweight, layerable formula.',
 150, '150ml', 14000, 11.00, 4.6, 5200, true, 12, 36),

('Apricot Blossom Peeling Gel', '살구꽃 필링 젤',
 'Beauty of Joseon', '조선미녀', 'exfoliator', 'peeling gel',
 'A gentle peeling gel with apricot blossom extract and PHA that rolls away dead skin cells, smooths texture, and brightens without irritation. Weekly exfoliation for sensitive skin.',
 100, '100ml', 12000, 9.50, 4.5, 3800, true, 12, 36);


-- ============================================================================
-- Verify counts
-- ============================================================================
SELECT brand_en, COUNT(*) AS count
FROM ss_products
WHERE brand_en IN ('COSRX','Laneige','Innisfree','Dr. Jart+','Sulwhasoo','Anua','Beauty of Joseon')
GROUP BY brand_en ORDER BY brand_en;
