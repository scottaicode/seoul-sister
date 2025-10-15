-- Korean Beauty Data Pipeline Schema
-- Supporting tables for live data discovery and trend analysis

-- Trending Ingredients Table
CREATE TABLE IF NOT EXISTS trending_ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_name TEXT UNIQUE NOT NULL,
    trend_score INTEGER DEFAULT 0,
    weekly_growth_percentage DECIMAL(5,2) DEFAULT 0,
    monthly_growth_percentage DECIMAL(5,2) DEFAULT 0,
    data_source TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Beauty Trends Table
CREATE TABLE IF NOT EXISTS social_beauty_trends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trend_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    mention_count INTEGER DEFAULT 0,
    growth_rate_percentage DECIMAL(5,2) DEFAULT 0,
    hashtags TEXT[] DEFAULT '{}',
    influencer_engagement INTEGER DEFAULT 0,
    data_source TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(trend_name, platform)
);

-- Korean Beauty Market Data
CREATE TABLE IF NOT EXISTS market_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_date DATE DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    market_size_krw BIGINT,
    growth_rate_percentage DECIMAL(5,2),
    top_brands TEXT[],
    emerging_brands TEXT[],
    key_insights TEXT,
    data_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Launch Calendar
CREATE TABLE IF NOT EXISTS product_launches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT,
    launch_date DATE,
    korean_price DECIMAL(10,2),
    predicted_trend_score INTEGER,
    key_ingredients TEXT[],
    target_concerns TEXT[],
    pre_launch_buzz_score INTEGER DEFAULT 0,
    data_source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Korean Retailer Performance
CREATE TABLE IF NOT EXISTS retailer_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    retailer_name TEXT NOT NULL,
    platform_type TEXT, -- 'online', 'offline', 'app'
    monthly_transaction_volume INTEGER,
    average_order_value_krw DECIMAL(10,2),
    customer_satisfaction_score DECIMAL(3,2),
    delivery_speed_days DECIMAL(3,1),
    return_rate_percentage DECIMAL(5,2),
    authenticity_guarantee BOOLEAN DEFAULT FALSE,
    data_source TEXT,
    analysis_month DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingredient Popularity Tracking
CREATE TABLE IF NOT EXISTS ingredient_popularity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_name TEXT NOT NULL,
    korean_name TEXT,
    inci_name TEXT,
    category TEXT, -- 'active', 'moisturizer', 'preservative', etc.
    popularity_score INTEGER DEFAULT 0,
    product_count INTEGER DEFAULT 0, -- How many products contain this ingredient
    user_satisfaction_score DECIMAL(3,2),
    scientific_backing_score INTEGER DEFAULT 0,
    trending_direction TEXT DEFAULT 'stable', -- 'rising', 'falling', 'stable'
    seasonal_trend JSONB DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ingredient_name)
);

-- K-Beauty Influencer Impact
CREATE TABLE IF NOT EXISTS influencer_impact (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    influencer_handle TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'tiktok', 'instagram', 'youtube', 'naver'
    follower_count INTEGER,
    engagement_rate DECIMAL(5,2),
    beauty_focus_percentage DECIMAL(5,2),
    korean_brand_mentions INTEGER DEFAULT 0,
    product_recommendation_impact_score INTEGER DEFAULT 0,
    recent_viral_content TEXT,
    last_analyzed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(influencer_handle, platform)
);

