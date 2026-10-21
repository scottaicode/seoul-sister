-- Olive Young Global stopped shipping to US addresses on May 29 2026, when
-- Olive Young US (us.oliveyoung.com) launched. Our "Olive Young" retailer row
-- (4,908 price links) has pointed US shoppers at a store that refuses to ship
-- to them ever since. Record shipping reach as DATA so every surface (Yuri's
-- tools, product pages, the LGAAS price endpoint) reads one fact instead of
-- re-deriving it from a name.
--
-- ships_to_us: NULL means unknown. It is a fact for Yuri to weigh, not a filter.

ALTER TABLE ss_retailers ADD COLUMN IF NOT EXISTS ships_to_us boolean;

COMMENT ON COLUMN ss_retailers.ships_to_us IS
  'Whether the retailer delivers to US addresses. NULL = unknown. A fact surfaced to Yuri and UI, never a filter.';

-- The existing row is the Global store. Name it for what it is.
UPDATE ss_retailers
SET name = 'Olive Young Global',
    ships_to_us = false,
    verification_notes = coalesce(verification_notes || ' | ', '')
      || 'Stopped shipping to the US May 29 2026; US shoppers are redirected to us.oliveyoung.com (verified on global.oliveyoung.com Oct 21 2026).'
WHERE website = 'https://global.oliveyoung.com';

UPDATE ss_retailers SET ships_to_us = true
WHERE name IN ('Soko Glam', 'iHerb', 'YesStyle', 'StyleKorean', 'Stylevana', 'Amazon');

INSERT INTO ss_retailers (name, website, country, trust_score, ships_international, affiliate_program,
                          is_authorized, risk_level, verification_notes, counterfeit_report_count, ships_to_us, last_verified_at)
SELECT 'Olive Young US', 'https://us.oliveyoung.com', 'United States', 95, false, false,
       true, 'low',
       'Olive Young''s own US store (CJ OLIVE YOUNG USA Inc.), launched May 29 2026. Sells US-compliant formulas; US sunscreens use FDA-approved filters.',
       0, true, now()
WHERE NOT EXISTS (SELECT 1 FROM ss_retailers WHERE website = 'https://us.oliveyoung.com');
