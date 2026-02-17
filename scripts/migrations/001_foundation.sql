-- =============================================================================
-- Seoul Sister K-Beauty Intelligence Platform
-- Migration: 001_foundation.sql
-- Description: Complete foundation schema for all platform tables
-- Version: 1.0.0
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search on product names


-- =============================================================================
-- SECTION 1: PRODUCTS & INGREDIENTS
-- =============================================================================

-- Master K-beauty product database
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

-- Master ingredient database with Korean translations and safety data
CREATE TABLE ss_ingredients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_inci           TEXT UNIQUE NOT NULL,          -- International Nomenclature of Cosmetic Ingredients
    name_en             TEXT,
    name_ko             TEXT,
    function            TEXT,                           -- e.g. "Humectant", "Emollient", "Preservative"
    description         TEXT,
    safety_rating       INT CHECK (safety_rating >= 1 AND safety_rating <= 5),
    comedogenic_rating  INT CHECK (comedogenic_rating >= 0 AND comedogenic_rating <= 5),
    is_fragrance        BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN NOT NULL DEFAULT true,  -- "active" as in active ingredient vs. inactive
    common_concerns     TEXT[],                         -- e.g. ARRAY['acne', 'sensitivity', 'brightening']
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction table: which ingredients are in each product, in what order
CREATE TABLE ss_product_ingredients (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    ingredient_id    UUID NOT NULL REFERENCES ss_ingredients(id) ON DELETE RESTRICT,
    position         INT NOT NULL,                      -- Position in ingredient list (1 = highest concentration)
    concentration_pct DECIMAL(5, 3),                   -- Exact concentration if known (often not disclosed)
    UNIQUE (product_id, ingredient_id)
);

-- Known ingredient interaction/conflict warnings
CREATE TABLE ss_ingredient_conflicts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_a_id UUID NOT NULL REFERENCES ss_ingredients(id) ON DELETE CASCADE,
    ingredient_b_id UUID NOT NULL REFERENCES ss_ingredients(id) ON DELETE CASCADE,
    severity        TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description     TEXT NOT NULL,
    recommendation  TEXT,
    UNIQUE (ingredient_a_id, ingredient_b_id)
);

-- Retailer directory with trust scoring
CREATE TABLE ss_retailers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT UNIQUE NOT NULL,
    website               TEXT,
    country               TEXT,
    trust_score           INT CHECK (trust_score >= 1 AND trust_score <= 100),
    ships_international   BOOLEAN NOT NULL DEFAULT false,
    affiliate_program     BOOLEAN NOT NULL DEFAULT false,
    affiliate_url_template TEXT                         -- URL template with {product_id} or {url} placeholder
);

-- Historical price tracking across retailers
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

-- Known counterfeit markers per brand (for counterfeit detection)
CREATE TABLE ss_counterfeit_markers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand        TEXT NOT NULL,
    marker_type  TEXT NOT NULL,                         -- e.g. 'packaging', 'label', 'barcode', 'texture'
    description  TEXT NOT NULL,
    image_url    TEXT,
    severity     TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User-submitted counterfeit reports (crowdsourced intelligence)
CREATE TABLE ss_counterfeit_reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id  UUID REFERENCES ss_products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    image_urls  TEXT[] NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'confirmed', 'rejected')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- SECTION 2: USERS & PROFILES
-- =============================================================================

-- Extended skin profile (beyond what Supabase Auth stores)
CREATE TABLE ss_user_profiles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    skin_type        TEXT CHECK (skin_type IN ('oily', 'dry', 'combination', 'normal', 'sensitive')),
    skin_concerns    TEXT[],                            -- e.g. ARRAY['acne', 'hyperpigmentation', 'aging']
    allergies        TEXT[],                            -- Known allergen ingredient names
    fitzpatrick_scale INT CHECK (fitzpatrick_scale >= 1 AND fitzpatrick_scale <= 6),
    climate          TEXT,                              -- e.g. 'humid', 'dry', 'temperate', 'tropical'
    age_range        TEXT CHECK (age_range IN ('18-24', '25-30', '31-35', '36-40', '41-50', '50+')),
    budget_range     TEXT CHECK (budget_range IN ('budget', 'mid-range', 'luxury', 'mixed')),
    experience_level TEXT CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Personalized routines (AM/PM/weekly)
