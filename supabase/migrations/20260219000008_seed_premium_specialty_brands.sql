-- ============================================================================
-- Seoul Sister Product Database — Premium/Luxury + Specialty/Niche Brands
-- ~84 new products across 13 brands
-- Run in Supabase SQL Editor after 20260219000007
-- ============================================================================

INSERT INTO ss_products (
  name_en, name_ko, brand_en, brand_ko, category, subcategory,
  description_en, volume_ml, volume_display,
  price_krw, price_usd, rating_avg, review_count,
  is_verified, pao_months, shelf_life_months
) VALUES

-- ============================================================================
-- HERA (7 products) — AmorePacific luxury brand
-- ============================================================================

('Black Cushion SPF34 PA++', '블랙 쿠션 SPF34 PA++',
 'HERA', '헤라', 'moisturizer', 'cushion foundation',
 'A luxury cushion foundation with velvet matte finish and SPF34 PA++ protection. 24-hour wear with blur technology that minimizes pores and imperfections. Signature K-beauty luxury item.',
 15, '15g', 55000, 42.00, 4.7, 8200, true, 12, 36),

('Signia Deluxe Cream', '시그니아 디럭스 크림',
 'HERA', '헤라', 'moisturizer', 'luxury anti-aging',
 'A premium anti-aging cream with HERA exclusive SIGNIA technology and Acetyl Hexapeptide-8 that restores skin vitality, firms sagging contours, and delivers luxurious moisture. Korean luxury flagship.',
 60, '60ml', 280000, 215.00, 4.6, 2200, true, 12, 36),

('Age Away Aesthetic BX Cream', '에이지 어웨이 에스테틱 BX 크림',
 'HERA', '헤라', 'moisturizer', 'anti-aging',
 'A professional anti-aging cream with BX (Botox-like) complex that firms, lifts, and reduces fine lines and wrinkles. Clinical-grade ingredients in a luxurious texture.',
 50, '50ml', 120000, 92.00, 4.6, 3400, true, 12, 36),

('Cell Essence', '셀 에센스',
 'HERA', '헤라', 'essence', 'cell renewal',
 'A cell-renewing essence with Bio-peptide complex that activates skin cell regeneration, improves skin density, and delivers anti-aging hydration. HERA signature skincare step.',
 150, '150ml', 95000, 73.00, 4.6, 4200, true, 12, 36),

('White Program Deep Brightening Serum', '화이트 프로그램 딥 브라이트닝 세럼',
 'HERA', '헤라', 'serum', 'brightening',
 'A luxury brightening serum with concentrated vitamin C derivatives that targets deep pigmentation, melasma, and age spots. Premium formulation for visible results in 4 weeks.',
 40, '40ml', 85000, 65.00, 4.5, 2800, true, 6, 24),

('Hydro Reflecting Serum', '하이드로 리플렉팅 세럼',
 'HERA', '헤라', 'serum', NULL,
 'A hydrating serum with light-reflecting micro-particles and hyaluronic acid that creates an instant luminous glow while providing deep moisture. Dual-action beauty and skincare.',
 40, '40ml', 72000, 55.00, 4.5, 2400, true, 6, 24),

('Eye Cream Cell Essential', '아이크림 셀 에센셜',
 'HERA', '헤라', 'eye_care', NULL,
 'A premium eye cream with concentrated Cell Bio technology that targets dark circles, fine lines, and loss of firmness around the delicate eye area. Rich but fast-absorbing.',
 25, '25ml', 75000, 58.00, 4.5, 1800, true, 6, 24),

-- ============================================================================
-- AMOREPACIFIC (7 products) — Korean luxury heritage brand
-- ============================================================================

('Treatment Enzyme Peel Cleansing Powder', '트리트먼트 엔자임 필 클렌징 파우더',
 'AmorePacific', '아모레퍼시픽', 'cleanser', 'enzyme powder',
 'A luxury enzyme cleansing powder with papain and green tea that gently dissolves dead skin cells and purifies pores when activated with water. Creates a fine foam for spa-like daily cleansing.',
 50, '50g', 65000, 50.00, 4.6, 3800, true, 12, 36),

