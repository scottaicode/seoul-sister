-- Recap email content audit — make "what did we actually send?" a query.
--
-- WHY (Aug 17 2026). The lead recap email is the surface that converted the
-- only paying subscriber this funnel has produced, it is written fresh by Opus
-- on every send, and it carries its own explicit scope rule
-- (`src/lib/email/lead-email.ts` — "NOT a complete take-home routine... do NOT
-- compile a full AM/PM routine, a multi-week schedule, or a complete shopping
-- list"). Its subject and body were generated, sent, and then DISCARDED. Only
-- `recap_status` and the Resend message id survived.
--
-- So an email that violated its own scope and one that obeyed it perfectly left
-- IDENTICAL database state. That is the fourth of the four questions failing on
-- a customer-facing artifact: "nothing wrong" and "nothing checked" were
-- indistinguishable, permanently.
--
-- Sharper still: the recap is a SEPARATE Opus call from a SEPARATE prompt, so
-- every give-side instrument built to date (cumulative-give, tool-grounding)
-- watches only the CHAT. If the over-giving leak is in the email, none of them
-- can see it.
--
-- This is observability ONLY. Nothing about what Yuri sends changes.
--
-- PRIVACY NOTE: recap_body_html stores the content of an email sent to a
-- visitor who gave us their address for exactly that purpose. It contains our
-- own advice, not their personal data beyond what they told us in chat (already
-- stored in ss_widget_messages). Retention should follow the same policy as the
-- transcript itself.

ALTER TABLE ss_widget_visitors
  ADD COLUMN IF NOT EXISTS recap_subject text,
  ADD COLUMN IF NOT EXISTS recap_body_html text,
  -- Yuri's own one-line justification, which she already writes on every
  -- decision and which was also being thrown away. A suppressed send with no
  -- recorded reason is another silent state.
  ADD COLUMN IF NOT EXISTS recap_reason text,
  -- Which artifacts of "the complete build" the SENT email contained, scored by
  -- the same detector used on the chat side (src/lib/widget/cumulative-give.ts)
  -- so the two surfaces are measured on one ruler rather than two.
  ADD COLUMN IF NOT EXISTS recap_artifacts jsonb;

COMMENT ON COLUMN ss_widget_visitors.recap_body_html IS
  'The recap email body as actually sent. Without it, a scope violation and a clean send are indistinguishable.';
COMMENT ON COLUMN ss_widget_visitors.recap_artifacts IS
  'Artifacts of the complete build detected in the sent email, via detectCumulativeGive. {"count":N,"artifacts":[...]}';

-- Answering the question this exists for:
--   SELECT captured_email, recap_artifacts->>'count' AS artifacts, recap_subject
--   FROM ss_widget_visitors
--   WHERE recap_status IN ('sent','delivered')
--     AND (recap_artifacts->>'count')::int >= 2
--   ORDER BY recap_sent_at DESC;

-- ---------------------------------------------------------------------------
-- Queryable watch-for row (run AFTER the ALTER above).
--
-- Per CLAUDE.md: "Deliberate deferrals must be visible in DATA, not only in a
-- doc." This audit is schema-applied and code-deployed but has ZERO production
-- rows — it fires only when a visitor captures an email. A pending
-- verification recorded only in markdown is indistinguishable from a gap six
-- weeks later, which is exactly how a deferred loop got described as working.
--
-- Close it by re-running the audit query in RECAP-AUDIT-VERIFICATION.md and
-- confirming at least one row has recap_body_html IS NOT NULL.
INSERT INTO ss_pipeline_runs (source, run_type, status, started_at, completed_at, metadata)
VALUES (
  'widget',
  'reprocess',
  'completed',
  now(),
  now(),
  jsonb_build_object(
    'deferral_key', 'recap_body_audit_unverified',
    'opened', '2026-08-17',
    'doc', 'RECAP-AUDIT-VERIFICATION.md',
    'state', 'schema applied + code deployed, zero production rows',
    'closes_when', 'any ss_widget_visitors row has recap_body_html IS NOT NULL',
    'fires_on', 'next widget email capture — no cron, no manual trigger that would count'
  )
);

-- ---------------------------------------------------------------------------
-- CLOSED Aug 17 2026 — verified the same day it was opened.
--
-- The row that closed it: a real widget conversation captured
-- glowframeai@gmail.com, and the recap stored body (1,532 chars), subject,
-- reason and an artifact score. Real capture path, not a hand invocation.
--
-- RESULT: the email HELD its documented scope. One priority given completely,
-- the rotation schedule explicitly withheld and named as subscriber work, no
-- AM/PM sequence, anti-selling intact. The cow did not leave in the email.
--
-- CAVEAT worth carrying: the artifact SCORE was 2 and both were false
-- positives. `detectCumulativeGive` was built for chat prose, where naming
-- products means recommending them; in a recap, naming products is how you
-- remind someone what you discussed. Read the body, not just the count.
UPDATE ss_pipeline_runs
SET metadata = metadata || jsonb_build_object(
  'closed', '2026-08-17',
  'closed_by_row', 'glowframeai@gmail.com recap, body_stored=true, 1532 chars',
  'result', 'email held its scope — one priority given, rotation schedule withheld and named as subscriber work',
  'caveat', 'artifact score of 2 was both false positives; detector is chat-tuned, read the body'
)
WHERE metadata->>'deferral_key' = 'recap_body_audit_unverified';
