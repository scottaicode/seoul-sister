-- Phase 13.3: Decision Memory — Structured cross-session intelligence
-- Stores structured decisions, preferences, and commitments extracted from Yuri conversations
ALTER TABLE ss_yuri_conversations ADD COLUMN IF NOT EXISTS decision_memory JSONB DEFAULT '{}';