('Vintage Single Extract Essence', '빈티지 싱글 익스트랙트 에센스',
 'AmorePacific', '아모레퍼시픽', 'essence', 'first treatment',
 'A luxury fermented green tea essence aged over 50 days that deeply nourishes, brightens, and firms skin. The brand signature product — Korean equivalent of SK-II Facial Treatment Essence.',
 120, '120ml', 120000, 92.00, 4.7, 4200, true, 12, 36),

('Moisture Bound Hydration Intense Serum', '모이스처 바운드 하이드레이션 인텐스 세럼',
 'AmorePacific', '아모레퍼시픽', 'serum', NULL,
 'An intensive hydration serum with Jeju Green Tea and bamboo sap that delivers deep multi-layer moisture for dehydrated skin. Lightweight, quick-absorbing formula with a healthy glow finish.',
 30, '30ml', 85000, 65.00, 4.6, 2200, true, 6, 24),

('Dual Nourishing Lip Treatment', '듀얼 너리싱 립 트리트먼트',
 'AmorePacific', '아모레퍼시픽', 'lip_care', NULL,
 'A two-in-one lip treatment with plumping oil on one end and smoothing balm on the other. Green tea and raspberry deliver nourishment and subtle tint. Luxurious lip care staple.',
 NULL, '2g+2g', 42000, 32.00, 4.5, 2800, true, 12, 36),

('Time Response Skin Reserve Creme', '타임 리스폰스 스킨 리저브 크렘',
 'AmorePacific', '아모레퍼시픽', 'moisturizer', 'luxury anti-aging',
 'The ultra-luxury anti-aging cream with proprietary Green Tea probiotic ferment that targets all visible signs of aging — wrinkles, sagging, dark spots, and dullness. AmorePacific flagship product.',
 50, '50ml', 350000, 270.00, 4.7, 1200, true, 12, 36),

('Botanical Radiance Oil', '보태니컬 래디언스 오일',
 'AmorePacific', '아모레퍼시픽', 'oil', 'face oil',
 'A luxury face oil with Camellia seed oil and 9 botanical oils that delivers radiant nourishment, strengthens the barrier, and provides a luxurious glow. Absorbs without heaviness.',
 30, '30ml', 78000, 60.00, 4.5, 1800, true, 12, 36),

('Color Control Cushion Compact SPF50+', '컬러 컨트롤 쿠션 컴팩트 SPF50+',
 'AmorePacific', '아모레퍼시픽', 'sunscreen', 'cushion SPF',
 'A luxury cushion compact with SPF50+ PA+++ that provides sheer coverage, UV protection, and a natural dewy finish. Bamboo sap and green tea hydrate throughout the day.',
 15, '15g', 65000, 50.00, 4.5, 3200, true, 6, 24),

-- ============================================================================
-- THE HISTORY OF WHOO (7 products) — Royal palace luxury brand
-- ============================================================================

('Bichup Self-Generating Anti-Aging Essence', '비첩 자생 에센스',
 'The History of Whoo', '더 히스토리 오브 후', 'essence', 'luxury anti-aging',
 'The brand signature self-generating anti-aging essence with wild ginseng and royal jang complex that activates skin self-renewal ability. #1 luxury essence in Korea by sales volume.',
 90, '90ml', 180000, 138.00, 4.8, 6800, true, 12, 36),

('Cheongidan Radiant Regenerating Cream', '천기단 화현 크림',
 'The History of Whoo', '더 히스토리 오브 후', 'moisturizer', 'luxury anti-aging',
 'An ultra-luxury regenerating cream with 30+ Korean medicinal herbs including wild ginseng, deer antler, and royal court formulas that restores youthful radiance and vitality to aging skin.',
 60, '60ml', 420000, 325.00, 4.7, 2200, true, 12, 36),

