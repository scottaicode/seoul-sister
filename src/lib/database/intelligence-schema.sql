-- Korean Beauty Intelligence System Database Schema
-- Phase 1: Foundation tables for monitoring and transcription

-- Korean influencers and content creators
CREATE TABLE korean_influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  handle VARCHAR(100) NOT NULL UNIQUE,
  platform VARCHAR(50) NOT NULL, -- 'instagram', 'tiktok', 'youtube'
  follower_count INTEGER,
  engagement_rate DECIMAL(5,2),
  category VARCHAR(100), -- 'skincare', 'makeup', 'lifestyle', 'kbeauty_expert'
  language VARCHAR(10) DEFAULT 'ko', -- 'ko' for Korean, 'en' for English
  location VARCHAR(100) DEFAULT 'Seoul',
  verified BOOLEAN DEFAULT false,
  monitoring_active BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content posts from monitored influencers
CREATE TABLE influencer_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES korean_influencers(id) ON DELETE CASCADE,
  platform_post_id VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  content_type VARCHAR(50), -- 'post', 'story', 'reel', 'video', 'live'
  post_url TEXT,
  caption TEXT,
  hashtags TEXT[], -- Array of hashtags
  mentions TEXT[], -- Array of mentioned accounts
  media_urls TEXT[], -- Array of image/video URLs
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  share_count INTEGER,
  published_at TIMESTAMP WITH TIME ZONE,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate content
  UNIQUE(platform_post_id, platform)
);

-- Video transcriptions from SupaData
CREATE TABLE content_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES influencer_content(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  transcript_text TEXT,
  language VARCHAR(10) DEFAULT 'ko',
  confidence_score DECIMAL(5,2), -- Transcription confidence 0-100
  processing_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI-extracted product mentions and trends
CREATE TABLE product_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES influencer_content(id) ON DELETE CASCADE,
  transcription_id UUID REFERENCES content_transcriptions(id) ON DELETE SET NULL,

  -- Product information
  product_name VARCHAR(255),
  brand_name VARCHAR(255),
  product_category VARCHAR(100), -- 'cleanser', 'moisturizer', 'serum', 'sunscreen', etc.
  korean_name VARCHAR(255), -- Original Korean product name

  -- Context and sentiment
  mention_context TEXT, -- The specific context where product was mentioned
  sentiment VARCHAR(20), -- 'positive', 'negative', 'neutral'
  sentiment_score DECIMAL(5,2), -- -1 to 1 sentiment score

  -- Trend indicators
  is_trending BOOLEAN DEFAULT false,
  virality_score INTEGER DEFAULT 0, -- 0-100 based on engagement and reach

  -- AI analysis metadata
  extraction_confidence DECIMAL(5,2), -- AI confidence in product identification
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingredient mentions and trends
CREATE TABLE ingredient_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES influencer_content(id) ON DELETE CASCADE,
  transcription_id UUID REFERENCES content_transcriptions(id) ON DELETE SET NULL,

  -- Ingredient information
  ingredient_name VARCHAR(255) NOT NULL,
  korean_name VARCHAR(255), -- Original Korean ingredient name
  inci_name VARCHAR(255), -- International Nomenclature of Cosmetic Ingredients
  ingredient_category VARCHAR(100), -- 'active', 'moisturizing', 'cleansing', etc.

  -- Context and sentiment
  mention_context TEXT,
  sentiment VARCHAR(20), -- 'positive', 'negative', 'neutral'
  sentiment_score DECIMAL(5,2),

  -- Trend indicators
  is_trending BOOLEAN DEFAULT false,
  virality_score INTEGER DEFAULT 0,

  -- Safety and compatibility
  safety_concerns TEXT[], -- Array of potential safety issues
  skin_type_compatibility TEXT[], -- Array of compatible skin types

  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trend analysis and intelligence reports
CREATE TABLE trend_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Analysis scope
  analysis_type VARCHAR(50), -- 'daily', 'weekly', 'monthly', 'event_based'
  time_period_start TIMESTAMP WITH TIME ZONE,
  time_period_end TIMESTAMP WITH TIME ZONE,

  -- Trend data
  trending_products JSONB, -- Array of trending product objects with scores
  trending_ingredients JSONB, -- Array of trending ingredient objects
  trending_brands JSONB, -- Array of trending brand objects
  emerging_trends JSONB, -- Array of emerging trend objects

  -- Key insights
  key_insights TEXT[], -- Array of key insight strings
  market_predictions TEXT[], -- Array of market prediction strings
  us_arrival_predictions JSONB, -- Predictions for when trends will hit US market

  -- Analysis metadata
  total_content_analyzed INTEGER,
  total_influencers_monitored INTEGER,
  ai_confidence_score DECIMAL(5,2),

  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User trend alerts and notifications
CREATE TABLE user_trend_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- References auth.users from Supabase

  -- Alert configuration
  alert_type VARCHAR(50), -- 'ingredient', 'product', 'brand', 'category'
  alert_target VARCHAR(255), -- The specific thing to monitor
  keywords TEXT[], -- Keywords to watch for

  -- Notification preferences
  notification_method VARCHAR(50)[], -- Array: 'email', 'whatsapp', 'dashboard'
  frequency VARCHAR(20) DEFAULT 'immediate', -- 'immediate', 'daily', 'weekly'

  -- Alert status
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoring job logs and status
CREATE TABLE monitoring_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50), -- 'scrape_influencer', 'transcribe_video', 'analyze_trends'
  job_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'

  -- Job configuration
  target_platform VARCHAR(50),
  target_influencer_id UUID REFERENCES korean_influencers(id) ON DELETE CASCADE,
  job_config JSONB, -- Configuration parameters for the job

  -- Execution details
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  results_summary JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_influencer_content_influencer_id ON influencer_content(influencer_id);
CREATE INDEX idx_influencer_content_platform ON influencer_content(platform);
CREATE INDEX idx_influencer_content_published_at ON influencer_content(published_at DESC);
CREATE INDEX idx_product_mentions_product_name ON product_mentions(product_name);
CREATE INDEX idx_product_mentions_is_trending ON product_mentions(is_trending);
CREATE INDEX idx_ingredient_mentions_ingredient_name ON ingredient_mentions(ingredient_name);
CREATE INDEX idx_ingredient_mentions_is_trending ON ingredient_mentions(is_trending);
CREATE INDEX idx_trend_analysis_generated_at ON trend_analysis(generated_at DESC);
CREATE INDEX idx_user_trend_alerts_user_id ON user_trend_alerts(user_id);
CREATE INDEX idx_monitoring_jobs_status ON monitoring_jobs(job_status);

