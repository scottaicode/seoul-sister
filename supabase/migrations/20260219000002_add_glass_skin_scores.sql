-- Feature 8.9: Glass Skin Score — Photo Tracking
-- Stores photo-based skin analysis scores with 5 dimensions

CREATE TABLE ss_glass_skin_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  luminosity_score INTEGER CHECK (luminosity_score BETWEEN 0 AND 100),
  smoothness_score INTEGER CHECK (smoothness_score BETWEEN 0 AND 100),
  clarity_score INTEGER CHECK (clarity_score BETWEEN 0 AND 100),
  hydration_score INTEGER CHECK (hydration_score BETWEEN 0 AND 100),
  evenness_score INTEGER CHECK (evenness_score BETWEEN 0 AND 100),
  recommendations TEXT[] DEFAULT '{}',
  analysis_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE ss_glass_skin_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own glass skin scores"
  ON ss_glass_skin_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own glass skin scores"
  ON ss_glass_skin_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own glass skin scores"
  ON ss_glass_skin_scores FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_gss_user_created ON ss_glass_skin_scores(user_id, created_at DESC);

-- Updated_at trigger (reuse existing function)
CREATE TRIGGER set_glass_skin_scores_updated_at
  BEFORE UPDATE ON ss_glass_skin_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
