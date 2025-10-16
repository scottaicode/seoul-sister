-- Migration: Add AI skin analysis functionality
-- Created: 2025-01-16

-- Create user skin analysis table
CREATE TABLE IF NOT EXISTS public.user_skin_analysis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  analysis_data jsonb NOT NULL,
  metadata jsonb,
  confidence_score integer CHECK (confidence_score >= 0 AND confidence_score <= 100),
  skin_type text,
  primary_concerns text[],
  secondary_concerns text[],
  compatible_ingredients text[],
  ingredients_to_avoid text[],
  is_archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user photo uploads table
CREATE TABLE IF NOT EXISTS public.user_photos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  upload_method text CHECK (upload_method IN ('camera', 'upload')) DEFAULT 'upload',
  purpose text CHECK (purpose IN ('skin_analysis', 'before_after', 'concern_tracking', 'general')) DEFAULT 'skin_analysis',
  metadata jsonb,
  is_processed boolean DEFAULT false,
  analysis_id uuid REFERENCES public.user_skin_analysis(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create skin concerns tracking table
CREATE TABLE IF NOT EXISTS public.user_skin_concerns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  concern_type text NOT NULL,
  severity text CHECK (severity IN ('mild', 'moderate', 'severe')) DEFAULT 'moderate',
  affected_areas text[],
  first_noticed date,
  current_status text CHECK (current_status IN ('improving', 'stable', 'worsening', 'resolved')) DEFAULT 'stable',
  treatments_tried text[],
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create personalized recommendations table
CREATE TABLE IF NOT EXISTS public.user_recommendations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  analysis_id uuid REFERENCES public.user_skin_analysis(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  recommendation_type text CHECK (recommendation_type IN ('cleanser', 'moisturizer', 'treatment', 'sunscreen', 'mask', 'serum', 'toner')) NOT NULL,
  compatibility_score decimal(3,2) CHECK (compatibility_score >= 0 AND compatibility_score <= 1),
  reasoning text,
  priority integer DEFAULT 1,
  status text CHECK (status IN ('suggested', 'tried', 'using', 'discontinued', 'wishlist')) DEFAULT 'suggested',
  user_rating integer CHECK (user_rating >= 1 AND user_rating <= 5),
  user_notes text,
  recommended_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create ingredient compatibility tracking
CREATE TABLE IF NOT EXISTS public.user_ingredient_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  ingredient_name text NOT NULL,
  reaction_type text CHECK (reaction_type IN ('positive', 'negative', 'neutral', 'unknown')) NOT NULL,
  severity text CHECK (severity IN ('mild', 'moderate', 'severe')),
  symptoms text[],
  product_name text,
  brand text,
  patch_tested boolean DEFAULT false,
  first_exposure date,
  last_exposure date,
  notes text,
  verified_by_patch_test boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create skin progress tracking
CREATE TABLE IF NOT EXISTS public.user_skin_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  progress_type text CHECK (progress_type IN ('overall', 'specific_concern', 'product_trial')) NOT NULL,
  concern_id uuid REFERENCES public.user_skin_concerns(id) ON DELETE CASCADE,
  photo_before_url text,
  photo_after_url text,
  rating_before integer CHECK (rating_before >= 1 AND rating_before <= 10),
  rating_after integer CHECK (rating_after >= 1 AND rating_after <= 10),
  improvement_score decimal(3,2),
  time_period_days integer,
  products_used text[],
  routine_changes text,
  environmental_factors text[],
  notes text,
  progress_date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE public.user_skin_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skin_concerns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ingredient_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skin_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_skin_analysis
CREATE POLICY IF NOT EXISTS "Users can view own skin analysis" ON public.user_skin_analysis
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own skin analysis" ON public.user_skin_analysis
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own skin analysis" ON public.user_skin_analysis
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all skin analysis" ON public.user_skin_analysis
  FOR ALL USING (true);

-- RLS policies for user_photos
CREATE POLICY IF NOT EXISTS "Users can view own photos" ON public.user_photos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own photos" ON public.user_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all photos" ON public.user_photos
  FOR ALL USING (true);

-- RLS policies for user_skin_concerns
CREATE POLICY IF NOT EXISTS "Users can manage own skin concerns" ON public.user_skin_concerns
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for user_recommendations
CREATE POLICY IF NOT EXISTS "Users can view own recommendations" ON public.user_recommendations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own recommendations" ON public.user_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service can manage all recommendations" ON public.user_recommendations
  FOR ALL USING (true);

-- RLS policies for user_ingredient_reactions
CREATE POLICY IF NOT EXISTS "Users can manage own ingredient reactions" ON public.user_ingredient_reactions
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for user_skin_progress
CREATE POLICY IF NOT EXISTS "Users can manage own skin progress" ON public.user_skin_progress
  FOR ALL USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_skin_analysis_user_id ON public.user_skin_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skin_analysis_created_at ON public.user_skin_analysis(created_at);
CREATE INDEX IF NOT EXISTS idx_user_skin_analysis_skin_type ON public.user_skin_analysis(skin_type);
CREATE INDEX IF NOT EXISTS idx_user_skin_analysis_confidence ON public.user_skin_analysis(confidence_score);

CREATE INDEX IF NOT EXISTS idx_user_photos_user_id ON public.user_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_photos_purpose ON public.user_photos(purpose);
CREATE INDEX IF NOT EXISTS idx_user_photos_analysis_id ON public.user_photos(analysis_id);

CREATE INDEX IF NOT EXISTS idx_user_skin_concerns_user_id ON public.user_skin_concerns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skin_concerns_active ON public.user_skin_concerns(is_active);
CREATE INDEX IF NOT EXISTS idx_user_skin_concerns_type ON public.user_skin_concerns(concern_type);

CREATE INDEX IF NOT EXISTS idx_user_recommendations_user_id ON public.user_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_analysis_id ON public.user_recommendations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_product_id ON public.user_recommendations(product_id);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_type ON public.user_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_user_recommendations_score ON public.user_recommendations(compatibility_score);

CREATE INDEX IF NOT EXISTS idx_user_ingredient_reactions_user_id ON public.user_ingredient_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ingredient_reactions_ingredient ON public.user_ingredient_reactions(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_user_ingredient_reactions_type ON public.user_ingredient_reactions(reaction_type);

CREATE INDEX IF NOT EXISTS idx_user_skin_progress_user_id ON public.user_skin_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skin_progress_concern_id ON public.user_skin_progress(concern_id);
CREATE INDEX IF NOT EXISTS idx_user_skin_progress_date ON public.user_skin_progress(progress_date);

-- Add triggers for updated_at
CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.user_skin_analysis
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.user_skin_concerns
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.user_recommendations
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER IF NOT EXISTS handle_updated_at BEFORE UPDATE ON public.user_ingredient_reactions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Add skin analysis fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS current_skin_type text,
ADD COLUMN IF NOT EXISTS skin_concerns text[],
ADD COLUMN IF NOT EXISTS allergies text[],
ADD COLUMN IF NOT EXISTS skincare_goals text[],
ADD COLUMN IF NOT EXISTS last_analysis_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS analysis_count integer DEFAULT 0;

-- Create function to get user's latest skin analysis
CREATE OR REPLACE FUNCTION get_latest_skin_analysis(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  skin_type text,
  primary_concerns text[],
  confidence_score integer,
  analysis_date timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id,
    sa.skin_type,
    sa.primary_concerns,
    sa.confidence_score,
    sa.created_at
  FROM public.user_skin_analysis sa
  WHERE sa.user_id = p_user_id
    AND sa.is_archived = false
  ORDER BY sa.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get personalized product recommendations
CREATE OR REPLACE FUNCTION get_personalized_recommendations(
  p_user_id uuid,
  p_recommendation_type text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  brand text,
  price decimal,
  compatibility_score decimal,
  reasoning text,
  recommendation_type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.brand,
    p.price,
    ur.compatibility_score,
    ur.reasoning,
    ur.recommendation_type
  FROM public.user_recommendations ur
  JOIN public.products p ON ur.product_id = p.id
  WHERE ur.user_id = p_user_id
    AND (p_recommendation_type IS NULL OR ur.recommendation_type = p_recommendation_type)
    AND ur.status = 'suggested'
  ORDER BY ur.compatibility_score DESC NULLS LAST, ur.priority ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to track ingredient compatibility
CREATE OR REPLACE FUNCTION track_ingredient_reaction(
  p_user_id uuid,
  p_ingredient_name text,
  p_reaction_type text,
  p_severity text DEFAULT NULL,
  p_symptoms text[] DEFAULT NULL,
  p_product_name text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  reaction_id uuid;
BEGIN
  INSERT INTO public.user_ingredient_reactions (
    user_id,
    ingredient_name,
    reaction_type,
    severity,
    symptoms,
    product_name,
    first_exposure
  ) VALUES (
    p_user_id,
    p_ingredient_name,
    p_reaction_type,
    p_severity,
    p_symptoms,
    p_product_name,
    CURRENT_DATE
  ) RETURNING id INTO reaction_id;

  RETURN reaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_latest_skin_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION get_personalized_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION track_ingredient_reaction TO authenticated;