('Gongjinhyang Soo Yeon Balancer', '공진향 수연 밸런서',
 'The History of Whoo', '더 히스토리 오브 후', 'toner', NULL,
 'A luxurious balancer (toner) from the Gongjinhyang line with royal court herbal complex that hydrates, balances, and preps skin for subsequent treatment steps. Rich, fast-absorbing texture.',
 150, '150ml', 78000, 60.00, 4.6, 3200, true, 12, 36),

('Gongjinhyang Mi Luxury BB SPF20 PA++', '공진향 미 럭셔리 BB SPF20 PA++',
 'The History of Whoo', '더 히스토리 오브 후', 'sunscreen', 'BB cream',
 'A luxury BB cream with SPF20 PA++ and royal herbal complex that provides buildable coverage with skincare benefits. Natural finish with wrinkle improvement and brightening.',
 45, '45ml', 68000, 52.00, 4.5, 2800, true, 12, 36),

('Secret Court Cream', '비밀의 궁중 크림',
 'The History of Whoo', '더 히스토리 오브 후', 'moisturizer', 'night cream',
 'A luxury night cream with secret royal court formulas passed down through Korean palace traditions. Wild ginseng and silk amino acids restore skin overnight for morning radiance.',
 60, '60ml', 220000, 170.00, 4.6, 1800, true, 12, 36),

('Bichup Moisture Anti-Aging Mask', '비첩 모이스처 안티에이징 마스크',
 'The History of Whoo', '더 히스토리 오브 후', 'mask', 'sheet mask',
 'A luxury sheet mask soaked in concentrated Bichup essence with wild ginseng that delivers intensive anti-aging, hydrating, and firming benefits in one application. 5-piece set.',
 NULL, '5 sheets', 95000, 73.00, 4.6, 2200, true, 6, 24),

('Hwanyu Imperial Youth Cream', '환유 크림',
 'The History of Whoo', '더 히스토리 오브 후', 'moisturizer', 'luxury anti-aging',
 'The most premium cream from Whoo with 100-year-old wild ginseng extract and 12 rare herbs. Targets deep wrinkles, extreme dullness, and loss of firmness. The pinnacle of Korean luxury skincare.',
 60, '60ml', 600000, 462.00, 4.8, 800, true, 12, 36),

-- ============================================================================
-- SU:M37° (6 products) — LG natural fermentation brand
-- ============================================================================

('Secret Essence', '시크릿 에센스',
 'su:m37°', '숨37°', 'essence', 'fermented essence',
 'A naturally fermented essence created through 365 days of fermentation using 80+ plant ingredients. Brightens, smooths, and hydrates while strengthening the skin barrier. Korean fermentation at its finest.',
 80, '80ml', 68000, 52.00, 4.7, 5800, true, 12, 36),

('Water-Full Timeless Water Gel Cream', '워터풀 타임리스 워터 젤 크림',
 'su:m37°', '숨37°', 'moisturizer', 'gel cream',
 'A lightweight water gel cream from the Water-Full line that provides refreshing burst hydration and maintains moisture all day. Perfect for oily, combination, and dehydrated skin in humid climates.',
 50, '50ml', 45000, 35.00, 4.6, 4200, true, 12, 36),

('Losec Summa Elixir Serum', '로섹 숨마 엘릭서 세럼',
 'su:m37°', '숨37°', 'serum', 'luxury anti-aging',
 'An ultra-premium anti-aging serum with triple-fermented lotus complex and golden serum particles that intensely firms, plumps, and rejuvenates mature skin. Flagship luxury treatment.',
 50, '50ml', 180000, 138.00, 4.6, 1800, true, 6, 24),

('Secret Programming Essence', '시크릿 프로그래밍 에센스',
 'su:m37°', '숨37°', 'essence', 'first treatment',
 'An upgraded version of the Secret Essence with added fermented peptide complex that reprograms skin for enhanced renewal and brightness. Richer texture with enhanced anti-aging benefits.',
 100, '100ml', 85000, 65.00, 4.6, 3200, true, 12, 36),

