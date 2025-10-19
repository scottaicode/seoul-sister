import { NextRequest, NextResponse } from 'next/server'
import { ApifyClient } from 'apify-client'

export async function POST(request: NextRequest) {
  try {
    const { username, maxPosts = 10 } = await request.json()

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const apiKey = process.env.APIFY_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'Apify API key not configured in environment variables'
      }, { status: 500 })
    }

    console.log(`🔍 Testing Instagram scraping for @${username} (${maxPosts} posts)`)

    // Initialize Apify client properly as per documentation
    const client = new ApifyClient({
      token: apiKey,
    })

    console.log('🎯 Testing multiple Instagram actors to find working configuration')

    let result = null
    let actorUsed = 'none'

    // Try the premium actor first (same as portal)
    try {
      console.log('🔄 Attempting premium actor (shu8hvrXbJbY3Eb9W)...')
      const input = {
        usernames: [username],
        resultsLimit: maxPosts,
        includeStories: false,
        includeReels: true,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      }

      console.log('📋 Premium actor input:', JSON.stringify(input, null, 2))

      // Use the exact pattern from official docs with better error handling
      try {
        // Start the actor and wait for it to finish
        const run = await client.actor('shu8hvrXbJbY3Eb9W').call(input)

        // The call() method already waits for completion by default

        console.log(`🎯 Actor run completed with status: ${run.status}`)
        console.log(`📊 Run stats:`, JSON.stringify({
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          defaultDatasetId: run.defaultDatasetId
        }, null, 2))

        if (!run.defaultDatasetId) {
          throw new Error(`No dataset created. Run status: ${run.status}`)
        }

        const { items } = await client.dataset(run.defaultDatasetId).listItems()

        console.log(`📦 Dataset ${run.defaultDatasetId} contains ${items.length} items`)

        // Check if we got real data or error objects
        const hasValidData = items.some((item: any) => !item.error && (item.id || item.shortcode))
        if (hasValidData) {
          result = { items, actorUsed: 'premium' }
          actorUsed = 'premium'
        } else {
          console.log(`⚠️ Premium actor returned ${items.length} error objects`)
          throw new Error('Premium actor returned error objects')
        }
      } catch (actorError) {
        console.error(`❌ Premium actor execution failed:`, actorError)
        throw actorError
      }
    } catch (premiumError) {
      console.log(`⚠️ Premium actor failed: ${premiumError}`)

      // Try basic Instagram scraper as fallback
      try {
        console.log('🔄 Attempting basic actor (apify/instagram-scraper)...')
        const basicInput = {
          username: [username], // Note: different parameter name
          resultsLimit: maxPosts,
          resultsType: 'posts'
        }

        console.log('📋 Basic actor input:', JSON.stringify(basicInput, null, 2))
        const { defaultDatasetId } = await client.actor('apify/instagram-scraper').call(basicInput)
        const { items } = await client.dataset(defaultDatasetId).listItems()

        console.log(`✅ Basic actor returned ${items.length} items`)
        if (items.length > 0) {
          console.log('🔍 Basic result sample:', JSON.stringify(items[0], null, 2))
        }

        const hasValidData = items.some((item: any) => !item.error && (item.id || item.shortcode))
        if (hasValidData) {
          result = { items, actorUsed: 'basic' }
          actorUsed = 'basic'
        } else {
          result = { items, actorUsed: 'basic-with-errors' }
          actorUsed = 'basic-with-errors'
        }
      } catch (basicError) {
        console.log(`❌ Basic actor also failed: ${basicError}`)
        throw new Error(`Both actors failed: Premium - ${premiumError}, Basic - ${basicError}`)
      }
    }

    if (!result) {
      throw new Error('No valid results from any actor')
    }

    console.log(`📋 Final scraping result using ${actorUsed}: ${result.items.length} items`)
    const finalResult = result.items || []

    console.log(`📦 Retrieved ${finalResult.length} items from dataset`)
    if (finalResult.length > 0) {
      console.log('🔍 First item sample:', JSON.stringify(finalResult[0], null, 2))
    }

    if (!finalResult || finalResult.length === 0) {
      return NextResponse.json({
        error: 'Instagram scraping returned no results',
        details: 'Apify actor completed successfully but returned 0 posts. This may be due to Instagram rate limiting or account privacy settings.',
        debugInfo: {
          actorUsed: actorUsed,
          itemsRetrieved: finalResult?.length || 0
        }
      }, { status: 200 }) // Use 200 since the API worked, just no results
    }

    // Process results into clean format for the UI
    const processedPosts = finalResult.map((item: any) => {
      // Extract hashtags from caption
      const hashtags = item.caption ?
        (item.caption.match(/#[\w가-힣]+/g) || []).map((tag: string) => tag.substring(1)) : []

      return {
        id: item.id || item.shortcode || '',
        shortCode: item.shortcode || item.shortCode || '',
        url: item.url || `https://instagram.com/p/${item.shortcode || item.id}`,
        displayUrl: item.displayUrl || item.images?.[0] || '',
        caption: item.caption || item.text || '',
        hashtags: hashtags,
        likesCount: item.likesCount || item.likes || 0,
        commentsCount: item.commentsCount || item.comments || 0,
        timestamp: item.timestamp || item.time || new Date().toISOString(),
        ownerUsername: item.ownerUsername || item.username || username,
        videoUrl: item.videoUrl || item.video,
        isVideo: Boolean(item.videoUrl || item.video || item.type === 'Video')
      }
    }).filter((post: any) => post.id || post.shortCode) // Remove invalid posts

    console.log(`🎯 Processed ${processedPosts.length} valid posts`)

    return NextResponse.json({
      success: true,
      username,
      posts: processedPosts,
      totalPosts: processedPosts.length,
      runId: `apify-client-${Date.now()}`,
      message: `Successfully scraped ${processedPosts.length} posts from @${username}`,
      timestamp: new Date().toISOString(),
      debugInfo: {
        actorUsed: actorUsed,
        rawItems: finalResult.length,
        processedPosts: processedPosts.length,
        investigation: {
          portalWorking: true,
          apiBlocked: true,
          possibleCauses: [
            'API token has "Leaked" status limiting functionality',
            'Portal environment bypasses Instagram restrictions',
            'API calls use different IP/fingerprinting than portal',
            'Instagram systematic blocking of API-based scraping'
          ]
        }
      }
    })

  } catch (error) {
    console.error('❌ Test Apify error:', error)
    return NextResponse.json({
      error: 'Instagram scraping test failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Apify Instagram Scraping Test API',
    endpoints: {
      'POST /api/test-apify': 'Test Instagram scraping with username and maxPosts'
    },
    usage: {
      method: 'POST',
      body: {
        username: 'string (required)',
        maxPosts: 'number (optional, default: 10)'
      }
    }
  })
}