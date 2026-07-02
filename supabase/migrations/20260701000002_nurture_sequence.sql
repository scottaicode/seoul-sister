-- Nurture sequence send-tracking (July 1 2026 — the "Honest Three")
--
-- One row per lead email. Tracks which of the 3 sequence emails have been
-- sent, suppression (unsubscribe / conversion / manual), and the capability
-- token for the one-click unsubscribe link. Service-role only: this table
-- is written exclusively by the nurture cron and the unsubscribe endpoint.

CREATE TABLE IF NOT EXISTS ss_nurture_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id UUID,
  cohort TEXT NOT NULL, -- 'registered' (made an account, never paid) | 'widget' (gave Yuri their email)
  sequence_step INT NOT NULL DEFAULT 0, -- last email sent (0 = none yet)
  last_sent_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suppressed BOOLEAN NOT NULL DEFAULT false,
  suppressed_reason TEXT, -- 'unsubscribed' | 'converted' | 'manual'
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nurture_due
  ON ss_nurture_leads (suppressed, sequence_step, last_sent_at);
CREATE INDEX IF NOT EXISTS idx_nurture_token
  ON ss_nurture_leads (unsubscribe_token);

ALTER TABLE ss_nurture_leads ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated get nothing; the service role bypasses RLS.
