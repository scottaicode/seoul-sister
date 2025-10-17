import { NextRequest, NextResponse } from 'next/server'
import { createIntelligenceOrchestrator } from '@/lib/services/intelligence-orchestrator'

export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal/cron request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'seoul-sister-intelligence-2024'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🕒 Starting scheduled Korean Beauty Intelligence cycle...')

    const orchestrator = createIntelligenceOrchestrator()

    // Run full intelligence cycle (all tiers)
    const result = await orchestrator.runIntelligenceCycle({
      tier: 'all',
      scheduleSlot: 'all',
      maxContentPerInfluencer: 15,
      includeTranscription: true,
      generateTrendReport: true
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
      message: 'Scheduled Korean beauty intelligence cycle completed',
      data: result,
      timestamp: new Date().toISOString(),
      nextRun: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours from now
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