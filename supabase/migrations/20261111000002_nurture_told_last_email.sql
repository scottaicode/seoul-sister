-- Which leads were told "last email, promise" (Nov 11 2026).
--
-- Until this release the third nurture email said, in Yuri's voice, that it
-- was the last email. Writing to those leads again is an owner decision
-- (LEAD_REENGAGE_AFTER_LAST_EMAIL_APPROVED). The email no longer says it.
--
-- The fact is recorded on the lead and not inferred from last_sent_at: that
-- timestamp is rewritten by other sends (scripts/send-price-change-email.ts),
-- which would have turned a promised lead into an unpromised one.
--
-- TRUE is the default and the value for every existing lead. Only the nurture
-- send of the CURRENT email 3 writes FALSE (src/lib/email/nurture.ts). So a
-- server still running the old copy, or a rollback to it, can never leave a
-- lead marked "not told": old code does not write this column at all.
-- (Applied to production in two steps on Nov 11 2026; this file is the result.)

ALTER TABLE ss_nurture_leads
  ADD COLUMN IF NOT EXISTS told_last_email boolean NOT NULL DEFAULT true;
ALTER TABLE ss_nurture_leads ALTER COLUMN told_last_email SET DEFAULT true;

UPDATE ss_nurture_leads SET told_last_email = true WHERE told_last_email = false;

COMMENT ON COLUMN ss_nurture_leads.told_last_email IS
  'Whether this lead was (or must be assumed to have been) sent an email 3 that said it was the last email. TRUE by default and for every lead that existed on Nov 11 2026. Set FALSE only by the nurture send of the current email 3 (src/lib/email/nurture.ts), which makes no such promise. Read by leadGate (lead-reengage.ts).';
