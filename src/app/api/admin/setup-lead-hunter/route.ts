import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    console.log('🚀 Setting up AI Lead Hunter database schema...');

    // Create reddit_conversation_opportunities table
    const redditOpportunitiesSchema = `
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
    `;

    await supabase.from('_sql').select('*').eq('query', redditOpportunitiesSchema);

    // Create ai_conversation_threads table
    const conversationThreadsSchema = `
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
    `;

    await supabase.from('_sql').select('*').eq('query', conversationThreadsSchema);

    // Create ai_generated_leads table
    const aiLeadsSchema = `
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
    `;

    await supabase.from('_sql').select('*').eq('query', aiLeadsSchema);

    // Create lead_hunter_analytics table
    const analyticsSchema = `
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
    `;

    await supabase.from('_sql').select('*').eq('query', analyticsSchema);

    // Create korean_cultural_responses table
    const culturalResponsesSchema = `
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
    `;

    await supabase.from('_sql').select('*').eq('query', culturalResponsesSchema);

    // Insert sample Korean cultural responses
    const sampleResponses = [
      {
        category: 'glass_skin',
        subcategory: 'technique_explanation',
        trigger_keywords: ['glass skin', 'chok-chok', 'dewy skin', 'glowing skin'],
        response_template: "In Seoul, we call this 'mul-gwang' (물광) - literally meaning 'water-light' skin. The traditional approach focuses on {technique_details} with emphasis on {cultural_philosophy}.",
        cultural_context: "Korean beauty philosophy prioritizes prevention and gentle consistency over aggressive correction",
        pronunciation_guide: "mul-gwang (물광): 'mool-gwahng'",
        traditional_wisdom: "Traditional Korean beauty emphasizes 'yangsaeng' (양생) - nurturing life force through gentle care",
        modern_application: "Modern Seoul skincare combines traditional fermented ingredients with cutting-edge peptide technology",
        seoul_sister_connection: "Seoul Sister provides real-time intelligence on trending mul-gwang techniques from Korean beauty communities"
      },
      {
        category: 'authenticity',
        subcategory: 'product_verification',
        trigger_keywords: ['fake korean products', 'authentic korean', 'counterfeit', 'real korean skincare'],
        response_template: "Authenticity is crucial in Korean beauty. Seoul market standards include {verification_methods}. Key indicators of authentic products: {authenticity_markers}.",
        cultural_context: "Korean consumers are extremely quality-conscious and have sophisticated methods for verifying authenticity",
        pronunciation_guide: "jin-cha (진짜): 'jin-chah' meaning 'real/authentic'",
        traditional_wisdom: "Korean saying: 'Good medicine tastes bitter' - quality ingredients often have distinct characteristics",
        modern_application: "Korean beauty industry uses advanced packaging security and ingredient verification systems",
        seoul_sister_connection: "Seoul Sister connects you with verified Seoul suppliers for guaranteed authentic Korean beauty products"
      },
      {
        category: 'pricing',
        subcategory: 'seoul_vs_us_comparison',
        trigger_keywords: ['expensive korean skincare', 'korean beauty budget', 'overpriced k-beauty', 'affordable korean'],
        response_template: "Seoul pricing vs US retail can be shocking. The same {product_example} costs {seoul_price} in Seoul vs {us_price} at major US retailers. This markup exists because {market_dynamics}.",
        cultural_context: "Korean beauty products are positioned as accessible luxury in Seoul but premium imports in the US",
        pronunciation_guide: "gagyeok (가격): 'gah-gyuhk' meaning 'price'",
        traditional_wisdom: "Korean concept of 'gachi' (가치) - true value comes from quality and effectiveness, not brand markup",
        modern_application: "Korean beauty democratization movement focuses on high-quality ingredients at accessible prices",
        seoul_sister_connection: "Seoul Sister provides Seoul wholesale pricing intelligence and authentic product access at fair prices"
      }
    ];

    for (const response of sampleResponses) {
      await supabase
        .from('korean_cultural_responses')
        .upsert(response, { onConflict: 'category,subcategory' });
    }

    console.log('✅ AI Lead Hunter database schema setup completed successfully');

    return NextResponse.json({
      success: true,
      message: 'AI Lead Hunter system database initialized',
      tables_created: [
        'reddit_conversation_opportunities',
        'ai_conversation_threads',
        'ai_generated_leads',
        'lead_hunter_analytics',
        'korean_cultural_responses'
      ],
      sample_data: {
        cultural_responses: sampleResponses.length,
        ready_for_detection: true
      },
      next_steps: [
        'Deploy Reddit conversation detection',
        'Implement AI engagement engine',
        'Create lead qualification system',
        'Build analytics dashboard'
      ]
    });

  } catch (error) {
    console.error('❌ Error setting up AI Lead Hunter schema:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: {
        check: [
          'Database connection configuration',
          'SQL permissions for table creation',
          'Supabase service role key'
        ]
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Lead Hunter Database Setup',
    description: 'Initializes database schema for autonomous Reddit conversation detection and engagement',
    features: [
      'Reddit conversation opportunity detection',
      'AI conversation thread management',
      'Automated lead generation and qualification',
      'Performance analytics and optimization',
      'Korean cultural response framework'
    ],
    database_schema: {
      'reddit_conversation_opportunities': 'High-intent Korean beauty conversations detected across subreddits',
      'ai_conversation_threads': 'Active AI-to-human conversation management and tracking',
      'ai_generated_leads': 'Qualified leads created through AI conversations with handoff data',
      'lead_hunter_analytics': 'Performance metrics for conversation detection, engagement, and conversion',
      'korean_cultural_responses': 'Cultural knowledge base for authentic Korean beauty conversation'
    },
    setup_endpoint: 'POST /api/admin/setup-lead-hunter'
  });
}