-- =============================================================================
-- Seoul Sister K-Beauty Intelligence Platform
-- COMBINED MIGRATION: All 9 migrations in order
-- Run this in Supabase SQL Editor in ONE go
-- =============================================================================

-- ===========================
-- MIGRATION 1: Foundation Schema
-- ===========================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Products
CREATE TABLE ss_products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_en          TEXT NOT NULL,
    name_ko          TEXT,
    brand_en         TEXT NOT NULL,
    brand_ko         TEXT,
    category         TEXT NOT NULL,
    subcategory      TEXT,
    description_en   TEXT,
    description_ko   TEXT,
    image_url        TEXT,
    volume_ml        INT,
    volume_display   TEXT,
    price_krw        INT,
    price_usd        DECIMAL(10, 2),
    rating_avg       DECIMAL(3, 2) CHECK (rating_avg >= 0 AND rating_avg <= 5),
    review_count     INT NOT NULL DEFAULT 0,
    is_verified      BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_ingredients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_inci           TEXT UNIQUE NOT NULL,
    name_en             TEXT,
    name_ko             TEXT,
    function            TEXT,
    description         TEXT,
    safety_rating       INT CHECK (safety_rating >= 1 AND safety_rating <= 5),
    comedogenic_rating  INT CHECK (comedogenic_rating >= 0 AND comedogenic_rating <= 5),
    is_fragrance        BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    common_concerns     TEXT[],
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_product_ingredients (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    ingredient_id    UUID NOT NULL REFERENCES ss_ingredients(id) ON DELETE RESTRICT,
    position         INT NOT NULL,
    concentration_pct DECIMAL(5, 3),
    UNIQUE (product_id, ingredient_id)
);

CREATE TABLE ss_ingredient_conflicts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_a_id UUID NOT NULL REFERENCES ss_ingredients(id) ON DELETE CASCADE,
    ingredient_b_id UUID NOT NULL REFERENCES ss_ingredients(id) ON DELETE CASCADE,
    severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description     TEXT NOT NULL,
    recommendation  TEXT,
    UNIQUE (ingredient_a_id, ingredient_b_id)
);

CREATE TABLE ss_retailers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT UNIQUE NOT NULL,
    website               TEXT,
    country               TEXT,
    trust_score           INT CHECK (trust_score >= 1 AND trust_score <= 100),
    ships_international   BOOLEAN NOT NULL DEFAULT false,
    affiliate_program     BOOLEAN NOT NULL DEFAULT false,
    affiliate_url_template TEXT
);

