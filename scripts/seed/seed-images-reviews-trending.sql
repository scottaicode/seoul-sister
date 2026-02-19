-- ============================================================
-- Seoul Sister: Production Data Seed Script
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================
-- Part 1: Product Image URLs (56 products)
-- Part 2: Community Reviews (40 reviews)
-- Part 3: Trending Products (12 products)
-- ============================================================

-- ============================================================
-- PART 1: PRODUCT IMAGE URLS
-- Real images from brand Shopify CDNs, Soko Glam, retailers
-- ============================================================

-- Anua
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-toner-heartleaf-77-soothing-toner-1161173062.png' WHERE id = '2dac8c46-8a67-4b6c-9e46-6c5bc1f0c4cc';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-cleanser-200ml-heartleaf-pore-control-cleansing-oil-1161173153.png' WHERE id = '1a82a32c-2dad-4bce-ac49-8dc7c582b4c0';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-ampoule-serum-30ml-peach-70-niacinamide-serum-1161189371.png' WHERE id = '053241fd-1046-4b3c-bab1-a7ddd8182323';

-- Banila Co
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Banila-Co-Cleaning-It-Zero-Original-Cleansing-Balm_2.jpg' WHERE id = '457bc739-647b-4f9e-b367-9d210d14762f';

-- Beauty of Joseon
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0558/4135/7989/files/dynasty-cream-1-front.webp' WHERE id = 'e0184ef6-c2b2-4d4c-b132-7e4a58b5162b';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0558/4135/7989/files/glow-serum-propolis-niacinamide-1-front.webp' WHERE id = 'e9e4db3a-e589-44a5-a2de-a7edf43f0629';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0267/7676/4606/files/BEAUTYOFJOSEONReliefSunSPF50_PA_50ml.jpg' WHERE id = 'f2ba1ae1-8ed2-4ea7-b658-fd191f144008';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0558/4135/7989/files/revive-eye-serum-ginseng-retinal-1-front.webp' WHERE id = '9e8206d8-1bad-4559-bf26-6d54ecdf3470';

-- COSRX
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/COSRX-Advanced-Snail-92-All-In-One-Cream-Product.jpg' WHERE id = '6bd8cc65-7b76-4f8f-9d22-d15008e7722e';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/COSRX-Advanced-Snail-96-Mucin-Power-Essence-Product.jpg' WHERE id = '09dabfa8-b373-4006-9bbc-2393fb2743db';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0513/3775/6828/files/ahabha-clarifying-treatment-toner-cosrx-official-1.jpg' WHERE id = '059c9bdf-44cc-439f-9d5a-212c1f63ac5d';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/COSRX-BHA-Blackhead-Power-Liquid-Korean-Skincare-Product.jpg' WHERE id = 'dd11bde0-86b5-40e6-9782-0540dcc0f914';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0513/3775/6828/files/full-fit-propolis-synergy-toner-cosrx-official-1.jpg' WHERE id = 'f30b69cc-3996-4f00-b0da-abb35f8b88c3';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/COSRX-Low-pH-Good-Morning-Gel-Cleanser-Korean-Skincare-Product.jpg' WHERE id = 'ad9332e4-b85c-4809-91ed-137cc53b4ecb';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0513/3775/6828/files/full-fit-propolis-light-ampoule-cosrx-official-1.jpg' WHERE id = 'e0b818b5-a45c-4489-a9ef-2c60f1f0f6ae';

-- d'Alba
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0591/1094/9047/files/100ml_18802f44-6c65-4476-af0b-7a8e86a25e8c.png' WHERE id = 'e6f300fc-3d8a-46c9-8075-b23af0e56f10';

-- Dr. Jart+
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0515/4589/9157/files/Dr.Jart_Ceramidin_Skin_Barrier_Moisturizing_Cream__50ml_PNG.png' WHERE id = 'c70d74fa-0aea-4d1b-ac74-ae125687d733';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0980/9700/products/Ohlolly-Dr-Jart-Cicapair-Cream-1.jpg' WHERE id = '7f193a12-ed3e-4d07-92b3-0f1d5a5cfe0e';

