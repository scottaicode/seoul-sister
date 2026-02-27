-- Fix 1: Drop ghost no-argument overload of ss_check_rate_limit
-- This zero-arg version can intercept RPC calls and cause silent failures
DROP FUNCTION IF EXISTS public.ss_check_rate_limit();

-- Fix 1b: Recreate the real function as SECURITY DEFINER
-- Previously SECURITY INVOKER — relied on caller having RLS permissions.
-- SECURITY DEFINER ensures the function always bypasses RLS, which is
-- necessary because the widget route is anonymous (no auth context).
CREATE OR REPLACE FUNCTION ss_check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_in_ms INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_entry RECORD;
  v_elapsed_ms INTEGER;
BEGIN
  SELECT rl.count, rl.window_start, rl.window_ms
    INTO v_entry
    FROM ss_rate_limits rl
   WHERE rl.key = p_key
     FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO ss_rate_limits (key, count, window_start, window_ms)
    VALUES (p_key, 1, v_now, p_window_ms)
    ON CONFLICT (key) DO UPDATE
      SET count = 1, window_start = v_now, window_ms = p_window_ms;

    allowed := TRUE;
    remaining := p_max_requests - 1;
    reset_in_ms := p_window_ms;
    RETURN NEXT;
    RETURN;
  END IF;

  v_elapsed_ms := EXTRACT(EPOCH FROM (v_now - v_entry.window_start)) * 1000;

  IF v_elapsed_ms >= v_entry.window_ms THEN
    UPDATE ss_rate_limits
       SET count = 1, window_start = v_now, window_ms = p_window_ms
     WHERE ss_rate_limits.key = p_key;

    allowed := TRUE;
    remaining := p_max_requests - 1;
    reset_in_ms := p_window_ms;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_entry.count >= p_max_requests THEN
    allowed := FALSE;
    remaining := 0;
    reset_in_ms := v_entry.window_ms - v_elapsed_ms;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE ss_rate_limits
     SET count = count + 1
   WHERE ss_rate_limits.key = p_key;

  allowed := TRUE;
  remaining := p_max_requests - (v_entry.count + 1);
  reset_in_ms := v_entry.window_ms - v_elapsed_ms;
  RETURN NEXT;
  RETURN;
END;
$$;

-- Fix 5: Widget analytics table for conversion tracking
-- Lightweight: stores only aggregated session data, no PII beyond IP hash
CREATE TABLE IF NOT EXISTS ss_widget_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash TEXT NOT NULL,          -- hash of IP + UA (no raw PII)
  messages_sent INTEGER NOT NULL DEFAULT 1,
  first_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted BOOLEAN NOT NULL DEFAULT FALSE,  -- did they click signup?
  tool_calls_made INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying recent analytics
CREATE INDEX IF NOT EXISTS idx_widget_analytics_created
  ON ss_widget_analytics(created_at DESC);

-- Index for session upsert
CREATE INDEX IF NOT EXISTS idx_widget_analytics_session
  ON ss_widget_analytics(session_hash);

-- No RLS needed — service role only writes, admin reads
-- But enable RLS and add service-role policy for defense in depth
ALTER TABLE ss_widget_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages widget analytics"
  ON ss_widget_analytics
  FOR ALL
  USING (auth.role() = 'service_role');
