-- ss_yuri_conversations.updated_at = last ACTIVITY, not last write (Oct 10 2026)
--
-- THE HAZARD: ss_set_updated_at() stamps NOW() on every UPDATE. The memory
-- settle job (and its --apply backfill) writes summary, decision_memory and
-- settle state 3-4 times per conversation, including on failed attempts, so a
-- months-old conversation would jump to "most recent" for every reader that
-- orders by updated_at DESC: Yuri's context window + next_session_opener
-- (memory.ts loadUserContext), recent excerpts, welcome-context (last
-- conversation + opener), the sidebar (loadUserConversations), durable-memory,
-- and skin-score. memory.ts already warned that backfills touch updated_at.
--
-- WHAT COUNTS AS ACTIVITY TODAY (verified Oct 10 2026):
--   - a message insert: trigger ss_update_message_count() sets message_count
--     AND updated_at = NOW() on the conversation;
--   - saveMessage() also writes updated_at explicitly;
--   - a title change.
-- Nothing relies on a summary/memory write to bump updated_at: those writes
-- always follow a message that already bumped it.
--
-- THE FIX: a conversation-specific trigger function. If the only columns that
-- changed are memory bookkeeping, keep OLD.updated_at. If the caller set
-- updated_at explicitly (saveMessage), honour it. Anything else bumps to NOW().
--
-- Bookkeeping set (every column the extractors / settle job / learning
-- aggregation write that is not user activity):
--   summary, summary_generated_at, next_session_opener, decision_memory,
--   truncation_summary, truncation_summary_msg_count, learning_contributed,
--   memory_settled_at, memory_settle_attempts, memory_settle_next_at,
--   memory_settle_last_error
-- (`jsonb - text[]` ignores names that do not exist, so this is safe to apply
-- before or after 20261010000001.)

CREATE OR REPLACE FUNCTION public.ss_yuri_conversations_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  bookkeeping text[] := ARRAY[
    'updated_at',
    'summary', 'summary_generated_at', 'next_session_opener', 'decision_memory',
    'truncation_summary', 'truncation_summary_msg_count', 'learning_contributed',
    'memory_settled_at', 'memory_settle_attempts', 'memory_settle_next_at', 'memory_settle_last_error'
  ];
BEGIN
  IF (to_jsonb(NEW) - bookkeeping) = (to_jsonb(OLD) - bookkeeping) THEN
    -- Only bookkeeping changed. An explicit updated_at from the caller is
    -- activity (saveMessage); otherwise leave the activity time alone.
    IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
      NEW.updated_at := OLD.updated_at;
    END IF;
    RETURN NEW;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ss_yuri_conversations_updated_at ON public.ss_yuri_conversations;
CREATE TRIGGER ss_yuri_conversations_updated_at
  BEFORE UPDATE ON public.ss_yuri_conversations
  FOR EACH ROW EXECUTE FUNCTION public.ss_yuri_conversations_set_updated_at();

-- The shared ss_set_updated_at() is unchanged for every other table.

-- Presence marker the settle job checks (via RPC) before doing any live work:
-- without this trigger a settle write would bump old conversations to "recent".
CREATE OR REPLACE FUNCTION public.ss_conversation_activity_trigger_version()
RETURNS int
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$ SELECT 1 $$;
GRANT EXECUTE ON FUNCTION public.ss_conversation_activity_trigger_version() TO service_role;
--
-- Verify after applying: scripts/sql/check-conversation-updated-at.sql
-- (runs inside a transaction and ROLLS BACK; writes nothing).