CREATE TABLE ss_user_routines (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    routine_type TEXT NOT NULL CHECK (routine_type IN ('am', 'pm', 'weekly')),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products within each routine, with ordering and timing
CREATE TABLE ss_routine_products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routine_id  UUID NOT NULL REFERENCES ss_user_routines(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    step_order  INT NOT NULL,
    frequency   TEXT,                                   -- e.g. 'daily', '2x/week', 'weekly'
    notes       TEXT,
    UNIQUE (routine_id, product_id)
);

-- Label scan history (Korean label decoder feature)
CREATE TABLE ss_user_scans (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id        UUID REFERENCES ss_products(id) ON DELETE SET NULL,  -- Nullable: product may not be in DB
    image_url         TEXT,
    scan_type         TEXT NOT NULL CHECK (scan_type IN ('label', 'barcode', 'product_search', 'counterfeit')),
    extracted_text    TEXT,                              -- Raw OCR output from Claude Vision
    ingredients_found TEXT[],                            -- Parsed ingredient names
    analysis_result   JSONB,                             -- Full AI analysis: safety scores, conflicts, etc.
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User wishlist with optional price alert thresholds
CREATE TABLE ss_user_wishlists (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id             UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    price_alert_threshold  DECIMAL(10, 2),               -- Alert when price drops below this
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

-- User reactions to products: "Holy Grail" or "Broke Me Out"
CREATE TABLE ss_user_product_reactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    reaction   TEXT NOT NULL CHECK (reaction IN ('holy_grail', 'broke_me_out', 'no_effect', 'irritated', 'love', 'dislike')),
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);


-- =============================================================================
-- SECTION 3: COMMUNITY & REVIEWS
-- =============================================================================

-- Community reviews with skin-type metadata for filtering
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
    usage_duration   TEXT,                              -- e.g. '1 week', '1 month', '6 months'
    helpful_count    INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)                        -- One review per user per product
);

