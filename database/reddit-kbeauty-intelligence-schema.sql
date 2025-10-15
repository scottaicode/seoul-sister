-- Reddit K-Beauty Intelligence Database Schema
-- Dynamic, AI-powered Korean beauty trend discovery system
-- Builds on proven neurolink-bridge Reddit architecture

-- Store raw Reddit posts from K-beauty communities
CREATE TABLE IF NOT EXISTS reddit_kbeauty_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT UNIQUE NOT NULL,
    subreddit TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    author TEXT,
    url TEXT,
    score INTEGER DEFAULT 0,
    num_comments INTEGER DEFAULT 0,
    upvote_ratio FLOAT,
    created_utc TIMESTAMP,
    is_video BOOLEAN DEFAULT false,
    link_flair_text TEXT,
    total_awards_received INTEGER DEFAULT 0,
    detected_brands TEXT[],
    detected_ingredients TEXT[],
    detected_products TEXT[],
    skin_concerns TEXT[],
    routine_type TEXT, -- morning, evening, weekly, etc.
    price_mentions JSONB, -- {"product": "cosrx essence", "price": "$25", "source": "amazon"}
    sentiment_score FLOAT,
    is_question BOOLEAN DEFAULT false,
    is_review BOOLEAN DEFAULT false,
    is_routine BOOLEAN DEFAULT false,
    scraped_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast K-beauty analysis
CREATE INDEX IF NOT EXISTS idx_kbeauty_subreddit ON reddit_kbeauty_posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_kbeauty_created ON reddit_kbeauty_posts(created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_kbeauty_score ON reddit_kbeauty_posts(score DESC);
CREATE INDEX IF NOT EXISTS idx_kbeauty_brands ON reddit_kbeauty_posts USING GIN(detected_brands);
CREATE INDEX IF NOT EXISTS idx_kbeauty_ingredients ON reddit_kbeauty_posts USING GIN(detected_ingredients);
CREATE INDEX IF NOT EXISTS idx_kbeauty_products ON reddit_kbeauty_posts USING GIN(detected_products);

-- Dynamic Korean beauty trends discovered by AI
CREATE TABLE IF NOT EXISTS reddit_kbeauty_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trend_term TEXT NOT NULL,
    trend_type TEXT NOT NULL, -- brand, ingredient, product, technique, concern
    mention_count INTEGER DEFAULT 1,
    total_score INTEGER DEFAULT 0,
    avg_engagement FLOAT,
    sample_posts TEXT[],
    subreddits TEXT[],
    growth_rate FLOAT,
    velocity_score FLOAT, -- how fast it's growing
    sentiment_average FLOAT,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),
    peak_time TIMESTAMP,
    trend_status TEXT DEFAULT 'emerging', -- emerging, trending, peaked, declining
    ai_confidence FLOAT DEFAULT 0.0, -- Claude's confidence in this trend
    korean_origin BOOLEAN DEFAULT false, -- true if term appears to be Korean brand/ingredient
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(trend_term, trend_type)
);

CREATE INDEX IF NOT EXISTS idx_kbeauty_trends_status ON reddit_kbeauty_trends(trend_status);
CREATE INDEX IF NOT EXISTS idx_kbeauty_trends_growth ON reddit_kbeauty_trends(growth_rate DESC);
CREATE INDEX IF NOT EXISTS idx_kbeauty_trends_velocity ON reddit_kbeauty_trends(velocity_score DESC);
CREATE INDEX IF NOT EXISTS idx_kbeauty_trends_type ON reddit_kbeauty_trends(trend_type);

-- K-beauty questions and community needs
CREATE TABLE IF NOT EXISTS reddit_kbeauty_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT REFERENCES reddit_kbeauty_posts(post_id),
    question TEXT NOT NULL,
    skin_type TEXT, -- oily, dry, combination, sensitive, mature
    skin_concerns TEXT[], -- acne, aging, hyperpigmentation, etc.
    budget_range TEXT, -- budget, mid-range, luxury
    experience_level TEXT, -- beginner, intermediate, expert
    urgency_score FLOAT,
    has_solution BOOLEAN DEFAULT false,
    top_answer TEXT,
    answer_score INTEGER,
    product_recommendations TEXT[],
    routine_suggestions TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Korean beauty product mentions and reviews
CREATE TABLE IF NOT EXISTS reddit_kbeauty_product_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT REFERENCES reddit_kbeauty_posts(post_id),
    product_name TEXT NOT NULL,
    brand_name TEXT,
    mentioned_price TEXT,
    purchase_location TEXT, -- amazon, yesstyle, seoul, etc.
    user_rating INTEGER, -- 1-5 if mentioned
    skin_type_mentioned TEXT,
    results_mentioned TEXT,
    repurchase_intent BOOLEAN,
    recommendation_strength TEXT, -- love, like, neutral, dislike, hate
    context TEXT, -- morning routine, evening routine, special occasion
    created_at TIMESTAMP DEFAULT NOW()
);

