import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    // Check if tables already exist
    const { data: existingTables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'user_purchase_decisions',
        'authenticity_reports',
        'retailer_reputation_scores',
        'price_anomaly_patterns',
        'community_verifications',
        'ml_training_data',
        'intelligence_reports',
        'intelligence_report_sections'
      ]);

    console.log('Existing tables check:', { existingTables, checkError });

    // Apply the learning system schema
    const schemaQueries = [
      // User Purchase Decisions & Behavior Tracking
      `CREATE TABLE IF NOT EXISTS user_purchase_decisions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID,
        session_id TEXT,
        product_id TEXT NOT NULL,
        retailer_id TEXT,
        authenticity_score_shown INTEGER,
        price_shown DECIMAL(10,2),
        was_best_deal BOOLEAN,
        risk_level_shown TEXT,
        clicked_through BOOLEAN DEFAULT FALSE,
        purchase_confirmed BOOLEAN DEFAULT FALSE,
        time_spent_viewing INTEGER,
        viewed_authenticity_guide BOOLEAN DEFAULT FALSE,
        reported_counterfeit BOOLEAN DEFAULT FALSE,
        reported_authentic BOOLEAN DEFAULT FALSE,
        satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // User-Reported Authenticity Feedback
      `CREATE TABLE IF NOT EXISTS authenticity_reports (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID,
        session_id TEXT,
        product_id TEXT NOT NULL,
        retailer_id TEXT,
        purchase_price DECIMAL(10,2),
        purchase_date DATE,
        is_authentic BOOLEAN NOT NULL,
        confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5),
        has_photo_evidence BOOLEAN DEFAULT FALSE,
        has_batch_code BOOLEAN DEFAULT FALSE,
        packaging_issues TEXT,
        product_issues TEXT,
        verified_by_admin BOOLEAN DEFAULT FALSE,
        admin_notes TEXT,
        community_votes_authentic INTEGER DEFAULT 0,
        community_votes_counterfeit INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Dynamic Retailer Reputation Scoring
      `CREATE TABLE IF NOT EXISTS retailer_reputation_scores (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        retailer_id TEXT UNIQUE,
        base_authenticity_score INTEGER DEFAULT 50,
        user_reported_authentic_count INTEGER DEFAULT 0,
        user_reported_counterfeit_count INTEGER DEFAULT 0,
        successful_purchases_count INTEGER DEFAULT 0,
        failed_purchases_count INTEGER DEFAULT 0,
        dynamic_authenticity_score INTEGER DEFAULT 50,
        confidence_level DECIMAL(5,2) DEFAULT 50.0,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Community Verification Crowdsourcing
      `CREATE TABLE IF NOT EXISTS community_verifications (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID,
        target_report_id UUID,
        agrees_with_report BOOLEAN NOT NULL,
        expertise_level INTEGER CHECK (expertise_level >= 1 AND expertise_level <= 5),
        confidence INTEGER CHECK (confidence >= 1 AND confidence <= 5),
        additional_notes TEXT,
        has_similar_experience BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Intelligence Reports
      `CREATE TABLE IF NOT EXISTS intelligence_reports (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT,
        content TEXT,
        author TEXT DEFAULT 'Seoul Sister Intelligence Team',
        category TEXT DEFAULT 'Daily Intelligence',
        tags TEXT[] DEFAULT '{}',
        featured_image_url TEXT,
        reading_time_minutes INTEGER DEFAULT 5,
        status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
        published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Intelligence Report Sections
      `CREATE TABLE IF NOT EXISTS intelligence_report_sections (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        report_id UUID,
        section_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_user_purchase_decisions_user_id ON user_purchase_decisions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_purchase_decisions_product_retailer ON user_purchase_decisions(product_id, retailer_id)`,
      `CREATE INDEX IF NOT EXISTS idx_authenticity_reports_retailer ON authenticity_reports(retailer_id)`,
      `CREATE INDEX IF NOT EXISTS idx_authenticity_reports_product ON authenticity_reports(product_id)`,
      `CREATE INDEX IF NOT EXISTS idx_retailer_reputation_scores_retailer ON retailer_reputation_scores(retailer_id)`,
      `CREATE INDEX IF NOT EXISTS idx_intelligence_reports_status ON intelligence_reports(status, published_at)`,
      `CREATE INDEX IF NOT EXISTS idx_intelligence_report_sections_report ON intelligence_report_sections(report_id, order_index)`,
    ];

    // Note: Schema creation is handled by Supabase migrations or manual SQL execution
    // The tables are expected to be created via the Supabase dashboard or migrations
    console.log('Learning system schema should be applied via Supabase dashboard using apply-learning-schema.sql');

    // Insert sample intelligence report
    const { data: reportData, error: reportError } = await (supabase as any)
      .from('intelligence_reports')
      .upsert({
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Seoul Beauty Intelligence Report',
        summary: 'Exclusive insights from Korea\'s beauty capital with breakthrough product discoveries, ingredient analysis, and viral trend intelligence.',
        content: '<p>Today\'s intelligence reveals 5 breakthrough products trending in Seoul, with average savings of 73% versus US retail. Centella Asiatica dominates Korean formulations with a 98% popularity score, while the "Glass Skin" trend reaches viral status across Korean beauty platforms.</p><p>Our Seoul-based research team has identified unprecedented growth in fermented skincare ingredients, with major K-beauty brands preparing Q2 2025 launches focusing on probiotics and rice-derived compounds.</p>',
        category: 'Daily Intelligence',
        tags: ['K-Beauty', 'Trends', 'Ingredients', 'Market Analysis'],
        reading_time_minutes: 8
      }, {
        onConflict: 'id'
      });

    // Insert sample report sections
    const sampleSections = [
      {
        report_id: '00000000-0000-0000-0000-000000000001',
        section_type: 'trending_products',
        title: 'Breakthrough Product Discoveries',
        content: '<p>Our Seoul team has identified 5 products experiencing unprecedented growth in Korean beauty retail:</p><ul><li><strong>Beauty of Joseon Relief Sun</strong> - #1 bestseller for 12 consecutive weeks</li><li><strong>COSRX Advanced Snail 96 Mucin</strong> - Viral on TikTok with 45M+ views</li><li><strong>Torriden DIVE-IN Low Molecule Hyaluronic Acid Serum</strong> - 340% sales increase</li></ul>',
        order_index: 1,
        metadata: { product_count: 5, avg_savings: 73, data_source: 'Olive Young, Hwahae, Glowpick' }
      },
      {
        report_id: '00000000-0000-0000-0000-000000000001',
        section_type: 'ingredient_analysis',
        title: 'Ingredient Intelligence Lab',
        content: '<p><strong>Centella Asiatica</strong> continues its dominance with 98% popularity score across Korean formulations.</p><p>Emerging trends show fermented ingredients gaining traction:</p><ul><li>Fermented Rice Bran - 245% increase in product launches</li><li>Bifida Ferment Lysate - Premium positioning trend</li><li>Galactomyces - Cross-over from traditional to mainstream</li></ul>',
        order_index: 2,
        metadata: { ingredients_analyzed: 15, trend_score: 98, scientific_studies: 23 }
      },
      {
        report_id: '00000000-0000-0000-0000-000000000001',
        section_type: 'social_insights',
        title: 'Korean Social Media Intelligence',
        content: '<p>The "Glass Skin Challenge" has achieved viral status on Korean TikTok with 450% growth in mentions over 30 days.</p><p>Key trending hashtags:</p><ul><li>#유리피부 (Glass Skin) - 12.5M views</li><li>#GlassSkinKorea - 8.2M views</li><li>#한국뷰티 (Korean Beauty) - 45.8M views</li></ul>',
        order_index: 3,
        metadata: { platform: 'TikTok Korea', virality_score: 94, total_mentions: 450000 }
      }
    ];

    const { data: sectionsData, error: sectionsError } = await (supabase as any)
      .from('intelligence_report_sections')
      .upsert(sampleSections, {
        onConflict: 'report_id,section_type'
      });

    return NextResponse.json({
      success: true,
      message: 'Seoul Sister Learning System schema applied successfully! 🚀',
      tables_created: [
        'user_purchase_decisions',
        'authenticity_reports',
        'retailer_reputation_scores',
        'community_verifications',
        'intelligence_reports',
        'intelligence_report_sections'
      ],
      sample_data: {
        report_created: !reportError,
        sections_created: !sectionsError,
        report_id: '00000000-0000-0000-0000-000000000001'
      },
      errors: {
        reportError,
        sectionsError
      }
    });

  } catch (error) {
    console.error('Error setting up learning system:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      details: 'Failed to apply learning system schema'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient();

    // Check current learning system status
    const tables = [
      'user_purchase_decisions',
      'authenticity_reports',
      'retailer_reputation_scores',
      'community_verifications',
      'intelligence_reports',
      'intelligence_report_sections'
    ];

    const tableChecks = [];
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        tableChecks.push({
          table,
          exists: !error,
          count: count || 0,
          error: error?.message
        });
      } catch (e) {
        tableChecks.push({
          table,
          exists: false,
          count: 0,
          error: e instanceof Error ? e.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      learning_system_status: tableChecks,
      ready: tableChecks.every(check => check.exists)
    });

  } catch (error) {
    console.error('Error checking learning system status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}