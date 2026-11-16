-- A per-member, per-month addition to the Yuri message allowance (Nov 16 2026).
--
-- Why: a free-week member, in Korea and shopping, reached 57 of the month's 80
-- messages in three days. The owner chose to give that one member 150 for the
-- month. There was no per-member allowance: the only lever was lowering the
-- "used" counter, which would have had Yuri tell her a false number.
--
-- The bonus lives on the month's own usage row, so it ends with the month by
-- itself. 0 for everyone unless set by hand.
ALTER TABLE ss_usage_tracking
  ADD COLUMN IF NOT EXISTS yuri_messages_bonus integer NOT NULL DEFAULT 0
  CHECK (yuri_messages_bonus >= 0 AND yuri_messages_bonus <= 2000);

COMMENT ON COLUMN ss_usage_tracking.yuri_messages_bonus IS
  'Extra Yuri messages for this member in this calendar month, added to the plan allowance. Set by hand; 0 by default.';