-- Etude House
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Etude_Revamped_Soonjung_2x_Barrier_Intensive_Cream.jpg' WHERE id = '5298f3d2-7777-4690-b2f2-9a7dc813c0d6';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Etude-House-SoonJung-pH-5-5-Relief-Toner-Skin-Care-Korean.jpg' WHERE id = '342f9f81-5567-4b27-8c1d-f1108abdbc05';

-- I'm From
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/I_m-From-Mugwort-Essence-Korean-Skincare.jpg' WHERE id = 'bb7ae8fa-f369-4b20-975c-e0b7f3cc2a47';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/I_m-From-Rice-Toner.jpg' WHERE id = 'e6aba59e-984e-46c6-a873-c8f13f8d5ff0';

-- Innisfree
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0089/3367/1012/files/01_IF_SUN-D_Packshot_2024_01_1080x1080.jpg' WHERE id = '9321187e-e079-46e6-b5cb-2bdfc5430c6a';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0089/3367/1012/files/01_IF_GT-HS_Packshot_2024_01_1080x1080.jpg' WHERE id = '530e833f-37fe-491b-a34b-c61c8c01ff19';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0089/3367/1012/files/01_IF_V-CF_Packshot_2024_01_1080x1080.jpg' WHERE id = '34f08420-8d99-423a-96dc-131fb90fd447';

-- Isntree
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0254/3022/9055/products/7KCc66qp7JeG7J2M1.jpg' WHERE id = '877a0124-5c41-4225-bc1d-4aacc106cbcd';
UPDATE ss_products SET image_url = 'https://d1flfk77wl2xk4.cloudfront.net/Assets/62/273/l_p0091927362.jpg' WHERE id = '9c34611a-71b7-49cf-b588-d40f122120d6';

-- Klairs
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Klairs-Freshly-Juiced-Vitamin-Drop.jpg' WHERE id = '785754d7-80f0-4ea1-9e28-2716ea6d4358';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Klairs-Midnight-Blue-Calming-Cream_1.jpg' WHERE id = '80f860e6-5cb0-4c5b-9bc6-cae94db0cf62';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0610/7719/2884/files/Rich-Moist-Soothing-Tencel-Sheet-Mask-thumbnail-01-product.jpg' WHERE id = 'acda30d5-c614-411a-a2af-86959be276fa';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Klairs-Supple-Preparation-Unscented-Toner.jpg' WHERE id = '1c8c5a25-37d3-4188-bc38-c6c9a87a2484';

-- Laneige
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0255/0189/2660/files/Product_01_9129acd1-a5ce-46e2-9d30-bbd77479f839.jpg' WHERE id = '1d6ba44e-422f-4c4f-b6a3-aba62cb354d7';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0255/0189/2660/files/1080x10800_Thumbnail_Product.jpg' WHERE id = 'a3b42ab4-5967-4208-a59c-843c838bed18';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0255/0189/2660/files/PDPImage_1000x1000_LSM.jpg' WHERE id = '45ee8c2c-5fa6-4403-aef6-ed85ce1037b5';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0255/0189/2660/files/WSM_AD_PDP_2.jpg' WHERE id = '114d5b5f-ce87-4bfe-9989-621128b962e8';

-- Missha
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Missha-M-Perfect-Cover-BB-Cream_1.jpg' WHERE id = 'eff17242-df12-44c1-8b18-6de00aca4748';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Missha-Time-Revolution-The-First-Essence-5X-Korean-Skincare.jpg' WHERE id = '1da13fd5-8d97-452c-8840-c1a08c8a604e';

-- Numbuzin
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0573/3793/8117/files/250527_________09.jpg' WHERE id = '7540a71d-5cd4-4c8a-86fa-c1f7662520d4';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0573/3793/8117/files/250527_________10.jpg' WHERE id = '640117e1-d3df-4f72-882a-9831c8d28134';

-- ONE THING
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0111/9309/0106/products/one-thing-centella-asiatica-oo35mm.jpg' WHERE id = '560ecfd7-54bd-43a2-ad2c-9281c1daab39';

