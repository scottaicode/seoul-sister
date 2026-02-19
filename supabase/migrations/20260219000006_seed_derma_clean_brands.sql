-- ============================================================================
-- Seoul Sister Product Database — Korean Derma + Clean/Minimal Brands
-- ~84 new products across 12 brands
-- Run in Supabase SQL Editor after 20260219000005
-- ============================================================================

INSERT INTO ss_products (
  name_en, name_ko, brand_en, brand_ko, category, subcategory,
  description_en, volume_ml, volume_display,
  price_krw, price_usd, rating_avg, review_count,
  is_verified, pao_months, shelf_life_months
) VALUES

-- ============================================================================
-- AESTURA (7 products) — Korean dermatologist-developed brand
-- ============================================================================

('Atobarrier 365 Cream', '아토베리어 365 크림',
 'Aestura', '에스트라', 'moisturizer', 'barrier cream',
 'A dermatologist-developed barrier cream with Ceramide-9S complex that strengthens the skin barrier and provides 365-day moisture protection. Fragrance-free and hypoallergenic for sensitive and dry skin.',
 80, '80ml', 25000, 19.00, 4.7, 8200, true, 12, 36),

('Atobarrier 365 Lotion', '아토베리어 365 로션',
 'Aestura', '에스트라', 'moisturizer', 'lotion',
 'A lightweight daily lotion from the Atobarrier 365 line with Ceramide-9S complex that hydrates deeply while reinforcing the moisture barrier. Quick-absorbing texture suitable for all skin types including sensitive.',
 150, '150ml', 22000, 17.00, 4.6, 5100, true, 12, 36),

('Atobarrier 365 Hydro Essence', '아토베리어 365 하이드로 에센스',
 'Aestura', '에스트라', 'essence', NULL,
 'A hydrating essence with patented Ceramide-9S and 8-layer hyaluronic acid that delivers deep moisture to barrier-compromised skin. Lightweight, fragrance-free formula absorbs instantly.',
 150, '150ml', 24000, 18.50, 4.6, 3400, true, 12, 36),

('Theracne 365 Clear pH Balancing Gel Cleanser', '테라크네 365 클리어 pH 밸런싱 젤 클렌저',
 'Aestura', '에스트라', 'cleanser', 'gel cleanser',
 'A pH-balanced gel cleanser formulated for acne-prone skin with salicylic acid and LHA to clear pores without over-stripping. Maintains skin moisture barrier while controlling excess sebum.',
 200, '200ml', 18000, 14.00, 4.5, 4200, true, 12, 36),

('A-Cica 365 Calming Cream', '에이시카 365 카밍 크림',
 'Aestura', '에스트라', 'moisturizer', 'cica cream',
 'A calming cream with Centella Asiatica 4X and madecassoside that soothes irritated, redness-prone skin. Clinical trials show 48-hour calming effect. Dermatologist-tested, fragrance-free.',
 50, '50ml', 26000, 20.00, 4.7, 6100, true, 12, 36),

('Regederm 365 Repair Cream', '리제덤 365 리페어 크림',
 'Aestura', '에스트라', 'moisturizer', 'repair cream',
 'An intensive repair cream with PDRN (Polydeoxyribonucleotide) and Ceramide-9S complex that accelerates skin recovery, reduces fine lines, and strengthens the damaged barrier. For dry, mature, post-procedure skin.',
 50, '50ml', 32000, 25.00, 4.6, 2800, true, 12, 36),

('Theracne 365 Spot Treatment', '테라크네 365 스팟 트리트먼트',
 'Aestura', '에스트라', 'spot_treatment', NULL,
 'A targeted acne spot treatment with salicylic acid and zinc that quickly reduces blemish size and redness overnight. Dries clear without visible residue.',
 15, '15ml', 15000, 12.00, 4.4, 3100, true, 6, 24),

-- ============================================================================
-- DR.G (7 products) — Gowoonsesang Dermatology clinic brand
-- ============================================================================

('Red Blemish Clear Soothing Cream', '레드 블레미쉬 클리어 수딩 크림',
 'Dr.G', '닥터지', 'moisturizer', 'cica cream',
 'A cult-favorite soothing cream with Centella Asiatica and Madecassoside that calms redness, repairs the skin barrier, and provides intense hydration. Clinically tested on sensitive and rosacea-prone skin.',
 70, '70ml', 29000, 22.00, 4.8, 12500, true, 12, 36),

('Red Blemish Clear Moisturizing Cream', '레드 블레미쉬 클리어 모이스처라이징 크림',
 'Dr.G', '닥터지', 'moisturizer', NULL,
 'The richer version of the Red Blemish line with added ceramides and shea butter for deep nourishment. Soothes and strengthens the barrier while providing long-lasting moisture for dry and sensitive skin.',
 50, '50ml', 27000, 21.00, 4.7, 7800, true, 12, 36),

