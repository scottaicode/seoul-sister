-- Add conversation summary for cross-session memory
-- Stores AI-generated summary of what was discussed, products mentioned,
-- recommendations made, and key details the user shared
ALTER TABLE ss_yuri_conversations ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE ss_yuri_conversations ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;
