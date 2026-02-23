-- Add truncation bridge summary columns for long conversation handling
-- (LGAAS pattern: smart truncation with cached bridge summaries)
ALTER TABLE ss_yuri_conversations ADD COLUMN IF NOT EXISTS truncation_summary TEXT;
ALTER TABLE ss_yuri_conversations ADD COLUMN IF NOT EXISTS truncation_summary_msg_count INTEGER;
