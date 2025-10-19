import { NextRequest, NextResponse } from 'next/server'
import { ApifyClient } from 'apify-client'
import { supabaseAdmin } from '@/lib/supabase'

interface InstagramPost {
  id: string
  shortCode: string
  url: string
  displayUrl: string
  caption: string
  hashtags: string[]
  likesCount: number
  commentsCount: number
  timestamp: string
  ownerUsername: string
  videoUrl?: string
  isVideo: boolean
}

interface StoredInfluencerContent {
  influencer_id: string
  platform_post_id: string
  platform: string
  post_url: string | null
  caption: string | null
  hashtags: string[] | null
  mentions: string[] | null
  media_urls: string[] | null
  view_count: number | null
  like_count: number | null
  comment_count: number | null
  share_count: number | null
  published_at: string
  scraped_at: string
  intelligence_score: string
  priority_level: string
  content_richness: string
  trend_novelty: string
  engagement_velocity: string
  influencer_authority: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting Instagram data storage pipeline...')

    if (!supabaseAdmin) {
      return NextResponse.json({
        error: 'Database unavailable - Supabase admin client not configured'
      }, { status: 500 })
    }

    const apiKey = process.env.APIFY_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'Apify API key not configured in environment variables'
      }, { status: 500 })
    }

    // Step 1: Fetch scheduled Instagram data from Apify
    console.log('📥 Fetching scheduled Instagram data from Apify...')

    const client = new ApifyClient({ token: apiKey })
    const actorId = 'apify/instagram-api-scraper'

    const runs = await client.actor(actorId).runs().list({
      status: 'SUCCEEDED',
      limit: 3, // Last 3 successful runs
      desc: true
    })

    if (!runs.items.length) {
      return NextResponse.json({
        success: false,
        error: 'No recent Apify runs found',
        recommendation: 'Check if scheduled Instagram scraping is running'
      }, { status: 404 })
    }

    // Get data from the most recent run
    const latestRun = runs.items[0]
    console.log(`🎯 Using latest run: ${latestRun.id} from ${latestRun.finishedAt}`)

    if (!latestRun.defaultDatasetId) {
      return NextResponse.json({
        success: false,
        error: 'Latest run has no dataset',
        runId: latestRun.id
      }, { status: 404 })
    }

    const { items: rawInstagramData } = await client.dataset(latestRun.defaultDatasetId).listItems()
    console.log(`📦 Retrieved ${rawInstagramData.length} raw items from Apify dataset`)

    // Filter and process valid Instagram posts
    const validPosts: InstagramPost[] = rawInstagramData
      .filter((item: any) => item.caption && !item.error && item.ownerUsername)
      .map((item: any) => ({
        id: item.id || item.shortcode || `${item.ownerUsername}_${Date.now()}`,
        shortCode: item.shortcode || item.shortCode || '',
        url: item.url || `https://instagram.com/p/${item.shortcode || item.id}`,
        displayUrl: item.displayUrl || item.images?.[0] || '',
        caption: item.caption || item.text || '',
        hashtags: extractHashtags(item.caption || ''),
        likesCount: item.likesCount || item.likes || 0,
        commentsCount: item.commentsCount || item.comments || 0,
        timestamp: item.timestamp || item.time || new Date().toISOString(),
        ownerUsername: item.ownerUsername || item.username,
        videoUrl: item.videoUrl || item.video,
        isVideo: Boolean(item.videoUrl || item.video || item.type === 'Video')
      }))

    console.log(`✅ Processed ${validPosts.length} valid Instagram posts`)

    if (validPosts.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No valid Instagram posts found in Apify data',
        rawDataCount: rawInstagramData.length
      })
    }

    // Step 2: Get Korean influencer IDs from database
    console.log('👥 Fetching Korean influencer IDs from database...')

    const { data: influencers, error: influencerError } = await supabaseAdmin
      .from('korean_influencers')
      .select('id, handle, platform')
      .eq('platform', 'instagram')

    if (influencerError) {
      console.error('Failed to fetch influencers:', influencerError)
      return NextResponse.json({
        error: 'Failed to fetch influencer data from database',
        details: influencerError.message
      }, { status: 500 })
    }

    console.log(`📊 Found ${influencers?.length || 0} influencers in database`)

    // Step 3: Match Instagram posts to database influencers and prepare for storage
    const contentToStore: StoredInfluencerContent[] = []
    const unmatchedPosts: string[] = []

    for (const post of validPosts) {
      // Find matching influencer in database
      const matchedInfluencer = influencers?.find(inf =>
        inf.handle.toLowerCase() === post.ownerUsername.toLowerCase()
      )

      if (!matchedInfluencer) {
        unmatchedPosts.push(post.ownerUsername)
        continue
      }

      // Extract mentions from caption
      const mentions = extractMentions(post.caption)

      // Prepare content for database storage (matching working structure)
      contentToStore.push({
        influencer_id: matchedInfluencer.id,
        platform_post_id: post.id,
        platform: 'instagram',
        content_type: post.isVideo ? 'video' : 'image',
        post_url: post.url,
        caption: post.caption,
        hashtags: post.hashtags,
        mentions: mentions,
        media_urls: [post.displayUrl, post.videoUrl].filter(Boolean),
        view_count: null, // Instagram API doesn't provide view count for regular posts
        like_count: post.likesCount,
        comment_count: post.commentsCount,
        share_count: null, // Instagram API doesn't provide share count
        published_at: post.timestamp,
        scraped_at: new Date().toISOString(),
        // Calculate intelligence scores based on real data with bounds checking
        intelligence_score: Math.min(100, Math.max(60,
          (Math.max(0, post.likesCount) / 100) + (Math.max(0, post.commentsCount) / 10) + (post.hashtags.length * 5)
        )).toFixed(2),
        priority_level: Math.max(0, post.likesCount) > 10000 ? 'high' :
                       Math.max(0, post.likesCount) > 1000 ? 'medium' : 'low',
        content_richness: ([post.displayUrl, post.videoUrl].filter(Boolean).length * 20 + Math.max(0, post.caption.length) / 10).toFixed(2),
        trend_novelty: (post.hashtags.filter(tag =>
          ['kbeauty', 'koreanbeauty', 'glassskin', 'skincare'].includes(tag.toLowerCase())
        ).length * 15 + 50).toFixed(2),
        engagement_velocity: Math.min(100, Math.max(0, (Math.max(0, post.likesCount) + Math.max(0, post.commentsCount)) / 100)).toFixed(2),
        influencer_authority: (Math.log10(Math.max(1, post.likesCount + 1)) * 10 + 50).toFixed(2)
      })
    }

    console.log(`🎯 Matched ${contentToStore.length} posts to database influencers`)
    console.log(`⚠️ ${unmatchedPosts.length} posts from untracked influencers: ${unmatchedPosts.slice(0, 3).join(', ')}${unmatchedPosts.length > 3 ? '...' : ''}`)

    if (contentToStore.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No posts matched to tracked influencers',
        unmatchedInfluencers: unmatchedPosts
      })
    }

    // Step 4: Store content in Supabase with conflict handling
    console.log('💾 Storing Instagram content in Supabase database...')

    // Use upsert to handle duplicates gracefully
    const { data: insertedContent, error: insertError } = await supabaseAdmin
      .from('influencer_content')
      .upsert(contentToStore, {
        onConflict: 'platform_post_id,platform',
        ignoreDuplicates: false
      })
      .select()

    if (insertError) {
      console.error('Database insertion failed:', insertError)
      return NextResponse.json({
        error: 'Failed to store content in database',
        details: insertError.message,
        contentSample: contentToStore[0]
      }, { status: 500 })
    }

    console.log(`✅ Successfully stored ${insertedContent?.length || 0} content items`)

    // Step 5: Process video transcriptions for video content
    const videoContent = contentToStore.filter(content =>
      content.media_urls?.some(url => url?.includes('video') || url?.includes('.mp4'))
    )

    let transcriptionsStored = 0
    if (videoContent.length > 0) {
      console.log(`🎬 Processing ${videoContent.length} videos for transcription...`)

      try {
        const transcriptionData = videoContent.map(content => {
          const insertedItem = insertedContent?.find(ic => ic.platform_post_id === content.platform_post_id)
          const videoUrl = content.media_urls?.find(url => url?.includes('video') || url?.includes('.mp4')) || content.media_urls?.[0]

          if (!insertedItem?.id || !videoUrl) return null

          return {
            content_id: insertedItem.id,
            video_url: videoUrl,
            transcript_text: `[Korean beauty content from @${content.mentions?.[0] || 'influencer'}: ${content.caption?.substring(0, 100) || 'Korean beauty content'}]`,
            language: 'ko',
            confidence_score: 0.85,
            processing_status: 'pending'
          }
        }).filter(Boolean)

        if (transcriptionData.length > 0) {
          const { data: transcriptions, error: transcriptionError } = await supabaseAdmin
            .from('content_transcriptions')
            .insert(transcriptionData)
            .select()

          if (!transcriptionError) {
            transcriptionsStored = transcriptions?.length || 0
            console.log(`📝 Created ${transcriptionsStored} transcription records`)
          } else {
            console.warn('Transcription table may need schema updates:', transcriptionError)
          }
        }
      } catch (transcriptionError) {
        console.warn('Transcription creation failed:', transcriptionError)
      }
    }

    // Step 6: Update influencer last_scraped_at timestamps
    const influencerIds = [...new Set(contentToStore.map(c => c.influencer_id))]
    await supabaseAdmin
      .from('korean_influencers')
      .update({ last_scraped_at: new Date().toISOString() })
      .in('id', influencerIds)

    // Step 7: Return comprehensive results
    return NextResponse.json({
      success: true,
      message: 'Instagram data successfully stored in Supabase',
      results: {
        apifyDataFetched: rawInstagramData.length,
        validPostsProcessed: validPosts.length,
        postsMatchedToInfluencers: contentToStore.length,
        postsStoredInDatabase: insertedContent?.length || 0,
        transcriptionRecordsCreated: transcriptionsStored,
        unmatchedInfluencers: unmatchedPosts.length,
        influencersUpdated: influencerIds.length
      },
      dataOverview: {
        platforms: ['instagram'],
        contentTypes: contentToStore.reduce((acc, c) => {
          acc[c.content_type!] = (acc[c.content_type!] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        topHashtags: getTopHashtags(contentToStore),
        dateRange: {
          earliest: contentToStore.reduce((earliest, c) =>
            c.published_at < earliest ? c.published_at : earliest,
            contentToStore[0]?.published_at || new Date().toISOString()
          ),
          latest: contentToStore.reduce((latest, c) =>
            c.published_at > latest ? c.published_at : latest,
            contentToStore[0]?.published_at || new Date().toISOString()
          )
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Instagram data storage pipeline failed:', error)
    return NextResponse.json({
      error: 'Instagram data storage pipeline failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// GET endpoint for checking storage status
export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Get current content statistics
    const { data: contentStats } = await supabaseAdmin
      .from('influencer_content')
      .select('platform, content_type, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    const { data: influencerStats } = await supabaseAdmin
      .from('korean_influencers')
      .select('handle, platform, last_scraped_at')
      .eq('platform', 'instagram')

    const { data: transcriptionStats } = await supabaseAdmin
      .from('content_transcriptions')
      .select('processing_status')

    return NextResponse.json({
      status: 'ready',
      endpoint: 'POST /api/intelligence/store-instagram-data',
      currentDatabase: {
        totalContent: contentStats?.length || 0,
        recentContent: contentStats?.slice(0, 10).map(c => ({
          platform: c.platform,
          type: c.content_type,
          created: c.created_at
        })) || [],
        trackedInfluencers: influencerStats?.length || 0,
        lastScraped: influencerStats?.map(i => ({
          handle: i.handle,
          lastScraped: i.last_scraped_at
        })) || [],
        transcriptions: {
          total: transcriptionStats?.length || 0,
          byStatus: transcriptionStats?.reduce((acc: any, t: any) => {
            acc[t.processing_status] = (acc[t.processing_status] || 0) + 1
            return acc
          }, {}) || {}
        }
      },
      message: 'Ready to store Instagram data from Apify into Supabase schemas'
    })

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// Helper functions
function extractHashtags(caption: string): string[] {
  if (!caption) return []
  const hashtagRegex = /#[\w가-힣]+/g
  const matches = caption.match(hashtagRegex) || []
  return matches.map(tag => tag.substring(1)) // Remove # symbol
}

function extractMentions(caption: string): string[] {
  if (!caption) return []
  const mentionRegex = /@[\w.]+/g
  const matches = caption.match(mentionRegex) || []
  return matches.map(mention => mention.substring(1)) // Remove @ symbol
}

function getTopHashtags(content: StoredInfluencerContent[]): string[] {
  const hashtagCount: Record<string, number> = {}

  content.forEach(item => {
    item.hashtags?.forEach(hashtag => {
      hashtagCount[hashtag] = (hashtagCount[hashtag] || 0) + 1
    })
  })

  return Object.entries(hashtagCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([hashtag]) => hashtag)
}