-- Review helpfulness upvote/downvote tracking
CREATE TABLE ss_review_helpfulness (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id  UUID NOT NULL REFERENCES ss_reviews(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (review_id, user_id)
);

-- Trending products feed (aggregated from TikTok, Reddit, Korean market signals)
CREATE TABLE ss_trending_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,                      -- e.g. 'tiktok', 'reddit', 'naver', 'olive_young'
    trend_score     INT NOT NULL DEFAULT 0,
    mention_count   INT NOT NULL DEFAULT 0,
    sentiment_score DECIMAL(4, 3),                      -- -1.0 to 1.0
    trending_since  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- SECTION 4: YURI AI ADVISOR
-- =============================================================================

-- Top-level conversation sessions with Yuri
CREATE TABLE ss_yuri_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT,                               -- Auto-generated from first message
    specialist_type TEXT,                               -- Which specialist was primarily invoked
    message_count   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual messages within Yuri conversations
CREATE TABLE ss_yuri_messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES ss_yuri_conversations(id) ON DELETE CASCADE,
    role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content          TEXT NOT NULL,
    image_urls       TEXT[] NOT NULL DEFAULT '{}',      -- For vision-based messages (scans, photos)
    specialist_type  TEXT,                              -- Which specialist generated this response
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intelligence extracted from specialist conversations for the learning engine
CREATE TABLE ss_specialist_insights (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ss_yuri_conversations(id) ON DELETE CASCADE,
    specialist_type TEXT NOT NULL,                      -- e.g. 'ingredient_analyst', 'routine_architect'
    insight_type    TEXT NOT NULL,                      -- e.g. 'skin_pattern', 'ingredient_reaction', 'routine_preference'
    data            JSONB NOT NULL,                     -- Structured extracted intelligence
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- SECTION 5: INTELLIGENCE & LEARNING ENGINE
-- =============================================================================

-- Cross-user anonymized learning patterns (the moat)
-- All data here is aggregated/anonymized -- no PII
CREATE TABLE ss_learning_patterns (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type     TEXT NOT NULL,                     -- e.g. 'ingredient_reaction', 'routine_effectiveness', 'seasonal'
    skin_type        TEXT,
    skin_concerns    TEXT[],
    data             JSONB NOT NULL,                    -- Pattern data, varies by pattern_type
    confidence_score DECIMAL(4, 3),                     -- 0.000 to 1.000
    sample_size      INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ingredient effectiveness aggregated by skin type and concern
CREATE TABLE ss_ingredient_effectiveness (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id       UUID NOT NULL REFERENCES ss_ingredients(id) ON DELETE CASCADE,
    skin_type           TEXT,
    concern             TEXT,
    effectiveness_score DECIMAL(4, 3),                  -- 0.000 to 1.000
    sample_size         INT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ingredient_id, skin_type, concern)
);

-- Product effectiveness aggregated by skin type
CREATE TABLE ss_product_effectiveness (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    skin_type           TEXT,
    effectiveness_score DECIMAL(4, 3),                  -- 0.000 to 1.000
    sample_size         INT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, skin_type)
);

-- Korean market trend signals (raw data before aggregation)
CREATE TABLE ss_trend_signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source          TEXT NOT NULL,                      -- e.g. 'tiktok', 'naver_blog', 'olive_young', 'reddit'
    keyword         TEXT NOT NULL,
    signal_strength INT NOT NULL DEFAULT 0,
    data            JSONB,                              -- Source-specific metadata
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generated trend and blog content for AI discoverability
CREATE TABLE ss_content_posts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    slug         TEXT UNIQUE NOT NULL,
    body         TEXT NOT NULL,
    category     TEXT,                                  -- e.g. 'trends', 'ingredients', 'routines', 'brand-spotlight'
    tags         TEXT[],
    published_at TIMESTAMPTZ,                           -- NULL = draft
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- SECTION 6: COMMERCE (SUBSCRIPTIONS ONLY -- NO PRODUCT SALES)
-- =============================================================================

-- Stripe subscription records
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

-- Affiliate click tracking (no product sales, just referral attribution)
CREATE TABLE ss_affiliate_clicks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- Nullable: anonymous users can click
    product_id  UUID NOT NULL REFERENCES ss_products(id) ON DELETE CASCADE,
    retailer_id UUID NOT NULL REFERENCES ss_retailers(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    clicked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- SECTION 7: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Public tables: no RLS needed (read-only for all)
-- Note: mutations on these tables are done via service role key only

-- ss_products: public SELECT
ALTER TABLE ss_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_products_public_select" ON ss_products
    FOR SELECT USING (true);

-- ss_ingredients: public SELECT
ALTER TABLE ss_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_ingredients_public_select" ON ss_ingredients
    FOR SELECT USING (true);

-- ss_product_ingredients: public SELECT
ALTER TABLE ss_product_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_product_ingredients_public_select" ON ss_product_ingredients
    FOR SELECT USING (true);

-- ss_ingredient_conflicts: public SELECT
ALTER TABLE ss_ingredient_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_ingredient_conflicts_public_select" ON ss_ingredient_conflicts
    FOR SELECT USING (true);

-- ss_product_prices: public SELECT
ALTER TABLE ss_product_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_product_prices_public_select" ON ss_product_prices
    FOR SELECT USING (true);

-- ss_retailers: public SELECT
ALTER TABLE ss_retailers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_retailers_public_select" ON ss_retailers
    FOR SELECT USING (true);

-- ss_counterfeit_markers: public SELECT
ALTER TABLE ss_counterfeit_markers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_counterfeit_markers_public_select" ON ss_counterfeit_markers
    FOR SELECT USING (true);

-- ss_trending_products: public SELECT
ALTER TABLE ss_trending_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_trending_products_public_select" ON ss_trending_products
    FOR SELECT USING (true);

-- ss_reviews: public SELECT (so non-users can read reviews)
ALTER TABLE ss_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_reviews_public_select" ON ss_reviews
    FOR SELECT USING (true);

-- ss_trend_signals: public SELECT
ALTER TABLE ss_trend_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_trend_signals_public_select" ON ss_trend_signals
    FOR SELECT USING (true);

-- ss_content_posts: public SELECT (only published posts)
ALTER TABLE ss_content_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_content_posts_public_select" ON ss_content_posts
    FOR SELECT USING (published_at IS NOT NULL AND published_at <= NOW());

-- ss_learning_patterns: public SELECT (fully anonymized)
ALTER TABLE ss_learning_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_learning_patterns_public_select" ON ss_learning_patterns
    FOR SELECT USING (true);

-- ss_ingredient_effectiveness: public SELECT (fully anonymized)
ALTER TABLE ss_ingredient_effectiveness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_ingredient_effectiveness_public_select" ON ss_ingredient_effectiveness
    FOR SELECT USING (true);

-- ss_product_effectiveness: public SELECT (fully anonymized)
ALTER TABLE ss_product_effectiveness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_product_effectiveness_public_select" ON ss_product_effectiveness
    FOR SELECT USING (true);

-- -------------------------
-- User-specific table RLS
-- -------------------------

-- ss_counterfeit_reports
ALTER TABLE ss_counterfeit_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_counterfeit_reports_select_own" ON ss_counterfeit_reports
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_counterfeit_reports_insert_own" ON ss_counterfeit_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_counterfeit_reports_update_own" ON ss_counterfeit_reports
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_counterfeit_reports_delete_own" ON ss_counterfeit_reports
    FOR DELETE USING (auth.uid() = user_id);

-- ss_user_profiles
ALTER TABLE ss_user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_profiles_select_own" ON ss_user_profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_profiles_insert_own" ON ss_user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_profiles_update_own" ON ss_user_profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_profiles_delete_own" ON ss_user_profiles
    FOR DELETE USING (auth.uid() = user_id);

-- ss_user_routines
ALTER TABLE ss_user_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_routines_select_own" ON ss_user_routines
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_routines_insert_own" ON ss_user_routines
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_routines_update_own" ON ss_user_routines
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_routines_delete_own" ON ss_user_routines
    FOR DELETE USING (auth.uid() = user_id);

-- ss_routine_products: RLS via the owning routine
ALTER TABLE ss_routine_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_routine_products_select_own" ON ss_routine_products
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ss_user_routines r
            WHERE r.id = routine_id AND r.user_id = auth.uid()
        )
    );
