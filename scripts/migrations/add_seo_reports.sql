-- SEO Guardian Phase 1 (v11.11.0, July 24 2026)
-- Weekly GSC-driven SEO strategy reports with dated bets (learning-loop ready).
-- Each row = one weekly run: the raw Search Console snapshot it reasoned from,
-- the AI strategist's report, and its bets. Bets are graded by a future cron
-- (Phase 3) comparing later GSC snapshots against expected outcomes — the
-- graded history then feeds back into the strategist's context (Learning Loop
-- blueprint: dated judgment -> objective teacher -> self-calibration).

CREATE TABLE IF NOT EXISTS ss_seo_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The GSC date window this run reasoned over (GSC data lags ~3 days)
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  -- Raw Search Analytics snapshot (queries + pages rows) — the evidence the
  -- strategist saw, required for future grading and for auditing any bet
  gsc_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Deterministic pre-computed facts handed to the AI (striking-distance list,
  -- totals, deltas vs prior run) — stored so a graded bet can be replayed
  computed_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- The strategist's full prose report (markdown, emailed to the owner)
  report_md TEXT,
  -- Dated bets: [{id, action, target_queries, target_page, reasoning,
  --   expected_outcome, confidence, review_after}] — free-text reasoning,
  -- machine-readable envelope for the Phase 3 grader
  bets JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Phase 3 grading writes back here; NULL = ungraded
  grades JSONB,
  graded_at TIMESTAMPTZ,
  model_used TEXT,
  status TEXT NOT NULL DEFAULT 'completed', -- completed | failed | not_configured
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ss_seo_reports_created_at ON ss_seo_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ss_seo_reports_ungraded ON ss_seo_reports (created_at) WHERE graded_at IS NULL;

-- Service-role only (cron writes, admin reads); no user-facing access.
ALTER TABLE ss_seo_reports ENABLE ROW LEVEL SECURITY;