('Red Blemish Cica S.O.S Recovery Cream', '레드 블레미쉬 시카 SOS 리커버리 크림',
 'Dr.G', '닥터지', 'moisturizer', 'recovery cream',
 'An emergency recovery cream for extremely irritated, post-laser, and post-peel skin with 4X Centella complex, panthenol, and allantoin. Provides instant cooling and fast barrier recovery.',
 50, '50ml', 32000, 25.00, 4.7, 4500, true, 12, 36),

('Brightening Peeling Gel', '브라이트닝 필링 젤',
 'Dr.G', '닥터지', 'exfoliator', 'peeling gel',
 'A gentle cellulose-based peeling gel with papaya enzyme and vitamin C that rolls away dead skin cells, smooths texture, and brightens dull complexion without microbeads or harsh physical scrubbing.',
 120, '120ml', 18000, 14.00, 4.5, 8900, true, 12, 36),

('Green Mild Up Sun+ SPF50+ PA++++', '그린 마일드 업 선+ SPF50+ PA++++',
 'Dr.G', '닥터지', 'sunscreen', NULL,
 'A gentle mineral-chemical hybrid sunscreen with Centella extract that provides SPF50+ PA++++ protection without white cast. Tone-up effect brightens skin. Suitable for sensitive, acne-prone, and post-procedure skin.',
 50, '50ml', 22000, 17.00, 4.6, 9200, true, 6, 24),

('Dermoist Barrier.D Intense Cream', '더모이스트 베리어.D 인텐스 크림',
 'Dr.G', '닥터지', 'moisturizer', 'barrier cream',
 'An ultra-rich barrier cream with Vitamin D and ceramides that intensely nourishes and protects extremely dry, cracked, and eczema-prone skin. Dermatologist-formulated for winter-proof moisture.',
 50, '50ml', 28000, 22.00, 4.5, 3200, true, 12, 36),

('R.E.D Blemish Clear Soothing Toner', '레드 블레미쉬 클리어 수딩 토너',
 'Dr.G', '닥터지', 'toner', NULL,
 'A soothing toner from the Red Blemish line with Centella and panthenol that preps sensitive, redness-prone skin for treatment steps. Hydrates and calms while balancing pH.',
 200, '200ml', 23000, 18.00, 4.6, 5600, true, 12, 36),

-- ============================================================================
-- CNP LABORATORY (7 products) — Cha & Park Dermatology clinic brand
-- ============================================================================

('Propolis Energy Ampule', '프로폴리스 에너지 앰플',
 'CNP Laboratory', 'CNP 차앤박', 'ampoule', NULL,
 'A bestselling propolis ampoule with 10% propolis extract and 3% honey extract that deeply nourishes, soothes, and gives skin a healthy glow. Lightweight serum-like texture absorbs quickly for layering.',
 35, '35ml', 32000, 25.00, 4.7, 11200, true, 6, 24),

('Invisible Peeling Booster', '인비져블 필링 부스터',
 'CNP Laboratory', 'CNP 차앤박', 'exfoliator', 'chemical exfoliant',
 'A gentle daily chemical exfoliant with PHA (gluconolactone) and natural AHA that dissolves dead skin cells without irritation. Skin feels smooth, pores refined, and subsequent products absorb better.',
 100, '100ml', 28000, 22.00, 4.6, 8900, true, 12, 36),

('Propolis Energy Serum', '프로폴리스 에너지 세럼',
 'CNP Laboratory', 'CNP 차앤박', 'serum', NULL,
 'A glow-boosting serum with concentrated propolis and Royal Jelly extract that nourishes dull, tired skin and restores healthy radiance. Pairs perfectly with the Propolis Energy Ampule for enhanced glow.',
 30, '30ml', 29000, 22.00, 4.6, 5600, true, 6, 24),

('Mugener Ampule', '뮤제너 앰플',
 'CNP Laboratory', 'CNP 차앤박', 'ampoule', NULL,
 'An anti-aging ampule from the Rx Mugener line with growth factors and peptide complex that firms sagging skin, reduces fine lines, and restores youthful elasticity. Clinically tested by dermatologists.',
 30, '30ml', 45000, 35.00, 4.5, 3200, true, 6, 24),

('Dual-Balance Waterlock Lotion', '듀얼 밸런스 워터락 로션',
 'CNP Laboratory', 'CNP 차앤박', 'moisturizer', 'lotion',
 'A featherweight hydrating lotion with Hyaluron Waterlock technology that keeps skin moisturized for 72 hours without heaviness. Ideal for oily-combination skin that needs hydration without greasiness.',
 100, '100ml', 26000, 20.00, 4.5, 4100, true, 12, 36),

