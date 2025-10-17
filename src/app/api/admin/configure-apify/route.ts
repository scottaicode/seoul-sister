import { NextRequest, NextResponse } from 'next/server'
import { createApifyMonitor } from '@/lib/services/apify-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey, testInfluencer = 'ponysmakeup' } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    console.log('🔑 Testing Apify API key configuration...')

    // Test the API key by creating a monitor instance
    try {
      // Temporarily set the API key for testing
      process.env.APIFY_API_KEY = apiKey

      const monitor = createApifyMonitor()

      // Test with a small scrape
      const testResult = await monitor.scrapeInstagramInfluencer(testInfluencer, {
        maxPosts: 5,
        includeReels: true
      })

      if (testResult.success && testResult.data.length > 0) {
        console.log(`✅ Apify API key working! Scraped ${testResult.data.length} posts from @${testInfluencer}`)

        return NextResponse.json({
          success: true,
          message: 'Apify API key is working correctly',
          data: {
            apiKeyValid: true,
            testInfluencer,
            postsScraped: testResult.data.length,
            samplePost: testResult.data[0] ? {
              caption: testResult.data[0].caption?.substring(0, 100) + '...',
              likes: testResult.data[0].metrics.likes,
              platform: testResult.data[0].platform
            } : null
          }
        })
      } else {
        console.error('❌ Apify test failed:', testResult.error)
        return NextResponse.json({
          success: false,
          message: 'Apify API key validation failed',
          error: testResult.error || 'No data returned from test scrape'
        }, { status: 422 })
      }

    } catch (testError) {
      console.error('❌ Apify API key test error:', testError)
      return NextResponse.json({
        success: false,
        message: 'Failed to test Apify API key',
        error: testError instanceof Error ? testError.message : String(testError)
      }, { status: 422 })
    }

  } catch (error) {
    console.error('❌ Apify configuration API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to configure Apify API key',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Check current Apify configuration status
  const hasApiKey = !!process.env.APIFY_API_KEY

  return NextResponse.json({
    configured: hasApiKey,
    apiKeyPresent: hasApiKey,
    message: hasApiKey
      ? 'Apify API key is configured'
      : 'Apify API key needs to be set in environment variables',
    nextSteps: hasApiKey
      ? ['API key is ready', 'Run intelligence cycle to test full flow']
      : [
          'Get your Apify API key from https://console.apify.com/account/integrations',
          'Set APIFY_API_KEY in your .env.local file',
          'Or use the POST endpoint to test your key'
        ]
  })
}