-- Create update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table 1
CREATE TABLE IF NOT EXISTS conversation_context (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  context_data JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2
CREATE TABLE IF NOT EXISTS product_interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  product_brand VARCHAR(255),
  product_name VARCHAR(255),
  category VARCHAR(100),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50),
  message_content JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Table 4
CREATE TABLE IF NOT EXISTS whatsapp_outbound_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 5
CREATE TABLE IF NOT EXISTS user_skin_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
  current_skin_type VARCHAR(20),
  skin_concerns TEXT[],
  preferred_categories TEXT[],
  last_analysis_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);