-- Seoul Sister WhatsApp Business Integration Tables
-- Run this script against your Supabase database to enable WhatsApp ordering

-- Create update function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. WhatsApp Conversations Table (stores all message history)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    phone_number VARCHAR(20) NOT NULL,
    message_text TEXT,
    direction VARCHAR(10) CHECK (direction IN ('incoming', 'outgoing')) NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB,

    -- Indexes for performance
    INDEX idx_whatsapp_conversations_phone (phone_number),
    INDEX idx_whatsapp_conversations_timestamp (timestamp),
    INDEX idx_whatsapp_conversations_user_id (user_id)
);

-- 2. WhatsApp Orders Table (stores product orders placed via WhatsApp)
CREATE TABLE IF NOT EXISTS whatsapp_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    phone_number VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255),
    product_numbers INTEGER[],
    product_requests TEXT[],
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    order_message TEXT,
    quote_amount DECIMAL(10,2),
    quote_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    INDEX idx_whatsapp_orders_phone (phone_number),
    INDEX idx_whatsapp_orders_status (status),
    INDEX idx_whatsapp_orders_created (created_at)
);

-- 3. WhatsApp Messages Table (detailed message tracking for delivery status)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id VARCHAR(255) UNIQUE, -- WhatsApp's message ID
    phone_number VARCHAR(20) NOT NULL,
    direction VARCHAR(10) CHECK (direction IN ('incoming', 'outgoing')) NOT NULL,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text',
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    status_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    INDEX idx_whatsapp_messages_phone (phone_number),
    INDEX idx_whatsapp_messages_status (status),
    INDEX idx_whatsapp_messages_message_id (message_id)
);

-- 4. User Skin Profiles for WhatsApp (stores customer preferences from WhatsApp interactions)
CREATE TABLE IF NOT EXISTS user_skin_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    current_skin_type VARCHAR(50),
    skin_concerns TEXT[],
    preferred_brands TEXT[],
    budget_range VARCHAR(50),
    last_analysis_date TIMESTAMPTZ,
    preferences JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    INDEX idx_user_skin_profiles_whatsapp (whatsapp_number),
    INDEX idx_user_skin_profiles_user_id (user_id)
);

-- 5. Product Interest Tracking (track what products users ask about)
CREATE TABLE IF NOT EXISTS product_interests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    product_brand VARCHAR(255),
    product_name VARCHAR(255),
    category VARCHAR(100),
    interest_type VARCHAR(50), -- 'inquiry', 'order_request', 'comparison'
    context TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    INDEX idx_product_interests_phone (phone_number),
    INDEX idx_product_interests_brand (product_brand),
    INDEX idx_product_interests_timestamp (timestamp)
);

-- Add triggers for updated_at columns
CREATE TRIGGER trigger_whatsapp_orders_updated_at
    BEFORE UPDATE ON whatsapp_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_skin_profiles_updated_at
    BEFORE UPDATE ON user_skin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add profiles table extension for WhatsApp integration if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE profiles ADD COLUMN phone VARCHAR(20);
        ALTER TABLE profiles ADD COLUMN whatsapp_contact BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create indexes on profiles for WhatsApp lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_whatsapp_contact ON profiles(whatsapp_contact) WHERE whatsapp_contact = true;

-- Row Level Security Policies
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_interests ENABLE ROW LEVEL SECURITY;

-- Policies for service role (backend operations)
CREATE POLICY "Service role can manage whatsapp_conversations" ON whatsapp_conversations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage whatsapp_orders" ON whatsapp_orders
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage whatsapp_messages" ON whatsapp_messages
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage user_skin_profiles" ON user_skin_profiles
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage product_interests" ON product_interests
    FOR ALL USING (auth.role() = 'service_role');

-- Policies for authenticated users (own data only)
CREATE POLICY "Users can view own whatsapp_conversations" ON whatsapp_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own whatsapp_orders" ON whatsapp_orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own user_skin_profiles" ON user_skin_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON whatsapp_conversations TO service_role;
GRANT ALL ON whatsapp_orders TO service_role;
GRANT ALL ON whatsapp_messages TO service_role;
GRANT ALL ON user_skin_profiles TO service_role;
GRANT ALL ON product_interests TO service_role;

GRANT SELECT ON whatsapp_conversations TO authenticated;
GRANT SELECT ON whatsapp_orders TO authenticated;
GRANT SELECT ON user_skin_profiles TO authenticated;

COMMIT;