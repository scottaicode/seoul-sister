-- Backfill widget visitor and session counters that were lost due to
-- fire-and-forget persistence being killed by Vercel function teardown.
-- Run in Supabase SQL Editor.

-- Backfill visitor total_messages from actual user messages
UPDATE ss_widget_visitors v SET
  total_messages = sub.user_messages,
  total_tool_calls = sub.tool_calls
FROM (
  SELECT
    m.visitor_id,
    COUNT(*) FILTER (WHERE m.role = 'user') as user_messages,
    COALESCE(SUM(
      CASE
        WHEN m.tool_calls IS NOT NULL AND m.tool_calls::text NOT IN ('null', '[]')
        THEN jsonb_array_length(m.tool_calls)
        ELSE 0
      END
    ), 0) as tool_calls
  FROM ss_widget_messages m
  GROUP BY m.visitor_id
) sub
WHERE v.visitor_id = sub.visitor_id;

-- Backfill session counters from actual messages per session
UPDATE ss_widget_sessions s SET
  message_count = sub.user_messages,
  tool_calls_count = sub.tool_calls
FROM (
  SELECT
    m.session_id,
    COUNT(*) FILTER (WHERE m.role = 'user') as user_messages,
    COALESCE(SUM(
      CASE
        WHEN m.tool_calls IS NOT NULL AND m.tool_calls::text NOT IN ('null', '[]')
        THEN jsonb_array_length(m.tool_calls)
        ELSE 0
      END
    ), 0) as tool_calls
  FROM ss_widget_messages m
  GROUP BY m.session_id
) sub
WHERE s.id = sub.session_id;
