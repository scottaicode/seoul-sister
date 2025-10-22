import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting video URL debug check...')

    // Fetch raw Apify data
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seoulsister.com'
    const scheduledResponse = await fetch(`${baseUrl}/api/apify/fetch-scheduled`)

    if (!scheduledResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch Apify data' }, { status: 500 })
    }

    const scheduledData = await scheduledResponse.json()
    const rawInstagramData = scheduledData.posts || []

    console.log(`📦 Retrieved ${rawInstagramData.length} raw items from Apify`)

    // Analyze video content
    const videoAnalysis = rawInstagramData.map((item: any, index: number) => ({
      index,
      ownerUsername: item.ownerUsername,
      hasVideoUrl: Boolean(item.videoUrl),
      hasVideo: Boolean(item.video),
      videoUrl: item.videoUrl ? item.videoUrl.substring(0, 100) + '...' : null,
      video: item.video,
      type: item.type,
      isVideo: Boolean(item.videoUrl || item.video || item.type === 'Video'),
      caption: item.caption ? item.caption.substring(0, 50) + '...' : null
    }))

    const videosFound = videoAnalysis.filter(item => item.hasVideoUrl || item.hasVideo)
    const totalVideos = videosFound.length

    console.log(`🎬 Found ${totalVideos} items with video URLs out of ${rawInstagramData.length} total`)

    // Check what happens during processing
    const validPosts = rawInstagramData
      .filter((item: any) => item.caption && !item.error && item.ownerUsername)
      .map((item: any) => ({
        id: item.id || item.shortcode || `${item.ownerUsername}_${Date.now()}`,
        ownerUsername: item.ownerUsername,
        videoUrl: item.videoUrl || item.video,
        displayUrl: item.displayUrl || item.images?.[0] || '',
        media_urls: [item.displayUrl || item.images?.[0] || '', item.videoUrl || item.video].filter(Boolean),
        isVideo: Boolean(item.videoUrl || item.video || item.type === 'Video'),
        caption: item.caption ? item.caption.substring(0, 50) + '...' : null
      }))

    const processedVideos = validPosts.filter(post =>
      post.media_urls?.some(url => url?.includes('video') || url?.includes('.mp4') || url?.includes('reel'))
    )

    console.log(`🔄 After processing: ${processedVideos.length} videos detected from ${validPosts.length} valid posts`)

    return NextResponse.json({
      success: true,
      analysis: {
        totalApifyItems: rawInstagramData.length,
        totalVideosInRawData: totalVideos,
        validPostsAfterFiltering: validPosts.length,
        videosDetectedAfterProcessing: processedVideos.length,
        supadata_key_configured: Boolean(process.env.SUPADATA_API_KEY)
      },
      rawVideoSample: videosFound.slice(0, 3),
      processedVideoSample: processedVideos.slice(0, 3),
      detailAnalysis: videoAnalysis.slice(0, 10)
    })

  } catch (error) {
    console.error('❌ Video debug check failed:', error)
    return NextResponse.json({
      error: 'Video debug check failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}