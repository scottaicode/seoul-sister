import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    console.log('🔄 Populating database with fresh Apify data from 12 verified influencers...')

    // First, let's get the latest scheduled data from Apify
    const apifyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/apify/fetch-scheduled`)
    const apifyData = await apifyResponse.json()

    if (!apifyData.success) {
      console.error('Failed to fetch Apify data:', apifyData.error)
      return NextResponse.json({
        error: 'Failed to fetch Apify data',
        details: apifyData.error
      }, { status: 500 })
    }

    console.log(`📦 Retrieved ${apifyData.posts?.length || 0} posts from Apify`)

    // First, add the 12 verified influencers to the korean_influencers table
    const influencers = [
      { handle: 'ponysmakeup', name: 'Pony Park', tier: 'mega', priority: 1, category: 'makeup' },
      { handle: 'risabae_art', name: 'Risabae (Lee Sabae)', tier: 'mega', priority: 2, category: 'makeup' },
      { handle: 'directorpi', name: 'Director Pi', tier: 'mega', priority: 3, category: 'makeup' },
      { handle: '3ce_official', name: '3CE (3 Concept Eyes)', tier: 'mega', priority: 4, category: 'brand' },
      { handle: 'liahyoo', name: 'Lia Yoo', tier: 'rising', priority: 5, category: 'skincare' },
      { handle: 'gothamista', name: 'Gothamista', tier: 'rising', priority: 6, category: 'skincare' },
      { handle: 'glowwithava', name: 'Glow with Ava', tier: 'rising', priority: 7, category: 'lifestyle' },
      { handle: 'ireneisgood', name: 'Irene Kim', tier: 'rising', priority: 8, category: 'fashion' },
      { handle: 'laneige_kr', name: 'Laneige Korea', tier: 'niche', priority: 9, category: 'brand' },
      { handle: 'innisfreeofficial', name: 'Innisfree Official', tier: 'niche', priority: 10, category: 'brand' },
      { handle: 'etudehouse', name: 'Etude House', tier: 'niche', priority: 11, category: 'brand' },
      { handle: 'amorepacific_official', name: 'Amore Pacific Official', tier: 'niche', priority: 12, category: 'brand' }
    ]

    let influencersAdded = 0
    for (const influencer of influencers) {
      const { error } = await (supabaseAdmin as any)
        .from('korean_influencers')
        .upsert({
          name: influencer.name,
          handle: influencer.handle,
          platform: 'instagram',
          followers: influencer.tier === 'mega' ? 1000000 :
                    influencer.tier === 'rising' ? 500000 : 250000,
          category: influencer.category,
          tier: influencer.tier,
          priority: influencer.priority,
          max_posts: 15,
          monitoring_active: true,
          last_scraped: new Date().toISOString()
        }, {
          onConflict: 'handle,platform'
        })

      if (error) {
        console.warn(`Failed to add influencer ${influencer.handle}:`, error)
      } else {
        influencersAdded++
        console.log(`✅ Added influencer @${influencer.handle}`)
      }
    }

    // Now get the influencer IDs for linking content
    const { data: influencerList } = await supabaseAdmin
      .from('korean_influencers')
      .select('id, handle')
      .eq('platform', 'instagram')

    const influencerMap = new Map(influencerList?.map((inf: any) => [inf.handle, inf.id]) || [])

    let insertedCount = 0

    if (apifyData.posts && apifyData.posts.length > 0) {
      // Insert the posts into the database
      for (const post of apifyData.posts) {
        try {
          const influencerId = influencerMap.get(post.ownerUsername)
          if (!influencerId) {
            console.warn(`No influencer found for ${post.ownerUsername}, skipping post`)
            continue
          }

          const { error } = await (supabaseAdmin as any)
            .from('influencer_content')
            .upsert({
              influencer_id: influencerId,
              platform_post_id: post.id || post.shortCode || `${post.ownerUsername}_${Date.now()}_${Math.random()}`,
              platform: 'instagram',
              post_url: post.url,
              caption: post.caption,
              hashtags: post.hashtags || [],
              media_urls: post.displayUrl ? [post.displayUrl] : [],
              like_count: post.likesCount || 0,
              comment_count: post.commentsCount || 0,
              view_count: 0,
              share_count: 0,
              published_at: post.timestamp || new Date().toISOString(),
              scraped_at: new Date().toISOString(),
              intelligence_score: 0,
              priority_level: 'medium',
              content_richness: 0,
              trend_novelty: 0,
              engagement_velocity: 0,
              influencer_authority: 0
            }, {
              onConflict: 'platform_post_id,platform'
            })

          if (error) {
            console.warn(`Failed to insert post for ${post.ownerUsername}:`, error)
          } else {
            insertedCount++
            console.log(`✅ Inserted post for @${post.ownerUsername}`)
          }
        } catch (err) {
          console.warn(`Error inserting post:`, err)
        }
      }
    }

    // Verify the results
    const { count: totalContent } = await supabaseAdmin
      .from('influencer_content')
      .select('*', { count: 'exact', head: true })

    const { count: totalInfluencers } = await supabaseAdmin
      .from('korean_influencers')
      .select('*', { count: 'exact', head: true })

    console.log('✅ Database population completed')
    console.log(`📊 Final counts: ${totalContent} content items, ${totalInfluencers} influencers`)

    return NextResponse.json({
      success: true,
      message: 'Successfully populated database with fresh Apify data',
      results: {
        contentInserted: insertedCount,
        influencersAdded: influencersAdded,
        totalContent: totalContent || 0,
        totalInfluencers: totalInfluencers || 0
      },
      apifyData: {
        source: apifyData.source || 'scheduled',
        postsFound: apifyData.posts?.length || 0
      }
    })

  } catch (error) {
    console.error('❌ Error populating database:', error)
    return NextResponse.json({
      error: 'Failed to populate database',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister Database Population',
    description: 'Populates database with fresh data from 12 verified Korean beauty influencers',
    influencers: [
      'ponysmakeup', 'risabae_art', 'directorpi', '3ce_official',
      'liahyoo', 'gothamista', 'glowwithava', 'ireneisgood',
      'laneige_kr', 'innisfreeofficial', 'etudehouse', 'amorepacific_official'
    ],
    usage: 'POST /api/admin/populate-from-apify'
  })
}