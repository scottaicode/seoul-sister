-- Enable RLS on tables
ALTER TABLE conversation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_outbound_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skin_profiles ENABLE ROW LEVEL SECURITY;

-- Create simple policies
CREATE POLICY "Allow all for conversation_context" ON conversation_context FOR ALL USING (true);
CREATE POLICY "Allow all for product_interests" ON product_interests FOR ALL USING (true);
CREATE POLICY "Allow all for whatsapp_conversations" ON whatsapp_conversations FOR ALL USING (true);
CREATE POLICY "Allow all for whatsapp_outbound_queue" ON whatsapp_outbound_queue FOR ALL USING (true);
CREATE POLICY "Allow all for user_skin_profiles" ON user_skin_profiles FOR ALL USING (true);