('Flawless Regenerating Eye Cream', '플로우리스 리제너레이팅 아이 크림',
 'su:m37°', '숨37°', 'eye_care', NULL,
 'A firming eye cream with fermented plant complex and peptides that targets crow feet, dark circles, and sagging around the eyes. Rich texture nourishes the delicate eye area.',
 20, '20ml', 65000, 50.00, 4.5, 2200, true, 6, 24),

('Bright Award Bubble-De Mask', '브라이트 어워드 버블디 마스크',
 'su:m37°', '숨37°', 'mask', 'bubble mask',
 'A fun brightening bubble mask that fizzes and foams on the skin to deliver oxygen and natural fermented white flower extracts for instant brightening. Rinse after 10 minutes for glowing skin.',
 100, '100ml', 32000, 25.00, 4.5, 4800, true, 6, 24),

-- ============================================================================
-- ILLIYOON (7 products) — AmorePacific ceramide brand
-- ============================================================================

('Ceramide Ato Concentrate Cream', '세라마이드 아토 컨센트레이트 크림',
 'Illiyoon', '일리윤', 'moisturizer', 'barrier cream',
 'A bestselling ceramide barrier cream with patented Ceramide Capsule technology that strengthens the moisture barrier and provides intense 48-hour hydration for dry and eczema-prone skin.',
 200, '200ml', 22000, 17.00, 4.8, 15200, true, 12, 36),

('Ceramide Ato Lotion', '세라마이드 아토 로션',
 'Illiyoon', '일리윤', 'moisturizer', 'body lotion',
 'A daily ceramide body lotion with the same Ceramide Capsule technology that provides all-day moisture and barrier protection. Lightweight formula suitable for face and body.',
 350, '350ml', 16000, 12.50, 4.7, 8900, true, 12, 36),

('Ceramide Ato Soothing Gel', '세라마이드 아토 수딩 젤',
 'Illiyoon', '일리윤', 'moisturizer', 'soothing gel',
 'A cooling ceramide gel for irritated, heat-rashed, and sun-exposed skin that soothes and hydrates without heaviness. Multi-use for face and body. Popular for babies and adults alike.',
 175, '175ml', 14000, 11.00, 4.7, 6200, true, 12, 36),

('Ceramide Ato Foam Cleanser', '세라마이드 아토 폼 클렌저',
 'Illiyoon', '일리윤', 'cleanser', NULL,
 'A gentle foam cleanser with Ceramide Capsule technology that cleanses without stripping the moisture barrier. pH-balanced, fragrance-free formula for sensitive and dry skin.',
 200, '200ml', 12000, 9.50, 4.6, 5800, true, 12, 36),

('Ceramide Ato Top to Toe Wash', '세라마이드 아토 탑투토 워시',
 'Illiyoon', '일리윤', 'cleanser', 'body wash',
 'A full-body cleanser with ceramides that gently cleanses hair, face, and body in one step. Perfect for sensitive skin and commonly used for babies and children. Fragrance-free.',
 500, '500ml', 15000, 12.00, 4.7, 7200, true, 12, 36),

('Probiotics Skin Barrier Essence Drop', '프로바이오틱스 스킨 배리어 에센스 드롭',
 'Illiyoon', '일리윤', 'essence', NULL,
 'An essence with probiotics, prebiotics, and ceramides that strengthens the skin microbiome and barrier. Lightweight formula for sensitive skin that needs barrier support without heaviness.',
 200, '200ml', 20000, 15.50, 4.6, 3800, true, 12, 36),

('Ceramide Ato 6.0 Top to Toe Cream', '세라마이드 아토 6.0 탑투토 크림',
 'Illiyoon', '일리윤', 'moisturizer', NULL,
 'An ultra-rich 6.0% ceramide body cream that provides maximum barrier protection for extremely dry, eczema-prone skin. Can be used on face and body. Pediatrician-recommended.',
 200, '200ml', 18000, 14.00, 4.7, 4800, true, 12, 36),

-- ============================================================================
-- SIORIS (6 products) — Organic clean brand
-- ============================================================================