CREATE TABLE ss_product_prices (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id    UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    retailer_id   UUID NOT NULL REFERENCES ss_retailers(id) ON DELETE CASCADE,
    price_usd     DECIMAL(10, 2),
    price_krw     INT,
    url           TEXT,
    in_stock      BOOLEAN NOT NULL DEFAULT true,
    last_checked  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_counterfeit_markers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand        TEXT NOT NULL,
    marker_type  TEXT NOT NULL,
    description  TEXT NOT NULL,
    image_url    TEXT,
    severity     TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_counterfeit_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id  UUID REFERENCES ss_products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    image_urls  TEXT[] NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'confirmed', 'rejected')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_user_profiles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    skin_type        TEXT CHECK (skin_type IN ('oily', 'dry', 'combination', 'normal', 'sensitive')),
    skin_concerns    TEXT[],
    allergies        TEXT[],
    fitzpatrick_scale INT CHECK (fitzpatrick_scale >= 1 AND fitzpatrick_scale <= 6),
    climate          TEXT,
    age_range        TEXT CHECK (age_range IN ('18-24', '25-30', '31-35', '36-40', '41-50', '50+')),
    budget_range     TEXT CHECK (budget_range IN ('budget', 'mid-range', 'luxury', 'mixed')),
    experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_user_routines (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    routine_type TEXT NOT NULL CHECK (routine_type IN ('am', 'pm', 'weekly')),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_routine_products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id  UUID NOT NULL REFERENCES ss_user_routines(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    step_order  INT NOT NULL,
    frequency   TEXT,
    notes       TEXT,
    UNIQUE (routine_id, product_id)
);

CREATE TABLE ss_user_scans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id        UUID REFERENCES ss_products(id) ON DELETE SET NULL,
    image_url         TEXT,
    scan_type         TEXT NOT NULL CHECK (scan_type IN ('label', 'barcode', 'product_search', 'counterfeit')),
    extracted_text    TEXT,
    ingredients_found TEXT[],
    analysis_result   JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_user_wishlists (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id             UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    price_alert_threshold  DECIMAL(10, 2),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE TABLE ss_user_product_reactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    reaction   TEXT NOT NULL CHECK (reaction IN ('holy_grail', 'broke_me_out', 'no_effect', 'irritated', 'love', 'dislike')),
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE TABLE ss_reviews (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id       UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    rating           INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title            TEXT,
    body             TEXT NOT NULL,
    skin_type        TEXT CHECK (skin_type IN ('oily', 'dry', 'combination', 'normal', 'sensitive')),
    skin_concerns    TEXT[],
    reaction         TEXT CHECK (reaction IN ('holy_grail', 'broke_me_out', 'no_effect', 'irritated', 'love', 'dislike')),
    would_repurchase BOOLEAN,
    usage_duration   TEXT,
    helpful_count    INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE TABLE ss_review_helpfulness (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id  UUID NOT NULL REFERENCES ss_reviews(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (review_id, user_id)
);

CREATE TABLE ss_trending_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,
    trend_score     INT NOT NULL DEFAULT 0,
    mention_count   INT NOT NULL DEFAULT 0,
    sentiment_score DECIMAL(4, 3),
    trending_since  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_yuri_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT,
    specialist_type TEXT,
    message_count   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_yuri_messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES ss_yuri_conversations(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content          TEXT NOT NULL,
    image_urls       TEXT[] NOT NULL DEFAULT '{}',
    specialist_type  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_specialist_insights (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ss_yuri_conversations(id) ON DELETE CASCADE,
    specialist_type TEXT NOT NULL,
    insight_type    TEXT NOT NULL,
    data            JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_learning_patterns (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type     TEXT NOT NULL,
    skin_type        TEXT,
    skin_concerns    TEXT[],
    data             JSONB NOT NULL,
    confidence_score DECIMAL(4, 3),
    sample_size      INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_ingredient_effectiveness (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id       UUID NOT NULL REFERENCES ss_ingredients(id) ON DELETE CASCADE,
    skin_type           TEXT,
    concern             TEXT,
    effectiveness_score DECIMAL(4, 3),
    sample_size         INT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ingredient_id, skin_type, concern)
);

CREATE TABLE ss_product_effectiveness (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    skin_type           TEXT,
    effectiveness_score DECIMAL(4, 3),
    sample_size         INT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, skin_type)
);

CREATE TABLE ss_trend_signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source          TEXT NOT NULL,
    keyword         TEXT NOT NULL,
    signal_strength INT NOT NULL DEFAULT 0,
    data            JSONB,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_content_posts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    slug         TEXT UNIQUE NOT NULL,
    body         TEXT NOT NULL,
    category     TEXT,
    tags         TEXT[],
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    tier                    TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'student')),
    status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_affiliate_clicks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    product_id  UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    retailer_id UUID NOT NULL REFERENCES ss_retailers(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    clicked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- RLS POLICIES (Migration 1)
-- =============================================================================

ALTER TABLE ss_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_products_public_select" ON ss_products FOR SELECT USING (true);

ALTER TABLE ss_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_ingredients_public_select" ON ss_ingredients FOR SELECT USING (true);

ALTER TABLE ss_product_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_product_ingredients_public_select" ON ss_product_ingredients FOR SELECT USING (true);

ALTER TABLE ss_ingredient_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_ingredient_conflicts_public_select" ON ss_ingredient_conflicts FOR SELECT USING (true);

ALTER TABLE ss_product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_product_prices_public_select" ON ss_product_prices FOR SELECT USING (true);

ALTER TABLE ss_retailers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_retailers_public_select" ON ss_retailers FOR SELECT USING (true);

ALTER TABLE ss_counterfeit_markers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_counterfeit_markers_public_select" ON ss_counterfeit_markers FOR SELECT USING (true);

ALTER TABLE ss_trending_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_trending_products_public_select" ON ss_trending_products FOR SELECT USING (true);

ALTER TABLE ss_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_reviews_public_select" ON ss_reviews FOR SELECT USING (true);

ALTER TABLE ss_trend_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_trend_signals_public_select" ON ss_trend_signals FOR SELECT USING (true);

ALTER TABLE ss_content_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_content_posts_public_select" ON ss_content_posts FOR SELECT USING (published_at IS NOT NULL AND published_at <= NOW());

ALTER TABLE ss_learning_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_learning_patterns_public_select" ON ss_learning_patterns FOR SELECT USING (true);

ALTER TABLE ss_ingredient_effectiveness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_ingredient_effectiveness_public_select" ON ss_ingredient_effectiveness FOR SELECT USING (true);

ALTER TABLE ss_product_effectiveness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_product_effectiveness_public_select" ON ss_product_effectiveness FOR SELECT USING (true);

ALTER TABLE ss_counterfeit_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_counterfeit_reports_select_own" ON ss_counterfeit_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_counterfeit_reports_insert_own" ON ss_counterfeit_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_counterfeit_reports_update_own" ON ss_counterfeit_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_counterfeit_reports_delete_own" ON ss_counterfeit_reports FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_profiles_select_own" ON ss_user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_profiles_insert_own" ON ss_user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_profiles_update_own" ON ss_user_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_profiles_delete_own" ON ss_user_profiles FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_user_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_routines_select_own" ON ss_user_routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_routines_insert_own" ON ss_user_routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_routines_update_own" ON ss_user_routines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_routines_delete_own" ON ss_user_routines FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_routine_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_routine_products_select_own" ON ss_routine_products FOR SELECT USING (EXISTS (SELECT 1 FROM ss_user_routines r WHERE r.id = routine_id AND r.user_id = auth.uid()));
CREATE POLICY "ss_routine_products_insert_own" ON ss_routine_products FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ss_user_routines r WHERE r.id = routine_id AND r.user_id = auth.uid()));
CREATE POLICY "ss_routine_products_update_own" ON ss_routine_products FOR UPDATE USING (EXISTS (SELECT 1 FROM ss_user_routines r WHERE r.id = routine_id AND r.user_id = auth.uid()));
CREATE POLICY "ss_routine_products_delete_own" ON ss_routine_products FOR DELETE USING (EXISTS (SELECT 1 FROM ss_user_routines r WHERE r.id = routine_id AND r.user_id = auth.uid()));

ALTER TABLE ss_user_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_scans_select_own" ON ss_user_scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_scans_insert_own" ON ss_user_scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_scans_update_own" ON ss_user_scans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_scans_delete_own" ON ss_user_scans FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_user_wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_wishlists_select_own" ON ss_user_wishlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_wishlists_insert_own" ON ss_user_wishlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_wishlists_update_own" ON ss_user_wishlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_wishlists_delete_own" ON ss_user_wishlists FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_user_product_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_product_reactions_select_own" ON ss_user_product_reactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_product_reactions_insert_own" ON ss_user_product_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_product_reactions_update_own" ON ss_user_product_reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_product_reactions_delete_own" ON ss_user_product_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "ss_reviews_insert_own" ON ss_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_reviews_update_own" ON ss_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_reviews_delete_own" ON ss_reviews FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_review_helpfulness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_review_helpfulness_select_own" ON ss_review_helpfulness FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_review_helpfulness_insert_own" ON ss_review_helpfulness FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_review_helpfulness_update_own" ON ss_review_helpfulness FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_review_helpfulness_delete_own" ON ss_review_helpfulness FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_yuri_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_yuri_conversations_select_own" ON ss_yuri_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_yuri_conversations_insert_own" ON ss_yuri_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_yuri_conversations_update_own" ON ss_yuri_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_yuri_conversations_delete_own" ON ss_yuri_conversations FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_yuri_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_yuri_messages_select_own" ON ss_yuri_messages FOR SELECT USING (EXISTS (SELECT 1 FROM ss_yuri_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "ss_yuri_messages_insert_own" ON ss_yuri_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ss_yuri_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "ss_yuri_messages_update_own" ON ss_yuri_messages FOR UPDATE USING (EXISTS (SELECT 1 FROM ss_yuri_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "ss_yuri_messages_delete_own" ON ss_yuri_messages FOR DELETE USING (EXISTS (SELECT 1 FROM ss_yuri_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

ALTER TABLE ss_specialist_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_specialist_insights_select_own" ON ss_specialist_insights FOR SELECT USING (EXISTS (SELECT 1 FROM ss_yuri_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "ss_specialist_insights_insert_own" ON ss_specialist_insights FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ss_yuri_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

ALTER TABLE ss_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_subscriptions_select_own" ON ss_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_subscriptions_insert_own" ON ss_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_subscriptions_update_own" ON ss_subscriptions FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE ss_affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_affiliate_clicks_select_own" ON ss_affiliate_clicks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_affiliate_clicks_insert_any" ON ss_affiliate_clicks FOR INSERT WITH CHECK (true);


-- =============================================================================
-- INDEXES (Migration 1)
-- =============================================================================

CREATE INDEX idx_ss_products_category ON ss_products (category);
CREATE INDEX idx_ss_products_brand_en ON ss_products (brand_en);
CREATE INDEX idx_ss_products_rating_avg ON ss_products (rating_avg DESC);
CREATE INDEX idx_ss_products_name_en_trgm ON ss_products USING gin (name_en gin_trgm_ops);
CREATE INDEX idx_ss_products_name_ko_trgm ON ss_products USING gin (name_ko gin_trgm_ops);
CREATE INDEX idx_ss_ingredients_name_inci ON ss_ingredients (name_inci);
CREATE INDEX idx_ss_ingredients_safety ON ss_ingredients (safety_rating);
CREATE INDEX idx_ss_ingredients_function ON ss_ingredients (function);
CREATE INDEX idx_ss_product_ingredients_product ON ss_product_ingredients (product_id);
CREATE INDEX idx_ss_product_ingredients_ingr ON ss_product_ingredients (ingredient_id);
CREATE INDEX idx_ss_product_ingredients_position ON ss_product_ingredients (product_id, position);
CREATE INDEX idx_ss_ingredient_conflicts_a ON ss_ingredient_conflicts (ingredient_a_id);
CREATE INDEX idx_ss_ingredient_conflicts_b ON ss_ingredient_conflicts (ingredient_b_id);
CREATE INDEX idx_ss_product_prices_product ON ss_product_prices (product_id);
CREATE INDEX idx_ss_product_prices_retailer ON ss_product_prices (retailer_id);
CREATE INDEX idx_ss_product_prices_usd ON ss_product_prices (product_id, price_usd);
CREATE INDEX idx_ss_counterfeit_markers_brand ON ss_counterfeit_markers (brand);
CREATE INDEX idx_ss_counterfeit_reports_user ON ss_counterfeit_reports (user_id);
CREATE INDEX idx_ss_counterfeit_reports_product ON ss_counterfeit_reports (product_id);
CREATE INDEX idx_ss_counterfeit_reports_status ON ss_counterfeit_reports (status);
CREATE INDEX idx_ss_user_profiles_user_id ON ss_user_profiles (user_id);
CREATE INDEX idx_ss_user_profiles_skin_type ON ss_user_profiles (skin_type);
CREATE INDEX idx_ss_user_routines_user_id ON ss_user_routines (user_id);
CREATE INDEX idx_ss_routine_products_routine ON ss_routine_products (routine_id);
CREATE INDEX idx_ss_routine_products_product ON ss_routine_products (product_id);
CREATE INDEX idx_ss_user_scans_user_id ON ss_user_scans (user_id);
CREATE INDEX idx_ss_user_scans_product_id ON ss_user_scans (product_id);
CREATE INDEX idx_ss_user_scans_created_at ON ss_user_scans (created_at DESC);
CREATE INDEX idx_ss_user_wishlists_user_id ON ss_user_wishlists (user_id);
CREATE INDEX idx_ss_user_wishlists_product_id ON ss_user_wishlists (product_id);
CREATE INDEX idx_ss_user_product_reactions_user ON ss_user_product_reactions (user_id);
CREATE INDEX idx_ss_user_product_reactions_product ON ss_user_product_reactions (product_id);
CREATE INDEX idx_ss_user_product_reactions_reaction ON ss_user_product_reactions (reaction);
CREATE INDEX idx_ss_reviews_product_rating ON ss_reviews (product_id, rating);
CREATE INDEX idx_ss_reviews_user_id ON ss_reviews (user_id);
CREATE INDEX idx_ss_reviews_skin_type ON ss_reviews (skin_type);
CREATE INDEX idx_ss_reviews_created_at ON ss_reviews (created_at DESC);
CREATE INDEX idx_ss_review_helpfulness_review ON ss_review_helpfulness (review_id);
CREATE INDEX idx_ss_review_helpfulness_user ON ss_review_helpfulness (user_id);
CREATE INDEX idx_ss_trending_products_product ON ss_trending_products (product_id);
CREATE INDEX idx_ss_trending_products_score ON ss_trending_products (trend_score DESC);
CREATE INDEX idx_ss_trending_products_source ON ss_trending_products (source);
CREATE INDEX idx_ss_yuri_conversations_user_id ON ss_yuri_conversations (user_id);
CREATE INDEX idx_ss_yuri_conversations_updated_at ON ss_yuri_conversations (updated_at DESC);
CREATE INDEX idx_ss_yuri_messages_conversation ON ss_yuri_messages (conversation_id);
CREATE INDEX idx_ss_yuri_messages_created_at ON ss_yuri_messages (created_at ASC);
CREATE INDEX idx_ss_specialist_insights_conversation ON ss_specialist_insights (conversation_id);
CREATE INDEX idx_ss_specialist_insights_type ON ss_specialist_insights (specialist_type, insight_type);
CREATE INDEX idx_ss_learning_patterns_type ON ss_learning_patterns (pattern_type);
CREATE INDEX idx_ss_learning_patterns_skin_type ON ss_learning_patterns (skin_type);
CREATE INDEX idx_ss_ingredient_effectiveness_ingr ON ss_ingredient_effectiveness (ingredient_id);
CREATE INDEX idx_ss_ingredient_effectiveness_skin ON ss_ingredient_effectiveness (skin_type);
CREATE INDEX idx_ss_product_effectiveness_product ON ss_product_effectiveness (product_id);
CREATE INDEX idx_ss_product_effectiveness_skin ON ss_product_effectiveness (skin_type);
CREATE INDEX idx_ss_trend_signals_source ON ss_trend_signals (source);
CREATE INDEX idx_ss_trend_signals_detected_at ON ss_trend_signals (detected_at DESC);
CREATE INDEX idx_ss_trend_signals_keyword ON ss_trend_signals (keyword);
CREATE INDEX idx_ss_content_posts_slug ON ss_content_posts (slug);
CREATE INDEX idx_ss_content_posts_category ON ss_content_posts (category);
CREATE INDEX idx_ss_content_posts_published ON ss_content_posts (published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX idx_ss_content_posts_tags ON ss_content_posts USING gin (tags);
CREATE INDEX idx_ss_subscriptions_user_id ON ss_subscriptions (user_id);
CREATE INDEX idx_ss_subscriptions_stripe_cust ON ss_subscriptions (stripe_customer_id);
CREATE INDEX idx_ss_subscriptions_tier ON ss_subscriptions (tier);
CREATE INDEX idx_ss_affiliate_clicks_user_id ON ss_affiliate_clicks (user_id);
CREATE INDEX idx_ss_affiliate_clicks_product_id ON ss_affiliate_clicks (product_id);
CREATE INDEX idx_ss_affiliate_clicks_retailer_id ON ss_affiliate_clicks (retailer_id);
CREATE INDEX idx_ss_affiliate_clicks_clicked_at ON ss_affiliate_clicks (clicked_at DESC);


-- =============================================================================
-- TRIGGERS (Migration 1)
-- =============================================================================

CREATE OR REPLACE FUNCTION ss_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alias for migration 6 compatibility
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_products_updated_at BEFORE UPDATE ON ss_products FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
CREATE TRIGGER ss_user_profiles_updated_at BEFORE UPDATE ON ss_user_profiles FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
CREATE TRIGGER ss_user_routines_updated_at BEFORE UPDATE ON ss_user_routines FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
CREATE TRIGGER ss_reviews_updated_at BEFORE UPDATE ON ss_reviews FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
CREATE TRIGGER ss_yuri_conversations_updated_at BEFORE UPDATE ON ss_yuri_conversations FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
CREATE TRIGGER ss_learning_patterns_updated_at BEFORE UPDATE ON ss_learning_patterns FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();

CREATE OR REPLACE FUNCTION ss_update_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_helpful THEN UPDATE ss_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id; END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_helpful AND NOT NEW.is_helpful THEN UPDATE ss_reviews SET helpful_count = helpful_count - 1 WHERE id = NEW.review_id;
        ELSIF NOT OLD.is_helpful AND NEW.is_helpful THEN UPDATE ss_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id; END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_helpful THEN UPDATE ss_reviews SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = OLD.review_id; END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_review_helpfulness_count AFTER INSERT OR UPDATE OR DELETE ON ss_review_helpfulness FOR EACH ROW EXECUTE FUNCTION ss_update_helpful_count();

CREATE OR REPLACE FUNCTION ss_update_review_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN UPDATE ss_products SET review_count = review_count + 1 WHERE id = NEW.product_id;
    ELSIF TG_OP = 'DELETE' THEN UPDATE ss_products SET review_count = GREATEST(review_count - 1, 0) WHERE id = OLD.product_id; END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_products_review_count AFTER INSERT OR DELETE ON ss_reviews FOR EACH ROW EXECUTE FUNCTION ss_update_review_count();

CREATE OR REPLACE FUNCTION ss_update_product_rating()
RETURNS TRIGGER AS $$
DECLARE v_product_id UUID;
BEGIN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);
    UPDATE ss_products SET rating_avg = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM ss_reviews WHERE product_id = v_product_id) WHERE id = v_product_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_products_rating_avg AFTER INSERT OR UPDATE OF rating OR DELETE ON ss_reviews FOR EACH ROW EXECUTE FUNCTION ss_update_product_rating();

CREATE OR REPLACE FUNCTION ss_update_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN UPDATE ss_yuri_conversations SET message_count = message_count + 1, updated_at = NOW() WHERE id = NEW.conversation_id;
    ELSIF TG_OP = 'DELETE' THEN UPDATE ss_yuri_conversations SET message_count = GREATEST(message_count - 1, 0) WHERE id = OLD.conversation_id; END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_yuri_message_count AFTER INSERT OR DELETE ON ss_yuri_messages FOR EACH ROW EXECUTE FUNCTION ss_update_message_count();


-- ===========================
-- MIGRATION 2: Seed Products (retailers, ingredients, products)
-- ===========================

-- See seed file 001 - executing inline

-- Retailers
INSERT INTO ss_retailers (id, name, website, country, trust_score, ships_international) VALUES
  (gen_random_uuid(), 'Olive Young',  'https://www.oliveyoung.co.kr',  'South Korea', 95, true),
  (gen_random_uuid(), 'Soko Glam',    'https://www.sokoglam.com',      'USA',         90, true),
  (gen_random_uuid(), 'YesStyle',     'https://www.yesstyle.com',      'Hong Kong',   85, true),
  (gen_random_uuid(), 'Stylevana',    'https://www.stylevana.com',     'Hong Kong',   82, true),
  (gen_random_uuid(), 'Amazon',       'https://www.amazon.com',        'USA',         70, true),
  (gen_random_uuid(), 'iHerb',        'https://www.iherb.com',         'USA',         80, true);

-- NOTE: The full seed data for ingredients (30), products (55), ingredient-product links,
-- ingredient conflicts, and product prices is very large (900+ lines).
-- Due to the size, run Migration 2 and Migration 3 seed files separately after this script:
--   1. Run this combined migration file first
--   2. Then run: 20260216000002_seed_products.sql
--   3. Then run: 20260216000003_seed_product_ingredients_prices.sql
-- The seed files use name-based lookups so they work after the schema is created.

-- Skip inline seeds - run separately


-- ===========================
-- MIGRATION 4: Phase 4 Community & Discovery
-- ===========================

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
CREATE POLICY "Users can read own points" ON ss_community_points FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own points" ON ss_community_points FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE ss_reviews ADD COLUMN IF NOT EXISTS fitzpatrick_scale integer CHECK (fitzpatrick_scale >= 1 AND fitzpatrick_scale <= 6);
ALTER TABLE ss_reviews ADD COLUMN IF NOT EXISTS age_range text;

CREATE INDEX IF NOT EXISTS idx_ss_reviews_reaction ON ss_reviews(reaction);
CREATE INDEX IF NOT EXISTS idx_ss_reviews_fitzpatrick ON ss_reviews(fitzpatrick_scale);


-- ===========================
-- MIGRATION 5: Phase 5 Counterfeit Detection & Safety
-- ===========================

CREATE TABLE ss_batch_code_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES ss_products(id) ON DELETE SET NULL,
    brand           TEXT NOT NULL,
    batch_code      TEXT NOT NULL,
    decoded_info    JSONB,
    is_valid        BOOLEAN,
    confidence      INT CHECK (confidence >= 1 AND confidence <= 10),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ss_safety_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type      TEXT NOT NULL CHECK (alert_type IN ('counterfeit_wave', 'recall', 'ingredient_warning', 'seller_warning', 'batch_issue')),
    severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    affected_brands TEXT[],
    affected_products UUID[],
    affected_retailers UUID[],
    source          TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE TABLE ss_user_dismissed_alerts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_id    UUID NOT NULL REFERENCES ss_safety_alerts(id) ON DELETE CASCADE,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, alert_id)
);

