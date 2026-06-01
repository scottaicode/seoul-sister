-- ============================================================
-- v10.11.0 — Nudge Outcome Teacher: skin-outcome grading on nudges
--
-- Upgrades the proactive-nudge learning loop from a soft teacher (engagement:
-- acted/dismissed, already on ss_user_nudges.status) to a MEASURED teacher: did
-- the user's Glass Skin Score move in the weeks after she ACTED on the nudge.
--
-- The grade lives on the nudge row it grades — judgment + teacher's verdict stay
-- together. Outcome grades only ever exist for acted nudges that clear the
-- attribution/confounder gates (see NUDGE-OUTCOME-TEACHER-BLUEPRINT.md); all else
-- abstains as 'insufficient_data' or stays pending.
-- ============================================================

ALTER TABLE ss_user_nudges
  -- 'helped' | 'no_change' | 'hurt' | 'insufficient_data' | NULL(=not yet graded)
  ADD COLUMN IF NOT EXISTS outcome_grade TEXT
    CHECK (outcome_grade IN ('helped', 'no_change', 'hurt', 'insufficient_data')),
  -- followup.overall_score - baseline.overall_score (NULL when ungraded/abstained)
  ADD COLUMN IF NOT EXISTS outcome_score_delta INTEGER,
  -- the Glass Skin Score at/just-before the nudge (the "before")
  ADD COLUMN IF NOT EXISTS outcome_baseline_score_id UUID REFERENCES ss_glass_skin_scores(id) ON DELETE SET NULL,
  -- the earliest qualifying Glass Skin Score >=14d after acted_at (the "after")
  ADD COLUMN IF NOT EXISTS outcome_followup_score_id UUID REFERENCES ss_glass_skin_scores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS outcome_graded_at TIMESTAMPTZ,
  -- honest record of why this grade was assigned, or why the grader abstained
  ADD COLUMN IF NOT EXISTS outcome_notes TEXT;

-- The grader cron scans acted nudges that are either ungraded or still pending a
-- follow-up score. Partial index keeps that scan cheap.
CREATE INDEX IF NOT EXISTS idx_user_nudges_outcome_pending
  ON ss_user_nudges (acted_at)
  WHERE status = 'acted' AND outcome_grade IS NULL;

-- The calibration read (getNudgeTypePerformance) groups graded outcomes by type.
CREATE INDEX IF NOT EXISTS idx_user_nudges_type_grade
  ON ss_user_nudges (nudge_type, outcome_grade)
  WHERE outcome_grade IS NOT NULL;
