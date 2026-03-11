-- ============================================================
-- Phase 14.1: Widget Conversation Persistence Layer
-- Replaces shallow ss_widget_analytics with full message storage
-- ============================================================

-- 1. Persistent anonymous visitor identity
CREATE TABLE ss_widget_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL UNIQUE,
  ip_hash TEXT,
  user_agent_hash TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_messages INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_tool_calls INTEGER NOT NULL DEFAULT 0,
  ai_memory JSONB DEFAULT '{}',
  converted_at TIMESTAMPTZ,
  converted_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_visitors_visitor_id ON ss_widget_visitors(visitor_id);
CREATE INDEX idx_widget_visitors_last_seen ON ss_widget_visitors(last_seen_at DESC);
CREATE INDEX idx_widget_visitors_converted ON ss_widget_visitors(converted_user_id) WHERE converted_user_id IS NOT NULL;

-- 2. Widget conversation sessions (created on first message, not page load)
CREATE TABLE ss_widget_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL REFERENCES ss_widget_visitors(visitor_id),
  session_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,
  tool_calls_count INTEGER NOT NULL DEFAULT 0,
  specialist_domains_detected TEXT[] DEFAULT '{}',
  intent_signals_detected TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  ended_naturally BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_sessions_visitor ON ss_widget_sessions(visitor_id, started_at DESC);
CREATE INDEX idx_widget_sessions_recent ON ss_widget_sessions(started_at DESC);

-- 3. Widget messages (every message stored with tool call logging)
CREATE TABLE ss_widget_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ss_widget_sessions(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  specialist_detected TEXT,
  intent_signals TEXT[] DEFAULT '{}',
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_messages_session ON ss_widget_messages(session_id, created_at);
CREATE INDEX idx_widget_messages_visitor ON ss_widget_messages(visitor_id, created_at DESC);

-- 4. Intent signals — individual signal events for analytics
CREATE TABLE ss_widget_intent_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL REFERENCES ss_widget_visitors(visitor_id),
  session_id UUID NOT NULL REFERENCES ss_widget_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES ss_widget_messages(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_signals_visitor ON ss_widget_intent_signals(visitor_id, created_at DESC);
CREATE INDEX idx_widget_signals_type ON ss_widget_intent_signals(signal_type, created_at DESC);

-- RLS Policies
ALTER TABLE ss_widget_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_widget_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_widget_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_widget_intent_signals ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role manages widget visitors"
  ON ss_widget_visitors FOR ALL
  USING ((select auth.role()) = 'service_role');

CREATE POLICY "Service role manages widget sessions"
  ON ss_widget_sessions FOR ALL
  USING ((select auth.role()) = 'service_role');

CREATE POLICY "Service role manages widget messages"
  ON ss_widget_messages FOR ALL
  USING ((select auth.role()) = 'service_role');

CREATE POLICY "Service role manages widget signals"
  ON ss_widget_intent_signals FOR ALL
  USING ((select auth.role()) = 'service_role');

-- Admin users can read (for dashboard)
CREATE POLICY "Admins can read widget visitors"
  ON ss_widget_visitors FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));

CREATE POLICY "Admins can read widget sessions"
  ON ss_widget_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));

CREATE POLICY "Admins can read widget messages"
  ON ss_widget_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));

CREATE POLICY "Admins can read widget signals"
  ON ss_widget_intent_signals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));

-- Updated_at trigger for visitors
CREATE TRIGGER set_widget_visitors_updated
  BEFORE UPDATE ON ss_widget_visitors
  FOR EACH ROW
  EXECUTE FUNCTION ss_set_updated_at();
