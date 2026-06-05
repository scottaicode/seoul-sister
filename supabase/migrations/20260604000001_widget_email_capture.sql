-- ============================================================
-- v10.12.0 — Widget Email Capture
-- Adds optional email-capture columns to anonymous widget visitors.
-- Additive, nullable, no CHECK constraints (avoids silent-constraint bug class).
-- No backfill needed.
-- ============================================================

ALTER TABLE ss_widget_visitors
  ADD COLUMN IF NOT EXISTS captured_email TEXT,
  ADD COLUMN IF NOT EXISTS email_captured_at TIMESTAMPTZ;

-- Partial index for the nurture-list query (only rows with an email)
CREATE INDEX IF NOT EXISTS idx_widget_visitors_captured_email
  ON ss_widget_visitors (email_captured_at DESC)
  WHERE captured_email IS NOT NULL;
