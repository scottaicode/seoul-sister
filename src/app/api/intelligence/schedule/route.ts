import { NextRequest, NextResponse } from 'next/server'
import { createIntelligenceOrchestrator } from '@/lib/services/intelligence-orchestrator'

export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal/cron request or admin manual trigger
    const isVercelCron = request.headers.get('user-agent')?.includes('vercel')
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isManualAdmin = request.headers.get('referer')?.includes('/intelligence/enhanced')

    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}` && !isManualAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tier from query params for scheduled runs
    const { searchParams } = new URL(request.url)
    const tier = (searchParams.get('tier') || 'all') as 'mega' | 'rising' | 'niche' | 'all'

    console.log(`🕒 Starting scheduled Korean Beauty Intelligence cycle - Tier: ${tier}`)

    const orchestrator = createIntelligenceOrchestrator()
    console.log(`✅ Intelligence orchestrator created successfully`)

    // Validate tier parameter
    const validTiers = ['mega', 'rising', 'niche', 'all']
    if (!validTiers.includes(tier)) {
      return NextResponse.json(
        { error: `Invalid tier: ${tier}. Must be one of: ${validTiers.join(', ')}` },
        { status: 400 }
      )
    }

    // Set parameters for unified daily scraping
    const maxContentPerInfluencer = tier === 'all' ? 15 :
                                   tier === 'mega' ? 20 :
                                   tier === 'rising' ? 15 : 10
    const generateTrendReport = tier === 'all' || tier === 'mega'

    console.log(`📊 Intelligence cycle configuration:`)
    console.log(`   - Tier: ${tier}`)
    console.log(`   - Max content per influencer: ${maxContentPerInfluencer}`)
    console.log(`   - Generate trend report: ${generateTrendReport}`)

    // Run intelligence cycle for all influencers
    const result = await orchestrator.runIntelligenceCycle({
      tier,
      scheduleSlot: 'all',
      maxContentPerInfluencer,
      includeTranscription: true,
      generateTrendReport
    })

    console.log(`📈 Intelligence cycle result:`, {
      success: result.success,
      influencersMonitored: result.summary?.influencersMonitored,
      contentScraped: result.summary?.contentScraped,
      error: result.error
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

    const nextRunMessage = tier === 'all'
      ? 'Next run: Tomorrow at 9:00 AM Pacific (16:00 UTC)'
      : tier === 'mega' ? 'rising at 2:00 PM KST' :
        tier === 'rising' ? 'niche at 10:00 PM KST' :
        'mega at 6:30 AM KST tomorrow'

    return NextResponse.json({
      success: true,
      message: `Daily Korean beauty intelligence cycle completed successfully`,
      data: result,
      timestamp: new Date().toISOString(),
      tier,
      schedule: 'Once daily at 9:00 AM Pacific (16:00 UTC)',
      nextRun: nextRunMessage
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