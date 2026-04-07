-- AI Usage Tracking Table
-- Logs every Claude API call for cost visibility and optimization.
-- Adapted from LGAAS utils/ai-usage-logger.js pattern.

CREATE TABLE IF NOT EXISTS ss_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  conversation_id UUID,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ss_ai_usage(feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ss_ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ss_ai_usage(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE ss_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ai usage"
  ON ss_ai_usage FOR ALL
  USING ((select auth.role()) = 'service_role');

CREATE POLICY "Admins can read ai usage"
  ON ss_ai_usage FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));
