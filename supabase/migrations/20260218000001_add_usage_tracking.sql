-- Monthly usage tracking for subscription caps
CREATE TABLE IF NOT EXISTS ss_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  yuri_messages_used INTEGER NOT NULL DEFAULT 0,
  scans_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, billing_period_start)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_ss_usage_tracking_user_period
  ON ss_usage_tracking(user_id, billing_period_start DESC);

-- RLS
ALTER TABLE ss_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "Users can view own usage"
  ON ss_usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

-- Service role manages usage (incremented via API)
CREATE POLICY "Service role manages usage"
  ON ss_usage_tracking FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE TRIGGER ss_usage_tracking_updated_at
  BEFORE UPDATE ON ss_usage_tracking
  FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