-- AI-discovered insights from K-beauty community
CREATE TABLE IF NOT EXISTS reddit_kbeauty_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type TEXT, -- emerging_brand, price_alert, ingredient_trend, routine_shift
    insight_title TEXT NOT NULL,
    insight_content TEXT NOT NULL,
    confidence_score FLOAT, -- AI confidence 0-1
    evidence_posts TEXT[], -- post IDs supporting this insight
    actionable_data JSONB, -- structured data for Seoul Sister actions
    priority_level TEXT DEFAULT 'medium', -- low, medium, high, urgent
    ai_reasoning TEXT, -- Claude's explanation of why this is significant
    business_impact TEXT, -- potential impact on Seoul Sister
    action_taken BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Dynamic keyword learning system
CREATE TABLE IF NOT EXISTS reddit_kbeauty_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT UNIQUE NOT NULL,
    keyword_type TEXT NOT NULL, -- brand, ingredient, product, technique
    discovery_method TEXT, -- seed, ai_discovered, user_mentioned
    mention_frequency INTEGER DEFAULT 1,
    growth_trajectory FLOAT DEFAULT 0.0,
    last_activity TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    korean_verified BOOLEAN DEFAULT false, -- verified as Korean beauty term
    ai_notes TEXT, -- Claude's analysis of this keyword
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS for security
ALTER TABLE reddit_kbeauty_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reddit_kbeauty_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE reddit_kbeauty_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reddit_kbeauty_product_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reddit_kbeauty_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE reddit_kbeauty_keywords ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY reddit_kbeauty_admin_policy ON reddit_kbeauty_posts FOR ALL USING (true);
CREATE POLICY reddit_kbeauty_trends_policy ON reddit_kbeauty_trends FOR ALL USING (true);
CREATE POLICY reddit_kbeauty_questions_policy ON reddit_kbeauty_questions FOR ALL USING (true);
CREATE POLICY reddit_kbeauty_mentions_policy ON reddit_kbeauty_product_mentions FOR ALL USING (true);
CREATE POLICY reddit_kbeauty_insights_policy ON reddit_kbeauty_insights FOR ALL USING (true);
CREATE POLICY reddit_kbeauty_keywords_policy ON reddit_kbeauty_keywords FOR ALL USING (true);

-- Seed the system with foundational K-beauty keywords
INSERT INTO reddit_kbeauty_keywords (keyword, keyword_type, discovery_method, korean_verified) VALUES
-- Foundation brands (seed data)
('cosrx', 'brand', 'seed', true),
('beauty of joseon', 'brand', 'seed', true),
('innisfree', 'brand', 'seed', true),
('etude house', 'brand', 'seed', true),
('laneige', 'brand', 'seed', true),

-- Foundation ingredients (seed data)
('centella asiatica', 'ingredient', 'seed', true),
('snail mucin', 'ingredient', 'seed', true),
('niacinamide', 'ingredient', 'seed', true),
('hyaluronic acid', 'ingredient', 'seed', false),
('retinol', 'ingredient', 'seed', false),

-- Foundation techniques (seed data)
('double cleansing', 'technique', 'seed', true),
('glass skin', 'technique', 'seed', true),
('10-step routine', 'technique', 'seed', true),
('slugging', 'technique', 'seed', false),

-- Foundation product types (seed data)
('essence', 'product', 'seed', true),
('ampoule', 'product', 'seed', true),
('sheet mask', 'product', 'seed', true),
('cushion foundation', 'product', 'seed', true)

ON CONFLICT (keyword) DO NOTHING;

-- Functions for dynamic trend analysis
CREATE OR REPLACE FUNCTION update_kbeauty_trend_scores()
RETURNS VOID AS $$
BEGIN
    -- Update trend scores based on recent activity
    UPDATE reddit_kbeauty_trends
    SET
        velocity_score = (
            SELECT COUNT(*) * 10
            FROM reddit_kbeauty_posts
            WHERE created_utc > NOW() - INTERVAL '24 hours'
            AND (
                trend_term = ANY(detected_brands) OR
                trend_term = ANY(detected_ingredients) OR
                trend_term = ANY(detected_products)
            )
        ),
        growth_rate = (
            SELECT
                CASE
                    WHEN COUNT(*) > 20 THEN 100
                    WHEN COUNT(*) > 10 THEN 50
                    WHEN COUNT(*) > 5 THEN 25
                    ELSE 10
                END
            FROM reddit_kbeauty_posts
            WHERE created_utc > NOW() - INTERVAL '24 hours'
            AND (
                trend_term = ANY(detected_brands) OR
                trend_term = ANY(detected_ingredients) OR
                trend_term = ANY(detected_products)
            )
        ),
        last_seen = NOW(),
        updated_at = NOW()
    WHERE last_seen > NOW() - INTERVAL '7 days';

    -- Update trending status
    UPDATE reddit_kbeauty_trends
    SET trend_status = CASE
        WHEN velocity_score > 80 THEN 'trending'
        WHEN velocity_score > 40 THEN 'emerging'
        WHEN velocity_score < 10 THEN 'declining'
        ELSE 'stable'
    END;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Reddit K-Beauty Intelligence schema deployed successfully! 🇰🇷✨' as status;