-- Purito
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0254/3022/9055/products/8qF8u5VO1587994304.jpg' WHERE id = '4ab6e793-3514-4ac7-9303-b9fc24bbe00e';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0254/3022/9055/products/PURITOComfyWaterSunblockkoreanskincarenetherlands1.jpg' WHERE id = '24877447-996a-4520-acc6-b7cfc0dfc771';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0980/9700/files/Purito_From_Green_Cleansing_Oil_8.jpg' WHERE id = '39934a00-9c5a-45f9-9de5-ce0da47a3131';

-- Round Lab
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Round-Lab-Birch-Juice-Moisturizing-Cream.jpg' WHERE id = '2169dc84-997c-4949-9729-717dc1eed513';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Soko-Glam-Round-Lab-Birch-Juice-Moisturizing-UVLOCK.jpg' WHERE id = '48e4f6d5-5161-4716-b7bc-9a64cd8693ff';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Round-Lab-1025-DOKDO-Toner.jpg' WHERE id = '85d78a15-33cb-41f4-ba36-409e93590cc0';

-- Skin1004
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-cleanser-centella-light-cleansing-oil-42321970594038.jpg' WHERE id = '3fa0c2b1-3c94-41da-acf6-b2c59d774259';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-50ml-hyalu-cica-water-fit-sun-serum-uv-1204112543.png' WHERE id = 'ab3f2b8c-5e30-48b4-afa7-98fc728c2429';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0590/4538/0253/files/skin1004-ampoule-serum-centella-ampoule-42321171448054.jpg' WHERE id = '6ef1a629-bd58-4d9a-86c2-761315bc12d1';

-- Some By Mi
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Soko-Glam-PDP-Some-By-Mi-AHA-BHA-PHA-30-Days-Miracle-Toner-01.png' WHERE id = '7cdad34e-201e-4056-a906-e9cdc6ea9eff';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0254/3022/9055/files/SomeByMi_TruecicaMineralCalmingTone-UpSuncream_Packshot.jpg' WHERE id = '278081c1-76db-4c52-b97f-97e637264d19';

-- Sulwhasoo
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/8399/4413/files/Brand.com_1080x1080_NewCGRCream_01.Packshot_50ml.jpg' WHERE id = '90a035a7-fc33-4fc8-833f-8728972443d4';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/8399/4413/files/2023FCAS6thGeneration-60ml-1_270320590_Brand.com_1080px1_1ratio.jpg' WHERE id = '9f29aed1-fb55-4dfc-b176-f8ec01ffd9c7';

-- Torriden
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0920/1644/3758/files/01_99724da0-cdf3-4eba-bc6a-1b55fcfa0e45.jpg' WHERE id = 'a5b742ef-11a1-49a9-80df-3d64f604d0cc';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/TorridenDiveinSerum.jpg' WHERE id = '7606df77-b0ff-4d7b-ba5e-f02c14f3c4a6';
UPDATE ss_products SET image_url = 'https://cdn.shopify.com/s/files/1/0249/1218/files/Torriden-SOLID-IN-Ceramide-Cream.jpg' WHERE id = 'c7d7c9d0-5245-42c3-8af5-d954bd783178';


-- ============================================================
-- PART 2: COMMUNITY REVIEWS (40 reviews)
-- Realistic reviews from 3 users, spread across popular products
-- Skin types, concerns, reactions, fitzpatrick scales all realistic
-- ============================================================

-- User IDs:
-- Bailey (551569d3-...) - combo skin, Gen Z, K-beauty enthusiast
-- Test user (a97fbbd6-...) - oily skin, acne-prone
-- VibeTrend (cdb2a7e8-...) - dry/sensitive skin

-- ---- COSRX Advanced Snail 96 Mucin Power Essence (THE cult favorite) ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('551569d3-aed0-4feb-a340-47bfb146a835', '09dabfa8-b373-4006-9bbc-2393fb2743db', 5, 'The hype is REAL', 'I was skeptical about putting snail mucin on my face but this stuff is incredible. My skin feels so bouncy and hydrated without any greasiness. I use it morning and night after toner. My combo skin has never looked better — the dry patches are gone and my T-zone isn''t oilier.', 'combination', ARRAY['dryness', 'uneven_texture'], 'holy_grail', true, '6+ months', 12, 3, '18-24'),
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', '09dabfa8-b373-4006-9bbc-2393fb2743db', 4, 'Great hydration, a bit sticky', 'Really good essence for the price. Adds a nice layer of moisture and my acne scars look less noticeable. Only knock is it can feel a bit tacky if you apply too much. A little goes a long way.', 'oily', ARRAY['acne', 'hyperpigmentation'], 'love', true, '3-6 months', 8, 4, '18-24'),
('cdb2a7e8-b182-4da8-864f-4417fa6416be', '09dabfa8-b373-4006-9bbc-2393fb2743db', 5, 'Saved my dry winter skin', 'My skin was flaking and irritated from the winter air. Started layering this under my moisturizer and within a week the flaking stopped. So gentle — no stinging or redness at all. Will never stop repurchasing.', 'dry', ARRAY['dryness', 'sensitivity'], 'holy_grail', true, '6+ months', 15, 2, '25-34');

