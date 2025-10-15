-- Seoul Sister Premium Intelligence Platform - Simple Clean Schema
-- Copy and paste this entire script into your Supabase SQL Editor

-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS daily_deals CASCADE;
DROP TABLE IF EXISTS product_prices CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS user_watchlists CASCADE;
DROP TABLE IF EXISTS premium_subscriptions CASCADE;
DROP TABLE IF EXISTS korean_suppliers CASCADE;
DROP TABLE IF EXISTS price_retailers CASCADE;

-- ============================================
-- PART 1: Retailer Management
-- ============================================

CREATE TABLE price_retailers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(100) NOT NULL UNIQUE,
    country VARCHAR(10) NOT NULL DEFAULT 'US',
    base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    scraping_enabled BOOLEAN DEFAULT true,
    scraping_frequency_hours INTEGER DEFAULT 24,
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    average_shipping_cost DECIMAL(8,2) DEFAULT 0,
    free_shipping_threshold DECIMAL(8,2),
    typical_processing_days INTEGER DEFAULT 3,
    success_rate DECIMAL(5,2) DEFAULT 100.00,
    avg_response_time_ms INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 2: Product Price Tracking
-- ============================================

CREATE TABLE product_prices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    retailer_id UUID NOT NULL REFERENCES price_retailers(id),
    current_price DECIMAL(10,2) NOT NULL,
    original_price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    in_stock BOOLEAN DEFAULT true,
    stock_level VARCHAR(20),
    retailer_product_name VARCHAR(500),
    retailer_product_url TEXT,
    retailer_sku VARCHAR(100),
    shipping_cost DECIMAL(8,2) DEFAULT 0,
    shipping_time_days INTEGER,
    total_cost DECIMAL(10,2),
    price_confidence DECIMAL(3,2) DEFAULT 1.00,
    data_source VARCHAR(50) DEFAULT 'scraping',
    price_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 3: Price History & Analytics
-- ============================================

CREATE TABLE price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    retailer_id UUID NOT NULL REFERENCES price_retailers(id),
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    recorded_date DATE NOT NULL,
    price_change_amount DECIMAL(10,2),
    price_change_percentage DECIMAL(5,2),
    is_lowest_price BOOLEAN DEFAULT false,
    is_highest_price BOOLEAN DEFAULT false,
    was_on_sale BOOLEAN DEFAULT false,
    sale_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 4: Deal Discovery & Alerts
-- ============================================

CREATE TABLE daily_deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    product_id VARCHAR(255) NOT NULL,
    retailer_id UUID NOT NULL REFERENCES price_retailers(id),
    current_price DECIMAL(10,2) NOT NULL,
    previous_price DECIMAL(10,2) NOT NULL,
    savings_amount DECIMAL(10,2) NOT NULL,
    savings_percentage DECIMAL(5,2) NOT NULL,
    deal_type VARCHAR(50),
    deal_score INTEGER,
    stock_status VARCHAR(20) DEFAULT 'in_stock',
    deal_expires_at TIMESTAMP WITH TIME ZONE,
    views_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    member_saves INTEGER DEFAULT 0,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 5: User Watchlists & Premium Subscriptions
-- ============================================

CREATE TABLE user_watchlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    target_price DECIMAL(10,2),
    alert_on_restock BOOLEAN DEFAULT true,
    alert_on_sale BOOLEAN DEFAULT true,
    alert_on_price_drop BOOLEAN DEFAULT true,
    email_alerts BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT false,
    whatsapp_alerts BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    times_alerted INTEGER DEFAULT 0,
    last_alerted_at TIMESTAMP WITH TIME ZONE,
    best_price_seen DECIMAL(10,2),
    best_price_retailer_id UUID REFERENCES price_retailers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE premium_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    plan_type VARCHAR(50) DEFAULT 'premium',
    monthly_price DECIMAL(8,2) DEFAULT 20.00,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'trialing',
    trial_start DATE,
    trial_end DATE,
    trial_days_remaining INTEGER,
    current_period_start DATE,
    current_period_end DATE,
    next_billing_date DATE,
    intelligence_reports_accessed INTEGER DEFAULT 0,
    deal_alerts_sent INTEGER DEFAULT 0,
    watchlist_items INTEGER DEFAULT 0,
    ai_analyses_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    canceled_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- PART 6: Korean Supplier Directory