('Aqua Soothing Sun Cream SPF50+ PA++++', '아쿠아 수딩 선크림 SPF50+ PA++++',
 'CNP Laboratory', 'CNP 차앤박', 'sunscreen', NULL,
 'A dermatologist-developed daily sunscreen with centella and aloe vera that provides SPF50+ PA++++ protection while soothing sensitive skin. Lightweight, no white cast, suitable under makeup.',
 50, '50ml', 23000, 18.00, 4.6, 6700, true, 6, 24),

('Anti-Pore Black Head Clear Kit', '안티포어 블랙헤드 클리어 키트',
 'CNP Laboratory', 'CNP 차앤박', 'exfoliator', 'pore care',
 'A three-step blackhead removal kit with BHA, charcoal, and cica that softens, extracts, and tightens pores. Clinically tested for visible pore improvement without skin irritation.',
 NULL, '3-step kit', 15000, 12.00, 4.4, 5800, true, 6, 24),

-- ============================================================================
-- VT COSMETICS (7 products) — K-pop collaboration brand
-- ============================================================================

('Cica Cream', '시카 크림',
 'VT Cosmetics', '브이티 코스메틱', 'moisturizer', 'cica cream',
 'A bestselling cica cream with CICA Complex (Centella Asiatica 4X) and hyaluronic acid that calms irritation, strengthens the skin barrier, and provides 72-hour hydration. Light gel-cream texture.',
 50, '50ml', 22000, 17.00, 4.6, 9800, true, 12, 36),

('Cica Mild Toner', '시카 마일드 토너',
 'VT Cosmetics', '브이티 코스메틱', 'toner', NULL,
 'A gentle toner with Centella Asiatica extract and panthenol that soothes and hydrates sensitive skin as the first step. Alcohol-free, pH-balanced formula preps skin for treatment products.',
 200, '200ml', 18000, 14.00, 4.5, 5200, true, 12, 36),

('Progloss Collagen Cream', '프로글로스 콜라겐 크림',
 'VT Cosmetics', '브이티 코스메틱', 'moisturizer', 'anti-aging',
 'An anti-aging cream with marine collagen, adenosine, and niacinamide that firms, brightens, and deeply moisturizes. Designed for mature skin showing early signs of aging and loss of elasticity.',
 50, '50ml', 35000, 27.00, 4.5, 3400, true, 12, 36),

('Super Hyalon Essence', '슈퍼 히알론 에센스',
 'VT Cosmetics', '브이티 코스메틱', 'essence', NULL,
 'A hydration-boosting essence with 10 types of hyaluronic acid at different molecular weights that penetrate every layer of skin for plump, glass-like hydration. Watery, lightweight texture.',
 50, '50ml', 25000, 19.00, 4.6, 4800, true, 12, 36),

('Cica Sun Spray SPF50+ PA++++', '시카 선 스프레이 SPF50+ PA++++',
 'VT Cosmetics', '브이티 코스메틱', 'sunscreen', NULL,
 'A convenient mist-type sunscreen spray with Centella extract that provides SPF50+ PA++++ protection. Lightweight, non-sticky formula can be reapplied over makeup without disturbing it.',
 150, '150ml', 19000, 15.00, 4.4, 6200, true, 6, 24),

('Reedle Shot 300', '리들샷 300',
 'VT Cosmetics', '브이티 코스메틱', 'serum', 'micro-infusion',
 'A micro-infusion serum with 300 Spongilla Spicules per mL that physically exfoliates at the micro level to enhance absorption of active ingredients and stimulate skin renewal. Viral on TikTok.',
 50, '50ml', 38000, 29.00, 4.5, 7200, true, 6, 24),

('Reedle Shot 700', '리들샷 700',
 'VT Cosmetics', '브이티 코스메틱', 'serum', 'micro-infusion',
 'The stronger version of the Reedle Shot with 700 Spongilla Spicules per mL for more intensive micro-exfoliation and active ingredient delivery. For experienced users seeking enhanced skin renewal.',
 50, '50ml', 48000, 37.00, 4.4, 4100, true, 6, 24),

-- ============================================================================
-- REAL BARRIER (7 products) — Atopalm sub-brand for barrier care
-- ============================================================================

('Extreme Cream', '익스트림 크림',
 'Real Barrier', '리얼베리어', 'moisturizer', 'barrier cream',
 'An award-winning barrier cream with patented MLE (Multi-Lamellar Emulsion) technology that mimics the skin lipid structure. Provides 72-hour hydration and clinically proven barrier strengthening for dry and sensitive skin.',
 50, '50ml', 28000, 22.00, 4.8, 11500, true, 12, 36),

('Cicarelief Cream', '시카릴리프 크림',
 'Real Barrier', '리얼베리어', 'moisturizer', 'cica cream',
 'A cica barrier cream combining Centella Asiatica with MLE technology that calms irritation, repairs the damaged barrier, and provides lasting hydration. For redness-prone and post-procedure recovery skin.',
 50, '50ml', 26000, 20.00, 4.7, 6200, true, 12, 36),

