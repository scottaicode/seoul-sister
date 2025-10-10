-- Migration: AI Skin Analysis with Self-Learning Capabilities
-- Date: 2025-01-10
-- This creates a comprehensive system for storing, learning, and improving from every skin analysis

-- Main skin analysis results table
CREATE TABLE IF NOT EXISTS public.skin_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,

  -- Image data
  image_url TEXT NOT NULL,
  image_metadata JSONB,

  -- AI Analysis Results
  skin_type TEXT CHECK (skin_type IN ('dry', 'oily', 'combination', 'sensitive', 'normal')),
  skin_tone TEXT,
  age_range TEXT,

  -- Detected concerns (stored as array for flexibility)
  concerns TEXT[],
  concern_scores JSONB, -- {"acne": 0.8, "wrinkles": 0.3, "dark_spots": 0.6}

  -- Advanced metrics
  hydration_level DECIMAL(3,2),
  oil_level DECIMAL(3,2),
  texture_score DECIMAL(3,2),
  elasticity_score DECIMAL(3,2),
  brightness_score DECIMAL(3,2),

  -- AI Confidence and metadata
  ai_confidence DECIMAL(3,2),
  ai_model_version TEXT,
  analysis_raw JSONB, -- Complete AI response for future learning

  -- Timestamps
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Learning patterns table - stores successful product matches
CREATE TABLE IF NOT EXISTS public.skin_learning_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Pattern identification
  skin_profile JSONB NOT NULL, -- Combination of characteristics
  product_id UUID REFERENCES public.products(id),

  -- Success metrics
  effectiveness_score DECIMAL(3,2),
  user_satisfaction DECIMAL(3,2),
  repurchase_rate DECIMAL(3,2),
  improvement_timeline INTEGER, -- Days to see results

  -- Sample size for confidence
  sample_count INTEGER DEFAULT 1,

  -- Learning metadata
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Product recommendations based on analysis
CREATE TABLE IF NOT EXISTS public.skin_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID REFERENCES public.skin_analyses(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),

  -- Recommendation scoring
  match_score DECIMAL(3,2), -- How well product matches skin needs
  priority INTEGER, -- Order of importance (1 = most important)
  reason TEXT, -- Why this product was recommended

  -- Expected outcomes
  expected_improvement JSONB, -- {"hydration": "+30%", "brightness": "+20%"}
  expected_timeline TEXT, -- "2-4 weeks"

  -- User interaction
  was_purchased BOOLEAN DEFAULT FALSE,
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Progress tracking - compare analyses over time
CREATE TABLE IF NOT EXISTS public.skin_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Comparison data
  baseline_analysis_id UUID REFERENCES public.skin_analyses(id),
  current_analysis_id UUID REFERENCES public.skin_analyses(id),

  -- Improvement metrics
  overall_improvement DECIMAL(3,2),
  concern_improvements JSONB, -- {"acne": -40%, "wrinkles": -20%}

  -- Product attribution
  products_used UUID[], -- Array of product IDs
  routine_consistency DECIMAL(3,2), -- How consistently they followed recommendations

  -- Timeline
  days_between INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Aggregated insights for machine learning
CREATE TABLE IF NOT EXISTS public.skin_insights_aggregate (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Demographic clustering
  age_group TEXT,
  skin_type TEXT,
  primary_concerns TEXT[],
  geographic_region TEXT,

  -- Aggregated success data
  top_products JSONB, -- Most effective products for this cluster
  average_improvement DECIMAL(3,2),
  common_routines JSONB,

  -- Statistical data
  sample_size INTEGER,
  confidence_interval DECIMAL(3,2),
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- User skin profile - persistent profile that evolves
CREATE TABLE IF NOT EXISTS public.user_skin_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,

  -- Current state (updated with each analysis)
  current_skin_type TEXT,
  current_concerns TEXT[],
  current_routine JSONB,

  -- Historical patterns
  skin_type_history JSONB[], -- Track changes over seasons/time
  concern_evolution JSONB[], -- How concerns changed over time

  -- Preferences learned
  ingredient_preferences JSONB, -- {"loves": ["niacinamide"], "avoids": ["alcohol"]}
  texture_preferences TEXT[],
  price_sensitivity DECIMAL(3,2),

  -- Behavioral patterns
  purchase_frequency INTEGER, -- Days between purchases
  routine_complexity_preference TEXT CHECK (routine_complexity_preference IN ('minimal', 'moderate', 'extensive')),

  -- Metadata
  total_analyses INTEGER DEFAULT 0,
  last_analysis_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create indexes for performance
CREATE INDEX idx_skin_analyses_user_id ON public.skin_analyses(user_id);
CREATE INDEX idx_skin_analyses_analyzed_at ON public.skin_analyses(analyzed_at DESC);
CREATE INDEX idx_skin_analyses_concerns ON public.skin_analyses USING GIN(concerns);
CREATE INDEX idx_skin_learning_patterns_profile ON public.skin_learning_patterns USING GIN(skin_profile);
CREATE INDEX idx_skin_recommendations_analysis ON public.skin_recommendations(analysis_id);
CREATE INDEX idx_skin_recommendations_score ON public.skin_recommendations(match_score DESC);
CREATE INDEX idx_skin_progress_user ON public.skin_progress(user_id);

-- Enable Row Level Security
ALTER TABLE public.skin_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_insights_aggregate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skin_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own analyses
CREATE POLICY "Users can view own skin analyses" ON public.skin_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skin analyses" ON public.skin_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Learning patterns are public for the algorithm to learn
CREATE POLICY "Anyone can view learning patterns" ON public.skin_learning_patterns
  FOR SELECT USING (true);

-- Service can update learning patterns
CREATE POLICY "Service can manage learning patterns" ON public.skin_learning_patterns
  FOR ALL USING (true);

-- Users can see their recommendations
CREATE POLICY "Users can view own recommendations" ON public.skin_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.skin_analyses
      WHERE skin_analyses.id = skin_recommendations.analysis_id
      AND skin_analyses.user_id = auth.uid()
    )
  );

