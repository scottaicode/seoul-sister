-- Premium Korean Beauty Intelligence System
-- Enhanced monitoring with 12-influencer strategy and content scoring

-- Korean influencers monitoring table
CREATE TABLE IF NOT EXISTS korean_influencers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    handle TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('instagram', 'tiktok')) NOT NULL,
    followers INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    tier TEXT CHECK (tier IN ('mega', 'rising', 'niche')) NOT NULL,
    specialty TEXT[] DEFAULT '{}',
    max_posts INTEGER DEFAULT 15,
    priority INTEGER DEFAULT 1,
    schedule_slot TEXT CHECK (schedule_slot IN ('morning', 'afternoon', 'evening')),
    monitoring_active BOOLEAN DEFAULT true,
    last_scraped TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(handle, platform)
);

-- Influencer content with intelligence scoring
CREATE TABLE IF NOT EXISTS influencer_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    influencer_id UUID REFERENCES korean_influencers(id) ON DELETE CASCADE,
    platform_post_id TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('instagram', 'tiktok')) NOT NULL,
    post_url TEXT NOT NULL,
    caption TEXT,
    hashtags TEXT[] DEFAULT '{}',
    mentions TEXT[] DEFAULT '{}',
    media_urls TEXT[] DEFAULT '{}',
    view_count BIGINT DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Intelligence scoring fields
    intelligence_score DECIMAL(5,2) DEFAULT 0,
    priority_level TEXT CHECK (priority_level IN ('high', 'medium', 'low')) DEFAULT 'low',
    content_richness DECIMAL(5,2) DEFAULT 0,
    trend_novelty DECIMAL(5,2) DEFAULT 0,
    engagement_velocity DECIMAL(5,2) DEFAULT 0,
    influencer_authority DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_post_id, platform)
);

-- Content processing tracking (duplicate prevention)
CREATE TABLE IF NOT EXISTS processed_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('instagram', 'tiktok')) NOT NULL,
    influencer_handle TEXT NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE NOT NULL,
    engagement_score INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    content_hash TEXT,
    virality_score DECIMAL(5,2) DEFAULT 0,
    trend_signals TEXT[] DEFAULT '{}',
    UNIQUE(post_id, platform)
);

-- Video transcriptions
CREATE TABLE IF NOT EXISTS content_transcriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_id UUID REFERENCES influencer_content(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    transcript_text TEXT,
    language TEXT,
    confidence_score DECIMAL(3,2),
    processing_status TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI trend analysis results
CREATE TABLE IF NOT EXISTS trend_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_type TEXT NOT NULL,
    time_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    time_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trending_products JSONB DEFAULT '[]',
    trending_ingredients JSONB DEFAULT '[]',
    emerging_trends JSONB DEFAULT '[]',
    key_insights TEXT[],
    market_predictions JSONB DEFAULT '{}',
    cross_platform_insights JSONB DEFAULT '{}',
    total_content_analyzed INTEGER DEFAULT 0,
    total_influencers_monitored INTEGER DEFAULT 0,
    ai_confidence_score DECIMAL(3,2),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Product mentions extracted from content
CREATE TABLE IF NOT EXISTS product_mentions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name TEXT NOT NULL,
    brand_name TEXT,
    product_category TEXT,
    mention_context TEXT,
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')) DEFAULT 'neutral',
    sentiment_score DECIMAL(3,2) DEFAULT 0,
    is_trending BOOLEAN DEFAULT false,
    virality_score INTEGER DEFAULT 0,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_name, brand_name)
);

-- Ingredient mentions extracted from content
CREATE TABLE IF NOT EXISTS ingredient_mentions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_name TEXT NOT NULL UNIQUE,
    korean_name TEXT,
    ingredient_category TEXT,
    mention_context TEXT,
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')) DEFAULT 'positive',
    sentiment_score DECIMAL(3,2) DEFAULT 0,
    is_trending BOOLEAN DEFAULT false,
    virality_score INTEGER DEFAULT 0,
    skin_type_compatibility TEXT[],
    safety_concerns TEXT,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring job tracking
