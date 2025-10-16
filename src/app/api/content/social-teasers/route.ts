import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SocialTeaser {
  platform: 'instagram' | 'tiktok' | 'twitter' | 'youtube';
  content: string;
  hashtags: string[];
  hook: string;
  callToAction: string;
  visualSuggestion: string;
}

export async function POST(request: NextRequest) {
  try {
    const { reportId, reportData } = await request.json();

    console.log('🎬 Generating social media teasers for intelligence report...');

    // Get latest trends from Reddit intelligence
    const { data: trends } = await supabase
      .from('reddit_kbeauty_trends')
      .select('trend_term, trend_type, velocity_score, korean_origin')
      .order('velocity_score', { ascending: false })
      .limit(5);

    const topTrends = trends || [];

    // Generate platform-specific teasers
    const teasers: SocialTeaser[] = [
      generateInstagramTeaser(reportData, topTrends),
      generateTikTokTeaser(reportData, topTrends),
      generateTwitterTeaser(reportData, topTrends),
      generateYouTubeTeaser(reportData, topTrends)
    ];

    // Store teasers for scheduling
    for (const teaser of teasers) {
      await supabase
        .from('social_content_queue')
        .insert({
          report_id: reportId,
          platform: teaser.platform,
          content: teaser.content,
          hashtags: teaser.hashtags,
          hook: teaser.hook,
          call_to_action: teaser.callToAction,
          visual_suggestion: teaser.visualSuggestion,
          status: 'pending',
          scheduled_for: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          created_at: new Date()
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Social media teasers generated successfully',
      teasers,
      engagement_predictions: {
        instagram: calculateEngagementPrediction('instagram', topTrends),
        tiktok: calculateEngagementPrediction('tiktok', topTrends),
        twitter: calculateEngagementPrediction('twitter', topTrends),
        youtube: calculateEngagementPrediction('youtube', topTrends)
      }
    });

  } catch (error) {
    console.error('❌ Error generating social teasers:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function generateInstagramTeaser(reportData: any, trends: any[]): SocialTeaser {
  const topTrend = trends[0]?.trend_term || 'Korean beauty';
  const isKoreanTrend = trends[0]?.korean_origin || false;

  return {
    platform: 'instagram',
    content: `🇰🇷 SEOUL BEAUTY INTEL DROP 🇰🇷

${isKoreanTrend ? '🔥 KOREAN EXCLUSIVE:' : '🔥 TRENDING NOW:'} ${topTrend.toUpperCase()}

✨ Just discovered in Seoul before it hits the US
📊 ${trends.length} breakthrough products analyzed
💎 Average savings: 73% vs US retail
🚀 Available to Seoul Sister members NOW

Swipe to see what Korean beauty insiders are obsessing over...

Link in bio for full intelligence report 👆`,
    hashtags: [
      '#KBeauty', '#SeoulBeauty', '#KoreanSkincare', '#BeautyIntelligence',
      '#GlassSkin', '#SkincareRoutine', '#KBeautyTrends', '#SeoulSister',
      `#${topTrend.replace(/\s+/g, '')}`, '#BeautySecrets', '#SkincareAddiction'
    ],
    hook: `🚨 KOREA EXCLUSIVE: ${topTrend} is about to blow up in the US`,
    callToAction: 'Link in bio for full Seoul intelligence report',
    visualSuggestion: 'Split screen: Seoul beauty store vs empty US shelves, with trending product highlights and price comparison graphics'
  };
}

function generateTikTokTeaser(reportData: any, trends: any[]): SocialTeaser {
  const topTrend = trends[0]?.trend_term || 'Korean beauty';

  return {
    platform: 'tiktok',
    content: `POV: You have Seoul beauty intel before it goes viral in America 👀

Currently trending in Korean beauty stores:
${trends.slice(0, 3).map(t => `✨ ${t.trend_term}`).join('\n')}

Korean girls have been using this for MONTHS 🇰🇷

Meanwhile Americans are still waiting for it to launch 💀

Get the full Seoul intelligence report before everyone else finds out 👆

#KBeautySecrets #SeoulBeauty #BeautyIntel`,
    hashtags: [
      '#KBeauty', '#SeoulBeauty', '#KoreanSkincare', '#BeautyTok',
      '#SkincareRoutine', '#BeautySecrets', '#GlassSkin', '#KBeautyTrends',
      '#SeoulSister', '#BeautyIntelligence', '#SkincareAddiction'
    ],
    hook: 'POV: You have Seoul beauty intel before it goes viral',
    callToAction: 'Link in bio for full Seoul intelligence report',
    visualSuggestion: 'Quick cuts between Korean beauty stores, product close-ups, before/after results, with text overlays showing trending stats'
  };
}

function generateTwitterTeaser(reportData: any, trends: any[]): SocialTeaser {
  const topTrend = trends[0]?.trend_term || 'Korean beauty';

  return {
    platform: 'twitter',
    content: `🧵 SEOUL BEAUTY INTELLIGENCE THREAD

${topTrend} is about to explode in the US market.

Korean beauty insiders have been using it for months.

Here's what you need to know before everyone else catches on: 👇

Full intelligence report: seoulsister.com`,
    hashtags: [
      '#KBeauty', '#SeoulBeauty', '#BeautyIntelligence', '#KoreanSkincare',
      '#BeautyTrends', '#SkincareRoutine', '#GlassSkin', '#BeautySecrets'
    ],
    hook: `🚨 ${topTrend} is about to explode in the US market`,
    callToAction: 'Full intelligence report: seoulsister.com',
    visualSuggestion: 'Infographic showing trend progression from Seoul to US, with timeline and market data'
  };
}

function generateYouTubeTeaser(reportData: any, trends: any[]): SocialTeaser {
  const topTrend = trends[0]?.trend_term || 'Korean beauty';

  return {
    platform: 'youtube',
    content: `🇰🇷 SEOUL BEAUTY INTELLIGENCE: What Korean Girls Are Using RIGHT NOW

In today's intelligence report, I'm breaking down:

✨ ${trends.length} trending products Korean beauty insiders are obsessing over
📊 Real pricing data from Seoul beauty stores
🔥 What's going viral on Korean social media
💎 Products that won't hit the US for 3-6 months

This is insider information you can't get anywhere else.

Full written report available at seoulsister.com for members.

What Korean beauty trend should I investigate next? Let me know in the comments! 👇`,
    hashtags: [
      'K-Beauty', 'Seoul Beauty', 'Korean Skincare', 'Beauty Intelligence',
      'Glass Skin', 'Skincare Routine', 'Beauty Trends', 'Korea',
      'Seoul Sister', 'Beauty Secrets', 'Skincare Review'
    ],
    hook: `EXCLUSIVE: What Korean beauty insiders are using RIGHT NOW`,
    callToAction: 'Full report at seoulsister.com - link in description',
    visualSuggestion: 'Professional setup with Seoul beauty products displayed, Korean beauty store B-roll, product demos, and data visualizations'
  };
}

function calculateEngagementPrediction(platform: string, trends: any[]): {
  estimatedViews: number;
  estimatedEngagement: number;
  viralPotential: string;
} {
  const trendingFactor = trends.reduce((acc, trend) => acc + trend.velocity_score, 0) / trends.length;

  const baseMetrics = {
    instagram: { views: 5000, engagement: 0.08 },
    tiktok: { views: 25000, engagement: 0.12 },
    twitter: { views: 8000, engagement: 0.06 },
    youtube: { views: 15000, engagement: 0.10 }
  };

  const base = baseMetrics[platform as keyof typeof baseMetrics] || baseMetrics.instagram;
  const multiplier = Math.max(1, trendingFactor / 50);

  return {
    estimatedViews: Math.round(base.views * multiplier),
    estimatedEngagement: Math.round(base.views * multiplier * base.engagement),
    viralPotential: trendingFactor > 75 ? 'High' : trendingFactor > 50 ? 'Medium' : 'Low'
  };
}

export async function GET() {
  return NextResponse.json({
    message: 'Social Media Teaser Generator API',
    endpoints: {
      'POST /api/content/social-teasers': 'Generate social media teasers for a report'
    }
  });
}