-- Apply Seoul Sister Learning System Schema to Supabase
-- Run this script in Supabase SQL editor to create the competitive moat learning system

-- First, let's check what tables already exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'user_purchase_decisions',
    'authenticity_reports',
    'retailer_reputation_scores',
    'price_anomaly_patterns',
    'community_verifications',
    'ml_training_data'
);

-- User Purchase Decisions & Behavior Tracking
CREATE TABLE IF NOT EXISTS user_purchase_decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT, -- For anonymous users
    product_id TEXT NOT NULL,
    retailer_id UUID REFERENCES price_retailers(id),

    -- Decision context
    authenticity_score_shown INTEGER, -- What score we displayed
    price_shown DECIMAL(10,2),
    was_best_deal BOOLEAN,
    risk_level_shown TEXT, -- VERIFIED, TRUSTED, CAUTION, etc.

    -- User action
    clicked_through BOOLEAN DEFAULT FALSE,
    purchase_confirmed BOOLEAN DEFAULT FALSE,
    time_spent_viewing INTEGER, -- seconds on modal
    viewed_authenticity_guide BOOLEAN DEFAULT FALSE,

    -- Outcome tracking
    reported_counterfeit BOOLEAN DEFAULT FALSE,
    reported_authentic BOOLEAN DEFAULT FALSE,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Reported Authenticity Feedback
CREATE TABLE IF NOT EXISTS authenticity_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT,

    -- Product & retailer info
    product_id TEXT NOT NULL,
    retailer_id UUID REFERENCES price_retailers(id),
    purchase_price DECIMAL(10,2),
    purchase_date DATE,

    -- Authenticity assessment
    is_authentic BOOLEAN NOT NULL,
    confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5),

    -- Evidence provided
    has_photo_evidence BOOLEAN DEFAULT FALSE,
    has_batch_code BOOLEAN DEFAULT FALSE,
    packaging_issues TEXT,
    product_issues TEXT,

    -- Verification status
    verified_by_admin BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    community_votes_authentic INTEGER DEFAULT 0,
    community_votes_counterfeit INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dynamic Retailer Reputation Scoring
CREATE TABLE IF NOT EXISTS retailer_reputation_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    retailer_id UUID REFERENCES price_retailers(id) UNIQUE,

    -- Base scores (from our research)
    base_authenticity_score INTEGER DEFAULT 50,

    -- Dynamic learning scores
    user_reported_authentic_count INTEGER DEFAULT 0,
    user_reported_counterfeit_count INTEGER DEFAULT 0,
    successful_purchases_count INTEGER DEFAULT 0,
    failed_purchases_count INTEGER DEFAULT 0,

    -- Calculated scores (will be computed via function due to Supabase limitations)
    dynamic_authenticity_score INTEGER DEFAULT 50,
    confidence_level DECIMAL(5,2) DEFAULT 50.0,

    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Price Anomaly Detection Learning
CREATE TABLE IF NOT EXISTS price_anomaly_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_category TEXT,
    brand TEXT,

    -- Price pattern analysis
    normal_price_min DECIMAL(10,2),
    normal_price_max DECIMAL(10,2),
    counterfeit_threshold_percentage DECIMAL(5,2), -- % below normal that indicates fake

    -- Learning data (simplified for Supabase)
    confirmed_authentic_count INTEGER DEFAULT 0,
    confirmed_counterfeit_count INTEGER DEFAULT 0,
    avg_authentic_price DECIMAL(10,2),
    avg_counterfeit_price DECIMAL(10,2),

    -- Statistical confidence
    sample_size INTEGER DEFAULT 0,
    confidence_score DECIMAL(5,2) DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community Verification Crowdsourcing
CREATE TABLE IF NOT EXISTS community_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target_report_id UUID REFERENCES authenticity_reports(id),

    -- Verification decision
    agrees_with_report BOOLEAN NOT NULL,
    expertise_level INTEGER CHECK (expertise_level >= 1 AND expertise_level <= 5),
    confidence INTEGER CHECK (confidence >= 1 AND confidence <= 5),

    -- Additional evidence
    additional_notes TEXT,
    has_similar_experience BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Machine Learning Training Data Aggregation
CREATE TABLE IF NOT EXISTS ml_training_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Input features
    retailer_name TEXT,
    product_category TEXT,
    brand TEXT,
    price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),
    retailer_country TEXT,
    shipping_cost DECIMAL(10,2),

    -- Behavioral features
    user_hesitation_time INTEGER, -- time spent on modal before decision
    viewed_authenticity_guide BOOLEAN,
    authenticity_score_shown INTEGER,

    -- Ground truth label
    is_authentic BOOLEAN,
    confidence_score DECIMAL(5,2),

    -- Metadata
    data_source TEXT, -- 'user_report', 'admin_verification', 'community_consensus'
    sample_weight DECIMAL(5,2) DEFAULT 1.0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intelligence Reports Schema (for our detailed report system)
