-- Retailer recommendation policy (Jul 23 2026)
--
-- Demote YesStyle / StyleKorean / Stylevana as BUY destinations on service/fulfillment
-- grounds (slow shipping, poor refund recourse) after a real user's bad YesStyle order
-- (2-month non-delivery, refund fight). These retailers sell AUTHENTIC product — this is
-- NOT a counterfeit concern. `trust_score` here reflects buy-reliability, and Yuri reads
-- her recommend/don't-recommend guidance from the system prompt ("Where to Send People to
-- Buy"); this DB change keeps the data consistent with that prompt.
--
-- Rows are intentionally NOT deleted: price data stays visible (display != recommend).
-- Only the recommendation ranking changes. iHerb is promoted into the recommend-set.
--
-- Recommend-set: Olive Young Global (95), Soko Glam (90), iHerb (88).
-- Demoted (authentic, poor service): YesStyle (60), StyleKorean (60), Stylevana (55).
-- Amazon (70) unchanged — its risk is counterfeit (risk_level=medium), a separate axis.

UPDATE ss_retailers
SET trust_score = 88,
    verification_notes = 'US-based retailer with fast domestic fulfillment (climate-controlled warehouses). Authentic K-beauty staples. Recommended buy destination.'
WHERE name = 'iHerb';

UPDATE ss_retailers
SET trust_score = 60,
    verification_notes = COALESCE(verification_notes, '') || ' DEMOTED (Jul 2026): authentic product, NOT a counterfeit risk, but slow shipping (weeks-to-months) and poor refund recourse (non-refundable shipping, store-credit-only). Show price as data; do NOT recommend as a buy destination — steer to Olive Young Global / Soko Glam / iHerb.'
WHERE name = 'YesStyle';

UPDATE ss_retailers
SET trust_score = 60,
    verification_notes = COALESCE(verification_notes, 'Korean-based K-beauty retailer, international shipping, authorized for major brands.') || ' DEMOTED (Jul 2026): authentic but slow shipping and weak service (Trustpilot ~2.1). Show price as data; do NOT recommend as a buy destination.'
WHERE name = 'StyleKorean';

UPDATE ss_retailers
SET trust_score = 55,
    verification_notes = COALESCE(verification_notes, 'Asian beauty discount retailer.') || ' DEMOTED (Jul 2026): authentic but worst-in-class service (Trustpilot ~2.0, non-delivery/refund complaints). Show price as data; do NOT recommend as a buy destination.'
WHERE name = 'Stylevana';
