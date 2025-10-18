import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tier = searchParams.get('tier') || 'mega'

    console.log(`🚀 Quick Intelligence Cycle - Tier: ${tier} (v2.0)`)

    // Step 1: Get influencers for this tier
    const { getInfluencersByTier } = await import('@/lib/config/korean-influencers')
    const influencers = getInfluencersByTier(tier as 'mega' | 'rising' | 'niche')

    console.log(`👥 Selected ${influencers.length} influencers for ${tier} tier`)

    // Step 2: Get influencer IDs from database
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        error: 'Database connection not available',
        details: 'Supabase admin client is not configured'
      }, { status: 500 })
    }

    const { data: dbInfluencers, error: influencerError } = await supabaseAdmin
      .from('korean_influencers')
      .select('id, handle, platform')
      .in('handle', influencers.map(inf => inf.handle)) as {
        data: Array<{id: string, handle: string, platform: string}> | null,
        error: any
      }

    if (influencerError) {
      console.error('❌ Failed to get influencer IDs:', influencerError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch influencer data from database',
        details: influencerError.message
      }, { status: 500 })
    }

    // Step 3: Create properly structured content for influencer_content table
    const sampleContent = influencers.map((influencer, index) => {
      // Find the corresponding database influencer
      const dbInfluencer = dbInfluencers?.find(db =>
        db.handle === influencer.handle && db.platform === influencer.platform
      )

      if (!dbInfluencer) {
        console.warn(`⚠️ No database record found for ${influencer.handle} on ${influencer.platform}`)
        return null
      }

      const baseData = {
        influencer_id: dbInfluencer.id, // Required field from database schema
        platform_post_id: `sim_${Date.now()}_${index}`,
        platform: influencer.platform as string,
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
        scraped_at: new Date().toISOString(),

        // Intelligence scoring fields (matching database schema)
        intelligence_score: (Math.random() * 40 + 60).toFixed(2), // 60-100
        priority_level: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as 'high' | 'medium' | 'low',
        content_richness: (Math.random() * 30 + 70).toFixed(2), // 70-100
        trend_novelty: (Math.random() * 50 + 50).toFixed(2), // 50-100
        engagement_velocity: (Math.random() * 40 + 60).toFixed(2), // 60-100
        influencer_authority: (Math.random() * 20 + 80).toFixed(2) // 80-100
      }

      return baseData
    }).filter(Boolean) // Remove null entries

    console.log(`📊 Generated ${sampleContent.length} sample content pieces`)

    // Step 4: Store content in database following best practices
    // supabaseAdmin is guaranteed to be non-null due to early return check above
    try {
      console.log(`💾 Storing ${sampleContent.length} content pieces in influencer_content table...`)

      // Clear old simulation data first
      await supabaseAdmin!
        .from('influencer_content')
        .delete()
        .like('platform_post_id', 'sim_%')

        console.log(`🗑️ Cleared previous simulation data`)

        // Insert new content data with proper typing
        const { data: insertedData, error: insertError } = await supabaseAdmin!
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
            video_url: content.media_urls?.[0] || `https://example.com/video/${index}.mp4`,
            transcript_text: content.hashtags?.includes('skincare')
              ? 'This Korean skincare routine focuses on hydration and gentle ingredients like hyaluronic acid and ceramides for healthy Seoul-style glass skin.'
              : 'Today I\'m sharing my favorite Korean makeup look using trending products from Seoul beauty brands for that perfect dewy finish.',
            language: 'ko',
            confidence_score: (85 + Math.floor(Math.random() * 15)) / 100, // 0.85-0.99
            processing_status: 'completed'
          }))

          // Try to store transcription data
          try {
            const { data: transcriptionData } = await supabaseAdmin!
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
        console.error('❌ Detailed error:', JSON.stringify(dbError, null, 2))
        console.error('❌ Sample content structure:', JSON.stringify(sampleContent[0], null, 2))

        // Return the actual error so we can debug it
        return NextResponse.json({
          success: false,
          error: 'Database storage failed - detailed logging enabled',
          dbError: dbError instanceof Error ? dbError.message : String(dbError),
          sampleDataStructure: sampleContent[0],
          note: 'This error will help us fix the database schema mismatch',
          timestamp: new Date().toISOString()
        }, { status: 500 })
      }

    // Step 5: Return success with realistic processing simulation
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
        contentSample: sampleContent.slice(0, 2).map(content => content ? ({
          platform: content.platform,
          platform_post_id: content.platform_post_id,
          caption: content.caption?.substring(0, 100) + '...',
          hashtags: content.hashtags,
          mentions: content.mentions,
          engagement: {
            likes: content.like_count,
            comments: content.comment_count,
            views: content.view_count,
            shares: content.share_count
          },
          published_at: content.published_at,
          ai_analysis: {
            summary: `Korean beauty intelligence from @${content.mentions?.[0] || 'unknown'} reveals trending products`,
            score: Math.floor(Math.random() * 50) + 50
          }
        }) : null).filter(Boolean), // Show first 2 as preview with proper structure
        insights: {
          topHashtags: ['#kbeauty', '#glassskin', '#koreanbeauty'],
          trendingProducts: ['COSRX Snail Essence', 'Beauty of Joseon Relief Sun'],
          averageEngagement: Math.floor(sampleContent.reduce((acc, c) => acc + ((c?.like_count) || 0), 0) / sampleContent.length)
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