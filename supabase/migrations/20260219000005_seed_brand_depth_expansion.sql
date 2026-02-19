-- ============================================================================
-- Seoul Sister Product Database — Brand Depth Expansion
-- 30 new products: 6 per brand across Heimish, The Face Shop, Goodal,
-- Medicube, and Isntree. All verified via retailer research (Feb 2026).
-- Run in Supabase SQL Editor after 20260219000004_seed_products_expansion.sql
-- ============================================================================

INSERT INTO ss_products (
  name_en, name_ko, brand_en, brand_ko, category,
  description_en, volume_ml, volume_display,
  price_usd, price_krw, image_url, pao_months, is_verified
) VALUES

-- ============================================================================
-- HEIMISH (6 new products)
-- Existing in DB: All Clean Balm, All Clean Green Foam, Bulgarian Rose Satin
--   Cream, Artless Glow Base SPF50+, Marine Care Eye Cream
-- ============================================================================

('Matcha Biome Redness Relief Hydrating Toner',
 '마차 바이옴 레드니스 릴리프 하이드레이팅 토너',
 'Heimish', '헤이미쉬', 'toner',
 'A watery essence-toner with matcha extract and probiotics at pH 5.5 that calms redness, soothes sensitive skin, and delivers layered hydration without any stickiness. Free from 12 irritants.',
 150, '150ml', 20.00, 26000,
 'https://heimish.us/cdn/shop/files/matcha-biome-redness-relief-hydrating-toner-150ml.jpg',
 12, true),

('Matcha Biome Oil-Free Calming Gel Moisturizer',
 '마차 바이옴 오일프리 카밍 젤 모이스처라이저',
 'Heimish', '헤이미쉬', 'moisturizer',
 'A non-sticky oil-free gel moisturizer with 50% fermented matcha water and probiotics that cools on contact, instantly soothes oily and acne-prone skin, and balances the microbiome. Alcohol-free, parabens-free, pH 5.5.',
 100, '100ml', 25.00, 32500,
 'https://heimish.us/cdn/shop/files/matcha-biome-oil-free-calming-gel-moisturizer-100ml.jpg',
 12, true),

('Matcha Biome Intensive Repair Cream',
 '마차 바이옴 인텐시브 리페어 크림',
 'Heimish', '헤이미쉬', 'moisturizer',
 'A hypoallergenic barrier-repair moisturizer with 50% fermented matcha water, probiotics, ceramide, and panthenol that deeply nourishes very dry and sensitized skin. EWG Green-rated formula at pH 5.5.',
 50, '50ml', 28.00, 36400,
 'https://heimish.us/cdn/shop/files/matcha-biome-intensive-repair-cream-50ml.jpg',
 12, true),

('Marine Care Deep Moisture Nourishing Melting Cream',
 '마린 케어 딥 모이스처 노리싱 멜팅 크림',
 'Heimish', '헤이미쉬', 'moisturizer',
 'A luxurious whipped-texture cream infused with fermented seaweed, marine collagen, and mineral-rich seawater that melts into skin to deliver intense barrier-repairing moisture. Suitable for dry and mature skin.',
 55, '55ml', 34.00, 44200,
 'https://heimish.us/cdn/shop/files/marine-care-deep-moisture-nourishing-melting-cream-55ml.jpg',
 12, true),

('All Clean Low pH AHA/PHA Hydro Vegan Essence',
 '올 클린 로우 pH AHA/PHA 하이드로 비건 에센스',
 'Heimish', '헤이미쉬', 'essence',
 'A vegan exfoliating essence at low pH 3.9 combining AHA (glycolic, lactic) and PHA (gluconolactone) to gently dissolve dead skin cells, refine texture, and hydrate. Centella asiatica soothes post-exfoliation irritation.',
 50, '50ml', 22.00, 28600,
 'https://heimish.us/cdn/shop/files/all-clean-low-ph-aha-pha-hydro-vegan-essence-50ml.jpg',
 6, true),

('Black Tea Mask Pack',
 '블랙티 마스크 팩',
 'Heimish', '헤이미쉬', 'mask',
 'A cooling wash-off gel mask with Black Tea Polyphenols, Sodium Hyaluronate, aloe vera, and cica that tightens pores, boosts elasticity, and calms puffy or tired skin in just 5 minutes. Includes mini spatula.',
 110, '110ml', 18.00, 23400,
 'https://heimish.us/cdn/shop/files/black-tea-mask-pack-110ml.jpg',
 12, true),


-- ============================================================================
-- THE FACE SHOP (6 new products)
-- Existing in DB: Rice Water Bright Foaming Cleanser, Yehwadam Plum Flower
--   Revitalizing Serum, Rice & Ceramide Moisturizing Cream, Dr. Belmeur
--   Advanced Cica Recovery Cream, Yehwadam Hwansaenggo Rejuvenating Serum
-- ============================================================================