('Time Is Running Out Mist', '타임 이즈 러닝 아웃 미스트',
 'Sioris', '시오리스', 'mist', NULL,
 'A refreshing facial mist with organic Green Plum water that hydrates, sets makeup, and revitalizes tired skin throughout the day. Harvested within 4 hours for maximum freshness. COSMOS Organic certified.',
 100, '100ml', 18000, 14.00, 4.6, 4200, true, 12, 36),

('Cleanse Me Softly Milk Cleanser', '클렌즈 미 소프틀리 밀크 클렌저',
 'Sioris', '시오리스', 'cleanser', 'milk cleanser',
 'A vegan milk cleanser with organic green plum and rice extract that gently removes impurities while maintaining the moisture barrier. Non-foaming, creamy texture for dry and sensitive skin.',
 120, '120ml', 18000, 14.00, 4.5, 3200, true, 12, 36),

('My First Essener', '마이 퍼스트 에세너',
 'Sioris', '시오리스', 'essence', 'essence-toner',
 'A dual-function essence toner with fermented rice and grape extract that hydrates, brightens, and preps skin for treatment steps. COSMOS Natural certified, vegan.',
 200, '200ml', 28000, 22.00, 4.6, 3800, true, 12, 36),

('Bring the Light Serum', '브링 더 라이트 세럼',
 'Sioris', '시오리스', 'serum', 'brightening',
 'A brightening serum with organic evening primrose and tamanu oil that fades dark spots, evens skin tone, and delivers antioxidant nourishment. COSMOS Organic certified, 100% natural origin.',
 35, '35ml', 32000, 25.00, 4.5, 2800, true, 6, 24),

('Enriched By Nature Cream', '엔리치드 바이 네이처 크림',
 'Sioris', '시오리스', 'moisturizer', NULL,
 'A nourishing cream with shea butter, meadowfoam seed oil, and centella that deeply moisturizes and repairs the skin barrier. COSMOS Natural certified, clean formula.',
 50, '50ml', 30000, 23.00, 4.5, 2200, true, 12, 36),

('Day by Day Cleansing Gel', '데이 바이 데이 클렌징 젤',
 'Sioris', '시오리스', 'cleanser', 'gel cleanser',
 'A gentle daily gel cleanser with green plum extract that removes impurities and excess oil without disrupting the skin barrier. pH 5.5, suitable for all skin types including sensitive.',
 150, '150ml', 18000, 14.00, 4.5, 2800, true, 12, 36),

-- ============================================================================
-- AROMATICA (6 products) — Sustainable vegan brand
-- ============================================================================

('Rosemary Scalp Scaling Shampoo', '로즈마리 스칼프 스케일링 샴푸',
 'Aromatica', '아로마티카', 'cleanser', 'scalp care',
 'A scalp-detoxing shampoo with rosemary extract and salicylic acid that removes buildup, controls excess oil, and promotes a healthy scalp environment. Also popular as a face wash for oily skin.',
 400, '400ml', 22000, 17.00, 4.6, 7800, true, 12, 36),

('Tea Tree Balancing Emulsion', '티트리 밸런싱 에멀전',
 'Aromatica', '아로마티카', 'moisturizer', 'emulsion',
 'A lightweight emulsion with tea tree and green tea that balances oily skin, controls sebum, and prevents breakouts while maintaining hydration. B Corp certified, 100% vegan.',
 100, '100ml', 22000, 17.00, 4.5, 3800, true, 12, 36),

('Reviving Rose Infusion Cream', '리바이빙 로즈 인퓨전 크림',
 'Aromatica', '아로마티카', 'moisturizer', NULL,
 'A nourishing cream with organic Damask Rose and Rosehip oil that revitalizes dull, dry skin with rich hydration and antioxidant protection. COSMOS Organic certified.',
 50, '50ml', 32000, 25.00, 4.5, 2800, true, 12, 36),

