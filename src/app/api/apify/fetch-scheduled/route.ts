import { NextRequest, NextResponse } from 'next/server'
import { ApifyClient } from 'apify-client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'daily' // 'daily' or 'backfill'

    const apiKey = process.env.APIFY_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'Apify API key not configured in environment variables'
      }, { status: 500 })
    }

    console.log(`🔍 Fetching scheduled Korean beauty intelligence from Apify datasets (${mode} mode)`)

    const client = new ApifyClient({
      token: apiKey,
    })

    // Get recent runs from our scheduled Instagram API Scraper
    const actorId = 'apify/instagram-api-scraper'
    const runLimit = mode === 'backfill' ? 5 : 1 // Backfill: 5 runs, Daily: 1 run
    const runs = await client.actor(actorId).runs().list({
      status: 'SUCCEEDED',
      limit: runLimit,
      desc: true // Most recent first
    })

    console.log(`📊 Found ${runs.items.length} recent successful runs`)

    if (!runs.items.length) {
      return NextResponse.json({
        success: false,
        error: 'No recent successful runs found',
        recommendation: 'Check if the scheduled actor is running correctly'
      }, { status: 404 })
    }

    // Fetch data from ALL recent successful runs to capture complete dataset
    let allItems: any[] = []
    const runDetails: any[] = []

    for (const run of runs.items) {
      console.log(`🎯 Processing run: ${run.id} from ${run.finishedAt}`)

      if (!run.defaultDatasetId) {
        console.warn(`⚠️ Run ${run.id} has no dataset, skipping`)
        continue
      }

      try {
        const { items } = await client.dataset(run.defaultDatasetId).listItems()
        allItems.push(...items)
        runDetails.push({
          runId: run.id,
          finishedAt: run.finishedAt,
          itemCount: items.length
        })
        console.log(`📦 Retrieved ${items.length} items from run ${run.id}`)
      } catch (error) {
        console.error(`❌ Failed to fetch data from run ${run.id}:`, error)
      }
    }

    console.log(`📦 Retrieved ${allItems.length} total items from ${runDetails.length} successful runs`)

    // Process the real Instagram data into Seoul Sister format
    // Handle both old and new Apify data structures
    const processedPosts = allItems
      .filter((item: any) => {
        // Filter for items that have either caption or are posts/profiles with content
        return (item.caption && !item.error) || // Old format
               (item.posts && Array.isArray(item.posts)) || // New format with posts array
               (item.latestPosts && Array.isArray(item.latestPosts)) // New format variation
      })
      .flatMap((item: any) => {
        // Handle new enhanced scraper format
        if (item.posts && Array.isArray(item.posts)) {
          return item.posts.map((post: any) => processPost(post, item))
        } else if (item.latestPosts && Array.isArray(item.latestPosts)) {
          return item.latestPosts.map((post: any) => processPost(post, item))
        } else {
          // Handle old format
          return [processPost(item, null)]
        }
      })
      .filter(Boolean) // Remove null/undefined items

    function processPost(post: any, profile: any) {
      if (!post.caption && !post.text) return null // Skip items without content

      // Extract hashtags from caption
      const caption = post.caption || post.text || ''
      const hashtags = caption ?
        (caption.match(/#[\w가-힣]+/g) || []).map((tag: string) => tag.substring(1)) : []

      return {
        id: post.id || post.shortcode || `apify_${Date.now()}_${Math.random()}`,
        shortCode: post.shortcode || post.shortCode || '',
        url: post.url || `https://instagram.com/p/${post.shortcode || post.id}`,
        displayUrl: post.displayUrl || post.images?.[0] || '',
        caption: caption,
        hashtags: hashtags,
        likesCount: post.likesCount || post.likes || 0,
        commentsCount: post.commentsCount || post.comments || 0,
        timestamp: post.timestamp || post.time || new Date().toISOString(),
        ownerUsername: post.ownerUsername || post.username || profile?.username || 'korean_beauty_influencer',
        videoUrl: post.videoUrl || post.video,
        isVideo: Boolean(post.videoUrl || post.video || post.type === 'Video'),
        // Enhanced metadata from new scraper
        profile: profile ? {
          biography: profile.biography,
          businessCategory: profile.businessCategoryName,
          externalUrl: profile.externalUrl,
          followersCount: profile.followersCount,
          followingCount: profile.followingCount,
          postsCount: profile.postsCount
        } : null,
        // Standard metadata
        platform: 'instagram',
        sourceType: 'scheduled_scraping',
        scrapedAt: new Date().toISOString(),
        runId: 'multi_run_combined'
      }
    }

    console.log(`✅ Processed ${processedPosts.length} valid Korean beauty posts`)

    // Enhanced Korean beauty intelligence analysis
    const koreanBeautyTerms = ['kbeauty', 'koreanbeauty', '스킨케어', '화장품', '뷰티', 'skincare', 'makeup', 'seoul', 'korean']
    const koreanPosts = processedPosts.filter((post: any) =>
      koreanBeautyTerms.some(term =>
        post.caption.toLowerCase().includes(term) ||
        post.hashtags.some((hashtag: string) => hashtag.toLowerCase().includes(term))
      )
    )

    // Influencer breakdown
    const influencerStats = processedPosts.reduce((acc: any, post: any) => {
      const username = post.ownerUsername
      if (!acc[username]) {
        acc[username] = { posts: 0, totalLikes: 0, totalComments: 0 }
      }
      acc[username].posts++
      acc[username].totalLikes += post.likesCount
      acc[username].totalComments += post.commentsCount
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      posts: processedPosts,
      totalPosts: processedPosts.length,
      koreanBeautyPosts: koreanPosts.length,
      lastUpdate: new Date().toISOString(),
      sourceInfo: {
        totalRuns: runDetails.length,
        runs: runDetails,
        sourceType: 'scheduled_apify_scraping_multi_run'
      },
      influencerStats,
      message: `Successfully fetched ${processedPosts.length} fresh Korean beauty posts from scheduled scraping`,
      koreanBeautyIntelligence: {
        totalInfluencers: Object.keys(influencerStats).length,
        avgLikesPerPost: processedPosts.length > 0 ?
          Math.round(processedPosts.reduce((sum: number, p: any) => sum + p.likesCount, 0) / processedPosts.length) : 0,
        topHashtags: getTopHashtags(processedPosts),
        contentTypes: {
          videos: processedPosts.filter((p: any) => p.isVideo).length,
          images: processedPosts.filter((p: any) => !p.isVideo).length
        }
      }
    })

  } catch (error) {
    console.error('❌ Scheduled data fetch error:', error)
    return NextResponse.json({
      error: 'Failed to fetch scheduled Korean beauty intelligence',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

function getTopHashtags(posts: any[]): string[] {
  const hashtagCount: { [key: string]: number } = {}

  posts.forEach(post => {
    post.hashtags.forEach((hashtag: string) => {
      const tag = hashtag.toLowerCase()
      hashtagCount[tag] = (hashtagCount[tag] || 0) + 1
    })
  })

  return Object.entries(hashtagCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([hashtag]) => hashtag)
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET to fetch scheduled Korean beauty intelligence data'
  }, { status: 405 })
}