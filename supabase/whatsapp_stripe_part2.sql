-- Part 2: Create indexes and triggers

-- Create indexes
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

-- Create triggers
DROP TRIGGER IF EXISTS update_conversation_context_updated_at ON conversation_context;
CREATE TRIGGER update_conversation_context_updated_at
  BEFORE UPDATE ON conversation_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_skin_profiles_updated_at ON user_skin_profiles;
CREATE TRIGGER update_user_skin_profiles_updated_at
  BEFORE UPDATE ON user_skin_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();