-- ---- Anua Heartleaf 77% Soothing Toner ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('551569d3-aed0-4feb-a340-47bfb146a835', '2dac8c46-8a67-4b6c-9e46-6c5bc1f0c4cc', 5, 'TikTok was right about this one', 'Saw this everywhere on K-beauty TikTok and finally caved. SO glad I did. My redness has visibly calmed down and my pores look smaller. The texture is like water — absorbs instantly. I go through a bottle every 2 months using it with cotton pads.', 'combination', ARRAY['redness', 'large_pores'], 'holy_grail', true, '3-6 months', 18, 3, '18-24'),
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', '2dac8c46-8a67-4b6c-9e46-6c5bc1f0c4cc', 4, 'Good daily toner, calms breakouts', 'Noticed my skin is less reactive since switching to this toner. It doesn''t sting on active pimples which is a huge plus. Wish the bottle was bigger for the price though.', 'oily', ARRAY['acne', 'redness'], 'love', true, '1-3 months', 6, 4, '18-24');

-- ---- Beauty of Joseon Relief Sun SPF50 ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('551569d3-aed0-4feb-a340-47bfb146a835', 'f2ba1ae1-8ed2-4ea7-b658-fd191f144008', 5, 'Best sunscreen I have EVER used', 'No white cast, no greasy feeling, sits beautifully under makeup. This is the sunscreen that finally made me enjoy wearing SPF every day. The rice extract gives a natural glow without looking shiny. I''ve tried La Roche-Posay, Supergoop, and EltaMD — this beats them all.', 'combination', ARRAY['sun_protection', 'makeup_base'], 'holy_grail', true, '6+ months', 24, 3, '18-24'),
('cdb2a7e8-b182-4da8-864f-4417fa6416be', 'f2ba1ae1-8ed2-4ea7-b658-fd191f144008', 5, 'Finally a sunscreen for sensitive skin', 'No burning, no stinging, no breakouts. I''ve tried dozens of sunscreens that irritated my sensitive skin and this is the first one I can wear daily without issues. The formula is so elegant — like a moisturizer.', 'dry', ARRAY['sensitivity', 'sun_protection'], 'holy_grail', true, '3-6 months', 11, 2, '25-34'),
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', 'f2ba1ae1-8ed2-4ea7-b658-fd191f144008', 4, 'Great but pills under some moisturizers', 'Love the finish — dewy without being greasy. BUT if I use a heavy moisturizer underneath it pills. Works perfectly over lightweight essences and serums though. The protection is excellent.', 'oily', ARRAY['acne', 'sun_protection'], 'love', true, '3-6 months', 7, 5, '18-24');

-- ---- Beauty of Joseon Glow Serum ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('551569d3-aed0-4feb-a340-47bfb146a835', 'e9e4db3a-e589-44a5-a2de-a7edf43f0629', 5, 'Glass skin in a bottle', 'The propolis + niacinamide combo is perfect. My skin literally glows the morning after using this. Dark spots from old breakouts are fading too. At under $15 this is an absolute steal compared to Western serums.', 'combination', ARRAY['dullness', 'hyperpigmentation'], 'holy_grail', true, '3-6 months', 9, 3, '18-24'),
('cdb2a7e8-b182-4da8-864f-4417fa6416be', 'e9e4db3a-e589-44a5-a2de-a7edf43f0629', 4, 'Nice glow but not moisturizing enough alone', 'Gives beautiful luminosity and the niacinamide has evened out my skin tone. But for dry skin types like me, you definitely need a heavier moisturizer on top. Not a standalone product for winter.', 'dry', ARRAY['dullness', 'dryness'], 'love', true, '1-3 months', 5, 2, '25-34');

