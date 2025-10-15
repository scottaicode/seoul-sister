import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to manually trigger Reddit intelligence pipeline
 * Access: /api/test/reddit-intelligence
 */

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Manual test trigger for Reddit intelligence pipeline...');

    // Trigger the Reddit intelligence pipeline
    const pipelineResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/reddit-intelligence/run-pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });

    let pipelineResult = null;
    if (pipelineResponse.ok) {
      pipelineResult = await pipelineResponse.json();
    } else {
      console.error('Pipeline response not ok:', pipelineResponse.status);
    }

    // Fetch current Reddit trends
    const trendsResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/reddit-intelligence/trends?timeframe=7d&limit=10`);

    let trendsData = null;
    if (trendsResponse.ok) {
      trendsData = await trendsResponse.json();
    }

    return NextResponse.json({
      success: true,
      message: 'Reddit intelligence test completed',
      pipeline_result: pipelineResult,
      current_trends: trendsData,
      timestamp: new Date().toISOString(),
      next_steps: [
        'Check Supabase for new reddit_kbeauty_posts',
        'Review reddit_kbeauty_trends table for discovered terms',
        'Monitor reddit_kbeauty_keywords for AI-discovered terms',
        'Watch intelligence reports for Reddit community insights'
      ]
    });

  } catch (error) {
    console.error('❌ Reddit intelligence test failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}