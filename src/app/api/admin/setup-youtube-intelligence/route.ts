import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    console.log('🎬 Setting up YouTube Intelligence database tables...');

    // Test if tables exist
    const { data: existingTables, error: testError } = await supabase
      .from('youtube_kbeauty_videos')
      .select('video_id')
      .limit(1);

    if (!testError) {
      return NextResponse.json({
        success: true,
        message: 'YouTube Intelligence tables already exist and are functional',
        tables_status: 'operational'
      });
    }

    // Tables don't exist, provide SQL schema
    const youtubeVideoSchema = `
-- YouTube Korean Beauty Videos Intelligence Table
CREATE TABLE IF NOT EXISTS youtube_kbeauty_videos (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(255) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  published_at TIMESTAMP NOT NULL,
  channel_id VARCHAR(255) NOT NULL,
  channel_title VARCHAR(255) NOT NULL,
  view_count BIGINT DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  duration VARCHAR(50),
  tags TEXT[],
  category_id VARCHAR(10),
  engagement_rate DECIMAL(10,6) DEFAULT 0,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  korean_relevance_score DECIMAL(3,2) DEFAULT 0,
  trend_potential DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_youtube_videos_published_at ON youtube_kbeauty_videos(published_at);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_engagement ON youtube_kbeauty_videos(engagement_rate);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel ON youtube_kbeauty_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_relevance ON youtube_kbeauty_videos(korean_relevance_score);
`;

    const youtubeChannelSchema = `
-- YouTube Korean Beauty Channels Intelligence Table
CREATE TABLE IF NOT EXISTS youtube_kbeauty_channels (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subscriber_count BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  view_count BIGINT DEFAULT 0,
  country VARCHAR(10),
  custom_url VARCHAR(255),
  is_korean_beauty BOOLEAN DEFAULT true,
  influence_score DECIMAL(5,2) DEFAULT 0,
  growth_rate DECIMAL(5,2) DEFAULT 0,
  last_analyzed TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_youtube_channels_influence ON youtube_kbeauty_channels(influence_score);
CREATE INDEX IF NOT EXISTS idx_youtube_channels_growth ON youtube_kbeauty_channels(growth_rate);
`;

    const youtubeTrendsSchema = `
-- YouTube Korean Beauty Trends Analysis Table
CREATE TABLE IF NOT EXISTS youtube_kbeauty_trends (
  id SERIAL PRIMARY KEY,
  trend_date DATE NOT NULL,
  trending_topics JSONB,
  popular_brands JSONB,
  engagement_patterns JSONB,
  sentiment_analysis JSONB,
  content_recommendations JSONB,
  performance_metrics JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(trend_date)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_youtube_trends_date ON youtube_kbeauty_trends(trend_date);
`;

    const youtubeCommentsSchema = `
-- YouTube Comments Analysis for Korean Beauty Intelligence
CREATE TABLE IF NOT EXISTS youtube_kbeauty_comments (
  id SERIAL PRIMARY KEY,
  comment_id VARCHAR(255) UNIQUE NOT NULL,
  video_id VARCHAR(255) NOT NULL,
  author_name VARCHAR(255),
  comment_text TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  published_at TIMESTAMP NOT NULL,
  is_korean BOOLEAN DEFAULT false,
  sentiment_score DECIMAL(3,2) DEFAULT 0,
  contains_product_mention BOOLEAN DEFAULT false,
  mentioned_brands TEXT[],
  korean_beauty_relevance DECIMAL(3,2) DEFAULT 0,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (video_id) REFERENCES youtube_kbeauty_videos(video_id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_youtube_comments_video ON youtube_kbeauty_comments(video_id);
CREATE INDEX IF NOT EXISTS idx_youtube_comments_korean ON youtube_kbeauty_comments(is_korean);
CREATE INDEX IF NOT EXISTS idx_youtube_comments_sentiment ON youtube_kbeauty_comments(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_youtube_comments_relevance ON youtube_kbeauty_comments(korean_beauty_relevance);
`;

    return NextResponse.json({
      success: true,
      message: 'YouTube Intelligence database setup required',
      setup_status: 'schema_provided',
      instructions: 'Execute the following SQL schemas in your Supabase SQL Editor',
      schemas: {
        youtube_videos: youtubeVideoSchema,
        youtube_channels: youtubeChannelSchema,
        youtube_trends: youtubeTrendsSchema,
        youtube_comments: youtubeCommentsSchema
      },
      next_steps: [
        '1. Copy and execute each schema in Supabase SQL Editor',
        '2. Set up YouTube API key in environment variables',
        '3. Test the YouTube Intelligence API endpoint',
        '4. Schedule daily trend analysis'
      ]
    });

  } catch (error) {
    console.error('❌ Error setting up YouTube Intelligence:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: {
        common_issues: [
          'Check Supabase environment variables',
          'Verify database connection',
          'Ensure proper permissions'
        ]
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'YouTube Intelligence Database Setup API',
    description: 'Sets up database tables for YouTube Korean beauty intelligence',
    features: [
      'Video analytics and trending analysis',
      'Channel performance tracking',
      'Comment sentiment analysis',
      'Korean language content detection',
      'Brand mention tracking',
      'Engagement pattern analysis'
    ],
    endpoints: {
      'POST /api/admin/setup-youtube-intelligence': 'Setup YouTube intelligence database'
    }
  });
}