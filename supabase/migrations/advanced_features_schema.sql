-- Advanced features database schema for Seoul Sister

-- Photo skin analysis table
CREATE TABLE IF NOT EXISTS photo_skin_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Photo Information
  photo_url TEXT NOT NULL,
  photo_hash VARCHAR(64), -- For duplicate detection
  upload_source VARCHAR(50) DEFAULT 'web', -- web, mobile, api

  -- AI Analysis Results
  ai_model_version VARCHAR(50) DEFAULT 'claude-opus-4.1',
  analysis_confidence DECIMAL(3,2) CHECK (analysis_confidence >= 0 AND analysis_confidence <= 1),
  processing_time_ms INTEGER,

  -- Skin Assessment
  detected_skin_type VARCHAR(20) CHECK (detected_skin_type IN ('oily', 'dry', 'combination', 'sensitive', 'normal')),
  detected_skin_tone VARCHAR(20) CHECK (detected_skin_tone IN ('light', 'medium', 'tan', 'deep')),
  estimated_age_range VARCHAR(10) CHECK (estimated_age_range IN ('18-25', '25-35', '35-45', '45+')),

  -- Skin Concerns Detection (0.0-1.0 scores)
  acne_score DECIMAL(3,2) DEFAULT 0,
  wrinkles_score DECIMAL(3,2) DEFAULT 0,
  dark_spots_score DECIMAL(3,2) DEFAULT 0,
  dryness_score DECIMAL(3,2) DEFAULT 0,
  oiliness_score DECIMAL(3,2) DEFAULT 0,
  enlarged_pores_score DECIMAL(3,2) DEFAULT 0,
  redness_score DECIMAL(3,2) DEFAULT 0,
  dullness_score DECIMAL(3,2) DEFAULT 0,

  -- Overall Skin Health Metrics
  hydration_level DECIMAL(3,2) DEFAULT 0.5,
  oil_level DECIMAL(3,2) DEFAULT 0.5,
  texture_score DECIMAL(3,2) DEFAULT 0.5,
  elasticity_score DECIMAL(3,2) DEFAULT 0.5,
  brightness_score DECIMAL(3,2) DEFAULT 0.5,

  -- Detailed Analysis
  ai_detailed_analysis TEXT,
  primary_recommendations TEXT[],
  detected_concerns TEXT[],
  improvement_areas TEXT[],

  -- Progress Tracking
  is_baseline BOOLEAN DEFAULT FALSE,
  previous_analysis_id UUID REFERENCES photo_skin_analyses(id),
  improvement_notes TEXT
);

-- Skincare routines table
CREATE TABLE IF NOT EXISTS skincare_routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Routine Metadata
  name VARCHAR(255) NOT NULL DEFAULT 'My Routine',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  routine_type VARCHAR(20) CHECK (routine_type IN ('morning', 'evening', 'weekly', 'custom')),

  -- Routine Configuration
  complexity_level VARCHAR(20) CHECK (complexity_level IN ('minimal', 'moderate', 'extensive')),
  estimated_time_minutes INTEGER DEFAULT 10,

  -- AI Generation Info
  generated_by_ai BOOLEAN DEFAULT FALSE,
  generation_prompt TEXT,
  ai_confidence DECIMAL(3,2),

  -- Routine Goals
  primary_goals TEXT[], -- ['acne_control', 'anti_aging', 'hydration', etc.]
  target_concerns TEXT[],

  -- Success Metrics
  user_satisfaction_rating INTEGER CHECK (user_satisfaction_rating >= 1 AND user_satisfaction_rating <= 5),
  adherence_rate DECIMAL(3,2) DEFAULT 0, -- How often user follows routine
  effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5)
);

-- Routine steps table
CREATE TABLE IF NOT EXISTS routine_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id UUID REFERENCES skincare_routines(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,

  -- Product Information
  product_id VARCHAR(255) REFERENCES products(id),
  custom_product_name VARCHAR(255), -- For non-catalog products
  product_category VARCHAR(100),

  -- Application Details
  application_method TEXT,
  amount_description VARCHAR(100), -- "2-3 drops", "pea-sized amount"
  wait_time_seconds INTEGER DEFAULT 0,
  frequency VARCHAR(50) DEFAULT 'daily', -- daily, alternate, weekly

  -- Instructions
  instructions TEXT,
  tips TEXT,
  warnings TEXT,

  -- AI Recommendations
  ai_generated BOOLEAN DEFAULT FALSE,
  rationale TEXT, -- Why this step was recommended

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Routine tracking table
CREATE TABLE IF NOT EXISTS routine_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  routine_id UUID REFERENCES skincare_routines(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Completion Tracking
  completed BOOLEAN DEFAULT FALSE,
  completion_time TIMESTAMP WITH TIME ZONE,
  completed_steps INTEGER DEFAULT 0,
  total_steps INTEGER NOT NULL,

  -- User Feedback
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  skin_feel_rating INTEGER CHECK (skin_feel_rating >= 1 AND skin_feel_rating <= 5),
  notes TEXT,

  -- Progress Photos
  progress_photo_url TEXT,

  -- Side Effects / Reactions
  experienced_irritation BOOLEAN DEFAULT FALSE,
  irritation_description TEXT,
  products_causing_issues TEXT[],

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, routine_id, date)
);