CREATE TABLE ss_counterfeit_scans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id          UUID REFERENCES ss_products(id) ON DELETE SET NULL,
    image_urls          TEXT[] NOT NULL DEFAULT '{}',
    brand_detected      TEXT,
    product_detected    TEXT,
    authenticity_score  INT CHECK (authenticity_score >= 1 AND authenticity_score <= 10),
    red_flags           JSONB NOT NULL DEFAULT '[]',
    green_flags         JSONB NOT NULL DEFAULT '[]',
    analysis_summary    TEXT,
    recommendation      TEXT,
    markers_matched     UUID[],
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ss_counterfeit_reports
    ADD COLUMN IF NOT EXISTS seller_name TEXT,
    ADD COLUMN IF NOT EXISTS purchase_platform TEXT,
    ADD COLUMN IF NOT EXISTS purchase_url TEXT,
    ADD COLUMN IF NOT EXISTS brand TEXT,
    ADD COLUMN IF NOT EXISTS batch_code TEXT,
    ADD COLUMN IF NOT EXISTS admin_notes TEXT,
    ADD COLUMN IF NOT EXISTS verified_counterfeit BOOLEAN,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE ss_retailers
    ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS authorized_brands TEXT[],
    ADD COLUMN IF NOT EXISTS risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
    ADD COLUMN IF NOT EXISTS verification_notes TEXT,
    ADD COLUMN IF NOT EXISTS counterfeit_report_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

