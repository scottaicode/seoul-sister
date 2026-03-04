-- Historical archive of daily trending product snapshots.
-- ss_trending_products stays as the "live" view (current rankings).
-- ss_trending_history accumulates daily snapshots for trend analysis,
-- learning engine patterns, and historical queries.

CREATE TABLE IF NOT EXISTS ss_trending_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES ss_products(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  source_product_name TEXT,
  source_product_brand TEXT,
  source_url TEXT,
  trend_score INTEGER DEFAULT 0,
  mention_count INTEGER DEFAULT 0,
  sentiment_score NUMERIC(3,2),
  rank_position INTEGER,
  rank_change INTEGER,
  days_on_list INTEGER DEFAULT 1,
  gap_score INTEGER DEFAULT 0,
  data_date DATE NOT NULL,
  raw_data JSONB,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition-friendly indexes
CREATE INDEX IF NOT EXISTS idx_trending_history_source_date
  ON ss_trending_history(source, data_date DESC);

CREATE INDEX IF NOT EXISTS idx_trending_history_product_date
  ON ss_trending_history(product_id, data_date DESC)
  WHERE product_id IS NOT NULL;

-- Prevent duplicate snapshots (same product+source+date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_history_unique_snapshot
  ON ss_trending_history(source, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(source_product_name, ''), data_date);

-- RLS: public read (trending data is not user-specific)
ALTER TABLE ss_trending_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trending history"
  ON ss_trending_history FOR SELECT USING (true);

CREATE POLICY "Service role manages trending history"
  ON ss_trending_history FOR ALL
  USING ((select auth.role()) = 'service_role');