('Jeju Aloe 95% Fresh Soothing Gel',
 '제주 알로에 95% 프레쉬 수딩 젤',
 'The Face Shop', '더페이스샵', 'moisturizer',
 'A bestselling multi-use soothing gel with 95% Organic Certified Jeju aloe vera extract that instantly hydrates, calms sunburn, soothes irritated skin, and can be used on face, body, and hair. Vegan-certified.',
 300, '300ml', 13.00, 16900,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1057504839/1/A.jpg',
 12, true),

('Jeju Aloe Fresh Soothing Foam Cleanser',
 '제주 알로에 프레쉬 수딩 폼 클렌저',
 'The Face Shop', '더페이스샵', 'cleanser',
 'A gel-to-foam daily facial cleanser with Jeju aloe vera, green tea, and chamomile that gently removes impurities and excess oil while calming sensitive skin and maintaining the moisture balance.',
 150, '150ml', 13.99, 18100,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1090402939/1/A.jpg',
 12, true),

('Herb Day 365 Master Blending Cleansing Foam',
 '허브데이 365 마스터 블렌딩 클렌징 폼',
 'The Face Shop', '더페이스샵', 'cleanser',
 'A creamy foaming cleanser with 365 days of herb-fermented extracts including green tea, calendula, and centella that deeply cleanses pores while delivering antioxidant and soothing benefits to all skin types.',
 170, '170ml', 12.00, 15600,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1050132500/1/A.jpg',
 12, true),

('The Therapy Royal Made Oil Blending Serum',
 '더 테라피 로얄 메이드 오일 블렌딩 세럼',
 'The Face Shop', '더페이스샵', 'serum',
 'An oil-in-water anti-aging serum from The Therapy line infused with antioxidant botanical oils including rosehip, squalane, and royal herb complex that nourishes, brightens, and firms mature skin.',
 35, '35ml', 42.00, 54600,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1067902847/1/A.jpg',
 12, true),

('Yehwadam Hwansaenggo Ultimate Rejuvenating Cream',
 '예화담 환생고 얼티밋 리주비네이팅 크림',
 'The Face Shop', '더페이스샵', 'moisturizer',
 'A premium anti-aging balm-type cream from the heritage Hwansaenggo collection, formulated with Cheon-Hye-Myeong-Ui-Dan complex of 12 traditional Korean herbs to restore skin radiance, vitality, and resilience.',
 50, '50ml', 65.00, 84500,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1122805380/1/A.jpg',
 12, true),

('Natural Sun Eco Mild Watery Sun Cream SPF45 PA+++',
 '내추럴 선 에코 마일드 워터리 선크림 SPF45',
 'The Face Shop', '더페이스샵', 'sunscreen',
 'A lightweight SPF45 PA+++ daily sunscreen with a water-drop texture that absorbs quickly with no white cast. Formulated with sunflower and olive extract for skin-friendly UV protection suitable for all skin types.',
 50, '50ml', 17.00, 22100,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1052341872/1/A.jpg',
 6, true),


-- ============================================================================
-- GOODAL (6 new products)
-- Existing in DB: Green Tangerine Vita C Dark Spot Care Serum (serum),
--   Houttuynia Cordata Calming Essence, Vegan Rice Milk Moisturizing Cream,
--   Green Tangerine Vita C Toner Pad, Green Tangerine Vita C Dark Spot Care Cream
-- ============================================================================

('Green Tangerine Vita C Dark Spot Toner',
 '청귤 비타C 잡티케어 토너',
 'Goodal', '구달', 'toner',
 'A brightening vitamin C toner with 67% Jeju green tangerine extract and eight types of hyaluronic acid that visibly reduces dark spots and hyperpigmentation while delivering 24-hour hydration to sensitive skin.',
 300, '300ml', 24.00, 31200,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1119086771/1/A.jpg',
 12, true),

('Heartleaf Calming Moisture Serum',
 '허트리프 칼밍 모이스처 세럼',
 'Goodal', '구달', 'serum',
 'A lightweight calming serum with Jeju Houttuynia Cordata extract and eight types of hyaluronic acid that instantly soothes redness, rebuilds the skin barrier, and delivers long-lasting moisture for sensitive and acne-prone skin.',
 30, '30ml', 22.00, 28600,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1113845090/1/A.jpg',
 12, true),

('Heartleaf Calming Moisture Toner Pad',
 '허트리프 칼밍 모이스처 토너 패드',
 'Goodal', '구달', 'exfoliator',
 'Vegan toner pads soaked in heartleaf, turmeric root, and holy basil extracts (70 pads) to instantly alleviate redness and irritation. Both sides deliver gentle wiping cleanse plus concentrated soothing hydration.',
 210, '70 pads', 22.00, 28600,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1113845091/1/A.jpg',
 6, true),

