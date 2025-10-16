-- Seoul Sister AI Lead Hunter Database Schema
-- Run this SQL script in your Supabase SQL Editor

-- Table 1: Reddit Conversation Opportunities
CREATE TABLE IF NOT EXISTS reddit_conversation_opportunities (
  id SERIAL PRIMARY KEY,
  reddit_post_id VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  author VARCHAR(255),
  subreddit VARCHAR(100),
  url TEXT,
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  created_utc BIGINT,
  intent_score DECIMAL(3,2) DEFAULT 0.0,
  keywords_matched TEXT[] DEFAULT '{}',
  engagement_priority VARCHAR(20) DEFAULT 'medium',
  conversation_type VARCHAR(50),
  response_strategy TEXT,
  cultural_angle TEXT,
  qualification_approach TEXT,
  engagement_timing VARCHAR(20) DEFAULT 'delayed',
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  status VARCHAR(20) DEFAULT 'detected',
  engaged_at TIMESTAMP,
  lead_created BOOLEAN DEFAULT FALSE,
  lead_id INTEGER,
  conversion_tracked BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table 2: AI Conversation Threads
CREATE TABLE IF NOT EXISTS ai_conversation_threads (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  platform_thread_id VARCHAR(255) NOT NULL,
  original_post_id VARCHAR(255),
  thread_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  conversation_data JSONB DEFAULT '{}',
  messages JSONB DEFAULT '[]',
  engagement_score DECIMAL(3,2) DEFAULT 0.0,
  qualification_score DECIMAL(3,2) DEFAULT 0.0,
  lead_potential VARCHAR(20) DEFAULT 'unknown',
  handoff_ready BOOLEAN DEFAULT FALSE,
  handoff_completed BOOLEAN DEFAULT FALSE,
  lead_created_id INTEGER,
  total_messages INTEGER DEFAULT 0,
  ai_messages INTEGER DEFAULT 0,
  user_responses INTEGER DEFAULT 0,
  last_ai_response TIMESTAMP,
  last_user_response TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform, platform_thread_id)
);

-- Table 3: AI Generated Leads
CREATE TABLE IF NOT EXISTS ai_generated_leads (
  id SERIAL PRIMARY KEY,
  source_platform VARCHAR(50) NOT NULL,
  source_thread_id INTEGER,
  source_opportunity_id INTEGER,
  username VARCHAR(255),
  lead_type VARCHAR(50),
  intent_level VARCHAR(20) DEFAULT 'medium',
  qualification_data JSONB DEFAULT '{}',
  conversation_context TEXT,
  korean_beauty_interests TEXT[],
  authenticity_concerns BOOLEAN DEFAULT FALSE,
  price_sensitivity VARCHAR(20),
  cultural_interest_level VARCHAR(20),
  engagement_history JSONB DEFAULT '{}',
  handoff_notes TEXT,
  assigned_to VARCHAR(255),
  status VARCHAR(20) DEFAULT 'new',
  contacted_at TIMESTAMP,
  converted_at TIMESTAMP,
  conversion_value DECIMAL(10,2),
  customer_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table 4: Lead Hunter Analytics
CREATE TABLE IF NOT EXISTS lead_hunter_analytics (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  platform VARCHAR(50),
  opportunities_detected INTEGER DEFAULT 0,
  conversations_initiated INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  leads_handed_off INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(10,2) DEFAULT 0.0,
  avg_intent_score DECIMAL(3,2) DEFAULT 0.0,
  avg_qualification_score DECIMAL(3,2) DEFAULT 0.0,
  top_keywords TEXT[],
  top_subreddits TEXT[],
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, platform)
);

-- Table 5: Korean Cultural Responses
CREATE TABLE IF NOT EXISTS korean_cultural_responses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  trigger_keywords TEXT[],
  response_template TEXT NOT NULL,
  cultural_context TEXT,
  pronunciation_guide TEXT,
  traditional_wisdom TEXT,
  modern_application TEXT,
  seoul_sister_connection TEXT,
  engagement_effectiveness DECIMAL(3,2) DEFAULT 0.0,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert Sample Korean Cultural Responses