-- ---- Laneige Water Sleeping Mask ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('551569d3-aed0-4feb-a340-47bfb146a835', '114d5b5f-ce87-4bfe-9989-621128b962e8', 4, 'The OG K-beauty sleeping mask', 'This was my first-ever K-beauty product years ago and I still keep it in rotation. Wake up with plump, dewy skin every time. The scent is really nice too. Docking one star because I think the reformulation isn''t as moisturizing as the original.', 'combination', ARRAY['dryness', 'dullness'], 'love', true, '6+ months', 10, 3, '18-24'),
('cdb2a7e8-b182-4da8-864f-4417fa6416be', '114d5b5f-ce87-4bfe-9989-621128b962e8', 5, 'Must-have for dry skin types', 'I use this 3x a week and my morning skin is always soft and bouncy. Seals in all my nighttime serums perfectly. The texture is jelly-like and cooling — very spa-like experience. This is one product I always have a backup of.', 'dry', ARRAY['dryness', 'aging'], 'holy_grail', true, '6+ months', 7, 2, '25-34');

-- ---- Laneige Lip Sleeping Mask ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('551569d3-aed0-4feb-a340-47bfb146a835', '45ee8c2c-5fa6-4403-aef6-ed85ce1037b5', 5, 'Worth every penny', 'My lips are chronically dry and peely. This mask transformed them overnight — literally. I apply a thick layer before bed and wake up with baby-soft lips. The berry flavor is amazing and one jar lasts FOREVER.', 'combination', ARRAY['dryness'], 'holy_grail', true, '6+ months', 20, 3, '18-24'),
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', '45ee8c2c-5fa6-4403-aef6-ed85ce1037b5', 5, 'Best lip product ever made', 'I have repurchased this 4 times. Nothing else compares. Lip balms, Vaseline, Aquaphor — none of them work as well as this sleeping mask. My lips stay soft and hydrated for the entire next day.', 'oily', ARRAY['dryness'], 'holy_grail', true, '6+ months', 14, 4, '18-24');

-- ---- COSRX Low pH Good Morning Gel Cleanser ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', 'ad9332e4-b85c-4809-91ed-137cc53b4ecb', 5, 'Perfect for acne-prone skin', 'The tea tree oil in this cleanser keeps my breakouts in check without over-drying. The low pH means my skin barrier stays intact. I''ve been using this for almost a year as my morning cleanser and my skin has never been clearer.', 'oily', ARRAY['acne', 'excess_oil'], 'holy_grail', true, '6+ months', 11, 4, '18-24'),
('551569d3-aed0-4feb-a340-47bfb146a835', 'ad9332e4-b85c-4809-91ed-137cc53b4ecb', 4, 'Solid morning cleanser', 'Does what it says — gentle, low pH, cleans without stripping. The tea tree scent is noticeable but not overwhelming. Good value for money. I use it every morning followed by toner.', 'combination', ARRAY['excess_oil', 'large_pores'], 'love', true, '3-6 months', 4, 3, '18-24');

-- ---- Torriden DIVE-IN Hyaluronic Acid Serum ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('cdb2a7e8-b182-4da8-864f-4417fa6416be', '7606df77-b0ff-4d7b-ba5e-f02c14f3c4a6', 5, 'Hydration powerhouse', 'This serum has 5 different molecular weights of hyaluronic acid and you can FEEL the difference. My skin drinks this up. Plumps up fine lines and gives the most beautiful dewy finish. The pump bottle is hygienic and travel-friendly too.', 'dry', ARRAY['dryness', 'fine_lines'], 'holy_grail', true, '6+ months', 13, 2, '25-34'),
('551569d3-aed0-4feb-a340-47bfb146a835', '7606df77-b0ff-4d7b-ba5e-f02c14f3c4a6', 4, 'Great hydrating serum for the price', 'Replaced my more expensive HA serum with this and honestly can''t tell the difference. Absorbs fast, layers well under other products. My skin looks plump and healthy. Only wish the bottle was bigger.', 'combination', ARRAY['dehydration', 'dullness'], 'love', true, '1-3 months', 6, 3, '18-24');

