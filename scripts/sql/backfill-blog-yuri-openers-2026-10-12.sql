-- Backfill ss_content_posts.yuri_opener for the 48 published posts (Oct 12 2026).
-- Run AFTER supabase/migrations/20261012000001_blog_yuri_opener.sql.
-- Written by Opus 5.5 from each post's content, then adversarially reviewed by
-- Fable 5.1 (15 replaced: yes/no permission questions that spent a free message,
-- a Purito sibling Yuri would contradict, Japanese picks she cannot ground, and
-- authenticity openers asking for a verdict she must not give).
-- Only fills NULLs, so re-running never overwrites a hand edit.

BEGIN;

UPDATE ss_content_posts SET yuri_opener = 'I''m in the US. Is the Korean sunscreen I buy here the same formula as in Korea, and which one should I get?' WHERE slug = 'korean-sunscreen-vs-american-sunscreen-why-k-beauty-sunscreens-are-taking-over-tiktok' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I''ve got dark spots that won''t fade. Which ingredient should I actually start with for my skin?' WHERE slug = 'best-korean-skincare-for-dark-spots-what-actually-fades-hyperpigmentation-and-whats-just-marketing' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Is there somewhere I can get the Korean products I want without paying the big US markup?' WHERE slug = 'why-is-k-beauty-so-expensive-in-the-us-the-real-price-markup-explained' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I think my skin is dehydrated, not dry. What''s the one thing I should change first?' WHERE slug = 'how-to-fix-dehydrated-skin-with-a-korean-skincare-routine' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I''m new to K-beauty and don''t want to waste money. What''s the first product I should get for my skin?' WHERE slug = 'how-to-build-a-korean-skincare-routine-that-actually-works-without-wasting-money-or-wrecking-your-skin' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Where should I buy the K-beauty product I want so I know it''s real and fairly priced?' WHERE slug = 'where-to-buy-k-beauty-online-trusted-shops-in-2026' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Which Korean cleansing oil would suit my skin type without leaving a film or breaking me out?' WHERE slug = 'best-korean-cleansing-oils-for-every-skin-type-2026' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My skin gets oily fast. What''s the one product I should change first to get it under control?' WHERE slug = 'oily-skin-routine-guide' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Which of the products trending in Korea right now would actually be worth it for my skin?' WHERE slug = 'trending-k-beauty-products-2026-03' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My foundation slides or pills over my skincare. What in my morning products is most likely causing it?' WHERE slug = 'why-does-your-makeup-look-worse-over-korean-skincare-and-how-to-actually-fix-it' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I want glass skin. What''s the one hydrating product that would make the biggest difference for my skin?' WHERE slug = 'how-to-get-glass-skin-a-k-beauty-routine-that-works' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I want eye patches that actually do something. Which ones are worth buying for my under-eyes?' WHERE slug = 'do-korean-eye-patches-actually-work-a-realistic-guide-to-whats-worth-your-money' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I think niacinamide might be breaking me out. How do I tell which of my products have it?' WHERE slug = 'can-niacinamide-cause-acne-why-this-k-beauty-star-ingredient-might-be-breaking-you-out' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I have red marks left from old breakouts that won''t fade. What should I actually use on them?' WHERE slug = 'best-korean-skincare-for-pie-acne-scars-and-texture' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I can''t tell if I''m oily, dry or combo. What should I check about my skin to find out?' WHERE slug = 'how-to-figure-out-your-skin-type-for-korean-skincare' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Which Korean sunscreen should I buy in the US, and where do I get it without overpaying?' WHERE slug = 'best-japanese-korean-sunscreens-you-can-buy-in-the-us-2026-without-getting-ripped-off' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My sunscreen pills over my skincare. Which steps underneath usually cause it, and what should I change first?' WHERE slug = 'why-does-sunscreen-pill-how-to-stop-it-for-good' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My skin is dry and I have dark spots. What can fade them without irritating my skin?' WHERE slug = 'best-korean-skincare-for-dry-skin-with-pigmentation-a-routine-that-treats-both' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'The dots on my nose keep coming back. What should I actually use to make them less visible?' WHERE slug = 'why-your-sebaceous-filaments-keep-coming-back-and-the-k-beauty-routine-that-finally-changed-mine' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'A new product from a brand I already use broke me out, but their old one was fine. What should I compare between the two ingredient lists?' WHERE slug = 'same-brand-different-formula-why-that-similar-k-beauty-product-just-wrecked-your-skin' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Would Beauty of Joseon Aqua Fresh suit my skin, or is there a better sunscreen for me?' WHERE slug = 'beauty-of-joseon-aqua-fresh-sunscreen-full-review' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Not sure if my nose dots are sebaceous filaments or blackheads. What should I actually use on them?' WHERE slug = 'sebaceous-filaments-vs-blackheads-how-to-tell-treat' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I''m not sure my products are working together. Which one should I drop or swap first?' WHERE slug = 'how-to-evaluate-your-k-beauty-routine-without-guessing' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My skin got worse after I added a bunch of actives. What should I stop using first?' WHERE slug = 'late-20s-skin-spiral-your-barrier-is-probably-wrecked' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I keep quitting long routines. What''s the one active I should keep for my main skin concern?' WHERE slug = 'the-7-minute-k-beauty-routine-that-actually-sticks' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I have dark spots that keep hanging around. Which brightening serum would suit my skin?' WHERE slug = 'how-to-get-rid-of-hyperpigmentation-k-beauty-guide' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Which hydrating toner would actually suit my skin, and is the one I use now any good?' WHERE slug = 'k-beauty-toners-the-ones-actually-worth-your-money' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My skin''s been reacting to everything lately. Which of my products should I stop using first?' WHERE slug = 'why-simplifying-your-skincare-routine-actually-works' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I''m worried my COSRX snail mucin is fake. What should I check on the bottle and box, and does where I bought it matter?' WHERE slug = 'how-to-tell-if-your-cosrx-snail-mucin-is-fake-a-2-minute-che' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I bought Sulwhasoo First Care Serum from a third-party seller. What should I check on it before I use it?' WHERE slug = 'how-to-tell-if-your-sulwhasoo-first-care-serum-is-fake-5-che' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I found a Korean product online for a lot less than usual. What tells me whether the listing is real?' WHERE slug = 'how-to-tell-if-korean-skincare-is-fake-a-5-point-check-for-a' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'COSRX snail mucin broke me out. Was it the product, fungal acne, or something else?' WHERE slug = 'did-cosrx-snail-mucin-break-you-out-heres-why' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Purito''s Oat-in Intense Cream is discontinued. Is their Oat-In Calming Gel Cream the same thing, or what''s the closest match for my skin?' WHERE slug = 'purito-oat-in-cream-discontinued-best-alternatives' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I can''t read the dates on my Korean product. Can you help me tell if it''s expired?' WHERE slug = 'how-do-you-read-korean-skincare-expiration-dates-and-batch' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I''m peeling from tretinoin and have an event soon. How do I get my makeup to sit smoothly?' WHERE slug = 'makeup-over-tretinoin-peeling-wedding-week-rescue' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My skin stings with everything and feels tight. Does that sound like a damaged barrier, and what do I stop first?' WHERE slug = 'how-to-tell-if-your-skin-barrier-is-damaged-real-signs' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I''m about to buy a viral K-beauty product. How do I tell if it actually suits my skin before I spend the money?' WHERE slug = 'things-i-wish-i-knew-before-buying-korean-skincare' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My vitamin C serum stung or did nothing. Which gentler vitamin C would work for my skin?' WHERE slug = 'given-up-on-vitamin-c-heres-why-and-what-to-try' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I have brown marks left from old breakouts. Which Korean serum would fade them best for my skin?' WHERE slug = 'best-korean-skincare-for-pih-fade-post-acne-dark-spots' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'Where can I buy COSRX snail mucin in the US so I know it''s real, at a fair price?' WHERE slug = 'where-to-buy-authentic-korean-snail-mucin-in-the-us' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I never stick with a routine. If I only use one treatment, which one fits my skin?' WHERE slug = 'how-do-you-build-a-korean-skincare-routine-youll-actually-stick-to' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My skin is sensitive and dehydrated. Which milky toner won''t sting it?' WHERE slug = 'best-milky-toners-for-a-sensitive-dehydrated-skin-barrier' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I''ve never used retinol. Which one should I start with for my skin, and how often?' WHERE slug = 'retinol-or-retinal-how-to-pick-the-right-one' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I''m looking at a PDRN serum. How do I tell if it''s real PDRN or Sodium DNA, and does the difference matter?' WHERE slug = 'what-is-pdrn-skincare-really-why-salmon-dna-and-pdrn-are' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My collagen cream just says collagen on the front. How do I tell from the ingredient list if it''s the hydrolyzed kind?' WHERE slug = 'what-your-korean-collagen-creams-label-can-and-cant-tell-you' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My skin is dry but I still break out and have marks. What should I start with?' WHERE slug = 'dry-combo-skin-with-acne-scars-start-here' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'I found an $11 Korean serum that looks like my $38 one. How do I tell if the cheap one is actually as good?' WHERE slug = 'why-is-korean-skincare-so-cheap' AND yuri_opener IS NULL;
UPDATE ss_content_posts SET yuri_opener = 'My skin is tight and a bit flaky. Do I need a barrier cream or just a better moisturizer?' WHERE slug = 'korean-moisturizer-or-barrier-cream-how-to-tell-what-your-skin-needs' AND yuri_opener IS NULL;

-- Expect 48:
SELECT count(*) AS with_opener FROM ss_content_posts WHERE yuri_opener IS NOT NULL;

COMMIT;
