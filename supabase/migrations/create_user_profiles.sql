-- Create user profiles table for skin analysis and personalized recommendations
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Skin Type Classification
  skin_type VARCHAR(50) CHECK (skin_type IN ('oily', 'dry', 'combination', 'sensitive', 'normal')),
  skin_tone VARCHAR(50) CHECK (skin_tone IN ('light', 'medium', 'tan', 'deep')),

  -- Primary Skin Concerns (array for multiple concerns)
  skin_concerns TEXT[] DEFAULT '{}',

  -- Ingredient Preferences and Allergies
  ingredient_allergies TEXT[] DEFAULT '{}',
  preferred_ingredients TEXT[] DEFAULT '{}',
  ingredients_to_avoid TEXT[] DEFAULT '{}',

  -- Product Preferences
  preferred_texture VARCHAR(50) CHECK (preferred_texture IN ('gel', 'cream', 'serum', 'oil', 'lotion', 'essence')),
  price_range_min DECIMAL(10,2) DEFAULT 0,
  price_range_max DECIMAL(10,2) DEFAULT 1000,

  -- User Experience Level
  skincare_experience VARCHAR(50) CHECK (skincare_experience IN ('beginner', 'intermediate', 'advanced')),

  -- Routine Preferences
  routine_complexity VARCHAR(50) CHECK (routine_complexity IN ('minimal', 'moderate', 'extensive')),
  time_commitment VARCHAR(50) CHECK (time_commitment IN ('5min', '10min', '15min', '20min+')),

  -- Personalization Data
  product_history JSONB DEFAULT '{}',
  skin_analysis_history JSONB DEFAULT '{}',
  recommendation_feedback JSONB DEFAULT '{}'
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_skin_type ON user_profiles(skin_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_skin_concerns ON user_profiles USING GIN(skin_concerns);
CREATE INDEX IF NOT EXISTS idx_user_profiles_ingredient_allergies ON user_profiles USING GIN(ingredient_allergies);

-- Create skin analysis results table
CREATE TABLE IF NOT EXISTS skin_analysis_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id VARCHAR(255) REFERENCES products(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Analysis Results
  compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),

  -- Detailed Analysis
  beneficial_ingredients TEXT[],
  concerning_ingredients TEXT[],
  allergen_warnings TEXT[],
  skin_concern_match TEXT[],

  -- AI Analysis
  ai_recommendation TEXT,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  analysis_reasoning TEXT
);

-- Create indexes for skin analysis results
CREATE INDEX IF NOT EXISTS idx_skin_analysis_user_id ON skin_analysis_results(user_id);
CREATE INDEX IF NOT EXISTS idx_skin_analysis_product_id ON skin_analysis_results(product_id);
CREATE INDEX IF NOT EXISTS idx_skin_analysis_compatibility ON skin_analysis_results(compatibility_score);

-- Create user product interactions table
CREATE TABLE IF NOT EXISTS user_product_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id VARCHAR(255) REFERENCES products(id),
  interaction_type VARCHAR(50) CHECK (interaction_type IN ('viewed', 'analyzed', 'wishlisted', 'purchased', 'reviewed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Interaction Data
  interaction_data JSONB DEFAULT '{}',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  skin_improvement_noted BOOLEAN DEFAULT FALSE
);

-- Create indexes for user interactions
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_product_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_product_id ON user_product_interactions(product_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_product_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON user_product_interactions(created_at);

-- Update function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();