ALTER TABLE ss_batch_code_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_batch_code_verifications_select_own" ON ss_batch_code_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_batch_code_verifications_insert_own" ON ss_batch_code_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE ss_safety_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_safety_alerts_public_select" ON ss_safety_alerts FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

ALTER TABLE ss_user_dismissed_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_dismissed_alerts_select_own" ON ss_user_dismissed_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_dismissed_alerts_insert_own" ON ss_user_dismissed_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_dismissed_alerts_delete_own" ON ss_user_dismissed_alerts FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_counterfeit_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_counterfeit_scans_select_own" ON ss_counterfeit_scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_counterfeit_scans_insert_own" ON ss_counterfeit_scans FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ss_batch_code_verif_user ON ss_batch_code_verifications (user_id);
CREATE INDEX idx_ss_batch_code_verif_brand ON ss_batch_code_verifications (brand);
CREATE INDEX idx_ss_batch_code_verif_code ON ss_batch_code_verifications (batch_code);
CREATE INDEX idx_ss_safety_alerts_type ON ss_safety_alerts (alert_type);
CREATE INDEX idx_ss_safety_alerts_severity ON ss_safety_alerts (severity);
CREATE INDEX idx_ss_safety_alerts_active ON ss_safety_alerts (is_active) WHERE is_active = true;
CREATE INDEX idx_ss_user_dismissed_alerts_user ON ss_user_dismissed_alerts (user_id);
CREATE INDEX idx_ss_user_dismissed_alerts_alert ON ss_user_dismissed_alerts (alert_id);
CREATE INDEX idx_ss_counterfeit_scans_user ON ss_counterfeit_scans (user_id);
CREATE INDEX idx_ss_counterfeit_scans_product ON ss_counterfeit_scans (product_id);
CREATE INDEX idx_ss_counterfeit_scans_score ON ss_counterfeit_scans (authenticity_score);
CREATE INDEX idx_ss_counterfeit_scans_created ON ss_counterfeit_scans (created_at DESC);