-- Price Movement Tracking
CREATE TABLE IF NOT EXISTS price_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES beauty_products(id),
    retailer_id UUID REFERENCES price_retailers(id),
    price_krw DECIMAL(10,2) NOT NULL,
    price_usd DECIMAL(10,2),
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    stock_status TEXT DEFAULT 'in_stock',
    price_change_from_previous DECIMAL(10,2) DEFAULT 0,
    price_trend TEXT DEFAULT 'stable', -- 'increasing', 'decreasing', 'stable'
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seasonal Trend Analysis
CREATE TABLE IF NOT EXISTS seasonal_trends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    season TEXT NOT NULL, -- 'spring', 'summer', 'fall', 'winter'
    year INTEGER NOT NULL,
    category TEXT NOT NULL,
    trending_products TEXT[],
    popular_ingredients TEXT[],
    search_volume_increase_percentage DECIMAL(5,2),
    sales_volume_krw BIGINT,
    consumer_behavior_insights TEXT,
    weather_correlation JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(season, year, category)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trending_ingredients_score ON trending_ingredients(trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_trending_ingredients_updated ON trending_ingredients(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_social_trends_platform ON social_beauty_trends(platform, mention_count DESC);
CREATE INDEX IF NOT EXISTS idx_social_trends_updated ON social_beauty_trends(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_market_analysis_date ON market_analysis(analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_product_launches_date ON product_launches(launch_date DESC);
CREATE INDEX IF NOT EXISTS idx_retailer_performance_month ON retailer_performance(analysis_month DESC);
CREATE INDEX IF NOT EXISTS idx_ingredient_popularity_score ON ingredient_popularity(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_influencer_impact_score ON influencer_impact(product_recommendation_impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_price_movements_recorded ON price_movements(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_movements_product ON price_movements(product_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_seasonal_trends_year ON seasonal_trends(year DESC, season);

-- Functions for trend analysis
CREATE OR REPLACE FUNCTION calculate_ingredient_trend(ingredient_name_param TEXT)
RETURNS JSONB AS $$
DECLARE
    current_score INTEGER;
    previous_score INTEGER;
    trend_direction TEXT;
    growth_rate DECIMAL(5,2);
BEGIN
    -- Get current trend score
    SELECT trend_score INTO current_score
    FROM trending_ingredients
    WHERE ingredient_name = ingredient_name_param;

    -- Calculate trend direction and growth
    IF current_score IS NULL THEN
        RETURN jsonb_build_object(
            'trend_direction', 'new',
            'growth_rate', 0,
            'score', 0
        );
    END IF;

    -- Simplified trend calculation (in production, would use historical data)
    IF current_score >= 90 THEN
        trend_direction := 'rising';
        growth_rate := 15.0;
    ELSIF current_score >= 70 THEN
        trend_direction := 'stable';
        growth_rate := 5.0;
    ELSE
        trend_direction := 'falling';
        growth_rate := -10.0;
    END IF;

    RETURN jsonb_build_object(
        'trend_direction', trend_direction,
        'growth_rate', growth_rate,
        'score', current_score
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update product trending scores
CREATE OR REPLACE FUNCTION update_product_trending_scores()
RETURNS VOID AS $$
BEGIN
    -- Update beauty_products trending scores based on various factors
    UPDATE beauty_products
    SET trending_score = LEAST(100, GREATEST(0,
        COALESCE(trending_score, 50) +
        -- Boost for products with trending ingredients
        (SELECT COUNT(*) * 5 FROM trending_ingredients ti
         WHERE ti.ingredient_name = ANY(string_to_array(beauty_products.description, ' '))
         AND ti.trend_score > 80) +
        -- Boost for recent price updates
        (CASE WHEN last_updated > NOW() - INTERVAL '7 days' THEN 10 ELSE 0 END) +
        -- Random market fluctuation
        (RANDOM() * 10 - 5)::INTEGER
    )),
    last_updated = NOW()
    WHERE trending_score IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing
INSERT INTO trending_ingredients (ingredient_name, trend_score, weekly_growth_percentage, data_source) VALUES
('Centella Asiatica', 98, 15.5, 'korean_beauty_pipeline'),
('Niacinamide', 94, 8.2, 'korean_beauty_pipeline'),
('Hyaluronic Acid', 91, 12.1, 'korean_beauty_pipeline'),
('Snail Secretion Filtrate', 89, 22.4, 'korean_beauty_pipeline'),
('Rice Bran Extract', 87, 18.7, 'korean_beauty_pipeline')
ON CONFLICT (ingredient_name) DO UPDATE SET
    trend_score = EXCLUDED.trend_score,
    weekly_growth_percentage = EXCLUDED.weekly_growth_percentage,
    last_updated = NOW();

INSERT INTO social_beauty_trends (trend_name, platform, mention_count, growth_rate_percentage, hashtags, data_source) VALUES
('Glass Skin Challenge', 'TikTok Korea', 450000, 340.5, ARRAY['#유리피부', '#GlassSkinKorea', '#한국뷰티'], 'korean_beauty_pipeline'),
('Skinimalism', 'Instagram Korea', 230000, 125.3, ARRAY['#스키니멀리즘', '#SimpleBeauty', '#미니멀뷰티'], 'korean_beauty_pipeline'),
('Fermented Beauty', 'YouTube Korea', 180000, 89.2, ARRAY['#발효뷰티', '#FermentedSkincare', '#한방뷰티'], 'korean_beauty_pipeline')
ON CONFLICT (trend_name, platform) DO UPDATE SET
    mention_count = EXCLUDED.mention_count,
    growth_rate_percentage = EXCLUDED.growth_rate_percentage,
    hashtags = EXCLUDED.hashtags,
    last_updated = NOW();

-- Success message
SELECT 'Korean Beauty Data Pipeline schema applied successfully! 🇰🇷' as status;