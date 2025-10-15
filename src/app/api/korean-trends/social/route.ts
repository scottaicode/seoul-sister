import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const supabase = createClient();

    // Get social beauty trends data
    const { data: trends, error } = await supabase
      .from('social_beauty_trends')
      .select('*')
      .order('mention_count', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching social trends:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      trends: trends || [],
      count: trends?.length || 0,
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in social trends API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const {
      trend_name,
      platform,
      mention_count,
      growth_rate_percentage,
      hashtags,
      influencer_engagement,
      data_source
    } = body;

    // Validate required fields
    if (!trend_name || !platform || !mention_count) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: trend_name, platform, mention_count'
      }, { status: 400 });
    }

    // Insert or update social trend
    const { data, error } = await (supabase as any)
      .from('social_beauty_trends')
      .upsert({
        trend_name,
        platform,
        mention_count,
        growth_rate_percentage: growth_rate_percentage || 0,
        hashtags: hashtags || [],
        influencer_engagement: influencer_engagement || 0,
        data_source: data_source || 'manual_input',
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'trend_name,platform'
      });

    if (error) {
      throw new Error(`Failed to update social trend: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Social trend updated successfully',
      data
    });

  } catch (error) {
    console.error('Error updating social trend:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}