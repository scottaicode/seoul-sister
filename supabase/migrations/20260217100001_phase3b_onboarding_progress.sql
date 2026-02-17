-- ============================================================================
-- Phase 3B: Yuri Conversational Onboarding
-- ============================================================================
-- Adds ss_onboarding_progress table to track Yuri's conversational onboarding
-- and an onboarding_completed flag on ss_user_profiles.

-- Add onboarding_completed to user profiles
ALTER TABLE ss_user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Onboarding progress table
CREATE TABLE IF NOT EXISTS ss_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ss_yuri_conversations(id) ON DELETE SET NULL,
  onboarding_status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (onboarding_status IN ('in_progress', 'completed', 'skipped')),
  skin_profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_fields TEXT[] NOT NULL DEFAULT ARRAY[
    'skin_type', 'skin_concerns', 'age_range'
  ],
  completion_percentage INTEGER NOT NULL DEFAULT 0
    CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ss_onboarding_progress_unique_user UNIQUE (user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ss_onboarding_progress_user_id
  ON ss_onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_ss_onboarding_progress_status
  ON ss_onboarding_progress(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_ss_onboarding_progress_conversation
  ON ss_onboarding_progress(conversation_id);

-- RLS
ALTER TABLE ss_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY ss_onboarding_progress_select ON ss_onboarding_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY ss_onboarding_progress_insert ON ss_onboarding_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY ss_onboarding_progress_update ON ss_onboarding_progress
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY ss_onboarding_progress_delete ON ss_onboarding_progress
  FOR DELETE USING (auth.uid() = user_id);

-- Add conversation_type to ss_yuri_conversations for onboarding distinction
ALTER TABLE ss_yuri_conversations
ADD COLUMN IF NOT EXISTS conversation_type TEXT NOT NULL DEFAULT 'general'
  CHECK (conversation_type IN ('general', 'onboarding', 'specialist'));

-- Auto-update updated_at trigger
CREATE TRIGGER ss_onboarding_progress_updated_at
  BEFORE UPDATE ON ss_onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION ss_set_updated_at();
