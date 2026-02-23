-- Feature 13.5: Onboarding Quality Scoring
-- Tracks profile answer specificity (not just field completion)
-- Quality score 0-100: low = vague answers, high = specific answers
ALTER TABLE ss_onboarding_progress
  ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;