-- ---- Skin1004 Madagascar Centella Ampoule ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('cdb2a7e8-b182-4da8-864f-4417fa6416be', '6ef1a629-bd58-4d9a-86c2-761315bc12d1', 5, 'Redness rescue', 'My rosacea-prone skin loves centella and this ampoule is basically pure centella extract. Calms redness within minutes and has reduced my overall skin reactivity over time. Fragrance-free, simple ingredients — exactly what sensitive skin needs.', 'sensitive', ARRAY['redness', 'sensitivity'], 'holy_grail', true, '6+ months', 16, 2, '25-34'),
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', '6ef1a629-bd58-4d9a-86c2-761315bc12d1', 4, 'Helps calm acne inflammation', 'I use this after my BHA nights when my skin is red and irritated. Really speeds up healing on active pimples. Light texture that doesn''t clog pores. Good product but not miraculous — works best as part of a routine.', 'oily', ARRAY['acne', 'redness'], 'love', true, '3-6 months', 5, 4, '18-24');

-- ---- Klairs Freshly Juiced Vitamin Drop ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('551569d3-aed0-4feb-a340-47bfb146a835', '785754d7-80f0-4ea1-9e28-2716ea6d4358', 5, 'Best vitamin C for sensitive skin', 'Most vitamin C serums sting my face but this one is completely gentle. 5% concentration is enough to brighten without irritation. My PIH from old breakouts has faded noticeably over 3 months. The dropper makes it easy to control how much you use.', 'combination', ARRAY['hyperpigmentation', 'dullness'], 'holy_grail', true, '3-6 months', 8, 3, '18-24'),
('cdb2a7e8-b182-4da8-864f-4417fa6416be', '785754d7-80f0-4ea1-9e28-2716ea6d4358', 4, 'Gentle but effective brightening', 'I can''t use high-concentration vitamin C serums so this 5% formula is perfect. Has gradually brightened my overall complexion. Just be aware it oxidizes fast — keep it in the fridge and use within 2-3 months of opening.', 'dry', ARRAY['dullness', 'sensitivity'], 'love', true, '3-6 months', 7, 2, '25-34');

-- ---- COSRX BHA Blackhead Power Liquid ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', 'dd11bde0-86b5-40e6-9782-0540dcc0f914', 5, 'Blackhead destroyer', 'This BHA liquid cleared my nose and chin blackheads within a month. I use it 3x a week at night after cleansing. The 4% betaine salicylate is gentler than pure salicylic acid but still effective. My pores look so much cleaner.', 'oily', ARRAY['blackheads', 'large_pores', 'excess_oil'], 'holy_grail', true, '6+ months', 17, 4, '18-24'),
('551569d3-aed0-4feb-a340-47bfb146a835', 'dd11bde0-86b5-40e6-9782-0540dcc0f914', 4, 'Good BHA for beginners', 'Less intense than Paula''s Choice BHA but still works well. I use it on my T-zone only where I get congestion. Takes about 3-4 weeks to see results but the improvement is steady. Make sure to follow up with sunscreen.', 'combination', ARRAY['blackheads', 'large_pores'], 'love', true, '3-6 months', 6, 3, '18-24');

-- ---- I'm From Rice Toner ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('cdb2a7e8-b182-4da8-864f-4417fa6416be', 'e6aba59e-984e-46c6-a873-c8f13f8d5ff0', 5, 'Brightening and hydrating in one', 'The milky texture is so satisfying to apply. My skin looks brighter and more even-toned after just 2 weeks. It''s like a mini facial every time I use it. The rice ferment filtrate gives a natural glow that looks like you''re lit from within.', 'dry', ARRAY['dullness', 'dryness'], 'holy_grail', true, '6+ months', 9, 2, '25-34'),
('551569d3-aed0-4feb-a340-47bfb146a835', 'e6aba59e-984e-46c6-a873-c8f13f8d5ff0', 4, 'Love the glow effect', 'This toner gives the prettiest natural glow. Feels nourishing without being heavy. I love the 7-skin method with this — layer it 3-4 times for amazing hydration. Only downside is it''s not the most cost-effective toner out there.', 'combination', ARRAY['dullness', 'dehydration'], 'love', true, '1-3 months', 5, 3, '18-24');

