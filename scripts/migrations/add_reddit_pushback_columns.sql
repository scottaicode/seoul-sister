-- Reddit correction/pushback capture (Piece 2, Aug 5 2026)
--
-- WHY THESE COLUMNS AND NOT JUST `was_corrected`
--
-- `was_corrected` already existed as a boolean and nobody ever set it. The
-- obvious way to populate it — flag anything with score < 0 — was tested
-- against the real corpus and is WRONG. All three negative comments were
-- fetched with their reply threads on Aug 5 2026, and they are three different
-- things:
--
--   on7e1qd (-4)  a reply called the comment AI-GENERATED (+5). No factual
--                 error at all. The comment itself was a precise, correct
--                 correction about Real Barrier Extreme Cream formulations.
--   oc2erhk (-3)  a real FACTUAL correction: "300 is higher! 50 is the lowest"
--   p1j0ipt (-1)  substantive DISAGREEMENT: "very strange advice. I don't
--                 think it's true at all"
--
-- Collapsing those into one boolean would have labelled the account's best
-- factual work as an error and fed it back as a graded mistake — worse than no
-- teacher at all. The pushback KIND is the signal; the score is not.
--
-- `pushback_kind` is intentionally nullable and unconstrained by an enum here:
-- classification is a judgment call made by a human (or later, a model reading
-- the reply text), and a CHECK constraint would force the classifier to fit the
-- schema rather than the truth. Values in use:
--   'factual_correction' | 'disagreement' | 'ai_callout' | 'clarifying_question'
--
-- NOTE the ai_callout case is why this matters beyond fact-checking: it is the
-- only instrument that would tell us the account's cover is slipping, which is
-- the single risk that could end the channel outright.

ALTER TABLE ss_reddit_intel
  -- Replies actually fetched for this comment. NULL = never checked, 0 = checked
  -- and there were none. Those are different states and must not collapse.
  ADD COLUMN IF NOT EXISTS replies_checked_at timestamptz,
  -- The strongest pushback observed in the replies, if any.
  ADD COLUMN IF NOT EXISTS pushback_kind text,
  -- Verbatim reply text that triggered the flag, so a human can judge it
  -- without re-fetching. Truncated by the writer, not here.
  ADD COLUMN IF NOT EXISTS pushback_quote text,
  -- Score of the pushback reply. A +5 correction against a -4 comment is a very
  -- different signal from a -1 reply nobody agreed with.
  ADD COLUMN IF NOT EXISTS pushback_score integer,
  -- Author of the pushback reply.
  ADD COLUMN IF NOT EXISTS pushback_author text,
  -- Human confirmation. The auto-pass only ever PROPOSES; nothing is graded as
  -- a real error until a person confirms it. Mirrors the discipline in
  -- nudge-outcome-grader.ts: abstain rather than fabricate a verdict.
  ADD COLUMN IF NOT EXISTS pushback_confirmed boolean;

COMMENT ON COLUMN ss_reddit_intel.replies_checked_at IS
  'When replies were last fetched. NULL means never checked — distinct from checked-and-none.';
COMMENT ON COLUMN ss_reddit_intel.pushback_kind IS
  'factual_correction | disagreement | ai_callout | clarifying_question. NULL = no pushback observed.';
COMMENT ON COLUMN ss_reddit_intel.pushback_confirmed IS
  'Human verdict. NULL = unreviewed proposal. The teacher is not automatic.';

-- Find unreviewed pushback fast; this is the human review queue.
CREATE INDEX IF NOT EXISTS idx_reddit_intel_pushback_review
  ON ss_reddit_intel (pushback_kind, pushback_confirmed)
  WHERE pushback_kind IS NOT NULL;

-- Find comments whose replies have never been checked (the work queue).
CREATE INDEX IF NOT EXISTS idx_reddit_intel_replies_unchecked
  ON ss_reddit_intel (posted_at DESC)
  WHERE replies_checked_at IS NULL;