('Calendula Juicy Cream', '캘렌듈라 주시 크림',
 'Aromatica', '아로마티카', 'moisturizer', NULL,
 'A calming gel cream with calendula extract that soothes sensitive, irritated skin while providing juicy hydration. Non-sticky, fast-absorbing texture for daily use.',
 150, '150ml', 28000, 22.00, 4.5, 3200, true, 12, 36),

('Aloe Vera Gel 95%', '알로에 베라 젤 95%',
 'Aromatica', '아로마티카', 'moisturizer', 'soothing gel',
 'A 95% organic aloe vera soothing gel with vitamin E that cools, hydrates, and calms sun-exposed or irritated skin. Multi-purpose for face, body, and hair. COSMOS Organic certified.',
 300, '300ml', 14000, 11.00, 4.6, 5200, true, 12, 36),

('Neroli Brightening Facial Oil', '네롤리 브라이트닝 페이셜 오일',
 'Aromatica', '아로마티카', 'oil', 'face oil',
 'A brightening face oil with Neroli essential oil, rosehip, and sea buckthorn that targets dullness, dark spots, and dehydration. 100% natural origin, COSMOS Natural certified.',
 30, '30ml', 32000, 25.00, 4.5, 2200, true, 12, 36),

-- ============================================================================
-- PAPA RECIPE (6 products) — Honey-based brand
-- ============================================================================

('Bombee Honey Mask', '봄비 허니 마스크',
 'Papa Recipe', '파파레서피', 'mask', 'sheet mask',
 'A cult-favorite honey sheet mask with real Manuka honey and Royal Jelly that deeply nourishes, hydrates, and soothes dry, stressed skin. One of the best-selling K-beauty masks globally.',
 NULL, '1 sheet', 3500, 3.00, 4.6, 12200, true, 6, 24),

('Blemish Cream', '블레미쉬 크림',
 'Papa Recipe', '파파레서피', 'moisturizer', 'spot care',
 'A targeted blemish cream with calamine, tea tree, and centella that calms active breakouts, reduces redness, and promotes healing. Pink calamine formula provides visible coverage.',
 50, '50ml', 18000, 14.00, 4.5, 4800, true, 12, 36),

('Bombee Honey Pudding Cream', '봄비 허니 푸딩 크림',
 'Papa Recipe', '파파레서피', 'moisturizer', NULL,
 'A bouncy pudding-textured cream with Manuka honey and Royal Jelly that provides deep nourishment and moisture with a fun, jiggly texture. Suitable for dry and normal skin types.',
 50, '50ml', 22000, 17.00, 4.5, 3800, true, 12, 36),

('White Flower Clear Up Enzyme Powder Cleanser', '화이트 플라워 클리어 업 효소 파우더 클렌저',
 'Papa Recipe', '파파레서피', 'cleanser', 'enzyme powder',
 'A gentle enzyme powder cleanser with papain and white flower extracts that activates with water to create a fine foam. Exfoliates dead skin cells and brightens without irritation.',
 80, '80g', 18000, 14.00, 4.4, 3200, true, 12, 36),

('Eggplant Clearing Ampoule', '가지 클리어링 앰플',
 'Papa Recipe', '파파레서피', 'ampoule', NULL,
 'A blemish-clearing ampoule with eggplant extract and niacinamide that targets acne scars, dark spots, and uneven texture. Unique ingredient sourced from Korean eggplant for gentle brightening.',
 50, '50ml', 22000, 17.00, 4.4, 2800, true, 6, 24),

('Bombee Green Honey Mask Pack', '봄비 그린 허니 마스크 팩',
 'Papa Recipe', '파파레서피', 'mask', 'sheet mask',
 'A soothing variant of the iconic Bombee mask with green propolis and Centella that calms sensitive, irritated skin while deeply hydrating. Ideal for redness and acne-prone skin.',
 NULL, '1 sheet', 3500, 3.00, 4.5, 5800, true, 6, 24),

-- ============================================================================
-- KAHI (6 products) — Multi-balm brand
-- ============================================================================

