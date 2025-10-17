import { NextRequest, NextResponse } from 'next/server'
import { createIntelligenceOrchestrator } from '@/lib/services/intelligence-orchestrator'

export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal/cron request (Vercel cron jobs are authenticated automatically)
    const isVercelCron = request.headers.get('user-agent')?.includes('vercel')
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tier from query params for scheduled runs
    const { searchParams } = new URL(request.url)
    const tier = searchParams.get('tier') as 'mega' | 'rising' | 'niche' || 'all'

    console.log(`🕒 Starting scheduled Korean Beauty Intelligence cycle - Tier: ${tier}`)

    const orchestrator = createIntelligenceOrchestrator()

    // Run tier-specific intelligence cycle based on schedule
    const result = await orchestrator.runIntelligenceCycle({
      tier,
      scheduleSlot: 'all',
      maxContentPerInfluencer: tier === 'mega' ? 20 : tier === 'rising' ? 15 : 10,
      includeTranscription: true,
      generateTrendReport: tier === 'mega' // Only generate full report for mega-influencers
    })

    if (!result.success) {
      console.error('❌ Scheduled intelligence cycle failed:', result.error)
      return NextResponse.json(
        {
          error: 'Scheduled intelligence cycle failed',
          details: result.error,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }

    console.log(`✅ Scheduled intelligence cycle completed successfully`)
    console.log(`📊 Results: ${result.summary.influencersMonitored} influencers, ${result.summary.contentScraped} content pieces`)

    return NextResponse.json({
      success: true,
      message: `Scheduled Korean beauty intelligence cycle completed - ${tier} tier`,
      data: result,
      timestamp: new Date().toISOString(),
      tier,
      nextTierRun: tier === 'mega' ? 'rising at 2:00 PM KST' :
                   tier === 'rising' ? 'niche at 10:00 PM KST' :
                   'mega at 6:30 AM KST tomorrow'
    })

  } catch (error) {
    console.error('❌ Scheduled intelligence API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to run scheduled intelligence monitoring',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    const orchestrator = createIntelligenceOrchestrator()
    const dashboardData = await orchestrator.getDashboardData('daily')

    return NextResponse.json({
      success: true,
      status: 'Intelligence scheduler healthy',
      lastUpdate: dashboardData.overview.lastUpdate,
      totalInfluencers: dashboardData.overview.totalInfluencers,
      totalContent: dashboardData.overview.totalContent,
      activeTrends: dashboardData.overview.activeTrends,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Intelligence scheduler health check failed:', error)
    return NextResponse.json(
      {
        error: 'Intelligence scheduler unhealthy',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}