import { NextRequest, NextResponse } from 'next/server'
import { createIntelligenceOrchestrator } from '@/lib/services/intelligence-orchestrator'
import {
  getInfluencersByTier,
  getInfluencersBySchedule,
  getAllMonitoredInfluencers,
  MONITORING_SCHEDULE
} from '@/lib/config/korean-influencers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      tier = 'all', // 'mega', 'rising', 'niche', or 'all'
      scheduleSlot = 'all', // 'morning', 'afternoon', 'evening', or 'all'
      maxContentPerInfluencer = 15,
      includeTranscription = true,
      generateTrendReport = true,
      enableCrossPlatformValidation = true
    } = body

    console.log(`🚀 Starting Premium Korean Beauty Intelligence - Tier: ${tier}, Schedule: ${scheduleSlot}`)

    const orchestrator = createIntelligenceOrchestrator()

    // Run premium intelligence cycle with tier-based strategy
    const result = await orchestrator.runIntelligenceCycle({
      tier,
      scheduleSlot,
      maxContentPerInfluencer,
      includeTranscription,
      generateTrendReport
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Premium intelligence cycle failed',
          details: result.error,
          tier,
          scheduleSlot
        },
        { status: 500 }
      )
    }

    console.log(`✅ Premium intelligence cycle completed successfully`)
    console.log(`📊 Results: ${result.summary.influencersMonitored} influencers, ${result.summary.contentScraped} content pieces`)

    return NextResponse.json({
      success: true,
      message: 'Premium Korean beauty intelligence cycle completed',
      strategy: {
        tier,
        scheduleSlot,
        crossPlatformValidation: enableCrossPlatformValidation
      },
      data: result,
      premiumFeatures: {
        intelligenceScoring: true,
        duplicatePrevention: true,
        crossPlatformValidation: true,
        tierBasedMonitoring: true,
        premiumActors: true
      }
    })

  } catch (error) {
    console.error('❌ Premium intelligence API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to run premium intelligence monitoring',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tier = searchParams.get('tier') as 'mega' | 'rising' | 'niche' | null
    const scheduleSlot = searchParams.get('scheduleSlot') as 'morning' | 'afternoon' | 'evening' | null

    let influencers = []
    let schedule = null

    if (tier) {
      influencers = getInfluencersByTier(tier)
    } else if (scheduleSlot) {
      influencers = getInfluencersBySchedule(scheduleSlot)
      schedule = MONITORING_SCHEDULE[scheduleSlot]
    } else {
      influencers = getAllMonitoredInfluencers()
    }

    // Get dashboard data from orchestrator
    const orchestrator = createIntelligenceOrchestrator()
    const dashboardData = await orchestrator.getDashboardData('weekly')

    return NextResponse.json({
      success: true,
      configuration: {
        totalInfluencers: influencers.length,
        tiers: {
          mega: influencers.filter(i => i.tier === 'mega').length,
          rising: influencers.filter(i => i.tier === 'rising').length,
          niche: influencers.filter(i => i.tier === 'niche').length
        },
        platforms: {
          instagram: influencers.filter(i => i.platform === 'instagram').length,
          tiktok: influencers.filter(i => i.platform === 'tiktok').length
        },
        monitoringSchedule: schedule
      },
      influencers: influencers.map(inf => ({
        name: inf.name,
        handle: inf.handle,
        platform: inf.platform,
        tier: inf.tier,
        followers: inf.followers,
        specialty: inf.specialty,
        priority: inf.priority,
        scheduleSlot: inf.scheduleSlot
      })),
      dashboard: dashboardData,
      premiumFeatures: [
        'Premium Apify actors with residential proxies',
        '12-influencer tier-based monitoring strategy',
        'Seoul Sister Intelligence Scoring algorithm',
        'Cross-platform trend validation (Instagram + TikTok)',
        'Smart duplicate prevention and content filtering',
        'Advanced video transcription with SupaData',
        'Real-time Korean beauty trend analysis'
      ]
    })

  } catch (error) {
    console.error('❌ Premium intelligence configuration API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve premium intelligence configuration',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}