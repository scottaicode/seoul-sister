-- WhatsApp & Stripe Integration Tables
-- Add missing tables for complete order processing flow

-- Conversation context table for order states
CREATE TABLE IF NOT EXISTS conversation_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  context_type VARCHAR(50) NOT NULL, -- 'pending_order', 'payment_setup', etc.
  context_data JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product interests tracking from WhatsApp
CREATE TABLE IF NOT EXISTS product_interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  product_brand VARCHAR(255),
  product_name VARCHAR(255),
  category VARCHAR(100),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp conversations log
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50), -- 'text', 'image', 'location'
  message_content JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Outbound message queue for WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_outbound_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User skin profiles for WhatsApp recommendations
CREATE TABLE IF NOT EXISTS user_skin_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  current_skin_type VARCHAR(20),
  skin_concerns TEXT[],
  preferred_categories TEXT[],
  last_analysis_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to user_profiles for Stripe integration
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_context_phone ON conversation_context(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversation_context_type ON conversation_context(context_type);
CREATE INDEX IF NOT EXISTS idx_conversation_context_expires ON conversation_context(expires_at);

CREATE INDEX IF NOT EXISTS idx_product_interests_phone ON product_interests(phone_number);
CREATE INDEX IF NOT EXISTS idx_product_interests_timestamp ON product_interests(timestamp);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_timestamp ON whatsapp_conversations(timestamp);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status ON whatsapp_outbound_queue(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_created ON whatsapp_outbound_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe ON user_profiles(stripe_customer_id);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_conversation_context_updated_at
  BEFORE UPDATE ON conversation_context
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_skin_profiles_updated_at
  BEFORE UPDATE ON user_skin_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable RLS on new tables
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_outbound_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skin_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for WhatsApp service access
CREATE POLICY "Service can manage conversation context" ON conversation_context
  FOR ALL USING (true);

CREATE POLICY "Service can manage product interests" ON product_interests
  FOR ALL USING (true);

CREATE POLICY "Service can manage whatsapp conversations" ON whatsapp_conversations
  FOR ALL USING (true);

CREATE POLICY "Service can manage outbound queue" ON whatsapp_outbound_queue
  FOR ALL USING (true);

CREATE POLICY "Service can manage skin profiles" ON user_skin_profiles
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON conversation_context TO anon, authenticated;
GRANT ALL ON product_interests TO anon, authenticated;
GRANT ALL ON whatsapp_conversations TO anon, authenticated;
GRANT ALL ON whatsapp_outbound_queue TO anon, authenticated;
GRANT ALL ON user_skin_profiles TO anon, authenticated;