('Extreme Essence Toner', '익스트림 에센스 토너',
 'Real Barrier', '리얼베리어', 'toner', NULL,
 'A rich essence-type toner with MLE barrier complex, ceramides, and panthenol that delivers deep hydration in the first step. Ideal for very dry skin that needs extra moisture before serum.',
 190, '190ml', 22000, 17.00, 4.6, 5800, true, 12, 36),

('Aqua Soothing Gel Cream', '아쿠아 수딩 젤 크림',
 'Real Barrier', '리얼베리어', 'moisturizer', 'gel cream',
 'A lightweight gel-cream with MLE technology and madecassoside that hydrates and soothes without heaviness. Perfect for oily-combination and sensitive skin that wants barrier care without greasiness.',
 50, '50ml', 23000, 18.00, 4.6, 4200, true, 12, 36),

('Control-T Moisturizer', '컨트롤-T 모이스처라이저',
 'Real Barrier', '리얼베리어', 'moisturizer', 'oil control',
 'A sebum-control moisturizer with MLE technology and zinc PCA designed for oily and acne-prone skin. Controls oil production while maintaining barrier integrity. Matte finish without drying.',
 50, '50ml', 22000, 17.00, 4.5, 3800, true, 12, 36),

('Cream Ampoule', '크림 앰플',
 'Real Barrier', '리얼베리어', 'ampoule', NULL,
 'A creamy ampoule concentrate with MLE barrier complex and hyaluronic acid that intensively nourishes and repairs dry, damaged skin. Richer than a serum but lighter than a cream for versatile layering.',
 30, '30ml', 30000, 23.00, 4.6, 2900, true, 6, 24),

('Intense Moisture Lip Balm', '인텐스 모이스처 립밤',
 'Real Barrier', '리얼베리어', 'lip_care', NULL,
 'An intensive lip balm with MLE barrier technology, ceramides, and shea butter that heals chapped, cracked lips and provides lasting moisture protection. Fragrance-free, dermatologist-tested.',
 3, '3.2g', 8000, 6.00, 4.5, 2100, true, 12, 36),

-- ============================================================================
-- BIODERMA (6 products) — French derm brand hugely popular in Korea
-- ============================================================================

('Sensibio H2O Micellar Water', '센시비오 H2O 미셀라 워터',
 'Bioderma', '바이오더마', 'cleanser', 'micellar water',
 'The iconic micellar water with fatty acid esters matching the skin lipid composition that gently cleanses and removes makeup without rinsing. #1 selling micellar water in Korean pharmacies.',
 500, '500ml', 25000, 19.00, 4.7, 15200, true, 12, 36),

('Sensibio Defensive Rich Cream', '센시비오 디펜시브 리치 크림',
 'Bioderma', '바이오더마', 'moisturizer', NULL,
 'A rich moisturizer from the Sensibio line with Defensive patent technology that strengthens sensitive skin tolerance, soothes reactivity, and provides long-lasting comfort. Fragrance-free.',
 40, '40ml', 29000, 22.00, 4.6, 4800, true, 12, 36),

('Sebium Purifying Cleansing Foaming Gel', '세비움 퓨리파잉 클렌징 포밍 젤',
 'Bioderma', '바이오더마', 'cleanser', 'foaming cleanser',
 'A purifying gel cleanser for oily and acne-prone skin with zinc and copper sulfate that deeply cleanses pores, controls sebum production, and prevents breakouts while respecting the skin barrier.',
 200, '200ml', 19000, 15.00, 4.5, 7200, true, 12, 36),

('Photoderm MAX Cream SPF50+', '포토덤 맥스 크림 SPF50+',
 'Bioderma', '바이오더마', 'sunscreen', NULL,
 'A high-protection SPF50+ sunscreen with Cellular BIOprotection technology that provides broad-spectrum UVA/UVB defense. Rich, hydrating texture for dry and normal skin. Water-resistant.',
 40, '40ml', 26000, 20.00, 4.5, 5100, true, 6, 24),

('Cicabio Cream', '시카비오 크림',
 'Bioderma', '바이오더마', 'moisturizer', 'repair cream',
 'A skin-repair cream with hyaluronic acid, copper, and zinc that accelerates recovery of superficial skin damage, irritation, and post-procedure skin. Soothes and restores the barrier.',
 40, '40ml', 18000, 14.00, 4.6, 3800, true, 12, 36),

('Atoderm Intensive Baume', '아토덤 인텐시브 밤',
 'Bioderma', '바이오더마', 'moisturizer', 'body cream',
 'An ultra-nourishing emollient balm for very dry and atopic skin with patented Skin Barrier Therapy technology. Provides immediate soothing and 24-hour anti-itch relief. Face and body use.',
 200, '200ml', 27000, 21.00, 4.7, 6400, true, 12, 36),

-- ============================================================================
-- ROVECTIN (7 products) — Clean derma brand
-- ============================================================================