-- Functions for automated updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_korean_influencers_updated_at BEFORE UPDATE ON korean_influencers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_transcriptions_updated_at BEFORE UPDATE ON content_transcriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_trend_alerts_updated_at BEFORE UPDATE ON user_trend_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial data: Top Korean beauty influencers to monitor
INSERT INTO korean_influencers (name, handle, platform, follower_count, category, verified) VALUES
('PONY Makeup', 'ponysmakeup', 'instagram', 6500000, 'makeup', true),
('Ssin 씬님', 'ssin_makeup', 'instagram', 2800000, 'makeup', true),
('Director Pi', 'directorpi', 'instagram', 1200000, 'skincare', true),
('Jella 젤라', 'jella_cosmetic', 'instagram', 980000, 'kbeauty_expert', true),
('Hyram', 'hyram', 'instagram', 1800000, 'skincare', true),
('Joan Kim', 'joankeem', 'instagram', 850000, 'lifestyle', true),
('Liah Yoo', 'liahyoo', 'instagram', 750000, 'skincare', true),
('Gothamista', 'gothamista', 'instagram', 680000, 'skincare', true);

-- Add TikTok accounts
INSERT INTO korean_influencers (name, handle, platform, follower_count, category, verified) VALUES
('PONY Makeup', 'ponysmakeup', 'tiktok', 3200000, 'makeup', true),
('Ssin', 'ssinnim7', 'tiktok', 1500000, 'makeup', true),
('Jella', 'jellacosmetic', 'tiktok', 890000, 'kbeauty_expert', true);

COMMENT ON TABLE korean_influencers IS 'Top Korean beauty influencers and content creators to monitor for trends';
COMMENT ON TABLE influencer_content IS 'Posts, stories, and videos from monitored influencers';
COMMENT ON TABLE content_transcriptions IS 'Video transcriptions processed through SupaData API';
COMMENT ON TABLE product_mentions IS 'AI-extracted product mentions from influencer content';
COMMENT ON TABLE ingredient_mentions IS 'AI-extracted ingredient mentions and trend analysis';
COMMENT ON TABLE trend_analysis IS 'Comprehensive trend analysis reports generated by AI';
COMMENT ON TABLE user_trend_alerts IS 'User-configured alerts for trend notifications';
COMMENT ON TABLE monitoring_jobs IS 'Background job tracking for scraping and analysis tasks';