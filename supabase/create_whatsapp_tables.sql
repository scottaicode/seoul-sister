-- Create trigger function first
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create conversation_context table
CREATE TABLE conversation_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  context_type TEXT NOT NULL,
  context_data JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create product_interests table
CREATE TABLE product_interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  product_brand TEXT,
  product_name TEXT,
  category TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create whatsapp_conversations table
CREATE TABLE whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message_type TEXT,
  message_content JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create whatsapp_outbound_queue table
CREATE TABLE whatsapp_outbound_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_skin_profiles table
CREATE TABLE user_skin_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_number TEXT UNIQUE NOT NULL,
  current_skin_type TEXT,
  skin_concerns TEXT[],
  preferred_categories TEXT[],
  last_analysis_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);