import { NextRequest, NextResponse } from 'next/server';
import { RedditKBeautyIntelligence } from '@/lib/reddit-intelligence/scraper';

/**
 * Reddit K-Beauty Intelligence Pipeline
 * Dynamic trend discovery from Korean beauty communities
 */

export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🇰🇷 Starting Reddit K-beauty intelligence pipeline...');

    const intelligence = new RedditKBeautyIntelligence();
    const startTime = Date.now();

    // Run the full intelligence pipeline
    const results = await intelligence.runFullIntelligencePipeline();

    const executionTime = Date.now() - startTime;

    console.log(`🎯 Reddit intelligence pipeline completed in ${executionTime}ms`);
    console.log(`📊 Results: ${results.postsScraped} posts, ${results.trendsUpdated} trends, ${results.newKeywords} keywords`);

    return NextResponse.json({
      success: true,
      message: 'Reddit K-beauty intelligence pipeline completed successfully',
      results: {
        ...results,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString()
      },
      performance: {
        posts_per_second: Math.round(results.postsScraped / (executionTime / 1000)),
        total_runtime: `${Math.round(executionTime / 1000)}s`
      }
    });

  } catch (error) {
    console.error('❌ Reddit intelligence pipeline failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}