('Clean Lotus Water Calming Toner', '클린 로터스 워터 카밍 토너',
 'Rovectin', '로벡틴', 'toner', NULL,
 'A calming toner with Lotus water, Centella Asiatica, and Green Tea that soothes sensitive skin, minimizes redness, and provides lightweight hydration. pH 5.5, fragrance-free, vegan.',
 260, '260ml', 22000, 17.00, 4.6, 4200, true, 12, 36),

('Skin Essentials Activating Treatment Lotion', '스킨 에센셜 액티베이팅 트리트먼트 로션',
 'Rovectin', '로벡틴', 'toner', 'treatment toner',
 'A multi-purpose treatment toner with niacinamide, panthenol, and 7 botanical extracts that brightens, hydrates, and preps skin for better absorption of subsequent products. Award-winning K-beauty staple.',
 180, '180ml', 25000, 19.00, 4.7, 6800, true, 12, 36),

('Clean Lotus Water Calming Cream', '클린 로터스 워터 카밍 크림',
 'Rovectin', '로벡틴', 'moisturizer', NULL,
 'A gentle moisturizer with Sacred Lotus extract and Centella Asiatica that deeply calms and hydrates sensitive, irritated skin. Clean formula free from 50+ irritants including fragrance, parabens, and sulfates.',
 60, '60ml', 26000, 20.00, 4.6, 3500, true, 12, 36),

('Skin Essentials Barrier Repair Face Oil', '스킨 에센셜 배리어 리페어 페이스 오일',
 'Rovectin', '로벡틴', 'oil', 'face oil',
 'A clean face oil blending squalane, argan, jojoba, and rosehip oils that repairs the skin barrier, locks in moisture, and adds a healthy glow. Non-comedogenic, absorbs without greasiness.',
 30, '30ml', 28000, 22.00, 4.5, 2800, true, 12, 36),

('Skin Essentials Aqua Soothing Sun Cream SPF50+ PA++++', '스킨 에센셜 아쿠아 수딩 선크림',
 'Rovectin', '로벡틴', 'sunscreen', NULL,
 'A clean-formula daily sunscreen with SPF50+ PA++++ protection. Centella and hyaluronic acid soothe and hydrate while chemical filters provide invisible broad-spectrum UV defense. No white cast.',
 50, '50ml', 22000, 17.00, 4.6, 5100, true, 6, 24),

('LHA Blemish Ampule', 'LHA 블레미쉬 앰플',
 'Rovectin', '로벡틴', 'ampoule', 'acne treatment',
 'A targeted blemish treatment ampoule with LHA (Capryloyl Salicylic Acid), niacinamide, and tea tree that exfoliates inside pores, reduces inflammation, and prevents future breakouts without drying.',
 30, '30ml', 24000, 18.50, 4.5, 3200, true, 6, 24),

('Skin Essentials Conditioning Cleanser', '스킨 에센셜 컨디셔닝 클렌저',
 'Rovectin', '로벡틴', 'cleanser', NULL,
 'A pH-balanced conditioning cleanser with amino acid surfactants that gently removes impurities and makeup without stripping moisture. Suitable for all skin types including dry and sensitive.',
 175, '175ml', 20000, 15.50, 4.6, 3800, true, 12, 36),

-- ============================================================================
-- IUNIK (7 products) — Minimalist clean brand
-- ============================================================================

('Beta-Glucan Power Moisture Serum', '베타글루칸 파워 모이스처 세럼',
 'IUNIK', '아이유닉', 'serum', NULL,
 'A deeply hydrating serum with 98% Beta-Glucan extracted from mushrooms that provides intense moisture, strengthens the skin barrier, and soothes sensitive skin. Clean, minimalist formula with only 9 ingredients.',
 50, '50ml', 19000, 15.00, 4.7, 7200, true, 6, 24),

('Centella Calming Gel Cream', '센텔라 카밍 젤 크림',
 'IUNIK', '아이유닉', 'moisturizer', 'gel cream',
 'A lightweight gel cream with 70% Centella extract and tea tree that calms acne-prone, oily skin while providing balanced hydration. Non-comedogenic and fast-absorbing for summer and humid climates.',
 60, '60ml', 20000, 15.50, 4.6, 5800, true, 12, 36),

('Tea Tree Relief Serum', '티트리 릴리프 세럼',
 'IUNIK', '아이유닉', 'serum', NULL,
 'A blemish-fighting serum with 67% Tea Tree extract and Centella Asiatica that targets active breakouts, reduces inflammation, and prevents new acne. Clean formula with 6 simple ingredients.',
 50, '50ml', 18000, 14.00, 4.5, 6100, true, 6, 24),

