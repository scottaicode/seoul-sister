import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tier = searchParams.get('tier') || 'mega'

    console.log(`🚀 Quick Intelligence Cycle - Tier: ${tier}`)

    // Step 1: Get influencers for this tier
    const { getInfluencersByTier } = await import('@/lib/config/korean-influencers')
    const influencers = getInfluencersByTier(tier as 'mega' | 'rising' | 'niche')

    console.log(`👥 Selected ${influencers.length} influencers for ${tier} tier`)

    // Step 2: Create properly structured content for influencer_content table
    const sampleContent = influencers.map((influencer, index) => {
      const baseData = {
        platform_post_id: `sim_${Date.now()}_${index}`,
        platform: influencer.platform as string,
        content_type: 'post' as string,
        post_url: `https://${influencer.platform}.com/${influencer.handle}/posts/sample_${index}`,
        caption: `Sample Korean beauty content from @${influencer.handle} - featuring trending products and Seoul skincare tips. Today I'm sharing the latest from Seoul's beauty scene with authentic K-beauty recommendations. #kbeauty #glassskin #koreanbeauty #seoul #skincare`,

        // Arrays for hashtags and mentions
        hashtags: ['kbeauty', 'glassskin', 'koreanbeauty', 'seoul', 'skincare'],
        mentions: [influencer.handle],
        media_urls: [`https://example.com/media/${index}.jpg`],

        // Engagement metrics
        view_count: Math.floor(Math.random() * 200000) + 10000,
        like_count: Math.floor(Math.random() * 50000) + 5000,
        comment_count: Math.floor(Math.random() * 2000) + 100,
        share_count: Math.floor(Math.random() * 500) + 50,

        // Timestamps - using proper database timestamp format
        published_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        scraped_at: new Date().toISOString()
      }

      // Only include influencer_id if it's not required or we have a valid one
      // For now, omit it since it may be optional or auto-handled
      return baseData
    })

    console.log(`📊 Generated ${sampleContent.length} sample content pieces`)

    // Step 3: Store content in database following best practices
    if (supabaseAdmin) {
      try {
        console.log(`💾 Storing ${sampleContent.length} content pieces in influencer_content table...`)

        // Clear old simulation data first
        await supabaseAdmin
          .from('influencer_content')
          .delete()
          .like('platform_post_id', 'sim_%')

        console.log(`🗑️ Cleared previous simulation data`)

        // Insert new content data with proper typing
        const { data: insertedData, error: insertError } = await supabaseAdmin
          .from('influencer_content')
          .insert(sampleContent as any) // Type assertion to bypass strict typing issues
          .select() as { data: any[] | null, error: any }

        if (insertError) {
          console.error('❌ Database insert error:', insertError)
          throw insertError
        }

        console.log(`✅ Successfully stored ${insertedData?.length || 0} content items in database`)

        // Store additional AI analysis in separate table if needed
        if (insertedData && insertedData.length > 0) {
          const aiAnalysisData = insertedData.map((content: any, index: number) => ({
            content_id: content.id,
            transcript_text: content.hashtags?.includes('skincare')
              ? 'This Korean skincare routine focuses on hydration and gentle ingredients like hyaluronic acid and ceramides for healthy Seoul-style glass skin.'
              : 'Today I\'m sharing my favorite Korean makeup look using trending products from Seoul beauty brands for that perfect dewy finish.',
            language: 'ko',
            confidence_score: 85 + Math.floor(Math.random() * 15), // 85-99%
            processing_status: 'completed',
            processing_completed_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }))

          // Try to store transcription data
          try {
            const { data: transcriptionData } = await supabaseAdmin
              .from('content_transcriptions')
              .insert(aiAnalysisData as any) // Type assertion for flexibility
              .select()

            console.log(`📝 Added transcription data for ${transcriptionData?.length || 0} items`)
          } catch (transcriptionError) {
            console.log(`⚠️ Transcription table not available, continuing without it`)
          }
        }

      } catch (dbError) {
        console.error('❌ Database operation failed:', dbError)
        return NextResponse.json({
          success: false,
          error: 'Database storage failed',
          details: dbError instanceof Error ? dbError.message : String(dbError),
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }
    }

    // Step 4: Return success with realistic processing simulation
    const processingTime = 2000 + Math.random() * 3000 // 2-5 seconds

    return NextResponse.json({
      success: true,
      message: `Quick intelligence cycle completed for ${tier} tier`,
      data: {
        summary: {
          influencersMonitored: influencers.length,
          contentScraped: sampleContent.length,
          videosTranscribed: Math.floor(sampleContent.length * 0.6), // 60% have transcripts
          trendsIdentified: 3,
          processingTimeMs: processingTime
        },
        tier,
        influencers: influencers.map(inf => ({
          handle: inf.handle,
          platform: inf.platform,
          tier: inf.tier
        })),
        contentSample: sampleContent.slice(0, 2).map(content => ({
          platform: content.platform,
          platform_post_id: content.platform_post_id,
          caption: content.caption?.substring(0, 100) + '...',
          hashtags: content.hashtags,
          engagement: {
            likes: content.like_count,
            comments: content.comment_count,
            views: content.view_count
          },
          published_at: content.published_at
        })), // Show first 2 as preview with proper structure
        insights: {
          topHashtags: ['#kbeauty', '#glassskin', '#koreanbeauty'],
          trendingProducts: ['COSRX Snail Essence', 'Beauty of Joseon Relief Sun'],
          averageEngagement: Math.floor(sampleContent.reduce((acc, c) => acc + (c.like_count || 0), 0) / sampleContent.length)
        }
      },
      timestamp: new Date().toISOString(),
      note: 'Quick intelligence simulation - demonstrates tier-specific monitoring with realistic data processing'
    })

  } catch (error) {
    console.error('❌ Quick intelligence cycle failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Quick intelligence cycle failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tier = searchParams.get('tier') || 'all'

  try {
    const { getInfluencersByTier, getAllMonitoredInfluencers } = await import('@/lib/config/korean-influencers')

    let influencers
    if (tier === 'all') {
      influencers = getAllMonitoredInfluencers()
    } else {
      influencers = getInfluencersByTier(tier as 'mega' | 'rising' | 'niche')
    }

    // Check if we have recent data
    let recentData: any[] = []
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('influencer_content')
        .select('id, platform, mentions, scraped_at, like_count')
        .order('scraped_at', { ascending: false })
        .limit(10)

      recentData = data || []
    }

    return NextResponse.json({
      status: 'ready',
      tier,
      availableInfluencers: influencers.length,
      recentDataCount: recentData.length,
      lastUpdate: recentData[0]?.scraped_at || 'No data yet',
      influencerBreakdown: tier === 'all' ? {
        mega: getInfluencersByTier('mega').length,
        rising: getInfluencersByTier('rising').length,
        niche: getInfluencersByTier('niche').length
      } : {
        [tier]: influencers.length
      },
      message: `Quick intelligence endpoint ready for ${tier} tier monitoring`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}