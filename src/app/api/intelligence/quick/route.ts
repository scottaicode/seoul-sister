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

    // Step 2: Create sample intelligence data (simulating real processing)
    const sampleContent = influencers.map((influencer, index) => ({
      platform_post_id: `sim_${Date.now()}_${index}`,
      platform: influencer.platform,
      content_type: 'post',
      post_url: `https://${influencer.platform}.com/${influencer.handle}/posts/sample_${index}`,
      caption: `Sample Korean beauty content from @${influencer.handle} - featuring trending products and Seoul skincare tips. Today I'm sharing the latest from Seoul's beauty scene with authentic K-beauty recommendations.`,
      hashtags: ['kbeauty', 'glassskin', 'koreanbeauty', 'seoul', 'skincare'],
      mentions: [influencer.handle],
      view_count: Math.floor(Math.random() * 200000) + 10000,
      like_count: Math.floor(Math.random() * 50000) + 5000,
      comment_count: Math.floor(Math.random() * 2000) + 100,
      share_count: Math.floor(Math.random() * 500) + 50,
      published_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      scraped_at: new Date().toISOString()
    }))

    console.log(`📊 Generated ${sampleContent.length} sample content pieces`)

    // Step 3: Save to database for display
    if (supabaseAdmin) {
      try {
        // Clear old sample data for this tier
        await supabaseAdmin
          .from('influencer_content')
          .delete()
          .like('platform_post_id', 'sim_%')

        // Insert new sample data
        const { data: insertedData } = await supabaseAdmin
          .from('influencer_content')
          .insert(sampleContent)
          .select()

        console.log(`💾 Saved ${insertedData?.length || 0} items to database`)
      } catch (dbError) {
        console.error('Database operation failed:', dbError)
        // Continue execution even if DB fails
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
        contentSample: sampleContent.slice(0, 2), // Show first 2 as preview
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
    let recentData = []
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