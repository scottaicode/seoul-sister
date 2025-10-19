import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('⏰ Starting scheduled Instagram intelligence storage pipeline...')

    // Verify authorization header for Vercel Cron or use secret parameter for external cron
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const cronSecret = searchParams.get('secret')

    // Allow Vercel Cron (has Bearer token) or manual triggers with secret
    const isVercelCron = authHeader?.startsWith('Bearer ')
    const isAuthorizedSecret = cronSecret && cronSecret === process.env.CRON_SECRET

    if (!isVercelCron && !isAuthorizedSecret) {
      console.error('❌ Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid credentials' },
        { status: 401 }
      )
    }

    // Trigger the Instagram data storage pipeline
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'

    console.log('🚀 Triggering Instagram data storage pipeline...')
    const storageResponse = await fetch(`${baseUrl}/api/intelligence/store-instagram-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Seoul-Sister-Cron/1.0'
      }
    })

    if (!storageResponse.ok) {
      const errorData = await storageResponse.text()
      console.error('❌ Storage pipeline failed:', errorData)

      return NextResponse.json({
        success: false,
        error: 'Instagram storage pipeline failed',
        details: errorData,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    const storageResult = await storageResponse.json()
    console.log('✅ Instagram storage pipeline completed successfully')

    // Log the results for monitoring
    const results = storageResult.results || {}
    console.log(`📊 Pipeline Results:`)
    console.log(`   • Apify data fetched: ${results.apifyDataFetched || 0}`)
    console.log(`   • Valid posts processed: ${results.validPostsProcessed || 0}`)
    console.log(`   • Posts stored in database: ${results.postsStoredInDatabase || 0}`)
    console.log(`   • Transcription records created: ${results.transcriptionRecordsCreated || 0}`)
    console.log(`   • Influencers updated: ${results.influencersUpdated || 0}`)

    // Check if we should trigger additional analysis
    let additionalAnalysis = null
    if (results.postsStoredInDatabase > 0) {
      try {
        console.log('🧠 Triggering trend analysis for newly stored content...')

        // You could add a trend analysis endpoint call here
        const analysisResponse = await fetch(`${baseUrl}/api/intelligence/analyze-trends`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'cron_instagram_storage',
            newContentCount: results.postsStoredInDatabase
          })
        })

        if (analysisResponse.ok) {
          additionalAnalysis = await analysisResponse.json()
          console.log('✅ Trend analysis completed')
        }
      } catch (analysisError) {
        console.warn('⚠️ Trend analysis failed, continuing:', analysisError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Scheduled Instagram intelligence storage completed',
      pipeline: 'instagram_data_storage',
      executedAt: new Date().toISOString(),
      results: {
        storageResults: results,
        additionalAnalysis: additionalAnalysis ? 'completed' : 'skipped',
        performance: {
          totalProcessingTime: 'calculated_in_storage_pipeline',
          dataQuality: results.postsStoredInDatabase > 0 ? 'good' : 'needs_attention',
          influencerCoverage: `${results.influencersUpdated || 0} influencers updated`
        }
      },
      nextScheduledRun: 'Based on your cron configuration',
      recommendations: generateRecommendations(results)
    })

  } catch (error) {
    console.error('❌ Scheduled Instagram intelligence storage failed:', error)

    return NextResponse.json({
      success: false,
      error: 'Scheduled Instagram intelligence storage failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      pipeline: 'instagram_data_storage'
    }, { status: 500 })
  }
}

function generateRecommendations(results: any): string[] {
  const recommendations: string[] = []

  if (!results.postsStoredInDatabase || results.postsStoredInDatabase === 0) {
    recommendations.push('No new posts stored - check Apify scheduled runs and influencer activity')
  }

  if (results.unmatchedInfluencers > 5) {
    recommendations.push('Many unmatched influencers found - consider adding new influencers to tracking list')
  }

  if (results.validPostsProcessed > 0 && results.postsStoredInDatabase === 0) {
    recommendations.push('Valid posts found but none stored - check database schema and influencer matching')
  }

  if (results.transcriptionRecordsCreated === 0 && results.postsStoredInDatabase > 0) {
    recommendations.push('No transcription records created - video content may need manual review')
  }

  if (recommendations.length === 0) {
    recommendations.push('Pipeline running smoothly - continue monitoring for optimal performance')
  }

  return recommendations
}

// Simple health check for the cron endpoint
export async function POST(request: NextRequest) {
  return NextResponse.json({
    endpoint: 'GET /api/cron/store-instagram-intelligence',
    purpose: 'Scheduled Instagram data storage from Apify to Supabase',
    requiredParams: {
      secret: 'CRON_SECRET environment variable'
    },
    schedule: 'Configure in your cron service (Vercel Cron, GitHub Actions, etc.)',
    example: 'GET /api/cron/store-instagram-intelligence?secret=your_cron_secret'
  })
}