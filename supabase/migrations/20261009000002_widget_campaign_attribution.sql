-- Per-video traffic grading (Oct 9 2026)
--
-- WHY: Bailey is about to drive TikTok traffic. ss_user_profiles already keeps
-- first-touch UTM for SIGNUPS (20260713000001), but the widget, where most
-- strangers actually meet Yuri, kept only a page-type `source` slug on the
-- session: utm_campaign / utm_content (which video) and the referrer were lost,
-- and a visitor who landed and never typed left no row at all. So a per-video
-- link could be graded by views (TikTok's number) and by nothing of ours.
--
-- After this, one link like ?utm_source=tiktok&utm_content=<video-id> grades as:
--   landed (ss_campaign_touches) → chatted (visitor.total_messages > 0)
--   → left an email (captured_email) → paid (converted_at → ss_subscriptions)
--   → still paying past day 10.
-- Nothing downstream needs a copy of the fields: the touch is keyed by the SAME
-- browser id the widget uses (getOrCreateVisitorId), so
--   ss_campaign_touches.visitor_id = ss_widget_visitors.visitor_id
-- and the lead (ss_nurture_leads.visitor_id → ss_widget_visitors.id) and the
-- subscription (ss_widget_visitors.converted_user_id → ss_subscriptions) join
-- from there. Signups that skip the widget keep their own first touch on
-- ss_user_profiles.utm_* (20260713000001).
--
-- Additive. First touch is immutable (unique visitor_id, insert-ignore).

-- One row per browser's first touch on the site, written by a client beacon the
-- first time attribution is captured. This is the "landed" denominator; GA4 is
-- bot-inflated (346 phantom users vs 0 rows, Jul 27) and is not used for this.
CREATE TABLE IF NOT EXISTS ss_campaign_touches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL UNIQUE,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  referrer_host TEXT,
  landing_path TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_touches_source
  ON ss_campaign_touches (utm_source, utm_content, created_at);

ALTER TABLE ss_campaign_touches ENABLE ROW LEVEL SECURITY;
-- No policies: written by /api/attribution/touch (service role), read by admin API.

-- Verify:
-- SELECT to_regclass('public.ss_campaign_touches');  -- not null
