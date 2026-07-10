-- Remove price rows from retailers that have NO working scraper and are frozen
-- at the Feb 17 2026 seed (Amazon, Stylevana, iHerb). A 5-month-old price is not
-- a real deal; compare_prices picks best_deal by lowest price, so a stale-cheap
-- row could win and lead Yuri to quote a price that no longer exists (only then
-- disclosing its age). Honesty hygiene — same class as the v10.8.19 fake-URL
-- cleanup.
--
-- Safe: every affected product retains >=1 row from a scraped retailer
-- (Olive Young / YesStyle / Soko Glam), so no product is orphaned. The
-- search_products tool also falls back to inline price_usd, so pricing is never
-- blank. As of Jul 10 2026 this removes 15 rows (10 Amazon, 4 Stylevana, 1 iHerb).

DELETE FROM ss_product_prices pp
USING ss_retailers r
WHERE pp.retailer_id = r.id
  AND r.name IN ('Amazon', 'Stylevana', 'iHerb');