('Wrinkle Bounce Multi Balm', '링클 바운스 멀티 밤',
 'KAHI', '가히', 'moisturizer', 'multi-balm',
 'The viral multi-use collagen balm with salmon PDRN, collagen, and squalane that hydrates, firms, and adds a dewy glow. Apply to face, lips, eyes, hands — everywhere. K-drama actress favorite.',
 9, '9g', 22000, 17.00, 4.6, 11200, true, 12, 36),

('Extin C Cream', '엑스틴 C 크림',
 'KAHI', '가히', 'moisturizer', 'vitamin C',
 'A vitamin C cream with stabilized ascorbic acid and PDRN that brightens dark spots, improves skin texture, and provides anti-aging collagen support. Extension of the viral multi-balm line.',
 50, '50ml', 32000, 25.00, 4.5, 3800, true, 12, 36),

('Wrinkle Bounce Collagen Mist', '링클 바운스 콜라겐 미스트',
 'KAHI', '가히', 'mist', NULL,
 'A collagen-infused facial mist with PDRN that refreshes, hydrates, and firms throughout the day. Micro-fine mist can be sprayed over makeup without disturbing it.',
 80, '80ml', 25000, 19.00, 4.5, 4200, true, 12, 36),

('Multi Balm UV Aqua SPF50+ PA++++', '멀티밤 UV 아쿠아 SPF50+ PA++++',
 'KAHI', '가히', 'sunscreen', 'sun balm',
 'A sunscreen multi-balm with SPF50+ PA++++ in the signature twist-up format. Apply on the go for UV protection with collagen and PDRN skincare benefits. Portable sun protection.',
 9, '9g', 24000, 18.50, 4.5, 3400, true, 6, 24),

('Wrinkle Bounce Moisture Skin Balm', '링클 바운스 모이스처 스킨 밤',
 'KAHI', '가히', 'moisturizer', 'skin balm',
 'A moisture-focused variant of the viral multi-balm with extra ceramides and hyaluronic acid for enhanced hydration. Targets dry patches, fine lines, and areas needing barrier repair.',
 9, '9g', 22000, 17.00, 4.5, 3200, true, 12, 36),

('Real Pearl Collagen Mist', '리얼 펄 콜라겐 미스트',
 'KAHI', '가히', 'mist', NULL,
 'A luminous facial mist with real pearl extract and collagen that delivers instant hydration with a radiant glow. Fine micro-mist particles create a dewy, pearl-like finish.',
 80, '80ml', 28000, 22.00, 4.4, 2800, true, 12, 36),

-- ============================================================================
-- BIODANCE (6 products) — Bio-cellulose mask brand
-- ============================================================================

('Bio-Collagen Real Deep Mask', '바이오 콜라겐 리얼 딥 마스크',
 'Biodance', '바이오댄스', 'mask', 'bio-cellulose mask',
 'The viral bio-cellulose mask with low molecular collagen that dissolves into the skin during 4+ hours of wear, delivering intense plumping, firming, and hydrating effects. Iconic K-beauty mask.',
 NULL, '1 sheet', 5000, 4.00, 4.8, 18200, true, 6, 24),

('Bio-Collagen Real Deep Cream', '바이오 콜라겐 리얼 딥 크림',
 'Biodance', '바이오댄스', 'moisturizer', NULL,
 'A collagen cream inspired by the viral mask with the same low molecular collagen technology that plumps, firms, and deeply hydrates. Daily cream version of the mask experience.',
 50, '50ml', 28000, 22.00, 4.6, 4800, true, 12, 36),

('Skin-Glow Essence Toner', '스킨 글로우 에센스 토너',
 'Biodance', '바이오댄스', 'toner', NULL,
 'A glow-boosting toner with fermented ingredients and niacinamide that preps skin for better mask and skincare absorption. Lightweight, hydrating formula for the first step.',
 200, '200ml', 22000, 17.00, 4.5, 3200, true, 12, 36),

('Bio-Collagen Real Deep Serum', '바이오 콜라겐 리얼 딥 세럼',
 'Biodance', '바이오댄스', 'serum', NULL,
 'A collagen serum with the same deep-penetrating collagen technology as the viral mask in a daily-use formula. Plumps, firms, and hydrates for continuous collagen treatment.',
 45, '45ml', 32000, 25.00, 4.6, 3800, true, 6, 24),

