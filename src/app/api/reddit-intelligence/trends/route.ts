import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || '7d';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const type = url.searchParams.get('type'); // brand, ingredient, product, or all

    console.log(`📊 Fetching Reddit K-beauty trends: ${timeframe}, limit: ${limit}, type: ${type || 'all'}`);

    // Calculate timeframe in hours
    const hoursMap: { [key: string]: number } = {
      '24h': 24,
      '7d': 168,
      '30d': 720,
      '90d': 2160
    };

    const hours = hoursMap[timeframe] || 168;
    const sinceDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Build query
    let query = supabase
      .from('reddit_kbeauty_trends')
      .select('*')
      .gte('last_seen', sinceDate.toISOString())
      .order('velocity_score', { ascending: false })
      .limit(limit);

    if (type && type !== 'all') {
      query = query.eq('trend_type', type);
    }

    const { data: trends, error } = await query;

    if (error) {
      throw error;
    }

    // Get trend statistics
    const { data: stats } = await supabase
      .from('reddit_kbeauty_trends')
      .select('trend_type, trend_status')
      .gte('last_seen', sinceDate.toISOString());

    const trendStats = {
      total: trends?.length || 0,
      by_type: {},
      by_status: {},
      timeframe,
      last_updated: new Date().toISOString()
    };

    if (stats) {
      // Count by type
      const typeCount: { [key: string]: number } = {};
      const statusCount: { [key: string]: number } = {};

      stats.forEach(item => {
        typeCount[item.trend_type] = (typeCount[item.trend_type] || 0) + 1;
        statusCount[item.trend_status] = (statusCount[item.trend_status] || 0) + 1;
      });

      trendStats.by_type = typeCount;
      trendStats.by_status = statusCount;
    }

    console.log(`✅ Retrieved ${trends?.length || 0} Reddit K-beauty trends`);

    return NextResponse.json({
      success: true,
      trends: trends || [],
      statistics: trendStats,
      filters: {
        timeframe,
        type: type || 'all',
        limit
      }
    });

  } catch (error) {
    console.error('❌ Error fetching Reddit trends:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      trends: [],
      statistics: null
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, trend_data } = await request.json();

    if (action === 'update_trends') {
      // Manual trend update trigger
      console.log('🔄 Manual trend update triggered from Reddit data...');

      // Call the trend update function
      const { error } = await supabase.rpc('update_kbeauty_trend_scores');

      if (error) {
        throw error;
      }

      console.log('✅ Reddit trends manually updated');

      return NextResponse.json({
        success: true,
        message: 'Trends updated successfully from Reddit intelligence',
        timestamp: new Date().toISOString()
      });

    } else if (action === 'add_trend') {
      // Add a new trend from external discovery
      const { data, error } = await supabase
        .from('reddit_kbeauty_trends')
        .upsert({
          trend_term: trend_data.term,
          trend_type: trend_data.type,
          mention_count: trend_data.mentions || 1,
          velocity_score: trend_data.velocity || 10,
          growth_rate: trend_data.growth || 0,
          trend_status: 'emerging',
          ai_confidence: trend_data.confidence || 0.5,
          korean_origin: trend_data.korean_origin || false,
          sample_posts: trend_data.sample_posts || [],
          subreddits: trend_data.subreddits || ['AsianBeauty'],
          first_seen: new Date(),
          last_seen: new Date(),
          updated_at: new Date()
        });

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: 'New trend added to Reddit intelligence',
        trend: data
      });

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in Reddit trends API:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}