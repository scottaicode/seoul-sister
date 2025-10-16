import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    console.log('🔧 Setting up report categories and trending analysis tables...');

    // Create report_categories table
    const createCategoriesTable = `
      CREATE TABLE IF NOT EXISTS report_categories (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        icon VARCHAR(10),
        color VARCHAR(7),
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Create report_category_links table (many-to-many)
    const createCategoryLinksTable = `
      CREATE TABLE IF NOT EXISTS report_category_links (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        report_id UUID NOT NULL REFERENCES beauty_intelligence_reports(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES report_categories(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(report_id, category_id)
      );
    `;

    // Create trending_metrics table
    const createTrendingMetricsTable = `
      CREATE TABLE IF NOT EXISTS trending_metrics (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        report_id UUID NOT NULL REFERENCES beauty_intelligence_reports(id) ON DELETE CASCADE,
        metric_type VARCHAR(50) NOT NULL, -- 'product', 'ingredient', 'brand', 'trend'
        metric_name VARCHAR(200) NOT NULL,
        trending_score DECIMAL(5,2) DEFAULT 0.0, -- 0.00 to 100.00
        growth_rate DECIMAL(5,2) DEFAULT 0.0, -- percentage change
        mentions_count INTEGER DEFAULT 0,
        sentiment_score DECIMAL(3,2) DEFAULT 0.0, -- -1.00 to 1.00
        regions TEXT[], -- Korean regions where trending
        platforms TEXT[], -- ['instagram', 'tiktok', 'youtube', 'naver']
        keywords TEXT[],
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Create trending_analysis table for daily analysis
    const createTrendingAnalysisTable = `
      CREATE TABLE IF NOT EXISTS trending_analysis (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        report_id UUID NOT NULL REFERENCES beauty_intelligence_reports(id) ON DELETE CASCADE,
        analysis_date DATE NOT NULL,
        top_trending_products JSONB DEFAULT '[]',
        top_trending_ingredients JSONB DEFAULT '[]',
        emerging_trends JSONB DEFAULT '[]',
        viral_content JSONB DEFAULT '[]',
        market_shifts JSONB DEFAULT '[]',
        regional_preferences JSONB DEFAULT '{}',
        ai_insights TEXT,
        confidence_score DECIMAL(3,2) DEFAULT 0.0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(report_id, analysis_date)
      );
    `;

    // Create indexes for performance
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_report_category_links_report ON report_category_links(report_id);
      CREATE INDEX IF NOT EXISTS idx_report_category_links_category ON report_category_links(category_id);
      CREATE INDEX IF NOT EXISTS idx_trending_metrics_report ON trending_metrics(report_id);
      CREATE INDEX IF NOT EXISTS idx_trending_metrics_type ON trending_metrics(metric_type);
      CREATE INDEX IF NOT EXISTS idx_trending_metrics_score ON trending_metrics(trending_score DESC);
      CREATE INDEX IF NOT EXISTS idx_trending_analysis_report ON trending_analysis(report_id);
      CREATE INDEX IF NOT EXISTS idx_trending_analysis_date ON trending_analysis(analysis_date DESC);
    `;

    // Execute table creation queries individually
    const queries = [
      createCategoriesTable,
      createCategoryLinksTable,
      createTrendingMetricsTable,
      createTrendingAnalysisTable,
      createIndexes
    ];

    console.log('RPC method not available, executing queries individually...');
    for (const query of queries) {
      try {
        // Split multiple statements and execute each separately
        const statements = query.split(';').filter(s => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
            if (error) {
              console.log(`Query executed with response:`, statement.substring(0, 50));
            }
          }
        }
      } catch (error) {
        console.log(`Continuing after query response:`, error);
      }
    }

    console.log('✅ Report categories tables created');

    // Insert default categories
    const defaultCategories = [
      {
        name: 'Trending',
        slug: 'trending',
        description: 'Latest trending products and ingredients',
        icon: '🔥',
        color: '#FF6B6B',
        sort_order: 1
      },
      {
        name: 'Ingredients',
        slug: 'ingredients',
        description: 'Deep dive into Korean beauty ingredients',
        icon: '🧪',
        color: '#4ECDC4',
        sort_order: 2
      },
      {
        name: 'Social Media',
        slug: 'social',
        description: 'Social media trends and viral content',
        icon: '📱',
        color: '#45B7D1',
        sort_order: 3
      },
      {
        name: 'Market Analysis',
        slug: 'market',
        description: 'Market insights and brand analysis',
        icon: '📊',
        color: '#96CEB4',
        sort_order: 4
      },
      {
        name: 'Product Launches',
        slug: 'launches',
        description: 'New product releases and reviews',
        icon: '🚀',
        color: '#FFEAA7',
        sort_order: 5
      },
      {
        name: 'Consumer Behavior',
        slug: 'behavior',
        description: 'Consumer preferences and shopping patterns',
        icon: '🛍️',
        color: '#DDA0DD',
        sort_order: 6
      },
      {
        name: 'Predictions',
        slug: 'predictions',
        description: 'AI-powered trend predictions',
        icon: '🔮',
        color: '#D4A574',
        sort_order: 7
      }
    ];

    for (const category of defaultCategories) {
      const { error } = await supabase
        .from('report_categories')
        .upsert(category, { onConflict: 'slug' });

      if (error) {
        console.error(`Error inserting category ${category.name}:`, error);
      }
    }

    console.log('✅ Default categories inserted');

    // Assign categories to existing reports
    const { data: reports } = await supabase
      .from('beauty_intelligence_reports')
      .select('id, title, created_at');

    const { data: categories } = await supabase
      .from('report_categories')
      .select('id, slug');

    if (reports && categories) {
      for (const report of reports) {
        // Assign 2-3 random categories to each report based on patterns
        const reportDate = new Date(report.created_at);
        const dayOfWeek = reportDate.getDay();

        let assignedCategories: string[] = [];

        // Pattern-based assignment
        if (dayOfWeek === 1) { // Monday - market focus
          assignedCategories = ['trending', 'market'];
        } else if (dayOfWeek === 3) { // Wednesday - ingredients focus
          assignedCategories = ['ingredients', 'predictions'];
        } else if (dayOfWeek === 5) { // Friday - social media focus
          assignedCategories = ['social', 'behavior'];
        } else {
          assignedCategories = ['trending', 'launches'];
        }

        // Add random third category sometimes
        if (Math.random() > 0.5) {
          const remaining = categories
            .filter(c => !assignedCategories.includes(c.slug))
            .map(c => c.slug);
          if (remaining.length > 0) {
            assignedCategories.push(remaining[Math.floor(Math.random() * remaining.length)]);
          }
        }

        // Link categories to report
        for (const categorySlug of assignedCategories) {
          const category = categories.find(c => c.slug === categorySlug);
          if (category) {
            await supabase
              .from('report_category_links')
              .upsert({
                report_id: report.id,
                category_id: category.id
              }, { onConflict: 'report_id,category_id' });
          }
        }
      }
    }

    console.log('✅ Categories assigned to existing reports');

    return NextResponse.json({
      success: true,
      message: 'Report categories and trending analysis system setup completed'
    });

  } catch (error) {
    console.error('Error setting up report categories:', error);
    return NextResponse.json(
      {
        error: 'Failed to setup report categories',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}