('Propolis Vitamin Synergy Serum', '프로폴리스 비타민 시너지 세럼',
 'IUNIK', '아이유닉', 'serum', NULL,
 'A dual-action serum with 70% Propolis extract and Hippophae Rhamnoides (Sea Buckthorn) that brightens, nourishes, and gives skin a healthy glow. Honey-like texture absorbs quickly.',
 50, '50ml', 19000, 15.00, 4.6, 5400, true, 6, 24),

('Black Snail Restore Serum', '블랙 스네일 리스토어 세럼',
 'IUNIK', '아이유닉', 'serum', NULL,
 'An anti-aging serum with 58% Black Snail Mucin and 3% Centella extract that repairs, moisturizes, and improves skin elasticity. Targets fine lines, dullness, and uneven texture.',
 50, '50ml', 19000, 15.00, 4.5, 4200, true, 6, 24),

('Calendula Complete Cleansing Oil', '카렌듈라 컴플리트 클렌징 오일',
 'IUNIK', '아이유닉', 'cleanser', 'cleansing oil',
 'A gentle cleansing oil with real Calendula petals that dissolves makeup, sunscreen, and sebum without leaving residue. Lightweight formula emulsifies cleanly and leaves skin soft.',
 200, '200ml', 20000, 15.50, 4.6, 3900, true, 12, 36),

('Noni Light Oil Serum', '노니 라이트 오일 세럼',
 'IUNIK', '아이유닉', 'serum', 'oil serum',
 'A hybrid oil-serum with Noni fruit and Meadowfoam Seed Oil that delivers antioxidant nourishment and balanced hydration. Lightweight formula absorbs without oiliness for combination skin.',
 50, '50ml', 17000, 13.00, 4.5, 2800, true, 12, 36),

-- ============================================================================
-- AXIS-Y (7 products) — Clean K-beauty brand
-- ============================================================================

('Dark Spot Correcting Glow Serum', '다크 스팟 코렉팅 글로우 세럼',
 'AXIS-Y', '축스와이', 'serum', 'brightening',
 'A bestselling brightening serum with 5% Niacinamide, rice bran, and licorice root that fades dark spots, evens skin tone, and delivers a natural glow. Clean formula, suitable for all skin types.',
 50, '50ml', 22000, 17.00, 4.7, 8900, true, 6, 24),

('Mugwort Pore Clarifying Wash Off Pack', '쑥 포어 클래리파잉 워시오프 팩',
 'AXIS-Y', '축스와이', 'mask', 'wash-off mask',
 'A purifying wash-off mask with Korean Mugwort (Artemisia) that deeply cleanses pores, controls excess sebum, and calms inflamed acne-prone skin. Natural green color from real mugwort extract.',
 100, '100ml', 18000, 14.00, 4.6, 5200, true, 6, 24),

('Artichoke Intensive Skin Barrier Ampoule', '아티초크 인텐시브 스킨 배리어 앰플',
 'AXIS-Y', '축스와이', 'ampoule', 'barrier care',
 'A barrier-strengthening ampoule with artichoke extract, ceramide, and squalane that repairs compromised skin barriers, reduces sensitivity, and provides long-lasting hydration for stressed skin.',
 30, '30ml', 22000, 17.00, 4.6, 3800, true, 6, 24),

('New Skin Resolution Gel Mask', '뉴 스킨 레졸루션 젤 마스크',
 'AXIS-Y', '축스와이', 'mask', 'overnight mask',
 'A resurfacing overnight gel mask with AHA, BHA, and PHA that gently exfoliates while you sleep, revealing smoother, brighter skin by morning. Non-irritating formula for sensitive skin tolerance.',
 80, '80ml', 20000, 15.50, 4.5, 4100, true, 6, 24),

('Complete No-Stress Physical Sunscreen SPF50+ PA++++', '컴플리트 노스트레스 피지컬 선스크린',
 'AXIS-Y', '축스와이', 'sunscreen', NULL,
 'A 100% mineral (physical) sunscreen with zinc oxide that provides SPF50+ PA++++ protection. Clean formula with Centella and Green Tea. Minimal white cast with a natural finish.',
 50, '50ml', 22000, 17.00, 4.5, 6200, true, 6, 24),

('Biome Resetting Moringa Cleansing Oil', '바이옴 리셋팅 모링가 클렌징 오일',
 'AXIS-Y', '축스와이', 'cleanser', 'cleansing oil',
 'A microbiome-friendly cleansing oil with Moringa seed oil and probiotics that dissolves makeup and impurities while supporting healthy skin flora. Rinses clean without film or residue.',
 200, '200ml', 20000, 15.50, 4.6, 3200, true, 12, 36),

('Sunday Morning Refreshing Cleansing Foam', '선데이 모닝 리프레싱 클렌징 폼',
 'AXIS-Y', '축스와이', 'cleanser', 'foaming cleanser',
 'A gentle morning cleansing foam with Birch Sap and Green Tea that refreshes skin without over-cleansing. Low pH (5.5) formula maintains the acid mantle and preps skin for morning routine.',
 120, '120ml', 14000, 11.00, 4.5, 3600, true, 12, 36),

