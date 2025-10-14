-- Seoul Beauty Intelligence Report Tables
-- Premium daily research feature for members

-- Main reports table
CREATE TABLE IF NOT EXISTS beauty_intelligence_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_date DATE NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    executive_summary TEXT NOT NULL,

    -- Report sections
    trending_discoveries JSONB NOT NULL DEFAULT '[]',
    ingredient_analysis JSONB NOT NULL DEFAULT '[]',
    korean_social_insights JSONB NOT NULL DEFAULT '[]',
    expert_predictions JSONB NOT NULL DEFAULT '[]',

    -- Key highlights
    hero_product JSONB,
    hero_ingredient JSONB,
    viral_trend JSONB,

    -- Metadata
    view_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    premium_only BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,

    -- AI generation data
    generation_metadata JSONB DEFAULT '{}'::JSONB
);

-- Report categories for organization
CREATE TABLE IF NOT EXISTS report_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    color TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Link reports to categories
CREATE TABLE IF NOT EXISTS report_category_links (
    report_id UUID REFERENCES beauty_intelligence_reports(id) ON DELETE CASCADE,
    category_id UUID REFERENCES report_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (report_id, category_id)
);

-- User interactions with reports
CREATE TABLE IF NOT EXISTS report_user_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES beauty_intelligence_reports(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    interaction_type TEXT CHECK (interaction_type IN ('view', 'save', 'share', 'download')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_id, user_id, interaction_type)
);

-- Report sections for detailed content
CREATE TABLE IF NOT EXISTS report_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES beauty_intelligence_reports(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    data JSONB DEFAULT '{}'::JSONB,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trending products featured in reports
CREATE TABLE IF NOT EXISTS report_trending_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES beauty_intelligence_reports(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT,
    seoul_price DECIMAL(10,2),
    us_price DECIMAL(10,2),
    savings_percentage INTEGER,
    trending_score INTEGER,
    social_mentions INTEGER,
    discovery_source TEXT,
    insights JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ingredient intelligence data
CREATE TABLE IF NOT EXISTS report_ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID REFERENCES beauty_intelligence_reports(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    inci_name TEXT,
    category TEXT,
    benefits TEXT[],
    skin_types TEXT[],
    trending_score INTEGER,
    scientific_studies JSONB DEFAULT '[]'::JSONB,
    korean_popularity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_reports_date ON beauty_intelligence_reports(report_date DESC);
CREATE INDEX idx_reports_published ON beauty_intelligence_reports(published_at DESC);
CREATE INDEX idx_report_interactions_user ON report_user_interactions(user_id);
CREATE INDEX idx_report_sections_report ON report_sections(report_id, display_order);
CREATE INDEX idx_trending_products_report ON report_trending_products(report_id);
CREATE INDEX idx_ingredients_report ON report_ingredients(report_id);

-- Insert default categories
INSERT INTO report_categories (name, slug, description, icon, color, display_order) VALUES
    ('Trending Now', 'trending-now', 'Latest viral products and trends from Korea', '🔥', '#FFD700', 1),
    ('Ingredient Science', 'ingredient-science', 'Deep dives into K-beauty ingredients', '🧪', '#D4A574', 2),
    ('Social Insights', 'social-insights', 'What Korean influencers are using', '📱', '#E8D5C4', 3),
    ('Expert Analysis', 'expert-analysis', 'Professional dermatologist insights', '👩‍⚕️', '#B8956A', 4),
    ('Price Intelligence', 'price-intelligence', 'Seoul vs US price comparisons', '💰', '#FFD700', 5)
ON CONFLICT (slug) DO NOTHING;

-- Function to update report view count
CREATE OR REPLACE FUNCTION increment_report_view_count(report_id_param UUID)
RETURNS void AS $$
BEGIN
    UPDATE beauty_intelligence_reports
    SET view_count = view_count + 1
    WHERE id = report_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's saved reports
CREATE OR REPLACE FUNCTION get_user_saved_reports(user_id_param UUID)
RETURNS TABLE (
    report_id UUID,
    report_date DATE,
    title TEXT,
    subtitle TEXT,
    saved_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id as report_id,
        r.report_date,
        r.title,
        r.subtitle,
        i.created_at as saved_at
    FROM beauty_intelligence_reports r
    JOIN report_user_interactions i ON r.id = i.report_id
    WHERE i.user_id = user_id_param
    AND i.interaction_type = 'save'
    ORDER BY i.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE beauty_intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_trending_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_ingredients ENABLE ROW LEVEL SECURITY;

-- Public can view published reports (premium check happens in app)
CREATE POLICY "Reports viewable when published" ON beauty_intelligence_reports
    FOR SELECT
    USING (published_at IS NOT NULL);

-- Categories are public
CREATE POLICY "Categories are public" ON report_categories
    FOR SELECT
    USING (true);

-- Category links are viewable with reports
CREATE POLICY "Category links viewable with reports" ON report_category_links
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM beauty_intelligence_reports
        WHERE id = report_category_links.report_id
        AND published_at IS NOT NULL
    ));

-- Users can manage their own interactions
CREATE POLICY "Users manage own interactions" ON report_user_interactions
    FOR ALL
    USING (auth.uid() = user_id);

-- Report sections viewable with reports
CREATE POLICY "Sections viewable with reports" ON report_sections
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM beauty_intelligence_reports
        WHERE id = report_sections.report_id
        AND published_at IS NOT NULL
    ));

-- Trending products viewable with reports
CREATE POLICY "Trending products viewable with reports" ON report_trending_products
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM beauty_intelligence_reports
        WHERE id = report_trending_products.report_id
        AND published_at IS NOT NULL
    ));

-- Ingredients viewable with reports
CREATE POLICY "Ingredients viewable with reports" ON report_ingredients
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM beauty_intelligence_reports
        WHERE id = report_ingredients.report_id
        AND published_at IS NOT NULL
    ));