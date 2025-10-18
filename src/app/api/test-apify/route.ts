import { NextRequest, NextResponse } from 'next/server'

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

    // Use the premium Instagram scraper actor ID from your Apify console
    const actorId = 'shu8hvrXbJbY3Eb9W'

    const runInput = {
      usernames: [username],
      resultsType: 'posts',
      resultsLimit: maxPosts,
      searchType: 'user',
      addParentData: false
    }

    console.log('📋 Actor input:', JSON.stringify(runInput, null, 2))

    // Start the actor run
    const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(runInput)
    })

    if (!runResponse.ok) {
      const errorText = await runResponse.text()
      console.error('❌ Apify run failed:', runResponse.status, errorText)
      return NextResponse.json({
        error: `Apify API error: ${runResponse.status} - ${errorText}`,
        details: 'Check your API key and actor permissions'
      }, { status: 500 })
    }

    const runData = await runResponse.json()
    const runId = runData.data.id

    console.log(`⏳ Actor run started with ID: ${runId}`)

    // Wait for the run to complete with polling
    const maxWaitTime = 120000 // 2 minutes
    const pollInterval = 3000   // 3 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      // Check run status
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })

      if (!statusResponse.ok) {
        console.error('❌ Status check failed:', statusResponse.status)
        break
      }

      const statusData = await statusResponse.json()
      const status = statusData.data.status

      console.log(`📊 Run ${runId} status: ${status}`)

      if (status === 'SUCCEEDED') {
        // Get the results
        const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })

        if (!resultsResponse.ok) {
          console.error('❌ Results fetch failed:', resultsResponse.status)
          return NextResponse.json({
            error: 'Failed to fetch results from Apify'
          }, { status: 500 })
        }

        const rawResults = await resultsResponse.json()
        console.log(`✅ Raw results received:`, rawResults.length, 'items')

        // Process results into clean format
        const processedPosts = rawResults.map((item: any) => {
          // Handle different result formats from Apify
          const post = item.posts ? item.posts[0] : item

          // Extract hashtags from caption
          const hashtags = post.caption ?
            (post.caption.match(/#[\w가-힣]+/g) || []).map((tag: string) => tag.substring(1)) : []

          return {
            id: post.id || post.shortcode || '',
            shortCode: post.shortcode || post.shortCode || '',
            url: post.url || `https://instagram.com/p/${post.shortcode}`,
            displayUrl: post.displayUrl || post.images?.[0] || '',
            caption: post.caption || post.text || '',
            hashtags: hashtags,
            likesCount: post.likesCount || post.likes || 0,
            commentsCount: post.commentsCount || post.comments || 0,
            timestamp: post.timestamp || post.time || new Date().toISOString(),
            ownerUsername: post.ownerUsername || post.username || username,
            videoUrl: post.videoUrl || post.video,
            isVideo: Boolean(post.videoUrl || post.video || post.type === 'Video')
          }
        }).filter((post: any) => post.id) // Remove invalid posts

        console.log(`🎯 Processed ${processedPosts.length} valid posts`)

        return NextResponse.json({
          success: true,
          username,
          posts: processedPosts,
          totalPosts: processedPosts.length,
          runId,
          message: `Successfully scraped ${processedPosts.length} posts from @${username}`,
          timestamp: new Date().toISOString()
        })

      } else if (status === 'FAILED' || status === 'TIMED-OUT' || status === 'ABORTED') {
        console.error(`❌ Actor run failed with status: ${status}`)
        return NextResponse.json({
          error: `Actor run failed with status: ${status}`,
          runId,
          details: 'Check the actor run logs in Apify Console'
        }, { status: 500 })
      }

      // Still running, wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    // Timeout
    console.error('❌ Actor run timed out after 2 minutes')
    return NextResponse.json({
      error: 'Actor run timed out',
      runId,
      details: 'The scraping is taking longer than expected. Check Apify Console for run status.'
    }, { status: 408 })

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