('Heartleaf Calming Tone Up Sun Cream SPF50+ PA++++',
 '허트리프 칼밍 톤업 선크림 SPF50+ PA++++',
 'Goodal', '구달', 'sunscreen',
 'A dual-action SPF50+ PA++++ sunscreen that provides broad-spectrum UV protection while calming redness with Houttuynia Cordata extract. The tone-up formula delivers a lightweight brightening finish with no white cast.',
 50, '50ml', 20.00, 26000,
 'https://www.dodoskin.com/cdn/shop/products/goodal-heartleaf-calming-tone-up-sun-cream-50ml.jpg',
 6, true),

('Apple AHA Clearing Ampoule',
 '애플 AHA 클리어링 앰플',
 'Goodal', '구달', 'ampoule',
 'An exfoliating ampoule powered by 5% Apple AHA complex that gently resurfaces the skin to minimize pores, smooth texture, fade post-acne marks, and reveal a brighter complexion. Vegan certified, 18FREE+.',
 30, '30ml', 24.00, 31200,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1113845100/1/A.jpg',
 6, true),

('Lemon Vita C Clear Serum',
 '레몬 비타C 클리어 세럼',
 'Goodal', '구달', 'serum',
 'A clarifying serum with 13% fresh lemon extract and vitamin C derivatives that targets dullness, uneven texture, and hyperpigmentation. Lightweight water-gel texture absorbs instantly for a translucent glass-skin finish.',
 30, '30ml', 22.00, 28600,
 'https://image.yesstyle.com/api/image?path=https://img.yesstyle.com/ys1113845110/1/A.jpg',
 12, true),


-- ============================================================================
-- MEDICUBE (6 new products)
-- Existing in DB: Red Erasing Cream 2.0, PDRN Pink Peptide Serum,
--   Zero Pore Pad 2.0, Collagen Niacinamide Jelly Cream, Deep Vita C Ampoule 2.0
-- ============================================================================

('Triple Collagen Serum 4.0',
 '트리플 콜라겐 세럼 4.0',
 'Medicube', '메디큐브', 'serum',
 'A bestselling firming serum combining three types of collagen — Hydrolyzed, Atelo, and Soluble — plus Niacinamide and Hyaluronic Acid to deeply penetrate the skin barrier, plump fine lines, and restore suppleness.',
 55, '55ml', 38.00, 49400,
 'https://medicube.us/cdn/shop/files/triple-collagen-serum-4-55ml.jpg',
 12, true),

('Triple Collagen Toner 4.0',
 '트리플 콜라겐 토너 4.0',
 'Medicube', '메디큐브', 'toner',
 'A fast-absorbing toner with three collagen types (Hydrolyzed, Atelo, Soluble) that floods skin with essential nutrients for deep hydration and all-day suppleness. Ideal as the first step to prep skin for collagen layering.',
 140, '140ml', 22.00, 28600,
 'https://medicube.us/cdn/shop/files/triple-collagen-toner-4-140ml.jpg',
 12, true),

('PDRN Pink Collagen Capsule Cream',
 'PDRN 핑크 콜라겐 캡슐 크림',
 'Medicube', '메디큐브', 'moisturizer',
 'A lightweight dual-texture moisturizer featuring encapsulated Salmon DNA PDRN and Niacinamide that bursts on contact for targeted spot care, even skin tone, and lasting glow hydration. Viral on TikTok.',
 55, '55g', 22.00, 28600,
 'https://medicube.us/cdn/shop/files/pdrn-pink-collagen-capsule-cream-55g.jpg',
 12, true),

('PDRN Pink Collagen Gel Toner Pad',
 'PDRN 핑크 콜라겐 젤 토너 패드',
 'Medicube', '메디큐브', 'exfoliator',
 'Dual-textured exfoliating pads (60 pads) soaked in PDRN, Pink Collagen, and Niacinamide-enriched essence. The rough side sweeps away dead skin cells while the soft side delivers concentrated hydration and radiance.',
 180, '60 pads', 23.00, 29900,
 'https://medicube.us/cdn/shop/files/pdrn-pink-collagen-gel-toner-pad-60pads.jpg',
 6, true),

('Triple Collagen Cream',
 '트리플 콜라겐 크림',
 'Medicube', '메디큐브', 'moisturizer',
 'A rich barrier-strengthening moisturizer from the Triple Collagen line that combines three collagen types with Adenosine and Ceramide to visibly plump, firm, and nourish dry and mature-skewed skin types.',
 50, '50ml', 28.00, 36400,
 'https://medicube.us/cdn/shop/files/triple-collagen-cream-50ml.jpg',
 12, true),

