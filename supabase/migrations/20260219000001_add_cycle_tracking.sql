-- Feature 8.8: Hormonal Cycle Routine Adjustments
-- Tracks menstrual cycle data for cycle-aware skincare routine recommendations

CREATE TABLE ss_user_cycle_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_start_date DATE NOT NULL,
  cycle_length_days INTEGER DEFAULT 28 CHECK (cycle_length_days BETWEEN 20 AND 45),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add cycle tracking preferences to user profiles
ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS cycle_tracking_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE ss_user_profiles ADD COLUMN IF NOT EXISTS avg_cycle_length INTEGER DEFAULT 28;

-- RLS
ALTER TABLE ss_user_cycle_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cycle data" ON ss_user_cycle_tracking
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_cycle_tracking_user ON ss_user_cycle_tracking(user_id);
CREATE INDEX idx_cycle_tracking_start ON ss_user_cycle_tracking(user_id, cycle_start_date DESC);

-- Updated_at trigger
CREATE TRIGGER ss_cycle_tracking_updated_at
  BEFORE UPDATE ON ss_user_cycle_tracking
  FOR EACH ROW EXECUTE FUNCTION ss_set_updated_at();