CREATE POLICY "ss_routine_products_insert_own" ON ss_routine_products
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ss_user_routines r
            WHERE r.id = routine_id AND r.user_id = auth.uid()
        )
    );
CREATE POLICY "ss_routine_products_update_own" ON ss_routine_products
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM ss_user_routines r
            WHERE r.id = routine_id AND r.user_id = auth.uid()
        )
    );
CREATE POLICY "ss_routine_products_delete_own" ON ss_routine_products
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM ss_user_routines r
            WHERE r.id = routine_id AND r.user_id = auth.uid()
        )
    );

-- ss_user_scans
ALTER TABLE ss_user_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_scans_select_own" ON ss_user_scans
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_scans_insert_own" ON ss_user_scans
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_scans_update_own" ON ss_user_scans
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_scans_delete_own" ON ss_user_scans
    FOR DELETE USING (auth.uid() = user_id);

-- ss_user_wishlists
ALTER TABLE ss_user_wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_wishlists_select_own" ON ss_user_wishlists
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_wishlists_insert_own" ON ss_user_wishlists
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_wishlists_update_own" ON ss_user_wishlists
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_wishlists_delete_own" ON ss_user_wishlists
    FOR DELETE USING (auth.uid() = user_id);

-- ss_user_product_reactions
ALTER TABLE ss_user_product_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_user_product_reactions_select_own" ON ss_user_product_reactions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_user_product_reactions_insert_own" ON ss_user_product_reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_user_product_reactions_update_own" ON ss_user_product_reactions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_user_product_reactions_delete_own" ON ss_user_product_reactions
    FOR DELETE USING (auth.uid() = user_id);

-- ss_reviews: users can write their own, everyone can read
CREATE POLICY "ss_reviews_insert_own" ON ss_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_reviews_update_own" ON ss_reviews
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_reviews_delete_own" ON ss_reviews
    FOR DELETE USING (auth.uid() = user_id);

-- ss_review_helpfulness
ALTER TABLE ss_review_helpfulness ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_review_helpfulness_select_own" ON ss_review_helpfulness
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_review_helpfulness_insert_own" ON ss_review_helpfulness
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_review_helpfulness_update_own" ON ss_review_helpfulness
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_review_helpfulness_delete_own" ON ss_review_helpfulness
    FOR DELETE USING (auth.uid() = user_id);