-- ============================================================================
-- BEPLAIN (7 products) — Clean simple beauty
-- ============================================================================

('Cicaful Calming Ampoule', '시카풀 카밍 앰플',
 'Beplain', '비플레인', 'ampoule', 'cica',
 'A calming ampoule with 91% Centella Asiatica extract that provides instant relief for irritated, redness-prone skin. Ultra-minimal formula free from fragrance, essential oils, and common irritants.',
 30, '30ml', 22000, 17.00, 4.7, 6800, true, 6, 24),

('Greenful pH-Balanced Cleansing Foam', '그린풀 pH-밸런싱 클렌징 폼',
 'Beplain', '비플레인', 'cleanser', 'foaming cleanser',
 'A pH 5.5 foaming cleanser with Green Tea and natural surfactants that gently removes impurities while maintaining the moisture barrier. Creamy foam rinses clean without tightness.',
 160, '160ml', 16000, 12.50, 4.6, 4200, true, 12, 36),

('Chamomile pH-Balanced Lotion', '캐모마일 pH-밸런싱 로션',
 'Beplain', '비플레인', 'moisturizer', 'lotion',
 'A lightweight lotion with Chamomile extract and panthenol that hydrates and soothes while maintaining skin pH balance. Clean formula with only essential ingredients for sensitive skin.',
 120, '120ml', 22000, 17.00, 4.6, 3200, true, 12, 36),

('Mung Bean Pore Clay Mask', '녹두 포어 클레이 마스크',
 'Beplain', '비플레인', 'mask', 'clay mask',
 'A deep-cleansing clay mask with Korean Mung Bean extract and kaolin clay that draws out impurities, tightens pores, and controls excess oil without over-drying. Smooth, creamy texture.',
 120, '120ml', 20000, 15.50, 4.5, 3800, true, 6, 24),

('Cicaful Calming Toner', '시카풀 카밍 토너',
 'Beplain', '비플레인', 'toner', NULL,
 'A watery calming toner with Centella Asiatica that preps irritated, sensitive skin for treatment steps. Delivers lightweight hydration and immediately soothes redness.',
 200, '200ml', 20000, 15.50, 4.6, 4100, true, 12, 36),

('Multi Vitamin Serum', '멀티 비타민 세럼',
 'Beplain', '비플레인', 'serum', 'brightening',
 'A brightening serum with Vitamins C, E, and B3 (niacinamide) plus Sea Buckthorn extract that targets dark spots, dullness, and uneven texture. Lightweight essence texture absorbs instantly.',
 30, '30ml', 24000, 18.50, 4.5, 2800, true, 6, 24),

('Cicaful Calming Cream', '시카풀 카밍 크림',
 'Beplain', '비플레인', 'moisturizer', 'cica cream',
 'A gentle cica cream with Centella Asiatica and panthenol that deeply calms, repairs, and moisturizes sensitive and barrier-damaged skin. Fragrance-free, essential-oil-free clean formula.',
 50, '50ml', 24000, 18.50, 4.7, 5400, true, 12, 36),

-- ============================================================================
-- ABIB (7 products) — pH-focused clean brand
-- ============================================================================

('Heartleaf Calming Toner Pad', '어성초 카밍 토너 패드',
 'Abib', '아비브', 'exfoliator', 'toner pad',
 'A calming toner pad with 63% Heartleaf (Houttuynia Cordata) extract that soothes redness, hydrates, and gently exfoliates. 80 dual-textured pads for daily morning/evening calming care.',
 NULL, '80 pads', 20000, 15.50, 4.7, 9800, true, 6, 24),

('Heartleaf Calming Essence Toner', '어성초 카밍 에센스 토너',
 'Abib', '아비브', 'toner', 'essence toner',
 'A calming essence toner with 78% Heartleaf extract and panthenol that soothes and deeply hydrates irritated, redness-prone skin. Slightly viscous texture delivers more hydration than a regular toner.',
 200, '200ml', 22000, 17.00, 4.7, 7200, true, 12, 36),

('Quick Sunstick Protection Bar SPF50+ PA++++', '퀵 선스틱 프로텍션 바 SPF50+ PA++++',
 'Abib', '아비브', 'sunscreen', 'sun stick',
 'A portable sun stick with SPF50+ PA++++ protection in a twist-up balm format. Clean formula with Heartleaf extract. Easy reapplication over makeup without disturbing base.',
 22, '22g', 19000, 15.00, 4.6, 6800, true, 6, 24),

('Mild Acidic pH Sheet Mask Heartleaf Fit', '약산성 pH 시트마스크 어성초핏',
 'Abib', '아비브', 'mask', 'sheet mask',
 'A pH-balanced sheet mask infused with concentrated Heartleaf essence that calms and hydrates in 15 minutes. Ultra-thin microfiber sheet adheres perfectly for maximum absorption.',
 NULL, '1 sheet', 3500, 3.00, 4.6, 5200, true, 6, 24),

