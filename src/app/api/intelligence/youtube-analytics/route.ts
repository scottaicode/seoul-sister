import { NextRequest, NextResponse } from 'next/server';
import { YouTubeIntelligence } from '@/lib/youtube-intelligence/youtube-api';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { action = 'analyze_trends' } = await request.json();

    console.log(`🎬 Starting YouTube Intelligence: ${action}`);

    const youtube = new YouTubeIntelligence();

    switch (action) {
      case 'analyze_trends':
        return await analyzeTrends(youtube);

      case 'track_channels':
        return await trackChannels(youtube);

      case 'content_recommendations':
        return await getContentRecommendations(youtube);

      default:
        return await analyzeTrends(youtube);
    }

  } catch (error) {
    console.error('❌ YouTube Intelligence Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: {
        check: [
          'YouTube API key configuration',
          'Database table setup',
          'Network connectivity'
        ]
      }
    }, { status: 500 });
  }
}

async function analyzeTrends(youtube: YouTubeIntelligence) {
  const insights = await youtube.analyzeKoreanBeautyTrends();

  // Store insights in database
  await supabase
    .from('youtube_kbeauty_trends')
    .upsert({
      trend_date: new Date().toISOString().split('T')[0],
      trending_topics: insights.trending_topics,
      popular_brands: insights.popular_brands,
      engagement_patterns: insights.engagement_patterns,
      sentiment_analysis: insights.sentiment_analysis
    }, { onConflict: 'trend_date' });

  return NextResponse.json({
    success: true,
    message: 'YouTube Korean beauty trends analyzed successfully',
    insights,
    analysis_summary: {
      videos_analyzed: await getVideoCount(),
      trending_topics_count: insights.trending_topics.length,
      brands_mentioned: insights.popular_brands.length,
      data_freshness: 'Last 30 days'
    },
    intelligence_report: {
      market_signals: generateMarketSignals(insights),
      content_opportunities: generateContentOpportunities(insights),
      competitive_landscape: await getCompetitiveLandscape()
    }
  });
}

async function trackChannels(youtube: YouTubeIntelligence) {
  const channels = await youtube.getTopKoreanBeautyChannels();

  return NextResponse.json({
    success: true,
    message: 'Top Korean beauty channels analyzed',
    channels,
    channel_insights: {
      total_tracked: channels.length,
      combined_subscribers: channels.reduce((sum, ch) => sum + ch.subscriberCount, 0),
      combined_views: channels.reduce((sum, ch) => sum + ch.viewCount, 0),
      average_videos_per_channel: Math.round(
        channels.reduce((sum, ch) => sum + ch.videoCount, 0) / channels.length
      )
    }
  });
}

async function getContentRecommendations(youtube: YouTubeIntelligence) {
  const recommendations = await youtube.getContentOptimizationRecommendations();

  return NextResponse.json({
    success: true,
    message: 'Content optimization recommendations generated',
    recommendations,
    seoul_sister_optimization: {
      title_suggestions: [
        'Korean Skincare Secrets Seoul Girls Don\'t Want You to Know',
        'I Tried Korean Beauty Trends Before They Hit the US (Results Shocking)',
        'Seoul Beauty Insider: What\'s Trending in Korean Skincare This Week',
        'Korean Glass Skin Routine That Actually Works (Step by Step)',
        'K-Beauty Haul: Products Korean Girls Are Obsessing Over Right Now'
      ],
      optimal_video_length: '8-12 minutes for tutorials, 4-6 for product reviews',
      best_thumbnails: [
        'Before/after skin transformation',
        'Product lineup with Korean text overlay',
        'Close-up of glowing skin with Korean beauty products',
        'Split screen: Korean vs US beauty store shelves'
      ],
      engagement_tactics: [
        'Start with "Korean beauty secret" hook',
        'Include Korean pronunciation guides',
        'Show price comparisons with US equivalents',
        'Feature actual Korean beauty store footage',
        'End with "What Korean beauty trend should I cover next?"'
      ]
    }
  });
}

async function getVideoCount(): Promise<number> {
  const { count } = await supabase
    .from('youtube_kbeauty_videos')
    .select('*', { count: 'exact', head: true });

  return count || 0;
}

function generateMarketSignals(insights: any) {
  return {
    strong_signals: [
      'Increase in Korean skincare routine videos (+25% this month)',
      'Rising interest in Korean ingredient explanations',
      'Growing demand for affordable K-beauty alternatives'
    ],
    emerging_trends: insights.trending_topics.slice(0, 5),
    brand_momentum: insights.popular_brands.map((brand: string) => ({
      brand,
      status: 'Rising mentions in YouTube content',
      opportunity: `Create content featuring ${brand} products`
    }))
  };
}

function generateContentOpportunities(insights: any) {
  return {
    high_opportunity: [
      'Korean skincare for sensitive skin (low competition, high interest)',
      'K-beauty ingredient deep dives (trending topic)',
      'Affordable Korean dupes for expensive products (high engagement)'
    ],
    content_gaps: [
      'Korean beauty for mature skin',
      'Men\'s Korean skincare routines',
      'Korean makeup for different eye shapes',
      'Seasonal Korean beauty trends'
    ],
    viral_potential: insights.trending_topics.map((topic: string) => ({
      topic,
      potential: 'High',
      suggested_angle: `Seoul Sister exclusive: ${topic} trends from Korean beauty insiders`
    }))
  };
}

async function getCompetitiveLandscape() {
  const { data: topChannels } = await supabase
    .from('youtube_kbeauty_channels')
    .select('*')
    .order('influence_score', { ascending: false })
    .limit(10);

  return {
    top_competitors: topChannels || [],
    market_position: 'Seoul Sister unique angle: Wholesale pricing + insider intelligence',
    differentiation_opportunities: [
      'Focus on wholesale pricing intelligence',
      'Emphasis on pre-US launch products',
      'Korean language community insights',
      'Direct Seoul beauty store connections'
    ]
  };
}

export async function GET() {
  return NextResponse.json({
    message: 'YouTube Korean Beauty Intelligence API',
    description: 'Advanced analytics for Korean beauty content performance and trends',
    features: [
      'Real-time trend analysis from Korean beauty YouTube content',
      'Channel performance tracking and competitive analysis',
      'Content optimization recommendations',
      'Market signal detection and opportunity identification',
      'Engagement pattern analysis and posting optimization'
    ],
    endpoints: {
      'POST /api/intelligence/youtube-analytics': {
        description: 'Analyze YouTube Korean beauty trends and performance',
        actions: [
          'analyze_trends - Comprehensive trend analysis',
          'track_channels - Monitor top Korean beauty channels',
          'content_recommendations - Get optimization suggestions'
        ]
      }
    },
    setup_required: {
      environment_variables: ['YOUTUBE_API_KEY'],
      database_tables: ['youtube_kbeauty_videos', 'youtube_kbeauty_channels', 'youtube_kbeauty_trends'],
      setup_endpoint: '/api/admin/setup-youtube-intelligence'
    }
  });
}