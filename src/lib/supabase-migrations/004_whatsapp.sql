-- WhatsApp AI Beauty Assistant Schema
-- Stores conversation history and learning patterns

-- WhatsApp Conversations
CREATE TABLE whatsapp_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message_id TEXT UNIQUE,
  message_type TEXT NOT NULL, -- 'text', 'image', 'location', 'order'
  message_content JSONB NOT NULL,
  response_sent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Interests from WhatsApp
CREATE TABLE product_interests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  product_brand TEXT,
  product_name TEXT,
  product_name_korean TEXT,
  category TEXT,
  identified_from TEXT DEFAULT 'image', -- 'image', 'text', 'reorder'
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp User Profiles
CREATE TABLE whatsapp_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  first_name TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  preferred_language TEXT DEFAULT 'en',
  total_orders INTEGER DEFAULT 0,
  total_saved DECIMAL(10,2) DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quick Orders (Reorder favorites)
CREATE TABLE whatsapp_quick_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  seoul_price DECIMAL(10,2),
  order_count INTEGER DEFAULT 1,
  last_ordered TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product Identification History
CREATE TABLE product_identifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  image_url TEXT,
  identified_brand TEXT,
  identified_product TEXT,
  identified_product_korean TEXT,
  category TEXT,
  key_ingredients JSONB,
  ai_confidence DECIMAL(3,2),
  matched_product_id UUID REFERENCES products(id),
  seoul_price DECIMAL(10,2),
  us_price DECIMAL(10,2),
  savings_amount DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Outbound Queue
CREATE TABLE whatsapp_outbound_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_number TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'delivered', 'read'
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Routine Recommendations sent via WhatsApp
CREATE TABLE whatsapp_routine_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  skin_type TEXT,
  routine_products JSONB NOT NULL, -- Array of product recommendations
  total_seoul_price DECIMAL(10,2),
  total_us_price DECIMAL(10,2),
  total_savings DECIMAL(10,2),
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shipping Estimates
CREATE TABLE shipping_estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  country TEXT,
  city TEXT,
  standard_cost DECIMAL(10,2),
  express_cost DECIMAL(10,2),
  priority_cost DECIMAL(10,2),
  estimated_days_standard INTEGER,
  estimated_days_express INTEGER,
  estimated_days_priority INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ingredient Queries
CREATE TABLE ingredient_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  ingredient_name TEXT NOT NULL,
  query_text TEXT,
  ai_response TEXT,
  helpful_rating INTEGER, -- 1-5 rating if provided
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation Context (for maintaining chat context)
CREATE TABLE conversation_contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  current_context TEXT, -- 'browsing', 'ordering', 'asking', 'identifying'
  last_product_discussed UUID REFERENCES products(id),
  cart_items JSONB DEFAULT '[]'::JSONB,
  conversation_state JSONB DEFAULT '{}'::JSONB,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_whatsapp_conversations_phone ON whatsapp_conversations(phone_number);
CREATE INDEX idx_whatsapp_conversations_created ON whatsapp_conversations(created_at DESC);
CREATE INDEX idx_product_interests_phone ON product_interests(phone_number);
CREATE INDEX idx_product_identifications_phone ON product_identifications(phone_number);
CREATE INDEX idx_whatsapp_users_phone ON whatsapp_users(phone_number);
CREATE INDEX idx_whatsapp_outbound_status ON whatsapp_outbound_queue(status);
CREATE INDEX idx_conversation_contexts_phone ON conversation_contexts(phone_number);

-- Create RLS policies
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_identifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_outbound_queue ENABLE ROW LEVEL SECURITY;

-- Admin can access all WhatsApp data
CREATE POLICY "Admin full access to WhatsApp data" ON whatsapp_conversations
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.uid() = id
    AND raw_user_meta_data->>'role' = 'admin'
  ));

-- Function to update conversation context
CREATE OR REPLACE FUNCTION update_conversation_context()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO conversation_contexts (phone_number, current_context, updated_at)
  VALUES (NEW.phone_number, 'active', NOW())
  ON CONFLICT (phone_number)
  DO UPDATE SET
    updated_at = NOW(),
    expires_at = NOW() + INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain conversation context
CREATE TRIGGER update_context_on_message
  AFTER INSERT ON whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_context();

-- Function to track product interest patterns
CREATE OR REPLACE FUNCTION track_interest_pattern()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user's interest profile
  UPDATE whatsapp_users
  SET
    last_active = NOW(),
    updated_at = NOW()
  WHERE phone_number = NEW.phone_number;

  -- Store pattern for ML improvements
  INSERT INTO skin_learning_patterns (
    skin_profile,
    product_id,
    effectiveness_score,
    confidence_level
  )
  SELECT
    jsonb_build_object(
      'interests', array_agg(DISTINCT category),
      'brands', array_agg(DISTINCT product_brand)
    ),
    (SELECT id FROM products WHERE brand = NEW.product_brand LIMIT 1),
    0.7, -- Initial score, will be updated based on purchases
    NEW.confidence_score
  FROM product_interests
  WHERE phone_number = NEW.phone_number
  GROUP BY phone_number
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for interest tracking
CREATE TRIGGER track_interest
  AFTER INSERT ON product_interests
  FOR EACH ROW
  EXECUTE FUNCTION track_interest_pattern();

-- Analytics view for WhatsApp engagement
CREATE VIEW whatsapp_analytics AS
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT phone_number) as unique_users,
  COUNT(*) as total_messages,
  SUM(CASE WHEN message_type = 'image' THEN 1 ELSE 0 END) as product_photos,
  SUM(CASE WHEN message_type = 'text' THEN 1 ELSE 0 END) as text_queries,
  AVG(CASE WHEN response_sent IS NOT NULL THEN 1 ELSE 0 END) as response_rate
FROM whatsapp_conversations
GROUP BY DATE(created_at);

-- Product identification success rate
CREATE VIEW identification_analytics AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_identifications,
  AVG(ai_confidence) as avg_confidence,
  SUM(CASE WHEN matched_product_id IS NOT NULL THEN 1 ELSE 0 END) as matched_products,
  AVG(savings_amount) as avg_savings
FROM product_identifications
GROUP BY DATE(created_at);

COMMENT ON TABLE whatsapp_conversations IS 'Stores all WhatsApp message history and responses';
COMMENT ON TABLE product_interests IS 'Tracks products users are interested in via WhatsApp';
COMMENT ON TABLE whatsapp_users IS 'WhatsApp user profiles with preferences and history';
COMMENT ON TABLE product_identifications IS 'History of AI product identification from photos';
COMMENT ON TABLE whatsapp_outbound_queue IS 'Queue for sending WhatsApp messages';
COMMENT ON TABLE conversation_contexts IS 'Maintains conversation state for 24 hours';