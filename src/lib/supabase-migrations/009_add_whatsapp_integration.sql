-- Migration: Add WhatsApp Business API integration tables
-- Created: 2025-01-16

-- Create WhatsApp conversations table
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message_text text NOT NULL,
  direction text CHECK (direction IN ('incoming', 'outgoing')) NOT NULL,
  message_type text DEFAULT 'text',
  message_id text, -- WhatsApp message ID
  status text CHECK (status IN ('sent', 'delivered', 'read', 'failed')) DEFAULT 'sent',
  status_timestamp timestamp with time zone,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create WhatsApp messages table for tracking sent messages
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message_id text UNIQUE, -- WhatsApp message ID
  message_type text NOT NULL, -- text, template, interactive
  message_content jsonb NOT NULL,
  status text CHECK (status IN ('sent', 'delivered', 'read', 'failed')) DEFAULT 'sent',
  status_timestamp timestamp with time zone,
  sent_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create WhatsApp orders table
CREATE TABLE IF NOT EXISTS public.whatsapp_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  customer_name text NOT NULL,
  product_numbers integer[],
  product_requests text[],
  order_message text,
  skin_type text,
  preferences text[],
  budget_range text,
  urgency text CHECK (urgency IN ('low', 'medium', 'high')) DEFAULT 'medium',
  status text CHECK (status IN ('pending', 'quoted', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
  order_total decimal(10,2),
  shipping_cost decimal(10,2),
  estimated_delivery text,
  tracking_number text,
  notes text,
  admin_notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create WhatsApp contact profiles
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,
  whatsapp_name text,
  profile_picture_url text,
  last_seen timestamp with time zone,
  is_online boolean DEFAULT false,
  is_business_account boolean DEFAULT false,
  language_preference text DEFAULT 'en',
  timezone text,
  opted_in boolean DEFAULT true,
  blocked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create WhatsApp automation rules
CREATE TABLE IF NOT EXISTS public.whatsapp_automation_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name text NOT NULL,
  trigger_type text CHECK (trigger_type IN ('keyword', 'new_contact', 'order_status', 'scheduled')) NOT NULL,
  trigger_condition text NOT NULL,
  response_type text CHECK (response_type IN ('text', 'template', 'function')) NOT NULL,
  response_content jsonb NOT NULL,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 1,
  usage_count integer DEFAULT 0,
  last_used timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_automation_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for WhatsApp conversations
CREATE POLICY IF NOT EXISTS "Users can view own conversations" ON public.whatsapp_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all conversations" ON public.whatsapp_conversations
  FOR ALL USING (true);

-- RLS policies for WhatsApp messages
CREATE POLICY IF NOT EXISTS "Users can view own messages" ON public.whatsapp_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all messages" ON public.whatsapp_messages
  FOR ALL USING (true);

-- RLS policies for WhatsApp orders
CREATE POLICY IF NOT EXISTS "Users can view own orders" ON public.whatsapp_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all orders" ON public.whatsapp_orders
  FOR ALL USING (true);

-- RLS policies for WhatsApp contacts
CREATE POLICY IF NOT EXISTS "Service can manage contacts" ON public.whatsapp_contacts
  FOR ALL USING (true);

-- RLS policies for automation rules
CREATE POLICY IF NOT EXISTS "Service can manage automation rules" ON public.whatsapp_automation_rules
  FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_user_id ON public.whatsapp_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_timestamp ON public.whatsapp_conversations(timestamp);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON public.whatsapp_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON public.whatsapp_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages(status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_orders_phone ON public.whatsapp_orders(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_orders_user_id ON public.whatsapp_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_orders_status ON public.whatsapp_orders(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_orders_created_at ON public.whatsapp_orders(created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON public.whatsapp_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_opted_in ON public.whatsapp_contacts(opted_in);

-- Add triggers for updated_at
CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.whatsapp_orders
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.whatsapp_automation_rules
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Add WhatsApp fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_contact boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_language text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS last_whatsapp_message timestamp with time zone;

-- Insert default automation rules
INSERT INTO public.whatsapp_automation_rules (rule_name, trigger_type, trigger_condition, response_type, response_content) VALUES
('Welcome Message', 'keyword', 'hello|hi|start', 'function', '{"function": "sendWelcomeMessage"}'),
('Order Inquiry', 'keyword', 'order|buy|purchase', 'function', '{"function": "handleOrderInquiry"}'),
('Pricing Info', 'keyword', 'price|cost|how much', 'function', '{"function": "sendPricingInfo"}'),
('Shipping Info', 'keyword', 'shipping|delivery|tracking', 'function', '{"function": "sendShippingInfo"}'),
('Subscription Required', 'keyword', '.*', 'function', '{"function": "checkSubscriptionAndRespond"}')
ON CONFLICT (rule_name) DO NOTHING;

-- Create function to get user's WhatsApp conversation history
CREATE OR REPLACE FUNCTION get_whatsapp_conversation_history(
  p_phone_number text,
  p_limit integer DEFAULT 50
) RETURNS TABLE (
  id uuid,
  message_text text,
  direction text,
  timestamp timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.message_text,
    c.direction,
    c.timestamp
  FROM public.whatsapp_conversations c
  WHERE c.phone_number = p_phone_number
  ORDER BY c.timestamp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get pending WhatsApp orders
CREATE OR REPLACE FUNCTION get_pending_whatsapp_orders()
RETURNS TABLE (
  id uuid,
  phone_number text,
  customer_name text,
  product_numbers integer[],
  order_message text,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.phone_number,
    o.customer_name,
    o.product_numbers,
    o.order_message,
    o.created_at
  FROM public.whatsapp_orders o
  WHERE o.status = 'pending'
  ORDER BY o.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_whatsapp_conversation_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_whatsapp_conversation_history TO anon;
GRANT EXECUTE ON FUNCTION get_pending_whatsapp_orders TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_whatsapp_orders TO anon;