CREATE TABLE IF NOT EXISTS monitoring_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL,
    job_status TEXT CHECK (job_status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
    job_config JSONB DEFAULT '{}',
    results_summary JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_korean_influencers_platform ON korean_influencers(platform, monitoring_active);
CREATE INDEX idx_korean_influencers_tier ON korean_influencers(tier, priority);
CREATE INDEX idx_korean_influencers_schedule ON korean_influencers(schedule_slot);

CREATE INDEX idx_influencer_content_influencer ON influencer_content(influencer_id);
CREATE INDEX idx_influencer_content_platform ON influencer_content(platform);
CREATE INDEX idx_influencer_content_score ON influencer_content(intelligence_score DESC);
CREATE INDEX idx_influencer_content_priority ON influencer_content(priority_level);
CREATE INDEX idx_influencer_content_published ON influencer_content(published_at DESC);
CREATE INDEX idx_influencer_content_scraped ON influencer_content(scraped_at DESC);

CREATE INDEX idx_processed_content_platform ON processed_content(platform, post_id);
CREATE INDEX idx_processed_content_updated ON processed_content(last_updated DESC);

CREATE INDEX idx_transcriptions_content ON content_transcriptions(content_id);
CREATE INDEX idx_transcriptions_status ON content_transcriptions(processing_status);

CREATE INDEX idx_trend_analysis_period ON trend_analysis(time_period_start, time_period_end);
CREATE INDEX idx_trend_analysis_generated ON trend_analysis(generated_at DESC);

CREATE INDEX idx_product_mentions_trending ON product_mentions(is_trending, virality_score DESC);
CREATE INDEX idx_product_mentions_analyzed ON product_mentions(analyzed_at DESC);

CREATE INDEX idx_ingredient_mentions_trending ON ingredient_mentions(is_trending, virality_score DESC);
CREATE INDEX idx_ingredient_mentions_analyzed ON ingredient_mentions(analyzed_at DESC);

CREATE INDEX idx_monitoring_jobs_status ON monitoring_jobs(job_status, started_at);

-- Insert the 12 Korean beauty influencers
INSERT INTO korean_influencers (name, handle, platform, followers, category, tier, specialty, max_posts, priority, schedule_slot) VALUES
    -- TIER 1: MEGA-INFLUENCERS
    ('Pony Park', 'ponysmakeup', 'instagram', 5800000, 'makeup_artist', 'mega', ARRAY['makeup', 'korean_beauty', 'global_trends', 'product_reviews'], 30, 1, 'morning'),
    ('Ssin', 'ssin_makeup', 'instagram', 3200000, 'beauty_creator', 'mega', ARRAY['tutorials', 'product_reviews', 'daily_makeup', 'skincare'], 25, 2, 'morning'),
    ('Director Pi', 'directorpi', 'instagram', 2800000, 'skincare_expert', 'mega', ARRAY['skincare', 'ingredients', 'routines', 'education'], 25, 3, 'morning'),
    ('Jella Cosmetic', 'jella_cosmetic', 'instagram', 2100000, 'brand_founder', 'mega', ARRAY['product_launches', 'brand_insights', 'formulations', 'trends'], 20, 4, 'morning'),

    -- TIER 2: RISING STARS
    ('Lia Yoo', 'liahyoo', 'instagram', 800000, 'skincare_educator', 'rising', ARRAY['skincare_science', 'routines', 'ingredient_analysis', 'education'], 20, 5, 'afternoon'),
    ('Gothamista', 'gothamista', 'instagram', 650000, 'korean_american_bridge', 'rising', ARRAY['korean_skincare', 'us_market', 'crossover_trends', 'reviews'], 20, 6, 'afternoon'),
    ('Laneige Korea', 'laneige_kr', 'instagram', 1200000, 'official_brand', 'rising', ARRAY['new_products', 'campaigns', 'brand_trends', 'launches'], 15, 7, 'afternoon'),
    ('Olivia Hye', 'oliviahye', 'instagram', 450000, 'gen_z_creator', 'rising', ARRAY['viral_trends', 'gen_z_beauty', 'challenges', 'youthful_skin'], 20, 8, 'afternoon'),

    -- TIER 3: NICHE EXPERTS
    ('Amanda Korean Beauty', 'koreanbeauty_amanda', 'instagram', 320000, 'ingredient_specialist', 'niche', ARRAY['ingredient_analysis', 'formulation', 'science', 'safety'], 15, 9, 'evening'),
    ('Seoul Skincare Insider', 'seoul_skincare', 'instagram', 180000, 'local_insider', 'niche', ARRAY['seoul_trends', 'local_brands', 'insider_info', 'street_beauty'], 15, 10, 'evening'),
    ('K-Beauty Science', 'kbeauty_science', 'instagram', 150000, 'science_educator', 'niche', ARRAY['chemistry', 'formulations', 'research', 'clinical_studies'], 10, 11, 'evening'),
    ('Beauty Tokyo Seoul', 'beautytokyo_seoul', 'instagram', 280000, 'crossover_trends', 'niche', ARRAY['japan_korea', 'crossover_trends', 'cultural_beauty', 'innovations'], 15, 12, 'evening'),

    -- TIKTOK VALIDATION INFLUENCERS
    ('Pony Park TikTok', 'ponysmakeup', 'tiktok', 2100000, 'makeup_artist', 'mega', ARRAY['viral_makeup', 'trends', 'challenges'], 25, 1, 'morning'),
    ('Ssin TikTok', 'ssinnim7', 'tiktok', 1800000, 'beauty_creator', 'mega', ARRAY['tutorials', 'viral_trends', 'quick_tips'], 20, 2, 'morning'),
    ('Jella TikTok', 'jellacosmetic', 'tiktok', 890000, 'brand_founder', 'rising', ARRAY['behind_scenes', 'product_development', 'viral_products'], 15, 3, 'afternoon'),
    ('K-Beauty Viral', 'kbeauty_viral', 'tiktok', 650000, 'trend_tracker', 'rising', ARRAY['viral_trends', 'challenges', 'product_testing'], 20, 4, 'afternoon')
ON CONFLICT (handle, platform) DO NOTHING;

-- RLS Policies
ALTER TABLE korean_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_jobs ENABLE ROW LEVEL SECURITY;

-- Public read access to intelligence data (premium filtering happens in app)
CREATE POLICY "Intelligence data is publicly viewable" ON korean_influencers
    FOR SELECT USING (true);

CREATE POLICY "Content is publicly viewable" ON influencer_content
    FOR SELECT USING (true);

CREATE POLICY "Processed content tracking is publicly viewable" ON processed_content
    FOR SELECT USING (true);

CREATE POLICY "Transcriptions are publicly viewable" ON content_transcriptions
    FOR SELECT USING (true);

CREATE POLICY "Trend analysis is publicly viewable" ON trend_analysis
    FOR SELECT USING (true);

CREATE POLICY "Product mentions are publicly viewable" ON product_mentions
    FOR SELECT USING (true);

CREATE POLICY "Ingredient mentions are publicly viewable" ON ingredient_mentions
    FOR SELECT USING (true);

CREATE POLICY "Monitoring jobs are publicly viewable" ON monitoring_jobs
    FOR SELECT USING (true);