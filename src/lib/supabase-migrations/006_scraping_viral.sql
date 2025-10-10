-- Advanced Scraping and Viral Content Schema
-- Supports price tracking, viral content history, and learning system

-- Price tracking table for scraped data
CREATE TABLE IF NOT EXISTS price_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  brand TEXT NOT NULL,
  us_prices JSONB, -- {"sephora": 89, "ulta": 85, "amazon": 79}
  korean_prices JSONB, -- {"yesstyle": 35, "oliveyoung": 23}
  metadata JSONB, -- Store URLs, images, etc
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Viral content generation history
CREATE TABLE IF NOT EXISTS viral_content_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL, -- 'tiktok', 'instagram', 'twitter'
  content JSONB NOT NULL, -- Full generated content
  metadata JSONB, -- Product, prices, trends used
  ai_model TEXT, -- 'claude-3-opus', 'gpt-4', etc
  performance_metrics JSONB, -- Track views, likes, shares
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add price_history column to products if not exists
ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_history JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS last_scraped TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_update BOOLEAN DEFAULT FALSE;

-- Competitor monitoring table
CREATE TABLE IF NOT EXISTS competitor_monitoring (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  website_url TEXT,
  social_handles JSONB, -- {"instagram": "@handle", "tiktok": "@handle"}
  products_tracked JSONB DEFAULT '[]'::JSONB,
  last_checked TIMESTAMP WITH TIME ZONE,
  insights JSONB, -- AI-generated insights
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trending topics for content generation
CREATE TABLE IF NOT EXISTS trending_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  platform TEXT,
  relevance_score DECIMAL(3,2), -- 0.00 to 1.00
  engagement_metrics JSONB,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scraping jobs for automation
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'price_check', 'competitor_scan', 'trend_analysis'
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  target_data JSONB, -- Products/URLs to scrape
  results JSONB,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning system for content improvement
CREATE TABLE IF NOT EXISTS content_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID REFERENCES viral_content_history(id),
  platform TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0, -- Led to Seoul Sister visits
  viral_score DECIMAL(3,2), -- Calculated virality score
  feedback JSONB, -- User feedback and notes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_tracking_product ON price_tracking(product_name, brand);
CREATE INDEX IF NOT EXISTS idx_price_tracking_date ON price_tracking(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_viral_content_platform ON viral_content_history(platform);
CREATE INDEX IF NOT EXISTS idx_viral_content_date ON viral_content_history(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trending_topics_active ON trending_topics(expires_at) WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON scraping_jobs(status, scheduled_for);

-- Function to calculate average prices
CREATE OR REPLACE FUNCTION calculate_avg_price(prices JSONB)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL := 0;
  count INTEGER := 0;
  price_value DECIMAL;
BEGIN
  FOR price_value IN SELECT value::DECIMAL FROM jsonb_each_text(prices)
  LOOP
    IF price_value > 0 THEN
      total := total + price_value;
      count := count + 1;
    END IF;
  END LOOP;

  IF count > 0 THEN
    RETURN total / count;
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update product prices from scraping
CREATE OR REPLACE FUNCTION update_product_prices()
RETURNS TRIGGER AS $$
BEGIN
  -- Update products table with latest scraped prices
  UPDATE products
  SET
    us_price = ROUND(calculate_avg_price(NEW.us_prices)),
    seoul_price = ROUND(calculate_avg_price(NEW.korean_prices)),
    savings_percentage = ROUND(
      ((calculate_avg_price(NEW.us_prices) - calculate_avg_price(NEW.korean_prices))
      / NULLIF(calculate_avg_price(NEW.us_prices), 0)) * 100
    ),
    last_scraped = NEW.scraped_at,
    price_history = price_history || jsonb_build_object(
      'date', NEW.scraped_at,
      'us_prices', NEW.us_prices,
      'korean_prices', NEW.korean_prices
    )
  WHERE
    brand = NEW.brand
    AND name_english = NEW.product_name
    AND auto_update = TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update products when prices are scraped
CREATE TRIGGER update_products_on_scrape
  AFTER INSERT ON price_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_product_prices();

-- Function to clean old data
CREATE OR REPLACE FUNCTION clean_old_tracking_data()
RETURNS void AS $$
BEGIN
  -- Delete price tracking older than 90 days
  DELETE FROM price_tracking
  WHERE scraped_at < NOW() - INTERVAL '90 days';

  -- Delete old viral content without performance data
  DELETE FROM viral_content_history
  WHERE generated_at < NOW() - INTERVAL '30 days'
    AND id NOT IN (SELECT content_id FROM content_performance);

  -- Delete expired trending topics
  DELETE FROM trending_topics
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (would use pg_cron in production)
-- SELECT cron.schedule('clean-tracking-data', '0 2 * * *', 'SELECT clean_old_tracking_data()');

-- Sample data for testing
INSERT INTO trending_topics (topic, platform, relevance_score, expires_at) VALUES
  ('glass skin', 'tiktok', 0.95, NOW() + INTERVAL '7 days'),
  ('clean girl aesthetic', 'instagram', 0.88, NOW() + INTERVAL '5 days'),
  ('douyin makeup', 'tiktok', 0.92, NOW() + INTERVAL '10 days'),
  ('sunscreen controversy', 'twitter', 0.79, NOW() + INTERVAL '3 days'),
  ('K-beauty routine', 'instagram', 0.85, NOW() + INTERVAL '14 days')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE price_tracking IS 'Stores all scraped price data from US and Korean retailers';
COMMENT ON TABLE viral_content_history IS 'AI-generated content history with performance tracking';
COMMENT ON TABLE competitor_monitoring IS 'Track competitor pricing and content strategies';
COMMENT ON TABLE trending_topics IS 'Current trending topics for content generation';
COMMENT ON TABLE scraping_jobs IS 'Automated scraping job queue and history';