INSERT INTO korean_cultural_responses (
  category, subcategory, trigger_keywords, response_template,
  cultural_context, pronunciation_guide, traditional_wisdom,
  modern_application, seoul_sister_connection
) VALUES
(
  'glass_skin',
  'technique_explanation',
  ARRAY['glass skin', 'chok-chok', 'dewy skin', 'glowing skin'],
  'In Seoul, we call this ''mul-gwang'' (물광) - literally meaning ''water-light'' skin. The traditional approach focuses on gentle hydration layering with emphasis on prevention over correction.',
  'Korean beauty philosophy prioritizes prevention and gentle consistency over aggressive correction',
  'mul-gwang (물광): ''mool-gwahng''',
  'Traditional Korean beauty emphasizes ''yangsaeng'' (양생) - nurturing life force through gentle care',
  'Modern Seoul skincare combines traditional fermented ingredients with cutting-edge peptide technology',
  'Seoul Sister provides real-time intelligence on trending mul-gwang techniques from Korean beauty communities'
),
(
  'authenticity',
  'product_verification',
  ARRAY['fake korean products', 'authentic korean', 'counterfeit', 'real korean skincare'],
  'Authenticity is crucial in Korean beauty. Seoul market standards include hologram verification and ingredient transparency. Key indicators include proper Korean labeling and authentic packaging details.',
  'Korean consumers are extremely quality-conscious and have sophisticated methods for verifying authenticity',
  'jin-cha (진짜): ''jin-chah'' meaning ''real/authentic''',
  'Korean saying: ''Good medicine tastes bitter'' - quality ingredients often have distinct characteristics',
  'Korean beauty industry uses advanced packaging security and ingredient verification systems',
  'Seoul Sister connects you with verified Seoul suppliers for guaranteed authentic Korean beauty products'
),
(
  'pricing',
  'seoul_vs_us_comparison',
  ARRAY['expensive korean skincare', 'korean beauty budget', 'overpriced k-beauty', 'affordable korean'],
  'Seoul pricing vs US retail can be shocking. The same product costs 15,000-25,000 won ($12-20) in Seoul vs $40-60 at major US retailers. This markup exists because of import tariffs, distribution costs, and retailer margins.',
  'Korean beauty products are positioned as accessible luxury in Seoul but premium imports in the US',
  'gagyeok (가격): ''gah-gyuhk'' meaning ''price''',
  'Korean concept of ''gachi'' (가치) - true value comes from quality and effectiveness, not brand markup',
  'Korean beauty democratization movement focuses on high-quality ingredients at accessible prices',
  'Seoul Sister provides Seoul wholesale pricing intelligence and authentic product access at fair prices'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reddit_opportunities_status ON reddit_conversation_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_reddit_opportunities_confidence ON reddit_conversation_opportunities(confidence_score);
CREATE INDEX IF NOT EXISTS idx_ai_threads_platform ON ai_conversation_threads(platform);
CREATE INDEX IF NOT EXISTS idx_ai_threads_status ON ai_conversation_threads(status);
CREATE INDEX IF NOT EXISTS idx_ai_leads_status ON ai_generated_leads(status);
CREATE INDEX IF NOT EXISTS idx_ai_leads_intent ON ai_generated_leads(intent_level);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON lead_hunter_analytics(date);
CREATE INDEX IF NOT EXISTS idx_cultural_responses_category ON korean_cultural_responses(category);

-- Enable Row Level Security (RLS) for security
ALTER TABLE reddit_conversation_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_hunter_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE korean_cultural_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Enable all operations for authenticated users" ON reddit_conversation_opportunities
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON ai_conversation_threads
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON ai_generated_leads
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON lead_hunter_analytics
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all operations for authenticated users" ON korean_cultural_responses
  FOR ALL USING (auth.role() = 'authenticated');

-- Success message
SELECT 'AI Lead Hunter database schema created successfully! 🚀' as result;