-- =============================================================================
-- Phase 6: Learning Engine & Automation
-- Enhances existing learning tables + adds new tables for routine outcomes,
-- price history, and richer trend signals
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enhance ss_learning_patterns with richer filters
-- ---------------------------------------------------------------------------
ALTER TABLE ss_learning_patterns
  ADD COLUMN IF NOT EXISTS concern_filter TEXT,
  ADD COLUMN IF NOT EXISTS pattern_description TEXT;

-- ---------------------------------------------------------------------------
-- 2. Enhance ss_ingredient_effectiveness with report counts
-- ---------------------------------------------------------------------------
ALTER TABLE ss_ingredient_effectiveness
  ADD COLUMN IF NOT EXISTS positive_reports INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negative_reports INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS neutral_reports  INT NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 3. New: ss_routine_outcomes - track routine results over time
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ss_routine_outcomes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    routine             JSONB NOT NULL,
    skin_type           TEXT,
    concerns            TEXT[] NOT NULL DEFAULT '{}',
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome_reported_at TIMESTAMPTZ,
    outcome_score       INT CHECK (outcome_score BETWEEN 1 AND 5),
    outcome_notes       TEXT,
    before_photo_url    TEXT,
    after_photo_url     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. New: ss_price_history - historical price tracking for trends
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ss_price_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    retailer    TEXT NOT NULL,
    price       DECIMAL(10, 2) NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'USD',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 5. Enhance ss_trend_signals with richer fields
-- ---------------------------------------------------------------------------
ALTER TABLE ss_trend_signals
  ADD COLUMN IF NOT EXISTS trend_name  TEXT,
  ADD COLUMN IF NOT EXISTS trend_type  TEXT,
  ADD COLUMN IF NOT EXISTS first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS peak_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status      TEXT DEFAULT 'emerging';

-- ---------------------------------------------------------------------------
-- 6. Add learning_contributed flag to reviews and conversations
-- ---------------------------------------------------------------------------
ALTER TABLE ss_reviews
  ADD COLUMN IF NOT EXISTS learning_contributed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ss_yuri_conversations
  ADD COLUMN IF NOT EXISTS learning_contributed BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE ss_routine_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own routine outcomes"
  ON ss_routine_outcomes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users read price history"
  ON ss_price_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role inserts price history"
  ON ss_price_history FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 8. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_routine_outcomes_user ON ss_routine_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_outcomes_skin_type ON ss_routine_outcomes(skin_type);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON ss_price_history(product_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON ss_price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_signals_status ON ss_trend_signals(status);
CREATE INDEX IF NOT EXISTS idx_trend_signals_trend_type ON ss_trend_signals(trend_type);
CREATE INDEX IF NOT EXISTS idx_reviews_learning ON ss_reviews(learning_contributed) WHERE NOT learning_contributed;
CREATE INDEX IF NOT EXISTS idx_conversations_learning ON ss_yuri_conversations(learning_contributed) WHERE NOT learning_contributed;
CREATE INDEX IF NOT EXISTS idx_learning_patterns_type ON ss_learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_learning_patterns_skin ON ss_learning_patterns(skin_type);

-- ---------------------------------------------------------------------------
-- 9. Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ingredient_effectiveness_updated ON ss_ingredient_effectiveness;
CREATE TRIGGER trg_ingredient_effectiveness_updated
  BEFORE UPDATE ON ss_ingredient_effectiveness
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_learning_patterns_updated ON ss_learning_patterns;
CREATE TRIGGER trg_learning_patterns_updated
  BEFORE UPDATE ON ss_learning_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
