-- Trim the 5 meta descriptions that exceed Google's ~155-160 char SERP cap.
--
-- Measured Aug 25 2026. These render truncated mid-sentence in search results.
-- The worst is the Beauty of Joseon Aqua-Fresh review at 198 chars — the site's
-- single highest-impression blog page (~1,162 impressions / 5 clicks, 0.43%
-- CTR). A snippet cut mid-phrase costs clicks on impressions we already earn.
--
-- Each rewrite keeps the SEARCH INTENT that earns the impressions (the exact
-- entity + the question the query is asking) and moves the payoff earlier, so
-- the value proposition survives the cut. Nothing new is claimed.
--
-- Verify AFTER deploy by curling the SERVED html, not this file — per the
-- standing note in layout.tsx, entities like &#x27; change the rendered count.

UPDATE ss_content_posts SET meta_description =
'Beauty of Joseon Aqua Fresh sunscreen: full INCI list, the Uvinul A Plus and T 150 filters, who it suits, and how it compares.'
WHERE slug = 'beauty-of-joseon-aqua-fresh-sunscreen-full-review';

UPDATE ss_content_posts SET meta_description =
'Spot a fake Sulwhasoo First Care Serum with 5 checks: glass weight, gold foil, Korean MFDS label, barcode, and shrink wrap.'
WHERE slug = 'how-to-tell-if-your-sulwhasoo-first-care-serum-is-fake-5-che';

UPDATE ss_content_posts SET meta_description =
'A K-beauty routine for oily skin, built on BHA, niacinamide and tea tree. Which steps actually control shine, and which to skip.'
WHERE slug = 'oily-skin-routine-guide';

UPDATE ss_content_posts SET meta_description =
'Broke out from a similar product by the same K-beauty brand? Here is why near-identical formulas react completely differently.'
WHERE slug = 'same-brand-different-formula-why-that-similar-k-beauty-product-just-wrecked-your-skin';

UPDATE ss_content_posts SET meta_description =
'Most people quit because the routine is too big. How to build a Korean skincare routine you will still be using in a year.'
WHERE slug = 'how-do-you-build-a-korean-skincare-routine-youll-actually-stick-to';

-- Confirm none remain over the cap.
SELECT slug, length(meta_description) AS len
FROM ss_content_posts WHERE length(meta_description) > 160;
