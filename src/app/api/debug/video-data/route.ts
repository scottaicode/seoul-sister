import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging video data processing...')

    // Step 1: Get raw Apify data
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seoulsister.com'
    const apifyResponse = await fetch(`${baseUrl}/api/apify/fetch-scheduled`)

    if (!apifyResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch Apify data' }, { status: 500 })
    }

    const apifyData = await apifyResponse.json()
    const rawPosts = apifyData.posts || []

    // Step 2: Analyze video content in raw data
    const videoAnalysis = rawPosts.map((item: any, index: number) => {
      const hasVideoUrl = Boolean(item.videoUrl)
      const hasVideo = Boolean(item.video)
      const isVideo = Boolean(item.videoUrl || item.video || item.type === 'Video')

      return {
        index,
        ownerUsername: item.ownerUsername,
        hasVideoUrl,
        hasVideo,
        isVideo,
        videoUrl: item.videoUrl ? item.videoUrl.substring(0, 100) + '...' : null,
        displayUrl: item.displayUrl ? item.displayUrl.substring(0, 100) + '...' : null,
        caption: item.caption ? item.caption.substring(0, 50) + '...' : null
      }
    })

    const videosInRawData = videoAnalysis.filter((item: any) => item.hasVideoUrl || item.hasVideo)

    // Step 3: Simulate processing pipeline
    const validPosts = rawPosts
      .filter((item: any) => item.caption && !item.error && item.ownerUsername)
      .map((item: any) => ({
        id: item.id || item.shortcode || `${item.ownerUsername}_${Date.now()}`,
        ownerUsername: item.ownerUsername,
        videoUrl: item.videoUrl || item.video,
        displayUrl: item.displayUrl || item.images?.[0] || '',
        media_urls: [item.displayUrl || item.images?.[0] || '', item.videoUrl || item.video].filter(Boolean),
        caption: item.caption ? item.caption.substring(0, 100) + '...' : null
      }))

    // Step 4: Test video detection logic
    const videoDetected = validPosts.filter((post: any) => {
      return post.media_urls?.some((url: string) => {
        if (!url) return false
        return url.includes('.mp4') ||
               url.includes('video') ||
               url.includes('reel') ||
               (url.includes('instagram') && url.includes('.mp4')) ||
               (url.includes('fbcdn.net') && url.includes('.mp4')) ||
               (url.includes('cdninstagram.com') && url.includes('.mp4')) ||
               url.includes('/v/t16/') ||
               url.includes('dst-mp4')
      })
    })

    console.log(`🎬 Debug results: ${videosInRawData.length} videos in raw data, ${videoDetected.length} detected after processing`)

    return NextResponse.json({
      success: true,
      analysis: {
        totalRawPosts: rawPosts.length,
        videosInRawData: videosInRawData.length,
        validPostsAfterFiltering: validPosts.length,
        videosDetectedAfterProcessing: videoDetected.length,
        environment: {
          supadata_key_configured: Boolean(process.env.SUPADATA_API_KEY),
          base_url: baseUrl
        }
      },
      sample_videos_raw: videosInRawData.slice(0, 3),
      sample_videos_processed: videoDetected.slice(0, 3),
      debug_info: {
        first_raw_post: rawPosts[0],
        first_processed_post: validPosts[0]
      }
    })

  } catch (error) {
    console.error('❌ Video data debug failed:', error)
    return NextResponse.json({
      error: 'Video data debug failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}