('Exosome Shot PDRN Pink Collagen 2000 Serum',
 '엑소좀 샷 PDRN 핑크 콜라겐 2000 세럼',
 'Medicube', '메디큐브', 'ampoule',
 'An advanced skin booster ampoule with 2,000 ppm Salmon DNA PDRN Spicules and exosome complex that penetrates deeply to smooth uneven texture, minimize pores, and stimulate skin renewal for a glass-skin finish.',
 30, '30ml', 39.00, 50700,
 'https://medicube.us/cdn/shop/files/exosome-shot-pdrn-pink-collagen-2000-serum-30ml.jpg',
 6, true),


-- ============================================================================
-- ISNTREE (6 new products)
-- Existing in DB: Hyaluronic Acid Toner Plus, Green Tea Fresh Emulsion,
--   Spot Saver Mugwort Ampoule
-- ============================================================================

('Chestnut AHA 8% Clear Essence',
 '체스트넛 AHA 8% 클리어 에센스',
 'Isntree', '이즈앤트리', 'essence',
 'A chemical exfoliating essence with 8% AHA (4% glycolic + 4% lactic acid) and Gongju Chestnut Shell extract that resurfaces dead skin cells, minimizes pores, fades post-acne marks, and brightens dull complexions.',
 100, '100ml', 26.00, 33800,
 'https://theisntree.com/cdn/shop/products/isntree-chestnut-aha-8-clear-essence-100ml.jpg',
 6, true),

('TW-Real Bifida Collagen Ampoule',
 'TW 리얼 비피다 콜라겐 앰플',
 'Isntree', '이즈앤트리', 'ampoule',
 'A multi-functional anti-aging ampoule with 88% Bifida Ferment Lysate, triple peptides (Palmitoyl Oligopeptide, Copper Tripeptide-1, Acetyl Hexapeptide-8), Niacinamide, and Adenosine that strengthens the barrier, improves elasticity, and brightens.',
 50, '50ml', 38.00, 49400,
 'https://theisntree.com/cdn/shop/products/isntree-tw-real-bifida-collagen-ampoule-50ml.jpg',
 12, true),

('Aloe Soothing Gel Fresh Type',
 '알로에 수딩 젤 프레쉬 타입',
 'Isntree', '이즈앤트리', 'moisturizer',
 'A lightweight multi-use soothing gel with 99% Jeju Island aloe vera leaf extract that instantly hydrates, cools, and calms sun-exposed or irritated skin. Fragrance-free and suitable for face, body, and after-sun care.',
 300, '300ml', 18.00, 23400,
 'https://theisntree.com/cdn/shop/products/isntree-aloe-soothing-gel-fresh-type-300ml.jpg',
 12, true),

('Yam Root Vegan Milk Cleanser',
 '얌 루트 비건 밀크 클렌저',
 'Isntree', '이즈앤트리', 'cleanser',
 'A vegan milk cleanser with Andong Yam Root Extract rich in amino acids, plus coconut, rice, soybean, sweet almond, and oatmeal that gently removes impurities while maintaining the moisture barrier. Non-foaming, suitable for dry and sensitive skin.',
 220, '220ml', 22.00, 28600,
 'https://theisntree.com/cdn/shop/products/isntree-yam-root-vegan-milk-cleanser-220ml.jpg',
 12, true),

('Yam Root Vegan Milk Toner',
 '얌 루트 비건 밀크 토너',
 'Isntree', '이즈앤트리', 'toner',
 'A milky toner from the Yam Root line formulated with Andong Yam Root Extract and ceramides to restore the moisture barrier and comfort dry, sensitive skin. Creamy texture absorbs quickly without residue.',
 200, '200ml', 24.00, 31200,
 'https://theisntree.com/cdn/shop/products/isntree-yam-root-vegan-milk-toner-200ml.jpg',
 12, true),

('Ultra-Low Molecular Hyaluronic Acid Serum',
 '울트라 로우 몰레큘러 히알루로닉 에시드 세럼',
 'Isntree', '이즈앤트리', 'serum',
 'A science-forward hydrating serum with 14 types of Hyaluronic Acid including ultra-low molecular weight HA from Ulleung Island mineral-rich deep seawater. Glyceryl glucoside and Madecassoside deliver long-lasting plumping hydration.',
 50, '50ml', 28.00, 36400,
 'https://theisntree.com/cdn/shop/products/isntree-ultra-low-molecular-hyaluronic-acid-serum-50ml.jpg',
 12, true);


-- ============================================================================
-- Verify results
-- ============================================================================
SELECT
  brand_en,
  COUNT(*) AS product_count
FROM ss_products
WHERE brand_en IN ('Heimish', 'The Face Shop', 'Goodal', 'Medicube', 'Isntree')
GROUP BY brand_en
ORDER BY brand_en;
