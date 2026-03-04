-- Prevent duplicate seasonal learning patterns per climate zone.
-- The seasonal-adjustments cron uses .single() to look up the existing
-- pattern for each climate. With duplicates, .single() fails silently
-- and the cron generates 0 patterns.
--
-- Partial unique index: only applies to pattern_type = 'seasonal'.
-- Other pattern_type values (skin_type_cohort, etc.) can have multiple
-- rows per skin_type.

CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_patterns_seasonal_unique
  ON ss_learning_patterns(pattern_type, skin_type)
  WHERE pattern_type = 'seasonal';
