-- Bailey's Enhanced User Profile System
-- Comprehensive lifestyle and environmental factors for personalized skincare

-- Extend user_skin_profiles with Bailey's requested fields
ALTER TABLE public.user_skin_profiles
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS location_state TEXT,
ADD COLUMN IF NOT EXISTS location_country TEXT DEFAULT 'US',
ADD COLUMN IF NOT EXISTS climate_type TEXT CHECK (climate_type IN ('tropical', 'dry', 'temperate', 'continental', 'polar')),
ADD COLUMN IF NOT EXISTS ethnicity TEXT,
ADD COLUMN IF NOT EXISTS lifestyle_factors JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS current_medications TEXT[],
ADD COLUMN IF NOT EXISTS medical_conditions TEXT[],
ADD COLUMN IF NOT EXISTS skincare_goals TEXT[],
ADD COLUMN IF NOT EXISTS routine_commitment_level TEXT CHECK (routine_commitment_level IN ('minimal', 'moderate', 'dedicated')),
ADD COLUMN IF NOT EXISTS budget_range TEXT CHECK (budget_range IN ('budget', 'mid-range', 'luxury', 'no-limit'));

-- Create table for current routine products
CREATE TABLE IF NOT EXISTS public.current_routine_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number TEXT,
  product_name TEXT NOT NULL,
  brand TEXT,
  product_type TEXT,
  product_image_url TEXT,
  ingredients TEXT,
  cleanliness_score DECIMAL(3,2),
  ingredient_analysis JSONB,
  usage_frequency TEXT CHECK (usage_frequency IN ('daily-am', 'daily-pm', 'daily-both', 'weekly', 'as-needed')),
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  purchase_price DECIMAL(10,2),
  purchase_location TEXT,
  started_using DATE,
  notes TEXT,
  ai_review JSONB,
  replacement_suggestions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create table for routine analysis history
CREATE TABLE IF NOT EXISTS public.routine_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number TEXT,
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  routine_score DECIMAL(3,2),
  completeness_score DECIMAL(3,2),
  compatibility_score DECIMAL(3,2),
  missing_categories TEXT[],
  product_conflicts JSONB,
  recommended_order JSONB,
  improvement_suggestions JSONB,
  ai_detailed_analysis TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create table for gradual routine introduction
CREATE TABLE IF NOT EXISTS public.routine_introduction_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number TEXT,
  plan_name TEXT,
  total_duration_days INTEGER DEFAULT 30,
  current_day INTEGER DEFAULT 0,
  current_phase TEXT,
  products_to_introduce JSONB,
  introduction_schedule JSONB,
  status TEXT CHECK (status IN ('not-started', 'active', 'paused', 'completed')),
  start_date DATE,
  expected_end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create table for weekly progress tracking
CREATE TABLE IF NOT EXISTS public.skin_progress_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number TEXT,
  check_in_date DATE DEFAULT CURRENT_DATE,
  week_number INTEGER,
  photo_url TEXT,
  skin_condition_rating INTEGER CHECK (skin_condition_rating >= 1 AND skin_condition_rating <= 10),
  specific_concerns JSONB,
  product_reactions JSONB,
  experiencing_purging BOOLEAN DEFAULT FALSE,
  purging_areas TEXT[],
  new_irritations BOOLEAN DEFAULT FALSE,
  irritation_details JSONB,
  overall_satisfaction INTEGER CHECK (overall_satisfaction >= 1 AND overall_satisfaction <= 5),
  notes TEXT,
  ai_analysis JSONB,
  ai_recommendations JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create table for skin irritation analysis
CREATE TABLE IF NOT EXISTS public.irritation_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number TEXT,
  photo_url TEXT NOT NULL,
  irritation_type TEXT CHECK (irritation_type IN ('redness', 'bumps', 'acne', 'dryness', 'peeling', 'burning', 'itching', 'hives', 'other')),
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),
  affected_areas TEXT[],
  potential_causes JSONB,
  started_date DATE,
  suspected_product TEXT,
  ai_diagnosis JSONB,
  recommended_treatments JSONB,
  spot_treatment_suggestions JSONB,
  preventative_measures JSONB,
  should_discontinue_products TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create table for product barcode scanning
CREATE TABLE IF NOT EXISTS public.scanned_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  barcode TEXT,
  product_name TEXT,
  brand TEXT,
  retail_price DECIMAL(10,2),
  store_location TEXT,
  online_prices JSONB,
  ingredients TEXT,
  cleanliness_rating DECIMAL(3,2),
  user_needs_this BOOLEAN,
  similar_owned_products JSONB,
  ingredient_conflicts JSONB,
  ai_recommendation TEXT,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_current_routine_user ON public.current_routine_products(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_analysis_user ON public.routine_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_tracking_user ON public.skin_progress_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_irritation_user ON public.irritation_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_scanned_barcode ON public.scanned_products(barcode);

-- Enable RLS
ALTER TABLE public.current_routine_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_introduction_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_progress_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irritation_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanned_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage own routine products" ON public.current_routine_products
  FOR ALL USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can view own routine analysis" ON public.routine_analysis
  FOR ALL USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can manage own introduction plans" ON public.routine_introduction_plans
  FOR ALL USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can track own progress" ON public.skin_progress_tracking
  FOR ALL USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can view own irritation analysis" ON public.irritation_analysis
  FOR ALL USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can view own scanned products" ON public.scanned_products
  FOR ALL USING (auth.uid() = user_id OR auth.uid() IS NULL);