CREATE TRIGGER ss_counterfeit_reports_updated_at BEFORE UPDATE ON ss_counterfeit_reports FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();


-- ===========================
-- MIGRATION 6: Seed Counterfeit Markers & Retailer Verification
-- ===========================

UPDATE ss_retailers SET is_authorized = true, risk_level = 'low',
    authorized_brands = ARRAY['COSRX', 'Sulwhasoo', 'Laneige', 'Innisfree', 'Etude', 'Dr. Jart+', 'Missha', 'Klairs', 'Beauty of Joseon', 'Torriden', 'Anua', 'Isntree', 'Round Lab'],
    verification_notes = 'Official Korean beauty retailer operated by CJ Olive Young.',
    last_verified_at = NOW()
WHERE name = 'Olive Young';

UPDATE ss_retailers SET is_authorized = true, risk_level = 'low',
    authorized_brands = ARRAY['Sulwhasoo', 'Laneige', 'Dr. Jart+', 'COSRX', 'Missha', 'Klairs', 'Banila Co', 'Neogen'],
    verification_notes = 'US-based K-beauty specialty retailer. Founded by Charlotte Cho.',
    last_verified_at = NOW()
WHERE name = 'Soko Glam';

UPDATE ss_retailers SET is_authorized = true, risk_level = 'low',
    authorized_brands = ARRAY['COSRX', 'Innisfree', 'Etude', 'Missha', 'Some By Mi', 'Klairs', 'Benton', 'Purito'],
    verification_notes = 'Hong Kong-based Asian beauty retailer with direct brand partnerships.',
    last_verified_at = NOW()
