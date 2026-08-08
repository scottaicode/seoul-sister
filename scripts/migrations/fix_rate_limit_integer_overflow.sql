-- Rate limiter: widen the millisecond window from INTEGER to BIGINT.
--
-- Aug 7 2026. The 30-day preview backstop has never enforced anything.
--
-- WHAT BROKE: `PREVIEW_IP_WINDOW = 30 * 24 * 60 * 60 * 1000` = 2,592,000,000.
-- Postgres INTEGER maxes at 2,147,483,647. Every call carrying a 30-day window
-- raised `value "2592000000" is out of range for type integer` — visible in the
-- Postgres log at 2026-08-07T21:57:27Z, and on every prior preview message.
--
-- WHY NOBODY NOTICED: `checkRateLimit` wraps the RPC in try/catch and falls back
-- to an in-memory limiter on ANY error. In-memory state does not survive a Vercel
-- invocation, so the fallback returns `allowed: true` essentially always. The
-- 40-messages-per-IP-per-30-day backstop that v11.9.0 shipped to close the
-- device-switch quota reset has been failing OPEN since it was written. A dead
-- check and a clean check left identical state — the exact silent-failure class
-- CLAUDE.md warns about.
--
-- The 24h windows (86,400,000) fit in INTEGER and were always fine, which is why
-- the per-IP daily limit and the circuit breaker kept working. Only the two
-- 30-day windows overflowed.
--
-- THREE places carry the value; widening fewer than all three just moves the
-- overflow:
--   1. ss_rate_limits.window_ms   (stored)
--   2. p_window_ms                (parameter)
--   3. v_elapsed_ms               (local, computed from EXTRACT EPOCH * 1000)
--
-- v_elapsed_ms is the subtle one: it holds elapsed milliseconds, which for a
-- 30-day window legitimately reaches 2.59e9 near expiry and would overflow on
-- assignment even with the other two widened.
--
-- Idempotent — safe to re-run.

ALTER TABLE ss_rate_limits
  ALTER COLUMN window_ms TYPE BIGINT;

-- The parameter type is part of the signature, so the old INTEGER overload must
-- go or PostgREST may keep resolving to it.
DROP FUNCTION IF EXISTS ss_check_rate_limit(text, integer, integer);

CREATE OR REPLACE FUNCTION ss_check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_ms BIGINT
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reset_in_ms BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_entry RECORD;
  v_elapsed_ms BIGINT;
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

-- Proof the fix holds: a 30-day window must now round-trip. This SELECT is the
-- check, not a change. If it raises, the overflow is still live.
DO $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  SELECT allowed INTO v_allowed
  FROM ss_check_rate_limit('__migration_selftest__', 5, 2592000000::BIGINT);

  IF v_allowed IS NULL THEN
    RAISE EXCEPTION 'ss_check_rate_limit returned no row for a 30-day window';
  END IF;

  DELETE FROM ss_rate_limits WHERE key = '__migration_selftest__';
END $$;
