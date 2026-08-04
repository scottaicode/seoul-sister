-- v11.23.0 — Email delivery channel for proactive nudges.
--
-- WHY: the nudge engine has been generating good, well-timed messages and
-- delivering none of them. A nudge only renders on the dashboard, so it waits
-- for the user to return in order to deliver a message whose entire purpose is
-- getting them to return. Two paying subscribers each have an unsent nudge
-- (Kim, Jul 28; Caroline, Aug 3) while neither has signed in for days.
--
-- PROACTIVE-NUDGE-BLUEPRINT.md:191 anticipated exactly this: "the cron + ledger
-- are channel-agnostic; push is a later delivery adapter on the same
-- ss_user_nudges rows." Email is that adapter.
--
-- DESIGN NOTE (load-bearing): channel state lives on its OWN columns, never on
-- `status`. /api/me/nudge selects WHERE status = 'pending', and YuriNudgeCard
-- flips pending -> surfaced on render. If a send moved `status`, the dashboard
-- card would silently never appear for an emailed nudge — the email would
-- CANNIBALIZE the in-app surface instead of complementing it. Both channels
-- must be able to deliver the same row independently.
--
-- Mirrors the proven ss_widget_visitors.recap_* observability pattern
-- (LEAD-EMAIL-OBSERVABILITY.md) so "did this subscriber actually get it" is a
-- one-line query rather than a Resend dashboard login.

-- ---------------------------------------------------------------------------
-- Delivery columns on ss_user_nudges
-- ---------------------------------------------------------------------------

ALTER TABLE ss_user_nudges
  ADD COLUMN IF NOT EXISTS email_status TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS email_status_updated_at TIMESTAMPTZ;

-- Status vocabulary intentionally mirrors RecapStatus so the two delivery
-- ledgers read the same way:
--   sent            -> handed to Resend successfully
--   send_failed     -> Resend rejected it or the call threw
--   no_provider     -> RESEND_API_KEY unset (graceful no-op, not a failure)
--   no_address      -> could not resolve the subscriber's email address
--   suppressed      -> user opted out of nudge emails
--   delivered/bounced/complained -> from the Resend webhook, after the fact
ALTER TABLE ss_user_nudges
  DROP CONSTRAINT IF EXISTS ss_user_nudges_email_status_check;
ALTER TABLE ss_user_nudges
  ADD CONSTRAINT ss_user_nudges_email_status_check
  CHECK (
    email_status IS NULL OR email_status IN (
      'sent', 'send_failed', 'no_provider', 'no_address',
      'suppressed', 'delivered', 'bounced', 'complained'
    )
  );

-- The webhook matches inbound delivery events by Resend message id.
CREATE INDEX IF NOT EXISTS idx_user_nudges_email_provider
  ON ss_user_nudges (email_provider_id)
  WHERE email_provider_id IS NOT NULL;

-- Operational read: "which nudges went out in the last 7 days and what happened."
CREATE INDEX IF NOT EXISTS idx_user_nudges_email_status_sent
  ON ss_user_nudges (email_status, email_sent_at DESC)
  WHERE email_status IS NOT NULL;

COMMENT ON COLUMN ss_user_nudges.email_status IS
  'Delivery outcome of the nudge email. NULL = no send attempted (in-app only). Mirrors ss_widget_visitors.recap_status.';
COMMENT ON COLUMN ss_user_nudges.email_provider_id IS
  'Resend message id — the key the delivery webhook uses to correlate a bounce back to this nudge.';

-- ---------------------------------------------------------------------------
-- Subscriber-level opt-out
-- ---------------------------------------------------------------------------
--
-- A nudge to a paying subscriber about their own active treatment plan is
-- defensibly transactional under CAN-SPAM, so an unsubscribe link is not
-- strictly required. We add one anyway for two reasons: Gmail/Yahoo bulk-sender
-- rules weight List-Unsubscribe heavily (lib/email/send.ts already emits the
-- RFC 8058 headers when given a URL), and the no-guilt philosophy in
-- PROACTIVE-NUDGE-BLUEPRINT.md:214 argues for a user-controlled off switch on
-- principle. "I won't keep bringing it up" should be literally true.
--
-- The existing unsubscribe path (ss_nurture_leads.unsubscribe_token) cannot be
-- reused: nurture enrollment explicitly EXCLUDES active subscribers, so a
-- paying user has no row and no token there.

ALTER TABLE ss_user_profiles
  ADD COLUMN IF NOT EXISTS nudge_email_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nudge_unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_nudge_unsub_token
  ON ss_user_profiles (nudge_unsubscribe_token);

COMMENT ON COLUMN ss_user_profiles.nudge_email_opt_out IS
  'User asked to stop receiving proactive nudge EMAILS. The in-app dashboard card is unaffected — opting out of email is not opting out of care.';
