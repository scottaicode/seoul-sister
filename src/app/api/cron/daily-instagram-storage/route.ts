import { NextRequest, NextResponse } from 'next/server'

// Daily 9:10 AM Pacific cron job to store new Instagram content (10 minutes after Apify scrape)
export async function GET(request: NextRequest) {
  try {
    console.log('🌅 Daily 9:10 AM Pacific Instagram storage cron job started')

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://seoulsister.com'

    // Store only new posts from the latest daily run (economic approach)
    const storageResponse = await fetch(`${baseUrl}/api/intelligence/store-instagram-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'daily' // Only process latest run for new posts
      })
    })

    if (!storageResponse.ok) {
      const errorData = await storageResponse.json()
      console.error('❌ Daily storage failed:', errorData)
      return NextResponse.json({
        success: false,
        error: 'Daily storage pipeline failed',
        details: errorData,
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }

    const storageResult = await storageResponse.json()
    console.log(`✅ Daily storage completed: ${storageResult.results?.postsStoredInDatabase || 0} new posts stored`)

    // Also trigger alerts check for new content
    if (storageResult.success && storageResult.results?.postsStoredInDatabase > 0) {
      try {
        const alertResponse = await fetch(`${baseUrl}/api/intelligence/check-alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            checkAll: false, // Only check new content
            contentIds: storageResult.results.newContentIds || []
          })
        })

        if (alertResponse.ok) {
          const alertResult = await alertResponse.json()
          console.log(`🔔 Alerts checked: ${alertResult.alertsTriggered || 0} alerts triggered`)
        }
      } catch (alertError) {
        console.warn('⚠️ Alert checking failed, but storage succeeded:', alertError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily Instagram storage completed successfully',
      timestamp: new Date().toISOString(),
      results: storageResult.results,
      cronJob: 'daily-instagram-storage',
      schedule: '9:10 AM Pacific daily (10 min after Apify scrape)'
    })

  } catch (error) {
    console.error('❌ Daily storage cron job failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Daily storage cron job failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST method for manual triggering
export async function POST(request: NextRequest) {
  console.log('🔧 Manual trigger of daily Instagram storage')
  return GET(request)
}