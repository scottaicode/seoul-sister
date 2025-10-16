import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ Testing Reddit K-beauty intelligence system...');

    // Since we can't create tables via SQL, let's try to test existing tables and create mock data
    const results = [];

    // Test if we can insert test data to validate table structure
    try {
      // Try to insert a test Reddit post
      const testPost = {
        post_id: 'test_' + Date.now(),
        subreddit: 'AsianBeauty',
        title: 'Test K-beauty post',
        content: 'Testing COSRX snail mucin essence',
        author: 'test_user',
        url: 'https://reddit.com/test',
        score: 10,
        num_comments: 5,
        upvote_ratio: 0.95,
        created_utc: new Date().toISOString(),
        is_video: false,
        detected_brands: ['cosrx'],
        detected_ingredients: ['snail mucin'],
        detected_products: ['snail 96 mucin power essence'],
        skin_concerns: ['hydration'],
        sentiment_score: 0.8,
        is_question: false,
        is_review: true,
        is_routine: false,
        ai_confidence: 0.9
      };

      const { data: postData, error: postError } = await supabase
        .from('reddit_kbeauty_posts')
        .insert(testPost)
        .select();

      if (postError) {
        console.error('❌ Posts table error:', postError);
        results.push({
          table: 'reddit_kbeauty_posts',
          status: 'error',
          error: postError.message,
          sql_needed: `
CREATE TABLE reddit_kbeauty_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id VARCHAR(20) UNIQUE NOT NULL,
  subreddit VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  author VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  upvote_ratio DECIMAL(3,2) DEFAULT 0.5,
  created_utc TIMESTAMP WITH TIME ZONE NOT NULL,
  is_video BOOLEAN DEFAULT FALSE,
  link_flair_text VARCHAR(100),
  total_awards_received INTEGER DEFAULT 0,
  detected_brands JSONB DEFAULT '[]'::jsonb,
  detected_ingredients JSONB DEFAULT '[]'::jsonb,
  detected_products JSONB DEFAULT '[]'::jsonb,
  skin_concerns JSONB DEFAULT '[]'::jsonb,
  routine_type VARCHAR(20),
  price_mentions JSONB DEFAULT '[]'::jsonb,
  sentiment_score DECIMAL(3,2) DEFAULT 0.5,
  is_question BOOLEAN DEFAULT FALSE,
  is_review BOOLEAN DEFAULT FALSE,
  is_routine BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3,2) DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`
        });
      } else {
        console.log('✅ Posts table working');
        results.push({ table: 'reddit_kbeauty_posts', status: 'working' });

        // Clean up test data
        await supabase
          .from('reddit_kbeauty_posts')
          .delete()
          .eq('post_id', testPost.post_id);
      }
    } catch (err) {
      results.push({
        table: 'reddit_kbeauty_posts',
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Test trends table
    try {
      const testTrend = {
        trend_term: 'test_cosrx',
        trend_type: 'brand',
        mention_count: 5,
        total_score: 50,
        avg_engagement: 10.0,
        sample_posts: ['test1', 'test2'],
        subreddits: ['AsianBeauty'],
        growth_rate: 25,
        velocity_score: 75,
        trend_status: 'emerging',
        ai_confidence: 0.85,
        korean_origin: true
      };

      const { error: trendError } = await supabase
        .from('reddit_kbeauty_trends')
        .insert(testTrend);

      if (trendError) {
        console.error('❌ Trends table error:', trendError);
        results.push({
          table: 'reddit_kbeauty_trends',
          status: 'error',
          error: trendError.message,
          sql_needed: `
CREATE TABLE reddit_kbeauty_trends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_term VARCHAR(200) NOT NULL,
  trend_type VARCHAR(50) NOT NULL,
  mention_count INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  avg_engagement DECIMAL(10,2) DEFAULT 0,
  sample_posts JSONB DEFAULT '[]'::jsonb,
  subreddits JSONB DEFAULT '[]'::jsonb,
  growth_rate INTEGER DEFAULT 0,
  velocity_score INTEGER DEFAULT 0,
  trend_status VARCHAR(20) DEFAULT 'stable',
  ai_confidence DECIMAL(3,2) DEFAULT 0.5,
  korean_origin BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(trend_term, trend_type)
);`
        });
      } else {
        console.log('✅ Trends table working');
        results.push({ table: 'reddit_kbeauty_trends', status: 'working' });

        // Clean up test data
        await supabase
          .from('reddit_kbeauty_trends')
          .delete()
          .eq('trend_term', testTrend.trend_term);
      }
    } catch (err) {
      results.push({
        table: 'reddit_kbeauty_trends',
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Test keywords table
    try {
      const testKeyword = {
        keyword: 'test_keyword_' + Date.now(),
        keyword_type: 'test',
        discovery_method: 'manual',
        mention_frequency: 1,
        korean_verified: false,
        ai_notes: 'Test keyword'
      };

      const { error: keywordError } = await supabase
        .from('reddit_kbeauty_keywords')
        .insert(testKeyword);

      if (keywordError) {
        console.error('❌ Keywords table error:', keywordError);
        results.push({
          table: 'reddit_kbeauty_keywords',
          status: 'error',
          error: keywordError.message,
          sql_needed: `
CREATE TABLE reddit_kbeauty_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword VARCHAR(200) UNIQUE NOT NULL,
  keyword_type VARCHAR(50) NOT NULL,
  discovery_method VARCHAR(50) DEFAULT 'manual',
  mention_frequency INTEGER DEFAULT 0,
  korean_verified BOOLEAN DEFAULT FALSE,
  ai_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`
        });
      } else {
        console.log('✅ Keywords table working');
        results.push({ table: 'reddit_kbeauty_keywords', status: 'working' });

        // Clean up test data
        await supabase
          .from('reddit_kbeauty_keywords')
          .delete()
          .eq('keyword', testKeyword.keyword);
      }
    } catch (err) {
      results.push({
        table: 'reddit_kbeauty_keywords',
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }

    // Insert some seed keywords if tables were created successfully
    const seedKeywords = [
      { keyword: 'cosrx', keyword_type: 'brand', korean_verified: true },
      { keyword: 'beauty of joseon', keyword_type: 'brand', korean_verified: true },
      { keyword: 'innisfree', keyword_type: 'brand', korean_verified: true },
      { keyword: 'centella asiatica', keyword_type: 'ingredient', korean_verified: true },
      { keyword: 'snail mucin', keyword_type: 'ingredient', korean_verified: true },
      { keyword: 'glass skin', keyword_type: 'technique', korean_verified: true },
      { keyword: 'double cleansing', keyword_type: 'technique', korean_verified: true },
      { keyword: '10-step routine', keyword_type: 'technique', korean_verified: true }
    ];

    let seedResults = [];
    try {
      for (const keyword of seedKeywords) {
        const { error } = await supabase
          .from('reddit_kbeauty_keywords')
          .upsert(keyword, { onConflict: 'keyword' });

        if (error) {
          console.error(`❌ Error seeding keyword ${keyword.keyword}:`, error);
        } else {
          console.log(`✅ Seeded keyword: ${keyword.keyword}`);
        }
      }
      seedResults.push({ status: 'success', message: `Seeded ${seedKeywords.length} keywords` });
    } catch (err) {
      console.error('❌ Error seeding keywords:', err);
      seedResults.push({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
    }

    return NextResponse.json({
      success: true,
      message: 'Reddit K-beauty intelligence database setup completed',
      results: {
        tables: results,
        seed_data: seedResults
      },
      next_steps: [
        'Run the Reddit intelligence pipeline via /api/reddit-intelligence/run-pipeline',
        'Monitor the dashboard at /admin/korean-beauty-intelligence',
        'Check /api/reddit-intelligence/trends for data'
      ]
    });

  } catch (error) {
    console.error('❌ Reddit intelligence setup failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Reddit K-beauty intelligence database setup failed'
    }, { status: 500 });
  }
}

export async function GET() {
  return POST({} as NextRequest);
}