-- ss_yuri_conversations
ALTER TABLE ss_yuri_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_yuri_conversations_select_own" ON ss_yuri_conversations
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_yuri_conversations_insert_own" ON ss_yuri_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_yuri_conversations_update_own" ON ss_yuri_conversations
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ss_yuri_conversations_delete_own" ON ss_yuri_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- ss_yuri_messages: RLS via the owning conversation
ALTER TABLE ss_yuri_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_yuri_messages_select_own" ON ss_yuri_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ss_yuri_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );
CREATE POLICY "ss_yuri_messages_insert_own" ON ss_yuri_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ss_yuri_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );
CREATE POLICY "ss_yuri_messages_update_own" ON ss_yuri_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM ss_yuri_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );
CREATE POLICY "ss_yuri_messages_delete_own" ON ss_yuri_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM ss_yuri_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );

-- ss_specialist_insights: RLS via the owning conversation
ALTER TABLE ss_specialist_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_specialist_insights_select_own" ON ss_specialist_insights
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ss_yuri_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );
CREATE POLICY "ss_specialist_insights_insert_own" ON ss_specialist_insights
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ss_yuri_conversations c
            WHERE c.id = conversation_id AND c.user_id = auth.uid()
        )
    );

-- ss_subscriptions
ALTER TABLE ss_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_subscriptions_select_own" ON ss_subscriptions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_subscriptions_insert_own" ON ss_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ss_subscriptions_update_own" ON ss_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- ss_affiliate_clicks: users can see their own; inserts allowed for anonymous too
ALTER TABLE ss_affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss_affiliate_clicks_select_own" ON ss_affiliate_clicks
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ss_affiliate_clicks_insert_any" ON ss_affiliate_clicks
    FOR INSERT WITH CHECK (true);                       -- Allow anonymous clicks; user_id is nullable


-- =============================================================================
-- SECTION 8: INDEXES
-- =============================================================================

-- ss_products
CREATE INDEX idx_ss_products_category        ON ss_products (category);
CREATE INDEX idx_ss_products_brand_en        ON ss_products (brand_en);
CREATE INDEX idx_ss_products_rating_avg      ON ss_products (rating_avg DESC);
CREATE INDEX idx_ss_products_name_en_trgm    ON ss_products USING gin (name_en gin_trgm_ops);
CREATE INDEX idx_ss_products_name_ko_trgm    ON ss_products USING gin (name_ko gin_trgm_ops);

-- ss_ingredients
CREATE INDEX idx_ss_ingredients_name_inci    ON ss_ingredients (name_inci);
CREATE INDEX idx_ss_ingredients_safety       ON ss_ingredients (safety_rating);
CREATE INDEX idx_ss_ingredients_function     ON ss_ingredients (function);

-- ss_product_ingredients
CREATE INDEX idx_ss_product_ingredients_product  ON ss_product_ingredients (product_id);
CREATE INDEX idx_ss_product_ingredients_ingr     ON ss_product_ingredients (ingredient_id);
CREATE INDEX idx_ss_product_ingredients_position ON ss_product_ingredients (product_id, position);

-- ss_ingredient_conflicts
CREATE INDEX idx_ss_ingredient_conflicts_a   ON ss_ingredient_conflicts (ingredient_a_id);
CREATE INDEX idx_ss_ingredient_conflicts_b   ON ss_ingredient_conflicts (ingredient_b_id);

-- ss_product_prices
CREATE INDEX idx_ss_product_prices_product   ON ss_product_prices (product_id);
CREATE INDEX idx_ss_product_prices_retailer  ON ss_product_prices (retailer_id);
CREATE INDEX idx_ss_product_prices_usd       ON ss_product_prices (product_id, price_usd);

-- ss_counterfeit_markers
CREATE INDEX idx_ss_counterfeit_markers_brand ON ss_counterfeit_markers (brand);

-- ss_counterfeit_reports
CREATE INDEX idx_ss_counterfeit_reports_user    ON ss_counterfeit_reports (user_id);
CREATE INDEX idx_ss_counterfeit_reports_product ON ss_counterfeit_reports (product_id);
CREATE INDEX idx_ss_counterfeit_reports_status  ON ss_counterfeit_reports (status);

-- ss_user_profiles
CREATE INDEX idx_ss_user_profiles_user_id    ON ss_user_profiles (user_id);
CREATE INDEX idx_ss_user_profiles_skin_type  ON ss_user_profiles (skin_type);

