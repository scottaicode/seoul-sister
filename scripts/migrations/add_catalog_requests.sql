-- Catalog gap log — what subscribers actually own that we don't carry.
-- July 29 2026.
--
-- WHY THIS EXISTS
-- When Yuri can't find a product a user says they own, that fact currently
-- evaporates into a conversation. Nobody ever learns which products real
-- subscribers use that our catalog lacks. The 13 known cases were found only by
-- running a manual query — they were never recorded anywhere as requests.
--
-- WHAT IT IS NOT
-- Not a scraper trigger, and deliberately not wired to one. This is the
-- INSTRUMENT that makes the later "should we backfill?" decision evidence-based
-- instead of a hunch. It also captures the majority case a scraper could never
-- serve: of those 13 gaps, only 3 were Korean products Olive Young stocks. The
-- other 10 were Western (Naturium, Kiehl's, Byoma, Dr. Dennis Gross,
-- Colorescience, Hero Cosmetics) — no K-beauty scrape reaches those, but they
-- are still the honest answer to "what do our subscribers actually use?"
--
-- HONEST CAVEAT: with 3 real subscribers this table will be thin for a while.
-- It becomes decision-grade at ~50+ users. It costs almost nothing to start
-- collecting now, and it cannot tell you anything if it starts collecting later.

CREATE TABLE IF NOT EXISTS ss_catalog_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What the user called it, verbatim. Never normalized: the raw string is the
  -- evidence, and normalizing it destroys the signal about how people actually
  -- name products.
  requested_name text NOT NULL,
  requested_brand text,
  category text,

  -- Where the miss happened, so a spike in one surface is visible.
  source text NOT NULL DEFAULT 'library_save',

  -- Set when the product later appears in the catalog, so a fulfilled request
  -- stops counting as an open gap.
  fulfilled_product_id uuid REFERENCES ss_products(id) ON DELETE SET NULL,
  fulfilled_at timestamptz,

  -- Repeat asks are the ranking signal. Two people wanting the same product
  -- matters far more than one person asking twice, so user_id stays on the row.
  request_count integer NOT NULL DEFAULT 1,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per user per product name; repeat asks bump request_count.
CREATE UNIQUE INDEX IF NOT EXISTS ss_catalog_requests_user_name_uniq
  ON ss_catalog_requests (user_id, lower(requested_name));

-- The query this table exists to answer: what is most asked for and still missing?
CREATE INDEX IF NOT EXISTS ss_catalog_requests_open_idx
  ON ss_catalog_requests (request_count DESC, created_at DESC)
  WHERE fulfilled_at IS NULL;

COMMENT ON TABLE ss_catalog_requests IS
  'Products subscribers say they own that are not in ss_products. Demand evidence for catalog decisions; NOT a scraper trigger. Written from the resolver no-match path.';

-- RLS: this is operator intelligence, not user-facing. Service role only.
ALTER TABLE ss_catalog_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages catalog requests" ON ss_catalog_requests;
CREATE POLICY "service role manages catalog requests"
  ON ss_catalog_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Backfill the gaps we already know about
-- ---------------------------------------------------------------------------
-- These requests were made between May and July 2026 and were never recorded,
-- because until now there was nowhere to record them. Seeding from the existing
-- library means the table starts with real evidence instead of empty, and the
-- first ranked list is honest about what has been asked for.
--
-- Devices and routine steps are excluded ('device' category, plus the unbranded
-- rows like "Shower / cleanse" and "Moisturizer (TBD)") — no catalog contains
-- those, and counting them would inflate the very number this measures.
-- Duplicate saves of the same product collapse into request_count.

INSERT INTO ss_catalog_requests
  (user_id, requested_name, requested_brand, category, source, request_count, created_at)
SELECT
  up.user_id,
  min(up.custom_name)                AS requested_name,
  min(up.custom_brand)               AS requested_brand,
  min(up.category)                   AS category,
  'backfill_library'                 AS source,
  count(*)                           AS request_count,
  min(up.created_at)                 AS created_at
FROM ss_user_products up
WHERE up.product_id IS NULL
  AND up.custom_brand IS NOT NULL
  AND coalesce(up.category, '') <> 'device'
GROUP BY up.user_id, lower(up.custom_name)
ON CONFLICT (user_id, lower(requested_name)) DO NOTHING;

-- Verification — the ranked open-gap list:
--   SELECT requested_brand, requested_name, category, request_count,
--          count(*) OVER (PARTITION BY lower(requested_name)) AS distinct_users
--   FROM ss_catalog_requests
--   WHERE fulfilled_at IS NULL
--   ORDER BY request_count DESC, created_at DESC;
