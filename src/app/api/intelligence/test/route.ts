import { NextRequest, NextResponse } from 'next/server'
import { createSupaDataService } from '@/lib/services/supadata-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testType, data } = body

    console.log(`🧪 Testing ${testType} with Seoul Sister Intelligence System`)

    if (testType === 'supadata') {
      // Test SupaData API connection
      try {
        const supaDataService = createSupaDataService()

        // Test with a sample video URL or text
        const testUrl = data.videoUrl || 'https://www.youtube.com/watch?v=sample'

        console.log(`Testing SupaData transcription for: ${testUrl}`)

        const result = await supaDataService.transcribeVideo({
          videoUrl: testUrl,
          language: 'auto',
          includeTimestamps: true
        })

        return NextResponse.json({
          success: true,
          service: 'SupaData',
          testType: 'video_transcription',
          result: result,
          message: 'SupaData API test completed'
        })

      } catch (error) {
        console.error('SupaData test failed:', error)
        return NextResponse.json({
          success: false,
          service: 'SupaData',
          error: error instanceof Error ? error.message : String(error),
          message: 'SupaData API test failed'
        }, { status: 500 })
      }
    }

    if (testType === 'apify') {
      // Test Apify scraping with premium actor
      try {
        const { createApifyMonitor } = await import('@/lib/services/apify-service')
        const monitor = createApifyMonitor()

        // Test premium Instagram scraping with a known influencer
        const testInfluencer = data.influencer || 'ponysmakeup'
        console.log(`🔍 Testing Apify premium scraping for @${testInfluencer}`)

        const result = await monitor.scrapeInstagramInfluencer(testInfluencer, {
          maxPosts: 5,
          includeReels: true
        })

        return NextResponse.json({
          success: result.success,
          service: 'Apify Premium',
          testType: 'instagram_scraping',
          influencer: testInfluencer,
          totalScraped: result.totalScraped,
          sampleData: result.data.slice(0, 2), // Return first 2 posts as sample
          error: result.error,
          message: result.success
            ? `Successfully scraped ${result.totalScraped} posts from @${testInfluencer}`
            : `Failed to scrape from @${testInfluencer}: ${result.error}`
        })

      } catch (error) {
        console.error('Apify scraping test failed:', error)
        return NextResponse.json({
          success: false,
          service: 'Apify',
          error: error instanceof Error ? error.message : String(error),
          message: 'Apify scraping test failed'
        }, { status: 500 })
      }
    }

    if (testType === 'claude') {
      // Test Claude Opus 4.1 integration
      try {
        const { createAITrendAnalyzer } = await import('@/lib/services/ai-trend-analyzer')
        const analyzer = createAITrendAnalyzer()

        const sampleContent = [{
          platform: 'instagram',
          caption: 'Testing Seoul Sister AI intelligence with Korean beauty trends',
          hashtags: ['#kbeauty', '#seoul', '#skincare'],
          transcription: 'Sample Korean beauty content for testing AI analysis',
          authorHandle: 'test_influencer',
          metrics: { likes: 100, views: 1000, comments: 20 },
          publishedAt: new Date().toISOString()
        }]

        const analysis = await analyzer.analyzeTrends({
          content: sampleContent,
          timeframe: 'daily',
          focusArea: 'all'
        })

        return NextResponse.json({
          success: true,
          service: 'Claude Opus 4.1',
          testType: 'ai_trend_analysis',
          analysis: {
            trendsIdentified: analysis.emergingTrends.length,
            productIntelligence: analysis.productIntelligence.length,
            confidenceScore: analysis.summary.confidenceScore
          },
          message: 'Claude Opus 4.1 AI analysis test successful'
        })

      } catch (error) {
        console.error('Claude AI test failed:', error)
        return NextResponse.json({
          success: false,
          service: 'Claude Opus 4.1',
          error: error instanceof Error ? error.message : String(error),
          message: 'Claude AI test failed'
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      error: 'Invalid test type. Use: supadata, apify, or claude',
      availableTests: ['supadata', 'apify', 'claude']
    }, { status: 400 })

  } catch (error) {
    console.error('❌ Intelligence test API error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const testResults: any = {
    timestamp: new Date().toISOString(),
    tests: []
  }

  // Test 1: Environment Variables
  testResults.tests.push({
    name: 'Environment Variables',
    status: 'passed',
    details: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      APIFY_API_KEY: !!process.env.APIFY_API_KEY,
      SUPADATA_API_KEY: !!process.env.SUPADATA_API_KEY
    }
  })

  // Test 2: Supabase Connection
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (!supabaseAdmin) {
      testResults.tests.push({
        name: 'Supabase Connection',
        status: 'failed',
        error: 'supabaseAdmin not initialized'
      })
    } else {
      const { data, error } = await supabaseAdmin
        .from('beauty_intelligence_reports')
        .select('id')
        .limit(1)

      testResults.tests.push({
        name: 'Supabase Connection',
        status: error ? 'failed' : 'passed',
        error: error?.message,
        details: { hasData: !!data?.length }
      })
    }
  } catch (error) {
    testResults.tests.push({
      name: 'Supabase Connection',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    })
  }

  // Test 3: Korean Influencers Config
  try {
    const { getInfluencersByTier } = await import('@/lib/config/korean-influencers')
    const megaInfluencers = getInfluencersByTier('mega')
    const risingInfluencers = getInfluencersByTier('rising')
    const nicheInfluencers = getInfluencersByTier('niche')

    testResults.tests.push({
      name: 'Korean Influencers Config',
      status: 'passed',
      details: {
        megaCount: megaInfluencers.length,
        risingCount: risingInfluencers.length,
        nicheCount: nicheInfluencers.length,
        total: megaInfluencers.length + risingInfluencers.length + nicheInfluencers.length,
        sampleMega: megaInfluencers.slice(0, 2).map(i => ({ handle: i.handle, platform: i.platform }))
      }
    })
  } catch (error) {
    testResults.tests.push({
      name: 'Korean Influencers Config',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    })
  }

  // Test 4: Intelligence Orchestrator Creation
  try {
    const { createIntelligenceOrchestrator } = await import('@/lib/services/intelligence-orchestrator')
    const orchestrator = createIntelligenceOrchestrator()

    testResults.tests.push({
      name: 'Intelligence Orchestrator',
      status: 'passed',
      details: { created: !!orchestrator }
    })
  } catch (error) {
    testResults.tests.push({
      name: 'Intelligence Orchestrator',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    })
  }

  // Test 5: Service Dependencies
  const services = ['apify-service', 'supadata-service', 'ai-trend-analyzer', 'content-manager', 'ai-content-summarizer']
  for (const service of services) {
    try {
      await import(`@/lib/services/${service}`)
      testResults.tests.push({
        name: `Service: ${service}`,
        status: 'passed'
      })
    } catch (error) {
      testResults.tests.push({
        name: `Service: ${service}`,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // Overall status
  const failedTests = testResults.tests.filter((t: any) => t.status === 'failed')
  testResults.overallStatus = failedTests.length === 0 ? 'passed' : 'failed'
  testResults.summary = {
    total: testResults.tests.length,
    passed: testResults.tests.filter((t: any) => t.status === 'passed').length,
    failed: failedTests.length
  }

  testResults.recommendations = []
  if (failedTests.length > 0) {
    testResults.recommendations.push('🔧 Fix failed services before running intelligence cycles')
    if (failedTests.some((t: any) => t.name.includes('Supabase'))) {
      testResults.recommendations.push('📡 Check Supabase connection and environment variables')
    }
    if (failedTests.some((t: any) => t.name.includes('Service'))) {
      testResults.recommendations.push('📦 Some service dependencies are missing or have import errors')
    }
  } else {
    testResults.recommendations.push('✅ All services are working - intelligence monitoring should function correctly')
  }

  return NextResponse.json(testResults, {
    status: testResults.overallStatus === 'passed' ? 200 : 500
  })
}