WHERE name = 'YesStyle';

UPDATE ss_retailers SET is_authorized = false, risk_level = 'medium',
    authorized_brands = ARRAY[]::TEXT[],
    verification_notes = 'Major marketplace with commingled inventory risk.',
    last_verified_at = NOW()
WHERE name ILIKE '%amazon%';

INSERT INTO ss_counterfeit_markers (brand, marker_type, description, severity) VALUES
('COSRX', 'packaging', 'Authentic COSRX has sharp, clear printing. Counterfeits show blurry font edges.', 'high'),
('COSRX', 'label', 'Check for Korean MFDS certification number on back label.', 'critical'),
('COSRX', 'texture', 'Authentic snail mucin is clear, slightly viscous. Counterfeits may be watery.', 'medium'),
('COSRX', 'barcode', 'Authentic COSRX barcodes start with 880 (South Korea).', 'high'),
('Sulwhasoo', 'packaging', 'Authentic uses heavy, high-quality glass. Counterfeits use lighter glass.', 'high'),
('Sulwhasoo', 'label', 'Look for specific gold foil stamping vs flat printed gold ink.', 'high'),
('Laneige', 'packaging', 'Authentic Lip Sleeping Mask has precisely molded container with uniform color.', 'high'),
('Dr. Jart+', 'packaging', 'Authentic Cicapair has precise color-changing technology.', 'critical'),
('ANY', 'packaging', 'Compare shrink wrap quality - authentic is tight and professional-grade.', 'medium'),
('ANY', 'label', 'All legitimate K-beauty products must display Korean text with MFDS registration.', 'critical'),
('ANY', 'barcode', 'South Korean barcodes start with 880. Check against claimed country of origin.', 'high');