-- Users can update their recommendation feedback
CREATE POLICY "Users can update own recommendation feedback" ON public.skin_recommendations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.skin_analyses
      WHERE skin_analyses.id = skin_recommendations.analysis_id
      AND skin_analyses.user_id = auth.uid()
    )
  );

-- Users can view their progress
CREATE POLICY "Users can view own progress" ON public.skin_progress
  FOR SELECT USING (auth.uid() = user_id);

-- Aggregated insights are public
CREATE POLICY "Anyone can view insights" ON public.skin_insights_aggregate
  FOR SELECT USING (true);

-- Users can manage their profile
CREATE POLICY "Users can view own skin profile" ON public.user_skin_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own skin profile" ON public.user_skin_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skin profile" ON public.user_skin_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER handle_skin_analyses_updated_at BEFORE UPDATE ON public.skin_analyses
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER handle_user_skin_profiles_updated_at BEFORE UPDATE ON public.user_skin_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Function to calculate skin improvement over time
CREATE OR REPLACE FUNCTION calculate_skin_improvement(
  baseline_id UUID,
  current_id UUID
) RETURNS DECIMAL AS $$
DECLARE
  baseline_scores RECORD;
  current_scores RECORD;
  improvement DECIMAL;
BEGIN
  SELECT hydration_level, oil_level, texture_score, elasticity_score, brightness_score
  INTO baseline_scores
  FROM public.skin_analyses
  WHERE id = baseline_id;

  SELECT hydration_level, oil_level, texture_score, elasticity_score, brightness_score
  INTO current_scores
  FROM public.skin_analyses
  WHERE id = current_id;

  -- Calculate weighted improvement
  improvement := (
    (current_scores.hydration_level - baseline_scores.hydration_level) * 0.2 +
    (current_scores.texture_score - baseline_scores.texture_score) * 0.25 +
    (current_scores.elasticity_score - baseline_scores.elasticity_score) * 0.2 +
    (current_scores.brightness_score - baseline_scores.brightness_score) * 0.35
  ) * 100;

  RETURN improvement;
END;
$$ LANGUAGE plpgsql;

-- Function to update learning patterns based on user feedback
CREATE OR REPLACE FUNCTION update_learning_pattern(
  p_skin_profile JSONB,
  p_product_id UUID,
  p_effectiveness DECIMAL,
  p_satisfaction DECIMAL
) RETURNS VOID AS $$
DECLARE
  existing_pattern RECORD;
BEGIN
  SELECT * INTO existing_pattern
  FROM public.skin_learning_patterns
  WHERE skin_profile = p_skin_profile
  AND product_id = p_product_id;

  IF existing_pattern IS NOT NULL THEN
    -- Update existing pattern with weighted average
    UPDATE public.skin_learning_patterns
    SET effectiveness_score = (
      (effectiveness_score * sample_count + p_effectiveness) / (sample_count + 1)
    ),
    user_satisfaction = (
      (user_satisfaction * sample_count + p_satisfaction) / (sample_count + 1)
    ),
    sample_count = sample_count + 1,
    last_updated = NOW()
    WHERE id = existing_pattern.id;
  ELSE
    -- Create new pattern
    INSERT INTO public.skin_learning_patterns (
      skin_profile, product_id, effectiveness_score,
      user_satisfaction, sample_count
    ) VALUES (
      p_skin_profile, p_product_id, p_effectiveness,
      p_satisfaction, 1
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;