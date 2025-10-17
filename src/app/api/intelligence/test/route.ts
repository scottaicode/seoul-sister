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
      // Test basic Apify connection
      try {
        const apiKey = process.env.APIFY_API_KEY

        if (!apiKey) {
          throw new Error('APIFY_API_KEY not configured')
        }

        // Test basic Apify API connectivity
        const response = await fetch('https://api.apify.com/v2/acts', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })

        if (!response.ok) {
          throw new Error(`Apify API returned ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        return NextResponse.json({
          success: true,
          service: 'Apify',
          testType: 'api_connectivity',
          availableActors: data.data?.length || 0,
          message: 'Apify API connectivity test successful'
        })

      } catch (error) {
        console.error('Apify test failed:', error)
        return NextResponse.json({
          success: false,
          service: 'Apify',
          error: error instanceof Error ? error.message : String(error),
          message: 'Apify API test failed'
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
  // Return test interface for manual testing
  return NextResponse.json({
    message: 'Seoul Sister Intelligence System Test API',
    availableTests: {
      supadata: {
        description: 'Test video transcription with SupaData API',
        method: 'POST',
        body: { testType: 'supadata', data: { videoUrl: 'https://youtube.com/watch?v=sample' } }
      },
      apify: {
        description: 'Test Apify API connectivity and available actors',
        method: 'POST',
        body: { testType: 'apify', data: {} }
      },
      claude: {
        description: 'Test Claude Opus 4.1 AI trend analysis',
        method: 'POST',
        body: { testType: 'claude', data: {} }
      }
    },
    usage: 'POST /api/intelligence/test with { testType: "supadata|apify|claude", data: {} }'
  })
}