CREATE TABLE IF NOT EXISTS intelligence_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    author TEXT DEFAULT 'Seoul Sister Intelligence Team',
    category TEXT DEFAULT 'Daily Intelligence',
    tags TEXT[] DEFAULT '{}',
    featured_image_url TEXT,
    reading_time_minutes INTEGER DEFAULT 5,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Intelligence Report Sections (for detailed breakdowns)
CREATE TABLE IF NOT EXISTS intelligence_report_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES intelligence_reports(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL, -- 'trending_products', 'ingredient_analysis', 'social_insights'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_purchase_decisions_user_id ON user_purchase_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchase_decisions_product_retailer ON user_purchase_decisions(product_id, retailer_id);
CREATE INDEX IF NOT EXISTS idx_authenticity_reports_retailer ON authenticity_reports(retailer_id);
CREATE INDEX IF NOT EXISTS idx_authenticity_reports_product ON authenticity_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_retailer_reputation_scores_retailer ON retailer_reputation_scores(retailer_id);
CREATE INDEX IF NOT EXISTS idx_ml_training_data_features ON ml_training_data(retailer_name, product_category, brand);
CREATE INDEX IF NOT EXISTS idx_intelligence_reports_status ON intelligence_reports(status, published_at);
CREATE INDEX IF NOT EXISTS idx_intelligence_report_sections_report ON intelligence_report_sections(report_id, order_index);

-- Row Level Security (RLS) policies
ALTER TABLE user_purchase_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE authenticity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_report_sections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own purchase decisions" ON user_purchase_decisions;
DROP POLICY IF EXISTS "Users can insert own purchase decisions" ON user_purchase_decisions;
DROP POLICY IF EXISTS "Service role can manage purchase decisions" ON user_purchase_decisions;
DROP POLICY IF EXISTS "Users can view own authenticity reports" ON authenticity_reports;
DROP POLICY IF EXISTS "Users can insert own authenticity reports" ON authenticity_reports;
DROP POLICY IF EXISTS "Service role can manage authenticity reports" ON authenticity_reports;
DROP POLICY IF EXISTS "Users can view community verifications" ON community_verifications;
DROP POLICY IF EXISTS "Users can insert community verifications" ON community_verifications;
DROP POLICY IF EXISTS "Public read access to retailer reputation" ON retailer_reputation_scores;
DROP POLICY IF EXISTS "Public read access to price patterns" ON price_anomaly_patterns;
DROP POLICY IF EXISTS "Public read intelligence reports" ON intelligence_reports;
DROP POLICY IF EXISTS "Public read intelligence report sections" ON intelligence_report_sections;

-- User policies
CREATE POLICY "Users can view own purchase decisions" ON user_purchase_decisions
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own purchase decisions" ON user_purchase_decisions
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can manage purchase decisions" ON user_purchase_decisions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view own authenticity reports" ON authenticity_reports
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert own authenticity reports" ON authenticity_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can manage authenticity reports" ON authenticity_reports
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view community verifications" ON community_verifications
    FOR SELECT USING (true);

CREATE POLICY "Users can insert community verifications" ON community_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Public read access for aggregated data
CREATE POLICY "Public read access to retailer reputation" ON retailer_reputation_scores
    FOR SELECT USING (true);

CREATE POLICY "Public read access to price patterns" ON price_anomaly_patterns
    FOR SELECT USING (true);

-- Intelligence reports - public read access
CREATE POLICY "Public read intelligence reports" ON intelligence_reports
    FOR SELECT USING (status = 'published');

CREATE POLICY "Public read intelligence report sections" ON intelligence_report_sections
    FOR SELECT USING (true);

-- Functions for automated learning updates
CREATE OR REPLACE FUNCTION update_retailer_reputation()
RETURNS TRIGGER AS $$
BEGIN
    -- Update retailer reputation when new authenticity report is added
    INSERT INTO retailer_reputation_scores (retailer_id, base_authenticity_score)
    VALUES (NEW.retailer_id, 50)
    ON CONFLICT (retailer_id) DO UPDATE SET
        user_reported_authentic_count = CASE
            WHEN NEW.is_authentic THEN retailer_reputation_scores.user_reported_authentic_count + 1
            ELSE retailer_reputation_scores.user_reported_authentic_count
        END,
        user_reported_counterfeit_count = CASE
            WHEN NOT NEW.is_authentic THEN retailer_reputation_scores.user_reported_counterfeit_count + 1
            ELSE retailer_reputation_scores.user_reported_counterfeit_count
        END,
        dynamic_authenticity_score = LEAST(100, GREATEST(0,
            retailer_reputation_scores.base_authenticity_score +
            (CASE WHEN NEW.is_authentic THEN retailer_reputation_scores.user_reported_authentic_count + 1
                  ELSE retailer_reputation_scores.user_reported_authentic_count END * 2) -
            (CASE WHEN NOT NEW.is_authentic THEN retailer_reputation_scores.user_reported_counterfeit_count + 1
                  ELSE retailer_reputation_scores.user_reported_counterfeit_count END * 5)
        )),
        confidence_level = LEAST(99.9,
            50 + (retailer_reputation_scores.user_reported_authentic_count +
                  retailer_reputation_scores.user_reported_counterfeit_count +
                  retailer_reputation_scores.successful_purchases_count +
                  retailer_reputation_scores.failed_purchases_count) * 2
        ),
        last_updated = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_retailer_reputation ON authenticity_reports;
CREATE TRIGGER trigger_update_retailer_reputation
    AFTER INSERT ON authenticity_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_retailer_reputation();

-- Function to update purchase decision outcomes
CREATE OR REPLACE FUNCTION update_purchase_outcomes()
RETURNS TRIGGER AS $$
BEGIN
    -- Update retailer reputation based on purchase outcomes
    IF NEW.purchase_confirmed = true AND OLD.purchase_confirmed = false THEN
        UPDATE retailer_reputation_scores
        SET successful_purchases_count = successful_purchases_count + 1,
            last_updated = NOW()
        WHERE retailer_id = NEW.retailer_id;
    END IF;

    IF NEW.reported_counterfeit = true AND OLD.reported_counterfeit = false THEN
        UPDATE retailer_reputation_scores
        SET failed_purchases_count = failed_purchases_count + 1,
            last_updated = NOW()
        WHERE retailer_id = NEW.retailer_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for purchase outcomes
DROP TRIGGER IF EXISTS trigger_update_purchase_outcomes ON user_purchase_decisions;
CREATE TRIGGER trigger_update_purchase_outcomes
    AFTER UPDATE ON user_purchase_decisions
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_outcomes();

-- Insert sample intelligence report
INSERT INTO intelligence_reports (
    id,
    title,
    summary,
    content,
    category,
    tags,
    reading_time_minutes
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Seoul Beauty Intelligence Report',
    'Exclusive insights from Korea''s beauty capital with breakthrough product discoveries, ingredient analysis, and viral trend intelligence.',
    '<p>Today''s intelligence reveals 5 breakthrough products trending in Seoul, with average savings of 73% versus US retail. Centella Asiatica dominates Korean formulations with a 98% popularity score, while the "Glass Skin" trend reaches viral status across Korean beauty platforms.</p><p>Our Seoul-based research team has identified unprecedented growth in fermented skincare ingredients, with major K-beauty brands preparing Q2 2025 launches focusing on probiotics and rice-derived compounds.</p>',
    'Daily Intelligence',
    ARRAY['K-Beauty', 'Trends', 'Ingredients', 'Market Analysis'],
    8
) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    updated_at = NOW();

-- Sample report sections
INSERT INTO intelligence_report_sections (
    report_id,
    section_type,
    title,
    content,
    order_index,
    metadata
) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'trending_products',
    'Breakthrough Product Discoveries',
    '<p>Our Seoul team has identified 5 products experiencing unprecedented growth in Korean beauty retail:</p><ul><li><strong>Beauty of Joseon Relief Sun</strong> - #1 bestseller for 12 consecutive weeks</li><li><strong>COSRX Advanced Snail 96 Mucin</strong> - Viral on TikTok with 45M+ views</li><li><strong>Torriden DIVE-IN Low Molecule Hyaluronic Acid Serum</strong> - 340% sales increase</li></ul>',
    1,
    '{"product_count": 5, "avg_savings": 73, "data_source": "Olive Young, Hwahae, Glowpick"}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    'ingredient_analysis',
    'Ingredient Intelligence Lab',
    '<p><strong>Centella Asiatica</strong> continues its dominance with 98% popularity score across Korean formulations.</p><p>Emerging trends show fermented ingredients gaining traction:</p><ul><li>Fermented Rice Bran - 245% increase in product launches</li><li>Bifida Ferment Lysate - Premium positioning trend</li><li>Galactomyces - Cross-over from traditional to mainstream</li></ul>',
    2,
    '{"ingredients_analyzed": 15, "trend_score": 98, "scientific_studies": 23}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000001',
    'social_insights',
    'Korean Social Media Intelligence',
    '<p>The "Glass Skin Challenge" has achieved viral status on Korean TikTok with 450% growth in mentions over 30 days.</p><p>Key trending hashtags:</p><ul><li>#유리피부 (Glass Skin) - 12.5M views</li><li>#GlassSkinKorea - 8.2M views</li><li>#한국뷰티 (Korean Beauty) - 45.8M views</li></ul>',
    3,
    '{"platform": "TikTok Korea", "virality_score": 94, "total_mentions": 450000}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Success message
SELECT 'Seoul Sister Learning System schema applied successfully! 🚀' as status;