INSERT INTO ss_safety_alerts (alert_type, severity, title, description, affected_brands, source, is_active) VALUES
('counterfeit_wave', 'high', 'COSRX Snail Mucin Counterfeit Alert', 'Reports of counterfeit COSRX Advanced Snail 96 on Amazon have increased.', ARRAY['COSRX'], 'community_reports', true),
('seller_warning', 'medium', 'Temu K-Beauty Seller Warning', 'Multiple reports of suspicious K-beauty products on Temu at below retail prices.', ARRAY['ANY'], 'internal_detection', true),
('ingredient_warning', 'medium', 'Mercury in Counterfeit Whitening Products', 'FDA warning about mercury in counterfeit Asian beauty whitening products.', ARRAY['ANY'], 'kfda', true);


-- ===========================
-- MIGRATION 7: Phase 3B Onboarding Progress
-- ===========================

ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS ss_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ss_yuri_conversations(id) ON DELETE SET NULL,
  onboarding_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (onboarding_status IN ('in_progress', 'completed', 'skipped')),
  skin_profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_fields TEXT[] NOT NULL DEFAULT ARRAY['skin_type', 'skin_concerns', 'age_range'],
  completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ss_onboarding_progress_unique_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_ss_onboarding_progress_user_id ON ss_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_ss_onboarding_progress_status ON ss_onboarding_progress(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_ss_onboarding_progress_conversation ON ss_onboarding_progress(conversation_id);

ALTER TABLE ss_onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY ss_onboarding_progress_select ON ss_onboarding_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ss_onboarding_progress_insert ON ss_onboarding_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ss_onboarding_progress_update ON ss_onboarding_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ss_onboarding_progress_delete ON ss_onboarding_progress FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE ss_yuri_conversations ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'general' CHECK (conversation_type IN ('general', 'onboarding', 'specialist'));

CREATE TRIGGER ss_onboarding_progress_updated_at BEFORE UPDATE ON ss_onboarding_progress FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();


-- ===========================
-- MIGRATION 8: Phase 6 Learning Engine & Automation
-- ===========================

ALTER TABLE ss_learning_patterns ADD COLUMN IF NOT EXISTS concern_filter TEXT;
ALTER TABLE ss_learning_patterns ADD COLUMN IF NOT EXISTS pattern_description TEXT;

ALTER TABLE ss_ingredient_effectiveness ADD COLUMN IF NOT EXISTS positive_reports INT NOT NULL DEFAULT 0;
ALTER TABLE ss_ingredient_effectiveness ADD COLUMN IF NOT EXISTS negative_reports INT NOT NULL DEFAULT 0;
ALTER TABLE ss_ingredient_effectiveness ADD COLUMN IF NOT EXISTS neutral_reports INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ss_routine_outcomes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    routine             JSONB NOT NULL,
    skin_type           TEXT,
    concerns            TEXT[] NOT NULL DEFAULT '{}',
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome_reported_at TIMESTAMPTZ,
    outcome_score       INT CHECK (outcome_score BETWEEN 1 AND 5),
    outcome_notes       TEXT,
    before_photo_url    TEXT,
    after_photo_url     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ss_price_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    retailer    TEXT NOT NULL,
    price       DECIMAL(10, 2) NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'USD',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ss_trend_signals ADD COLUMN IF NOT EXISTS trend_name TEXT;
ALTER TABLE ss_trend_signals ADD COLUMN IF NOT EXISTS trend_type TEXT;
ALTER TABLE ss_trend_signals ADD COLUMN IF NOT EXISTS first_detected_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE ss_trend_signals ADD COLUMN IF NOT EXISTS peak_at TIMESTAMPTZ;
ALTER TABLE ss_trend_signals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'emerging';

ALTER TABLE ss_reviews ADD COLUMN IF NOT EXISTS learning_contributed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ss_yuri_conversations ADD COLUMN IF NOT EXISTS learning_contributed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ss_routine_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own routine outcomes" ON ss_routine_outcomes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users read price history" ON ss_price_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role inserts price history" ON ss_price_history FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_routine_outcomes_user ON ss_routine_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_outcomes_skin_type ON ss_routine_outcomes(skin_type);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON ss_price_history(product_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON ss_price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_signals_status ON ss_trend_signals(status);
CREATE INDEX IF NOT EXISTS idx_trend_signals_trend_type ON ss_trend_signals(trend_type);
CREATE INDEX IF NOT EXISTS idx_reviews_learning ON ss_reviews(learning_contributed) WHERE NOT learning_contributed;
CREATE INDEX IF NOT EXISTS idx_conversations_learning ON ss_yuri_conversations(learning_contributed) WHERE NOT learning_contributed;

DROP TRIGGER IF EXISTS trg_ingredient_effectiveness_updated ON ss_ingredient_effectiveness;
CREATE TRIGGER trg_ingredient_effectiveness_updated BEFORE UPDATE ON ss_ingredient_effectiveness FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_learning_patterns_updated ON ss_learning_patterns;
CREATE TRIGGER trg_learning_patterns_updated BEFORE UPDATE ON ss_learning_patterns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===========================
-- MIGRATION 9: Phase 7 Subscriptions & Monetization
-- ===========================

-- ss_subscriptions already created in Migration 1, add Phase 7 columns
ALTER TABLE ss_subscriptions ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
ALTER TABLE ss_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Subscription events table (webhook audit log)
CREATE TABLE IF NOT EXISTS ss_subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES ss_subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add plan column to user profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ss_user_profiles' AND column_name = 'plan'
  ) THEN
    ALTER TABLE ss_user_profiles ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'
      CHECK (plan IN ('free', 'pro_monthly', 'pro_annual', 'student'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ss_subscription_events_subscription ON ss_subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_ss_subscription_events_stripe_event ON ss_subscription_events(stripe_event_id);

ALTER TABLE ss_subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages subscription events" ON ss_subscription_events FOR ALL USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION ss_update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ss_subscriptions_updated_at ON ss_subscriptions;
CREATE TRIGGER ss_subscriptions_updated_at BEFORE UPDATE ON ss_subscriptions FOR EACH ROW EXECUTE FUNCTION ss_update_subscription_timestamp();


-- =============================================================================
-- DONE! All 9 migrations applied.
-- Now run separately:
--   1. 20260216000002_seed_products.sql (ingredients + products)
--   2. 20260216000003_seed_product_ingredients_prices.sql (links + prices)
-- =============================================================================
