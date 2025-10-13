-- Part 3: Enable RLS and create policies

-- Enable RLS
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_outbound_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skin_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Service can manage conversation context" ON conversation_context FOR ALL USING (true);
CREATE POLICY "Service can manage product interests" ON product_interests FOR ALL USING (true);
CREATE POLICY "Service can manage whatsapp conversations" ON whatsapp_conversations FOR ALL USING (true);
CREATE POLICY "Service can manage outbound queue" ON whatsapp_outbound_queue FOR ALL USING (true);
CREATE POLICY "Service can manage skin profiles" ON user_skin_profiles FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON conversation_context TO anon, authenticated;
GRANT ALL ON product_interests TO anon, authenticated;
GRANT ALL ON whatsapp_conversations TO anon, authenticated;
GRANT ALL ON whatsapp_outbound_queue TO anon, authenticated;
GRANT ALL ON user_skin_profiles TO anon, authenticated;