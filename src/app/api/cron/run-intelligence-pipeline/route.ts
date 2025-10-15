import { NextRequest, NextResponse } from 'next/server';

/**
 * Automated Korean Beauty Intelligence Pipeline
 * Runs every hour to keep Seoul Sister's intelligence fresh and self-improving
 * This makes the platform smarter with every run
 */

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🇰🇷 Starting automated Korean beauty intelligence pipeline...');

    const results = {
      timestamp: new Date().toISOString(),
      pipeline_runs: [] as any[],
      total_discoveries: 0,
      total_updates: 0,
      errors: [] as string[]
    };

    // 1. Run Korean Beauty Discovery Pipeline
    try {
      console.log('📊 Running discovery pipeline...');
      const discoveryResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/data-pipeline/korean-beauty-discovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'all', limit: 20 })
      });

      if (discoveryResponse.ok) {
        const discoveryData = await discoveryResponse.json();
        results.pipeline_runs.push({
          step: 'korean_beauty_discovery',
          success: true,
          data: discoveryData.results
        });
        results.total_discoveries += discoveryData.results.products_discovered || 0;
        results.total_updates += discoveryData.results.prices_updated || 0;
        console.log(`✅ Discovery: ${discoveryData.results.products_discovered} products, ${discoveryData.results.prices_updated} prices`);
      } else {
        throw new Error('Discovery pipeline failed');
      }
    } catch (error) {
      results.errors.push(`Discovery pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Discovery pipeline failed:', error);
    }

    // 2. Update Trending Scores Based on User Behavior
    try {
      console.log('🧠 Analyzing user behavior patterns...');
      const behaviorResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/learning/ml-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_trending_scores' })
      });

      if (behaviorResponse.ok) {
        const behaviorData = await behaviorResponse.json();
        results.pipeline_runs.push({
          step: 'behavior_learning',
          success: true,
          data: behaviorData
        });
        console.log('✅ Behavior learning: Trending scores updated');
      }
    } catch (error) {
      results.errors.push(`Behavior learning error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Behavior learning failed:', error);
    }

    // 3. Update Community Verification Scores
    try {
      console.log('👥 Processing community verifications...');
      const communityResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/learning/community-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_verifications' })
      });

      if (communityResponse.ok) {
        const communityData = await communityResponse.json();
        results.pipeline_runs.push({
          step: 'community_verification',
          success: true,
          data: communityData
        });
        console.log('✅ Community verification: Authenticity scores updated');
      }
    } catch (error) {
      results.errors.push(`Community verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Community verification failed:', error);
    }

    // 4. Generate Fresh Intelligence Report (only once per day)
    try {
      const hour = new Date().getHours();
      if (hour === 6) { // 6 AM Seoul time - fresh morning intelligence
        console.log('📰 Generating fresh intelligence report...');
        const reportResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/cron/generate-report`, {
          method: 'GET',
          headers: {
            'authorization': `Bearer ${process.env.CRON_SECRET}`,
            'Content-Type': 'application/json'
          }
        });

        if (reportResponse.ok) {
          const reportData = await reportResponse.json();
          results.pipeline_runs.push({
            step: 'intelligence_report',
            success: true,
            data: reportData
          });
          console.log('✅ Intelligence report: Fresh daily report generated');
        }
      } else {
        console.log('ℹ️ Intelligence report: Skipped (not daily generation time)');
      }
    } catch (error) {
      results.errors.push(`Intelligence report error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Intelligence report failed:', error);
    }

    // 5. Self-Improvement: Analyze Performance and Adjust Parameters
    try {
      console.log('🔄 Running self-improvement analysis...');
      const improvementResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/learning/dynamic-scoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'optimize_parameters',
          performance_data: results
        })
      });

      if (improvementResponse.ok) {
        const improvementData = await improvementResponse.json();
        results.pipeline_runs.push({
          step: 'self_improvement',
          success: true,
          data: improvementData
        });
        console.log('✅ Self-improvement: Algorithm parameters optimized');
      }
    } catch (error) {
      results.errors.push(`Self-improvement error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Self-improvement failed:', error);
    }

    const successfulRuns = results.pipeline_runs.filter(run => run.success).length;
    const totalRuns = results.pipeline_runs.length;

    console.log(`🎯 Pipeline complete: ${successfulRuns}/${totalRuns} steps successful`);
    console.log(`📈 Total discoveries: ${results.total_discoveries}, Updates: ${results.total_updates}`);

    return NextResponse.json({
      success: true,
      message: `Korean beauty intelligence pipeline completed successfully`,
      results,
      summary: {
        successful_steps: successfulRuns,
        total_steps: totalRuns,
        discoveries: results.total_discoveries,
        updates: results.total_updates,
        error_count: results.errors.length
      }
    });

  } catch (error) {
    console.error('❌ Intelligence pipeline failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also allow POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}