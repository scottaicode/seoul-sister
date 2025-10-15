-- Seoul Sister Learning System Database Schema
-- Creates competitive moat through user behavior learning and authenticity intelligence

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

    -- Calculated scores
    dynamic_authenticity_score INTEGER GENERATED ALWAYS AS (
        LEAST(100, GREATEST(0,
            base_authenticity_score +
            (user_reported_authentic_count * 2) -
            (user_reported_counterfeit_count * 5) +
            (successful_purchases_count * 1) -
            (failed_purchases_count * 3)
        ))
    ) STORED,

    confidence_level DECIMAL(5,2) GENERATED ALWAYS AS (
        LEAST(99.9,
            50 + (user_reported_authentic_count + user_reported_counterfeit_count +
                  successful_purchases_count + failed_purchases_count) * 2
        )
    ) STORED,

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

    -- Learning data
    confirmed_authentic_prices DECIMAL(10,2)[] DEFAULT '{}',
    confirmed_counterfeit_prices DECIMAL(10,2)[] DEFAULT '{}',

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_purchase_decisions_user_id ON user_purchase_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchase_decisions_product_retailer ON user_purchase_decisions(product_id, retailer_id);
CREATE INDEX IF NOT EXISTS idx_authenticity_reports_retailer ON authenticity_reports(retailer_id);
CREATE INDEX IF NOT EXISTS idx_authenticity_reports_product ON authenticity_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_retailer_reputation_scores_retailer ON retailer_reputation_scores(retailer_id);
CREATE INDEX IF NOT EXISTS idx_ml_training_data_features ON ml_training_data(retailer_name, product_category, brand);

-- Row Level Security (RLS) policies
ALTER TABLE user_purchase_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE authenticity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_verifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own purchase decisions" ON user_purchase_decisions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchase decisions" ON user_purchase_decisions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own authenticity reports" ON authenticity_reports
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own authenticity reports" ON authenticity_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view community verifications" ON community_verifications
    FOR SELECT USING (true);

CREATE POLICY "Users can insert community verifications" ON community_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Public read access for aggregated data
CREATE POLICY "Public read access to retailer reputation" ON retailer_reputation_scores
    FOR SELECT USING (true);

CREATE POLICY "Public read access to price patterns" ON price_anomaly_patterns
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
        last_updated = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_retailer_reputation
    AFTER INSERT ON authenticity_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_retailer_reputation();

-- Function to generate ML training data
CREATE OR REPLACE FUNCTION generate_ml_training_sample(
    report_id UUID
) RETURNS VOID AS $$
DECLARE
    report_data authenticity_reports%ROWTYPE;
    decision_data user_purchase_decisions%ROWTYPE;
    retailer_data price_retailers%ROWTYPE;
BEGIN
    -- Get report data
    SELECT * INTO report_data FROM authenticity_reports WHERE id = report_id;

    -- Get related decision data
    SELECT * INTO decision_data
    FROM user_purchase_decisions
    WHERE product_id = report_data.product_id
      AND retailer_id = report_data.retailer_id
      AND user_id = report_data.user_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Get retailer data
    SELECT * INTO retailer_data FROM price_retailers WHERE id = report_data.retailer_id;

    -- Insert ML training sample
    INSERT INTO ml_training_data (
        retailer_name,
        product_category,
        brand,
        price,
        original_price,
        discount_percentage,
        retailer_country,
        shipping_cost,
        user_hesitation_time,
        viewed_authenticity_guide,
        authenticity_score_shown,
        is_authentic,
        confidence_score,
        data_source
    ) VALUES (
        retailer_data.name,
        'skincare', -- Default category, should be enhanced with product data
        '', -- Would need product brand data
        report_data.purchase_price,
        report_data.purchase_price * 1.2, -- Estimated original price
        CASE WHEN report_data.purchase_price > 0 THEN 20 ELSE 0 END,
        retailer_data.country,
        0, -- Would need shipping cost data
        COALESCE(decision_data.time_spent_viewing, 0),
        COALESCE(decision_data.viewed_authenticity_guide, false),
        COALESCE(decision_data.authenticity_score_shown, 50),
        report_data.is_authentic,
        report_data.confidence_level * 20, -- Convert 1-5 scale to percentage
        'user_report'
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate ML training data
CREATE TRIGGER trigger_generate_ml_training_data
    AFTER INSERT ON authenticity_reports
    FOR EACH ROW
    EXECUTE FUNCTION generate_ml_training_sample(NEW.id);