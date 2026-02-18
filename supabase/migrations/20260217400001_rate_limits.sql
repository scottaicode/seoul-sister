-- Rate limiting table for serverless-compatible rate limiting
-- Replaces in-memory Map that resets on Vercel cold starts
--
-- Apply this migration when Supabase project is in read-write mode:
--   Supabase Dashboard > SQL Editor > paste and run

CREATE TABLE IF NOT EXISTS ss_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ss_rate_limits_window_start ON ss_rate_limits (window_start);

-- Atomic check-and-increment function
-- Returns whether the request is allowed, remaining count, and ms until reset
CREATE OR REPLACE FUNCTION ss_check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_ms INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_in_ms INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_entry RECORD;
  v_elapsed_ms INTEGER;
BEGIN
  -- Try to get existing entry with row lock
  SELECT rl.count, rl.window_start, rl.window_ms
    INTO v_entry
    FROM ss_rate_limits rl
   WHERE rl.key = p_key
     FOR UPDATE;

  IF NOT FOUND THEN
    -- First request for this key
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

  -- Check if window has expired
  v_elapsed_ms := EXTRACT(EPOCH FROM (v_now - v_entry.window_start)) * 1000;

  IF v_elapsed_ms >= v_entry.window_ms THEN
    -- Window expired, reset
    UPDATE ss_rate_limits
       SET count = 1, window_start = v_now, window_ms = p_window_ms
     WHERE ss_rate_limits.key = p_key;

    allowed := TRUE;
    remaining := p_max_requests - 1;
    reset_in_ms := p_window_ms;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Window still active
  IF v_entry.count >= p_max_requests THEN
    -- Rate limited
    allowed := FALSE;
    remaining := 0;
    reset_in_ms := v_entry.window_ms - v_elapsed_ms;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Increment count
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

-- Cleanup function for expired entries (call periodically or via cron)
CREATE OR REPLACE FUNCTION ss_cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM ss_rate_limits
   WHERE window_start + (window_ms || ' milliseconds')::INTERVAL < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