-- Community reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id VARCHAR(255) REFERENCES products(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Review Content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  review_text TEXT,

  -- Skin Context
  reviewer_skin_type VARCHAR(20),
  reviewer_age_range VARCHAR(10),
  reviewer_concerns TEXT[],
  usage_duration VARCHAR(50), -- "2 weeks", "3 months"

  -- Experience Details
  effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
  texture_rating INTEGER CHECK (texture_rating >= 1 AND texture_rating <= 5),
  packaging_rating INTEGER CHECK (packaging_rating >= 1 AND packaging_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),

  -- Results
  would_repurchase BOOLEAN,
  would_recommend BOOLEAN DEFAULT TRUE,
  noticed_improvements TEXT[],
  experienced_issues TEXT[],

  -- Verification
  verified_purchase BOOLEAN DEFAULT FALSE,
  purchase_date DATE,

  -- Moderation
  is_approved BOOLEAN DEFAULT TRUE,
  moderation_notes TEXT,
  helpful_votes INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0
);

-- Review photos table
CREATE TABLE IF NOT EXISTS review_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES product_reviews(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type VARCHAR(50) CHECK (photo_type IN ('before', 'after', 'during_use', 'product_shot')),
  caption TEXT,
  display_order INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community discussions table
CREATE TABLE IF NOT EXISTS community_discussions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Discussion Content
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  discussion_type VARCHAR(50) CHECK (discussion_type IN ('question', 'routine_share', 'before_after', 'general')),

  -- Categories
  category VARCHAR(100), -- skin_type, concern, product_type, routine
  tags TEXT[],

  -- Engagement
  views_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  helpful_votes INTEGER DEFAULT 0,

  -- Status
  is_pinned BOOLEAN DEFAULT FALSE,
  is_closed BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT TRUE
);

-- Discussion replies table
CREATE TABLE IF NOT EXISTS discussion_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discussion_id UUID REFERENCES community_discussions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  parent_reply_id UUID REFERENCES discussion_replies(id), -- For nested replies
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Reply Content
  content TEXT NOT NULL,
  helpful_votes INTEGER DEFAULT 0,

  -- Expert Verification
  is_expert_reply BOOLEAN DEFAULT FALSE,
  expert_credentials TEXT,

  -- Status
  is_approved BOOLEAN DEFAULT TRUE
);

-- Machine learning insights table
CREATE TABLE IF NOT EXISTS ml_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Insight Type
  insight_type VARCHAR(100) NOT NULL, -- 'skin_improvement', 'product_effectiveness', 'routine_optimization'
  confidence_score DECIMAL(3,2),

  -- Data Source
  data_source TEXT, -- 'photo_analysis', 'routine_tracking', 'user_feedback'
  sample_size INTEGER,

  -- Insight Content
  title VARCHAR(255),
  description TEXT,
  actionable_recommendation TEXT,

  -- Affected Population
  applicable_skin_types TEXT[],
  applicable_age_ranges TEXT[],
  applicable_concerns TEXT[],

  -- Validation
  is_validated BOOLEAN DEFAULT FALSE,
  validation_method TEXT,
  implementation_date DATE,

  -- Performance
  improvement_percentage DECIMAL(5,2),
  statistical_significance DECIMAL(3,2)
);

-- User preferences and settings
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE,

  -- Notification Preferences
  email_notifications BOOLEAN DEFAULT TRUE,
  routine_reminders BOOLEAN DEFAULT TRUE,
  progress_updates BOOLEAN DEFAULT TRUE,
  community_activity BOOLEAN DEFAULT FALSE,

  -- Privacy Settings
  profile_visibility VARCHAR(20) DEFAULT 'private' CHECK (profile_visibility IN ('public', 'friends', 'private')),
  share_progress_photos BOOLEAN DEFAULT FALSE,
  allow_ai_analysis BOOLEAN DEFAULT TRUE,

  -- AI Preferences
  ai_recommendation_frequency VARCHAR(20) DEFAULT 'weekly' CHECK (ai_recommendation_frequency IN ('daily', 'weekly', 'monthly')),
  preferred_analysis_detail VARCHAR(20) DEFAULT 'moderate' CHECK (preferred_analysis_detail IN ('minimal', 'moderate', 'detailed')),

  -- Interface Preferences
  preferred_language VARCHAR(10) DEFAULT 'en',
  theme_preference VARCHAR(20) DEFAULT 'auto' CHECK (theme_preference IN ('light', 'dark', 'auto')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_photo_analyses_user_id ON photo_skin_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_analyses_created_at ON photo_skin_analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_photo_analyses_skin_type ON photo_skin_analyses(detected_skin_type);

CREATE INDEX IF NOT EXISTS idx_routines_user_id ON skincare_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_active ON skincare_routines(is_active);
CREATE INDEX IF NOT EXISTS idx_routines_type ON skincare_routines(routine_type);

CREATE INDEX IF NOT EXISTS idx_routine_steps_routine_id ON routine_steps(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_steps_product_id ON routine_steps(product_id);

CREATE INDEX IF NOT EXISTS idx_routine_tracking_user_id ON routine_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_routine_tracking_date ON routine_tracking(date);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON product_reviews(rating);

CREATE INDEX IF NOT EXISTS idx_discussions_type ON community_discussions(discussion_type);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON community_discussions(created_at);

-- Update function for updated_at timestamps
CREATE TRIGGER update_skincare_routines_updated_at BEFORE UPDATE ON skincare_routines
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_product_reviews_updated_at BEFORE UPDATE ON product_reviews
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_community_discussions_updated_at BEFORE UPDATE ON community_discussions
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();