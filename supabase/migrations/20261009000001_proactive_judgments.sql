-- Yuri Wakes Up First — the proactive-judgment ledger (Oct 9 2026)
--
-- One row per decision Yuri makes about reaching out FIRST: to a captured lead
-- (one re-engagement email, ever) or to a subscriber (a routine-timed check-in).
-- SILENCE IS A ROW. A day where Yuri judged there was nothing worth saying
-- writes decision='silent' with her reason, so "nothing to send" is never
-- indistinguishable from "didn't run" (ss_pipeline_runs carries the run row).
--
-- Learning loop (LEARNING-LOOP-BLUEPRINT.md):
--   1. judgment   — decision, signal, reasoning, confidence, message (dated)
--   2. teacher    — grade: did they come back (chat restart / reply), convert,
--                   unsubscribe, or not respond. Objective rows, no self-report.
--                   retained_30d: was a subscriber still active 30 days later.
--   3. feedback   — the graded rows are read back into Yuri's next judgment
--                   (src/lib/proactive/ledger.ts → calibrationFacts).
--
-- Additive only. Apply by hand in Supabase Studio (MCP is read-only), then
-- verify with the query at the bottom.

CREATE TABLE IF NOT EXISTS ss_proactive_judgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience TEXT NOT NULL CHECK (audience IN ('lead', 'subscriber')),
  -- 'lead_reengage_v1' (one email per lead, ever) | 'subscriber_checkin'
  campaign TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nurture_lead_id UUID REFERENCES ss_nurture_leads(id) ON DELETE CASCADE,
  widget_visitor_id TEXT,
  -- 'blocked' = Yuri chose to speak; the closed-world content guard refused the
  -- draft (content-guard.ts). The draft and reasons are kept; graded 'blocked'.
  decision TEXT NOT NULL CHECK (decision IN ('speak', 'silent', 'failed', 'blocked')),
  -- Yuri's own short label for what prompted her (free text, model-chosen).
  signal TEXT,
  reasoning TEXT,
  confidence NUMERIC CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  subject TEXT,
  message TEXT,
  suggested_ask TEXT,
  model TEXT,
  -- Deterministic facts at decision time that the grader needs later (e.g.
  -- nudge_email_opt_out at send, free-preview messages left, promise state).
  context_facts JSONB,
  -- Delivery (subscriber check-ins also create an ss_user_nudges row so the
  -- dashboard card + existing email adapter + acted tracking all apply).
  nudge_id UUID REFERENCES ss_user_nudges(id) ON DELETE SET NULL,
  delivery_status TEXT,
  provider_id TEXT,
  sent_at TIMESTAMPTZ,
  -- ?from= slug on the CTA link. ss_widget_sessions.source records it only when
  -- the click starts a NEW widget session (in practice: a different device or
  -- cleared storage). Same-device returns resume the old session and are
  -- graded instead by ss_widget_messages on the same visitor_id.
  attribution_tag TEXT,
  -- Teacher
  grade TEXT CHECK (grade IS NULL OR grade IN ('converted', 'engaged', 'unsubscribed', 'no_response', 'undelivered', 'blocked')),
  grade_evidence JSONB,
  graded_at TIMESTAMPTZ,
  retained_30d BOOLEAN,
  retention_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Never double-send: a lead gets at most one decided judgment per campaign.
-- The runner INSERTS this row before sending, so a concurrent or repeated run
-- hits the conflict and skips. 'failed' rows are excluded so a generation error
-- can be retried; a crash after insert leaves delivery_status 'sending' and the
-- lead is never retried (the safe direction).
CREATE UNIQUE INDEX IF NOT EXISTS uq_proactive_lead_once
  ON ss_proactive_judgments (nurture_lead_id, campaign)
  WHERE audience = 'lead' AND decision IN ('speak', 'silent', 'blocked');

-- Subscriber idempotency: at most one decided check-in judgment per user per
-- local calendar day. Two overlapping invocations (a retry plus a manual run)
-- both pass the read-before-insert gate; this makes the second insert 23505,
-- which the runner treats as "already judged" before any nudge or email exists.
CREATE UNIQUE INDEX IF NOT EXISTS uq_proactive_checkin_daily
  ON ss_proactive_judgments (user_id, campaign, (context_facts->>'local_date'))
  WHERE audience = 'subscriber' AND decision IN ('speak', 'silent', 'blocked');

CREATE INDEX IF NOT EXISTS idx_proactive_user_created
  ON ss_proactive_judgments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proactive_ungraded
  ON ss_proactive_judgments (audience, sent_at)
  WHERE decision = 'speak' AND grade IS NULL;
CREATE INDEX IF NOT EXISTS idx_proactive_provider
  ON ss_proactive_judgments (provider_id)
  WHERE provider_id IS NOT NULL;

ALTER TABLE ss_proactive_judgments ENABLE ROW LEVEL SECURITY;
-- No policies: service role only (cron writes, admin API reads via service client).

-- Verify:
-- SELECT count(*) FROM information_schema.columns WHERE table_name = 'ss_proactive_judgments';  -- expect 26
-- SELECT indexname FROM pg_indexes WHERE tablename = 'ss_proactive_judgments';                  -- expect 6 incl. pkey