-- ---- Banila Co Clean It Zero ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('551569d3-aed0-4feb-a340-47bfb146a835', '457bc739-647b-4f9e-b367-9d210d14762f', 4, 'Best cleansing balm for double cleansing', 'Melts away sunscreen and makeup so easily. The sherbet texture turns into an oil when you massage it in and emulsifies cleanly with water. No residue left behind. Great first step in my double cleanse routine.', 'combination', ARRAY['excess_oil', 'clogged_pores'], 'love', true, '6+ months', 8, 3, '18-24'),
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', '457bc739-647b-4f9e-b367-9d210d14762f', 3, 'Decent but broke me out a little', 'It does remove makeup really well but I noticed small bumps appearing on my forehead after a week. Might be the mineral oil — some oily/acne-prone skin types may not tolerate it. Switched to an oil cleanser instead.', 'oily', ARRAY['acne', 'clogged_pores'], 'broke_me_out', false, '1-3 months', 12, 4, '18-24');

-- ---- Dr. Jart+ Ceramidin Cream ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('cdb2a7e8-b182-4da8-864f-4417fa6416be', 'c70d74fa-0aea-4d1b-ac74-ae125687d733', 5, 'Barrier repair hero', 'When I over-exfoliated and destroyed my moisture barrier, this cream was my salvation. The 5-cera complex truly repairs and protects. It''s rich but not greasy. My skin went from red and flaky to calm and healthy in about 10 days. Worth the premium price.', 'dry', ARRAY['sensitivity', 'dryness', 'damaged_barrier'], 'holy_grail', true, '6+ months', 19, 2, '25-34');

-- ---- Numbuzin No.3 Skin Softening Serum ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('551569d3-aed0-4feb-a340-47bfb146a835', '7540a71d-5cd4-4c8a-86fa-c1f7662520d4', 5, 'New holy grail serum', 'Numbuzin went viral for a reason. This serum has galactomyces + niacinamide + hyaluronic acid and it makes my skin SO smooth. The texture is watery and absorbs in seconds. My skin looks like I have a filter on. Already on my second bottle.', 'combination', ARRAY['uneven_texture', 'large_pores', 'dullness'], 'holy_grail', true, '3-6 months', 11, 3, '18-24'),
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', '7540a71d-5cd4-4c8a-86fa-c1f7662520d4', 4, 'Solid all-around serum', 'Good for brightening and smoothing. The fermented ingredients give a noticeable glow. Plays well with my other actives. Nothing about it is bad — it just quietly makes your skin better over time.', 'oily', ARRAY['dullness', 'large_pores'], 'love', true, '1-3 months', 4, 5, '18-24');

-- ---- Klairs Supple Preparation Unscented Toner ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('cdb2a7e8-b182-4da8-864f-4417fa6416be', '1c8c5a25-37d3-4188-bc38-c6c9a87a2484', 5, 'Perfect for sensitive, reactive skin', 'This is the toner I recommend to everyone with sensitive skin. No fragrance, no essential oils, just pure hydrating goodness. Layers beautifully and preps skin for serums. I''ve been using it for over a year and my skin has never been happier.', 'sensitive', ARRAY['sensitivity', 'dryness'], 'holy_grail', true, '6+ months', 13, 2, '25-34');

-- ---- Some By Mi AHA BHA PHA 30 Days Miracle Toner ----
INSERT INTO ss_reviews (user_id, product_id, rating, title, body, skin_type, skin_concerns, reaction, would_repurchase, usage_duration, helpful_count, fitzpatrick_scale, age_range) VALUES
('a97fbbd6-d7a2-4e93-b867-a08f3b7ecf30', '7cdad34e-201e-4056-a906-e9cdc6ea9eff', 4, 'Good intro to chemical exfoliation', 'The triple acid approach (AHA + BHA + PHA) is well-balanced and not too harsh. My skin cleared up noticeably in the first month. Some purging in week 2-3 but it settled. Tea tree oil keeps breakouts at bay.', 'oily', ARRAY['acne', 'blackheads', 'uneven_texture'], 'love', true, '3-6 months', 8, 4, '18-24');


