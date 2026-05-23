-- v10.8.0 Path B — Products as Yuri's Shortlist
-- ===============================================================
-- Caches Opus 4.7 reasoning for product fit/skip verdicts.
-- Keyed by (user_id, product_id, cache_key_hash) so reasoning
-- invalidates automatically when the user's load-bearing state
-- changes (active phase, decision_memory, allergens, watch_for).
--
-- Authored: May 22 2026.
-- Triggered by: Bailey iMessage feedback May 20-22 2026 (Products
-- feature feels generic vs Ingredients feature).
-- Architecture: PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md
-- ===============================================================

CREATE TABLE IF NOT EXISTS ss_product_curation_reasoning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,

  -- Deterministic hash over: skin_type + allergens + active_phase_id
  -- + decision_memory.corrections + decision_memory.decisions(phase-relevant)
  -- + watch_for items. When user's state changes meaningfully, this
  -- changes, and the cache row becomes a no-match for future lookups
  -- (automatic invalidation).
  cache_key_hash TEXT NOT NULL,

  verdict TEXT NOT NULL CHECK (verdict IN ('fits', 'skip', 'neutral')),
  reasoning_text TEXT NOT NULL,

  -- Which specific watch_for items, allergens, or excluded substances
  -- this product touched. Pure observational metadata for telemetry
  -- + future learning. Example shape:
  --   [{ "type": "watch_for", "item": "BHA on cheeks 6+ days/wk", "matched_ingredient": "Salicylic Acid" }]
  matched_items JSONB DEFAULT '[]'::jsonb,

  model TEXT NOT NULL DEFAULT 'claude-opus-4-7',
  input_tokens INTEGER,
  output_tokens INTEGER,

  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft TTL for reformulation drift safety. K-beauty brands reformulate
  -- every 2-3 years; 60 days catches the common reformulation cadence
  -- without forcing constant regeneration.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),

  -- One row per (user, product, state-hash) combination.
  -- A new state-hash for the same (user, product) writes a new row;
  -- the old row stays as historical record until expires_at.
  UNIQUE (user_id, product_id, cache_key_hash)
);

-- Lookup index: cache hit query against (user, product, hash)
CREATE INDEX IF NOT EXISTS idx_curation_lookup
  ON ss_product_curation_reasoning(user_id, product_id, cache_key_hash);

-- Recent-activity index for admin observability + telemetry queries
CREATE INDEX IF NOT EXISTS idx_curation_user_recent
  ON ss_product_curation_reasoning(user_id, generated_at DESC);

-- Expiry index for future cleanup cron
CREATE INDEX IF NOT EXISTS idx_curation_expires
  ON ss_product_curation_reasoning(expires_at);

-- RLS — users read their own; service role manages everything
ALTER TABLE ss_product_curation_reasoning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own curation reasoning"
  ON ss_product_curation_reasoning FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Service role manages curation reasoning"
  ON ss_product_curation_reasoning FOR ALL
  USING ((SELECT auth.role()) = 'service_role');

COMMENT ON TABLE ss_product_curation_reasoning IS
  'v10.8.0 Path B — caches Opus 4.7 reasoning for /browse skip explanations. '
  'Keyed by user + product + state-hash so it auto-invalidates when phase or '
  'decision_memory changes. See PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md.';
