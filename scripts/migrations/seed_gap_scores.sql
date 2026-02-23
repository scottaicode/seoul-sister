-- Phase 10.3: Seed initial gap scores for existing trending data.
-- Run this ONCE in Supabase SQL Editor after deploying Phase 10.3 code.
-- After this, the daily cron /api/cron/calculate-gap-scores (9:00 AM UTC)
-- will recalculate gap scores automatically.
--
-- Gap score formula: oy_trend_score * (1 - min(reddit_mentions / 50, 1))
-- High gap = trending in Korea, unknown in the US.

WITH reddit_mentions AS (
  SELECT product_id, mention_count
  FROM ss_trending_products
  WHERE source = 'reddit' AND product_id IS NOT NULL
),
gap_calc AS (
  SELECT
    oy.id,
    LEAST(100, GREATEST(0, ROUND(
      oy.trend_score * (1.0 - LEAST(COALESCE(r.mention_count, 0)::numeric / 50.0, 1.0))
    )))::integer AS calculated_gap
  FROM ss_trending_products oy
  LEFT JOIN reddit_mentions r ON oy.product_id = r.product_id
  WHERE oy.source = 'olive_young'
)
UPDATE ss_trending_products t
SET gap_score = gc.calculated_gap
FROM gap_calc gc
WHERE t.id = gc.id;
