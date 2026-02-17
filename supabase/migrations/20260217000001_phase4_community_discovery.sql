-- Phase 4: Community & Discovery
-- Adds community points system, review enhancements, and seeds trending data

-- ============================================================
-- 1. Community Points System
-- ============================================================
CREATE TABLE IF NOT EXISTS ss_community_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'review_submitted', 'review_helpful_vote', 'review_received_helpful',
    'holy_grail_shared', 'broke_me_out_shared', 'first_review', 'streak_bonus'
  )),
  points integer NOT NULL,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ss_community_points_user_id ON ss_community_points(user_id);
CREATE INDEX IF NOT EXISTS idx_ss_community_points_action ON ss_community_points(action);

ALTER TABLE ss_community_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own points"
  ON ss_community_points FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own points"
  ON ss_community_points FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. Add fitzpatrick_scale and age_range to ss_reviews
-- ============================================================
ALTER TABLE ss_reviews ADD COLUMN IF NOT EXISTS fitzpatrick_scale integer CHECK (fitzpatrick_scale >= 1 AND fitzpatrick_scale <= 6);
ALTER TABLE ss_reviews ADD COLUMN IF NOT EXISTS age_range text;

CREATE INDEX IF NOT EXISTS idx_ss_reviews_skin_type ON ss_reviews(skin_type);
CREATE INDEX IF NOT EXISTS idx_ss_reviews_reaction ON ss_reviews(reaction);
CREATE INDEX IF NOT EXISTS idx_ss_reviews_fitzpatrick ON ss_reviews(fitzpatrick_scale);

-- ============================================================
-- 3. Seed trending products
-- ============================================================
INSERT INTO ss_trending_products (product_id, source, trend_score, mention_count, sentiment_score, trending_since)
SELECT p.id, 'tiktok', 92, 24500, 0.89, now() - interval '3 days'
FROM ss_products p WHERE p.name_en ILIKE '%Beauty of Joseon%Glow Serum%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ss_trending_products (product_id, source, trend_score, mention_count, sentiment_score, trending_since)
SELECT p.id, 'tiktok', 88, 18200, 0.92, now() - interval '5 days'
FROM ss_products p WHERE p.name_en ILIKE '%COSRX%Snail%Mucin%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ss_trending_products (product_id, source, trend_score, mention_count, sentiment_score, trending_since)
SELECT p.id, 'reddit', 85, 12800, 0.87, now() - interval '2 days'
FROM ss_products p WHERE p.name_en ILIKE '%Torriden%DIVE%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ss_trending_products (product_id, source, trend_score, mention_count, sentiment_score, trending_since)
SELECT p.id, 'instagram', 82, 9600, 0.91, now() - interval '7 days'
FROM ss_products p WHERE p.name_en ILIKE '%Laneige%Water%Sleeping%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ss_trending_products (product_id, source, trend_score, mention_count, sentiment_score, trending_since)
SELECT p.id, 'korean_market', 79, 8400, 0.85, now() - interval '1 day'
FROM ss_products p WHERE p.name_en ILIKE '%Sulwhasoo%First%Care%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ss_trending_products (product_id, source, trend_score, mention_count, sentiment_score, trending_since)
SELECT p.id, 'tiktok', 76, 7200, 0.88, now() - interval '4 days'
FROM ss_products p WHERE p.name_en ILIKE '%Innisfree%Green Tea%Seed%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ss_trending_products (product_id, source, trend_score, mention_count, sentiment_score, trending_since)
SELECT p.id, 'reddit', 74, 6100, 0.83, now() - interval '6 days'
FROM ss_products p WHERE p.name_en ILIKE '%Etude%SoonJung%' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO ss_trending_products (product_id, source, trend_score, mention_count, sentiment_score, trending_since)
SELECT p.id, 'instagram', 71, 5400, 0.90, now() - interval '8 days'
FROM ss_products p WHERE p.name_en ILIKE '%Missha%Time Revolution%' LIMIT 1
ON CONFLICT DO NOTHING;
