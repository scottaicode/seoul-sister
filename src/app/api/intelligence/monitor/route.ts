import { NextRequest, NextResponse } from 'next/server'
import { createIntelligenceOrchestrator } from '@/lib/services/intelligence-orchestrator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      influencers,
      maxContentPerInfluencer = 10,
      includeTranscription = true,
      generateTrendReport = true
    } = body

    console.log('🚀 Starting Korean Beauty Intelligence monitoring cycle')

    const orchestrator = createIntelligenceOrchestrator()

    const result = await orchestrator.runIntelligenceCycle({
      influencers,
      maxContentPerInfluencer,
      includeTranscription,
      generateTrendReport
    })

    if (!result.success) {
      return NextResponse.json(
        { error: 'Intelligence cycle failed', details: result.error },
        { status: 500 }
      )
    }

    console.log(`✅ Intelligence cycle completed: ${result.summary.contentScraped} content pieces analyzed`)

    return NextResponse.json({
      success: true,
      message: 'Intelligence monitoring cycle completed successfully',
      data: result
    })

  } catch (error) {
    console.error('❌ Intelligence monitoring API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to run intelligence monitoring',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') as 'daily' | 'weekly' | 'monthly' || 'weekly'

    const orchestrator = createIntelligenceOrchestrator()
    const dashboardData = await orchestrator.getDashboardData(timeframe)

    return NextResponse.json({
      success: true,
      data: dashboardData,
      timeframe
    })

  } catch (error) {
    console.error('❌ Dashboard data API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve dashboard data',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}