-- ============================================

CREATE TABLE korean_suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    korean_name VARCHAR(255),
    business_type VARCHAR(50),
    contact_email VARCHAR(255),
    whatsapp_number VARCHAR(20),
    kakao_id VARCHAR(100),
    website_url VARCHAR(255),
    city VARCHAR(100) DEFAULT 'Seoul',
    district VARCHAR(100),
    address TEXT,
    specialties TEXT[],
    minimum_order_usd DECIMAL(10,2),
    payment_methods TEXT[],
    shipping_methods TEXT[],
    verification_status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(255),
    response_rate DECIMAL(3,2) DEFAULT 0.95,
    avg_response_time_hours INTEGER DEFAULT 24,
    reliability_score INTEGER,
    premium_member_only BOOLEAN DEFAULT false,
    group_buy_eligible BOOLEAN DEFAULT true,
    internal_notes TEXT,
    public_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PART 7: Create Indexes for Performance
-- ============================================

CREATE INDEX idx_retailers_active ON price_retailers(is_active);
CREATE INDEX idx_retailers_last_scraped ON price_retailers(last_scraped_at);
CREATE INDEX idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX idx_product_prices_retailer_id ON product_prices(retailer_id);
CREATE INDEX idx_product_prices_date ON product_prices(price_date DESC);
CREATE INDEX idx_product_prices_total_cost ON product_prices(total_cost);
CREATE INDEX idx_price_history_product_retailer ON price_history(product_id, retailer_id);
CREATE INDEX idx_price_history_date ON price_history(recorded_date DESC);
CREATE INDEX idx_daily_deals_date ON daily_deals(deal_date DESC);
CREATE INDEX idx_daily_deals_score ON daily_deals(deal_score DESC);
CREATE INDEX idx_daily_deals_savings ON daily_deals(savings_percentage DESC);
CREATE INDEX idx_watchlists_user_id ON user_watchlists(user_id);
CREATE INDEX idx_watchlists_product_id ON user_watchlists(product_id);
CREATE INDEX idx_subscriptions_user_id ON premium_subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON premium_subscriptions(status);
CREATE INDEX idx_suppliers_verification ON korean_suppliers(verification_status);
CREATE INDEX idx_suppliers_premium_only ON korean_suppliers(premium_member_only);

-- ============================================
-- PART 8: Insert Initial Data
-- ============================================

INSERT INTO price_retailers (name, domain, country, base_currency, average_shipping_cost, free_shipping_threshold, typical_processing_days) VALUES
    ('Sephora', 'sephora.com', 'US', 'USD', 5.95, 35.00, 2),
    ('YesStyle', 'yesstyle.com', 'HK', 'USD', 7.99, 35.00, 7),
    ('Olive Young Global', 'global.oliveyoung.com', 'KR', 'USD', 12.99, 60.00, 10),
    ('StyleKorean', 'stylekorean.com', 'KR', 'USD', 6.99, 49.00, 7),
    ('Amazon', 'amazon.com', 'US', 'USD', 8.99, 35.00, 2),
    ('iHerb', 'iherb.com', 'US', 'USD', 4.99, 35.00, 3),
    ('Sokoglam', 'sokoglam.com', 'US', 'USD', 6.95, 50.00, 3),
    ('Beautylish', 'beautylish.com', 'US', 'USD', 5.95, 35.00, 2);

INSERT INTO korean_suppliers (name, korean_name, business_type, contact_email, city, district, specialties, minimum_order_usd, verification_status) VALUES
    ('Seoul Beauty Hub', '서울뷰티허브', 'distributor', 'contact@seoulbeautyhub.kr', 'Seoul', 'Gangnam', ARRAY['skincare', 'makeup'], 200.00, 'verified'),
    ('K-Beauty Direct', '케이뷰티다이렉트', 'wholesaler', 'info@kbeautydirect.co.kr', 'Seoul', 'Hongdae', ARRAY['skincare', 'tools'], 150.00, 'verified'),
    ('Myeongdong Beauty Supply', '명동뷰티서플라이', 'retailer', 'sales@mdbeauty.kr', 'Seoul', 'Jung-gu', ARRAY['skincare', 'makeup', 'tools'], 100.00, 'pending');

-- Success message
SELECT 'Price Intelligence Platform database schema deployed successfully!' as message;