('Miracle Overnight Mask', '미라클 오버나이트 마스크',
 'Biodance', '바이오댄스', 'mask', 'sleeping mask',
 'An overnight sleeping mask with bio-collagen and peptides that works while you sleep to firm, hydrate, and regenerate skin. Wake up to bouncy, glowing skin.',
 80, '80ml', 25000, 19.00, 4.5, 2800, true, 6, 24),

('Pore Tightening Bio-Collagen Mask', '포어 타이트닝 바이오 콜라겐 마스크',
 'Biodance', '바이오댄스', 'mask', 'bio-cellulose mask',
 'A pore-focused variant of the viral mask with collagen and BHA that tightens pores, controls sebum, and delivers the signature collagen-dissolving technology for oily and combination skin.',
 NULL, '1 sheet', 5000, 4.00, 4.6, 5200, true, 6, 24),

-- ============================================================================
-- SNP (6 products) — Science-backed affordable brand
-- ============================================================================

('Prep Peptaronic Serum', '프렙 펩타로닉 세럼',
 'SNP', '에스엔피', 'serum', 'peptide',
 'A peptide serum with 8 types of peptides and hyaluronic acid that firms, plumps, and hydrates aging skin. Affordable anti-aging option with clinical-grade peptide complex.',
 30, '30ml', 18000, 14.00, 4.5, 4800, true, 6, 24),

('Prep Cicaronic Ampoule', '프렙 시카로닉 앰플',
 'SNP', '에스엔피', 'ampoule', 'cica',
 'A calming ampoule with Centella Asiatica and ceramides that soothes irritated, redness-prone skin and strengthens the moisture barrier. Affordable cica treatment for daily use.',
 30, '30ml', 16000, 12.50, 4.5, 3800, true, 6, 24),

('Bird Nest Moisture Mask', '버드네스트 모이스처 마스크',
 'SNP', '에스엔피', 'mask', 'sheet mask',
 'A nourishing sheet mask with bird nest extract (Swiftlet Nest) that deeply moisturizes, firms, and brightens tired, dehydrated skin. Traditional Korean beauty ingredient in modern format.',
 NULL, '1 sheet', 2500, 2.00, 4.4, 5600, true, 6, 24),

('Gold Collagen Ampoule Mask', '골드 콜라겐 앰플 마스크',
 'SNP', '에스엔피', 'mask', 'sheet mask',
 'A luxury-feel sheet mask with 24K gold extract and collagen that firms, brightens, and delivers anti-aging hydration. Premium ingredients at an accessible price point.',
 NULL, '1 sheet', 3000, 2.50, 4.4, 4200, true, 6, 24),

('Prep Peptaronic Cream', '프렙 펩타로닉 크림',
 'SNP', '에스엔피', 'moisturizer', 'peptide cream',
 'A peptide moisturizer with 8 peptide types and ceramides that firms, nourishes, and provides lasting hydration. Pairs with the Peptaronic Serum for enhanced anti-aging results.',
 55, '55ml', 20000, 15.50, 4.5, 3200, true, 12, 36),

('Prep Vitaronic Ampoule', '프렙 비타로닉 앰플',
 'SNP', '에스엔피', 'ampoule', 'brightening',
 'A brightening ampoule with vitamin C and niacinamide that fades dark spots, brightens dull skin, and provides antioxidant protection. Budget-friendly vitamin C treatment.',
 30, '30ml', 16000, 12.50, 4.4, 3600, true, 6, 24);


-- ============================================================================
-- Verify counts
-- ============================================================================
SELECT brand_en, COUNT(*) AS count
FROM ss_products
WHERE brand_en IN ('HERA','AmorePacific','The History of Whoo','su:m37°','Illiyoon','Sioris','Aromatica','Papa Recipe','KAHI','Biodance','SNP')
GROUP BY brand_en ORDER BY brand_en;