('Acne Foam Cleanser Heartleaf', '아크네 폼 클렌저 어성초',
 'Abib', '아비브', 'cleanser', 'foaming cleanser',
 'A gentle acne-fighting foam cleanser with Heartleaf extract, BHA, and tea tree that cleanses pores and prevents breakouts while calming inflamed skin. pH 5.5, non-drying formula.',
 250, '250ml', 20000, 15.50, 4.5, 4800, true, 12, 36),

('Rice Probiotics Overnight Mask', '라이스 프로바이오틱스 오버나이트 마스크',
 'Abib', '아비브', 'mask', 'sleeping mask',
 'An overnight sleeping mask with fermented rice extract and probiotics that brightens, hydrates, and restores skin balance while you sleep. Wake up to plump, glowing skin.',
 80, '80ml', 22000, 17.00, 4.6, 3400, true, 6, 24),

('Jericho Rose Collagen Pad', '여리고 로즈 콜라겐 패드',
 'Abib', '아비브', 'essence', 'essence pad',
 'An anti-aging essence pad soaked in Rose of Jericho extract and collagen that hydrates, firms, and improves skin elasticity. 60 pads with gentle, non-sticky formula for daily use.',
 NULL, '60 pads', 22000, 17.00, 4.5, 3200, true, 6, 24),

-- ============================================================================
-- MIXSOON (7 products) — Minimalist single-ingredient brand
-- ============================================================================

('Bean Essence', '빈 에센스',
 'MIXSOON', '믹순', 'essence', NULL,
 'A fermented soybean essence with 90% naturally fermented soybean extract that deeply hydrates, firms, and brightens skin. Minimalist formula with transparent, water-like texture.',
 100, '100ml', 25000, 19.00, 4.7, 6800, true, 12, 36),

('Soondy Centella Asiatica Essence', '순디 센텔라 아시아티카 에센스',
 'MIXSOON', '믹순', 'essence', 'cica',
 'A single-ingredient essence with 99% pure Centella Asiatica extract that soothes, calms, and strengthens sensitive, redness-prone skin. Ultra-clean minimalist formula.',
 100, '100ml', 22000, 17.00, 4.7, 5600, true, 12, 36),

('Glacier Water Hyaluronic Acid Serum', '글레이셔 워터 히알루로닉 에시드 세럼',
 'MIXSOON', '믹순', 'serum', NULL,
 'A hydrating serum with glacier water and 3 molecular weights of hyaluronic acid that provides multi-layer moisture for plump, dewy skin. Pure, minimalist formula.',
 30, '30ml', 20000, 15.50, 4.6, 4200, true, 6, 24),

('Bifida Ferment Essence', '비피다 퍼먼트 에센스',
 'MIXSOON', '믹순', 'essence', NULL,
 'A fermented essence with 97% Bifida Ferment Lysate that strengthens the skin barrier, improves elasticity, and brightens dull skin. Korean answer to luxury fermented essences at a fraction of the price.',
 100, '100ml', 28000, 22.00, 4.6, 3800, true, 12, 36),

('Bean Cream', '빈 크림',
 'MIXSOON', '믹순', 'moisturizer', NULL,
 'A nourishing cream with fermented soybean extract and squalane that deeply moisturizes, firms, and strengthens the skin barrier. Pairs with Bean Essence for the complete soybean skincare routine.',
 50, '50ml', 27000, 21.00, 4.6, 2800, true, 12, 36),

('Master Repair Cream Panthenol', '마스터 리페어 크림 판테놀',
 'MIXSOON', '믹순', 'moisturizer', 'repair cream',
 'A repair cream with 10% Panthenol that intensively soothes, hydrates, and accelerates recovery of damaged, sensitive skin. Minimalist formula ideal for post-procedure and irritated skin.',
 80, '80ml', 24000, 18.50, 4.6, 3100, true, 12, 36),

('Galactomyces Ferment Essence', '갈락토미세스 퍼먼트 에센스',
 'MIXSOON', '믹순', 'essence', NULL,
 'A fermented essence with 97% Galactomyces Ferment Filtrate that brightens, refines texture, and controls excess sebum for a clear, radiant complexion. Clean, vegan formula.',
 100, '100ml', 22000, 17.00, 4.6, 3400, true, 12, 36);


-- ============================================================================
-- Verify counts
-- ============================================================================
SELECT brand_en, COUNT(*) AS count
FROM ss_products
WHERE brand_en IN ('Aestura','Dr.G','CNP Laboratory','VT Cosmetics','Real Barrier','Bioderma','Rovectin','IUNIK','AXIS-Y','Beplain','Abib','MIXSOON')
GROUP BY brand_en ORDER BY brand_en;