-- ss_user_routines
CREATE INDEX idx_ss_user_routines_user_id    ON ss_user_routines (user_id);

-- ss_routine_products
CREATE INDEX idx_ss_routine_products_routine ON ss_routine_products (routine_id);
CREATE INDEX idx_ss_routine_products_product ON ss_routine_products (product_id);

-- ss_user_scans
CREATE INDEX idx_ss_user_scans_user_id       ON ss_user_scans (user_id);
CREATE INDEX idx_ss_user_scans_product_id    ON ss_user_scans (product_id);
CREATE INDEX idx_ss_user_scans_created_at    ON ss_user_scans (created_at DESC);

-- ss_user_wishlists
CREATE INDEX idx_ss_user_wishlists_user_id   ON ss_user_wishlists (user_id);
CREATE INDEX idx_ss_user_wishlists_product_id ON ss_user_wishlists (product_id);

-- ss_user_product_reactions
CREATE INDEX idx_ss_user_product_reactions_user    ON ss_user_product_reactions (user_id);
CREATE INDEX idx_ss_user_product_reactions_product ON ss_user_product_reactions (product_id);
CREATE INDEX idx_ss_user_product_reactions_reaction ON ss_user_product_reactions (reaction);

-- ss_reviews
CREATE INDEX idx_ss_reviews_product_rating   ON ss_reviews (product_id, rating);
CREATE INDEX idx_ss_reviews_user_id          ON ss_reviews (user_id);
CREATE INDEX idx_ss_reviews_skin_type        ON ss_reviews (skin_type);
CREATE INDEX idx_ss_reviews_created_at       ON ss_reviews (created_at DESC);

-- ss_review_helpfulness
CREATE INDEX idx_ss_review_helpfulness_review ON ss_review_helpfulness (review_id);
CREATE INDEX idx_ss_review_helpfulness_user   ON ss_review_helpfulness (user_id);

-- ss_trending_products
CREATE INDEX idx_ss_trending_products_product     ON ss_trending_products (product_id);
CREATE INDEX idx_ss_trending_products_score       ON ss_trending_products (trend_score DESC);
CREATE INDEX idx_ss_trending_products_source      ON ss_trending_products (source);

-- ss_yuri_conversations
CREATE INDEX idx_ss_yuri_conversations_user_id    ON ss_yuri_conversations (user_id);
CREATE INDEX idx_ss_yuri_conversations_updated_at ON ss_yuri_conversations (updated_at DESC);

-- ss_yuri_messages
CREATE INDEX idx_ss_yuri_messages_conversation    ON ss_yuri_messages (conversation_id);
CREATE INDEX idx_ss_yuri_messages_created_at      ON ss_yuri_messages (created_at ASC);

-- ss_specialist_insights
CREATE INDEX idx_ss_specialist_insights_conversation ON ss_specialist_insights (conversation_id);
CREATE INDEX idx_ss_specialist_insights_type         ON ss_specialist_insights (specialist_type, insight_type);

-- ss_learning_patterns
CREATE INDEX idx_ss_learning_patterns_type        ON ss_learning_patterns (pattern_type);
CREATE INDEX idx_ss_learning_patterns_skin_type   ON ss_learning_patterns (skin_type);

-- ss_ingredient_effectiveness
CREATE INDEX idx_ss_ingredient_effectiveness_ingr ON ss_ingredient_effectiveness (ingredient_id);
CREATE INDEX idx_ss_ingredient_effectiveness_skin ON ss_ingredient_effectiveness (skin_type);

-- ss_product_effectiveness
CREATE INDEX idx_ss_product_effectiveness_product ON ss_product_effectiveness (product_id);
CREATE INDEX idx_ss_product_effectiveness_skin    ON ss_product_effectiveness (skin_type);

-- ss_trend_signals
CREATE INDEX idx_ss_trend_signals_source      ON ss_trend_signals (source);
CREATE INDEX idx_ss_trend_signals_detected_at ON ss_trend_signals (detected_at DESC);
CREATE INDEX idx_ss_trend_signals_keyword     ON ss_trend_signals (keyword);