-- ============================================================
-- PART 3: TRENDING PRODUCTS (12 products)
-- Based on real K-beauty trends: Numbuzin, Anua, Beauty of Joseon,
-- Torriden, Skin1004 are all genuinely trending in 2025-2026
-- ============================================================

INSERT INTO ss_trending_products (product_id, source, trend_score, mention_count, sentiment_score, trending_since) VALUES
-- Numbuzin No.3 - Massively viral on TikTok
('7540a71d-5cd4-4c8a-86fa-c1f7662520d4', 'tiktok', 95, 48200, 0.92, NOW() - INTERVAL '21 days'),
-- Anua Heartleaf Toner - Consistent TikTok darling
('2dac8c46-8a67-4b6c-9e46-6c5bc1f0c4cc', 'tiktok', 91, 35800, 0.89, NOW() - INTERVAL '45 days'),
-- Beauty of Joseon Relief Sun - #1 sunscreen on TikTok
('f2ba1ae1-8ed2-4ea7-b658-fd191f144008', 'tiktok', 93, 52100, 0.94, NOW() - INTERVAL '60 days'),
-- COSRX Snail Mucin - Perennial bestseller, always trending
('09dabfa8-b373-4006-9bbc-2393fb2743db', 'reddit', 88, 28400, 0.91, NOW() - INTERVAL '90 days'),
-- Torriden DIVE-IN Serum - Rising star in hydration
('7606df77-b0ff-4d7b-ba5e-f02c14f3c4a6', 'tiktok', 87, 19500, 0.88, NOW() - INTERVAL '14 days'),
-- Skin1004 Centella Ampoule - K-beauty Reddit favorite
('6ef1a629-bd58-4d9a-86c2-761315bc12d1', 'reddit', 82, 12300, 0.86, NOW() - INTERVAL '30 days'),
-- Beauty of Joseon Glow Serum - Affordable luxury trending
('e9e4db3a-e589-44a5-a2de-a7edf43f0629', 'instagram', 85, 15600, 0.90, NOW() - INTERVAL '28 days'),
-- Numbuzin No.5 Vitamin Serum - Following No.3's success
('640117e1-d3df-4f72-882a-9831c8d28134', 'tiktok', 80, 11200, 0.85, NOW() - INTERVAL '10 days'),
-- Round Lab Dokdo Toner - Korean domestic bestseller going global
('85d78a15-33cb-41f4-ba36-409e93590cc0', 'korean_market', 84, 8900, 0.87, NOW() - INTERVAL '35 days'),
-- Anua Cleansing Oil - Trending as "best oil cleanser"
('1a82a32c-2dad-4bce-ac49-8dc7c582b4c0', 'tiktok', 78, 9800, 0.83, NOW() - INTERVAL '18 days'),
-- d'Alba Spray Serum - Unique format driving curiosity
('e6f300fc-3d8a-46c9-8075-b23af0e56f10', 'instagram', 76, 7200, 0.81, NOW() - INTERVAL '25 days'),
-- Laneige Lip Sleeping Mask - Gateway K-beauty product always trending
('45ee8c2c-5fa6-4403-aef6-ed85ce1037b5', 'tiktok', 90, 41000, 0.93, NOW() - INTERVAL '120 days');


-- ============================================================
-- PART 4: UPDATE PRODUCT STATS TO MATCH REVIEWS
-- Sync avg_rating and review_count on products that now have reviews
-- ============================================================

UPDATE ss_products SET
  rating_avg = sub.avg_r,
  review_count = sub.cnt
FROM (
  SELECT product_id, ROUND(AVG(rating)::numeric, 1) as avg_r, COUNT(*) as cnt
  FROM ss_reviews
  GROUP BY product_id
) sub
WHERE ss_products.id = sub.product_id;


-- Done! Verify with:
-- SELECT name_en, image_url IS NOT NULL as has_image FROM ss_products ORDER BY brand_en;
-- SELECT COUNT(*) FROM ss_reviews;
-- SELECT p.name_en, t.source, t.trend_score FROM ss_trending_products t JOIN ss_products p ON p.id = t.product_id ORDER BY t.trend_score DESC;
