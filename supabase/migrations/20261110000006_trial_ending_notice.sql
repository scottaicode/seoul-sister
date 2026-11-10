-- One plain "your trial ends on..." notice per trial (Nov 10 2026).
-- Stamped only after the email is sent, so NULL on a trial about to end means
-- the notice has NOT gone out (and the hourly job will try again).
ALTER TABLE ss_trial_starts ADD COLUMN IF NOT EXISTS ending_notice_sent_at timestamptz;
COMMENT ON COLUMN ss_trial_starts.ending_notice_sent_at IS 'When the plain trial-ending notice was emailed (about 48h before trial_end). NULL = not sent.';