-- ss_content_posts
CREATE INDEX idx_ss_content_posts_slug        ON ss_content_posts (slug);
CREATE INDEX idx_ss_content_posts_category    ON ss_content_posts (category);
CREATE INDEX idx_ss_content_posts_published   ON ss_content_posts (published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX idx_ss_content_posts_tags        ON ss_content_posts USING gin (tags);

-- ss_subscriptions
CREATE INDEX idx_ss_subscriptions_user_id     ON ss_subscriptions (user_id);
CREATE INDEX idx_ss_subscriptions_stripe_cust ON ss_subscriptions (stripe_customer_id);
CREATE INDEX idx_ss_subscriptions_tier        ON ss_subscriptions (tier);

-- ss_affiliate_clicks
CREATE INDEX idx_ss_affiliate_clicks_user_id    ON ss_affiliate_clicks (user_id);
CREATE INDEX idx_ss_affiliate_clicks_product_id ON ss_affiliate_clicks (product_id);
CREATE INDEX idx_ss_affiliate_clicks_retailer_id ON ss_affiliate_clicks (retailer_id);
CREATE INDEX idx_ss_affiliate_clicks_clicked_at  ON ss_affiliate_clicks (clicked_at DESC);


-- =============================================================================
-- SECTION 9: TRIGGERS (updated_at auto-maintenance)
-- =============================================================================

-- Generic function to keep updated_at current
CREATE OR REPLACE FUNCTION ss_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_products_updated_at
    BEFORE UPDATE ON ss_products
    FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();

CREATE TRIGGER ss_user_profiles_updated_at
    BEFORE UPDATE ON ss_user_profiles
    FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();

CREATE TRIGGER ss_user_routines_updated_at
    BEFORE UPDATE ON ss_user_routines
    FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();

CREATE TRIGGER ss_reviews_updated_at
    BEFORE UPDATE ON ss_reviews
    FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();

CREATE TRIGGER ss_yuri_conversations_updated_at
    BEFORE UPDATE ON ss_yuri_conversations
    FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();

CREATE TRIGGER ss_learning_patterns_updated_at
    BEFORE UPDATE ON ss_learning_patterns
    FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();

-- Trigger: increment/decrement ss_reviews.helpful_count when helpfulness votes change
CREATE OR REPLACE FUNCTION ss_update_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_helpful THEN
            UPDATE ss_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_helpful AND NOT NEW.is_helpful THEN
            UPDATE ss_reviews SET helpful_count = helpful_count - 1 WHERE id = NEW.review_id;
        ELSIF NOT OLD.is_helpful AND NEW.is_helpful THEN
            UPDATE ss_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_helpful THEN
            UPDATE ss_reviews SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = OLD.review_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_review_helpfulness_count
    AFTER INSERT OR UPDATE OR DELETE ON ss_review_helpfulness
    FOR EACH ROW EXECUTE FUNCTION ss_update_helpful_count();

-- Trigger: keep ss_products.review_count in sync with ss_reviews
CREATE OR REPLACE FUNCTION ss_update_review_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE ss_products SET review_count = review_count + 1 WHERE id = NEW.product_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE ss_products SET review_count = GREATEST(review_count - 1, 0) WHERE id = OLD.product_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_products_review_count
    AFTER INSERT OR DELETE ON ss_reviews
    FOR EACH ROW EXECUTE FUNCTION ss_update_review_count();

-- Trigger: keep ss_products.rating_avg in sync with ss_reviews
CREATE OR REPLACE FUNCTION ss_update_product_rating()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id UUID;
BEGIN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);
    UPDATE ss_products
    SET rating_avg = (
        SELECT ROUND(AVG(rating)::NUMERIC, 2)
        FROM ss_reviews
        WHERE product_id = v_product_id
    )
    WHERE id = v_product_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_products_rating_avg
    AFTER INSERT OR UPDATE OF rating OR DELETE ON ss_reviews
    FOR EACH ROW EXECUTE FUNCTION ss_update_product_rating();

-- Trigger: increment ss_yuri_conversations.message_count on new message
CREATE OR REPLACE FUNCTION ss_update_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE ss_yuri_conversations
        SET message_count = message_count + 1,
            updated_at    = NOW()
        WHERE id = NEW.conversation_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE ss_yuri_conversations
        SET message_count = GREATEST(message_count - 1, 0)
        WHERE id = OLD.conversation_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ss_yuri_message_count
    AFTER INSERT OR DELETE ON ss_yuri_messages
    FOR EACH ROW EXECUTE FUNCTION ss_update_message_count();
