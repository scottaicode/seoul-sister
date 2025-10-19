import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface TrendAnalysis {
  hashtagTrends: {
    hashtag: string
    frequency: number
    totalEngagement: number
    averageEngagement: number
    trendDirection: 'rising' | 'stable' | 'declining'
    influencersUsing: string[]
  }[]
  influencerPerformance: {
    handle: string
    totalPosts: number
    averageEngagement: number
    topPerformingPost: {
      id: string
      engagement: number
      caption: string
    }
    trendingHashtags: string[]
  }[]
  engagementPatterns: {
    averageLikes: number
    averageComments: number
    highPerformingThreshold: number
    topPerformingPosts: {
      id: string
      handle: string
      engagement: number
      publishedAt: string
    }[]
  }
  timeBasedInsights: {
    postsLast24h: number
    postsLast7d: number
    engagementGrowth: number
    mostActiveInfluencer: string
  }
  koreanBeautyTerms: {
    term: string
    frequency: number
    associatedHashtags: string[]
    engagementImpact: number
  }[]
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting real-time Korean beauty trend analysis...')

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Get all stored Instagram content with engagement metrics
    const { data: content, error: contentError } = await supabaseAdmin
      .from('influencer_content')
      .select(`
        id,
        platform_post_id,
        platform,
        caption,
        hashtags,
        like_count,
        comment_count,
        published_at,
        scraped_at,
        intelligence_score,
        priority_level,
        created_at,
        korean_influencers!inner(handle, name)
      `)
      .eq('platform', 'instagram')
      .order('published_at', { ascending: false })

    if (contentError) {
      console.error('Failed to fetch content:', contentError)
      return NextResponse.json({
        error: 'Failed to fetch content data',
        details: contentError.message
      }, { status: 500 })
    }

    if (!content || content.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No Instagram content available for analysis',
        recommendation: 'Run data collection first: POST /api/intelligence/store-instagram-data'
      })
    }

    console.log(`📊 Analyzing ${content.length} Instagram posts for trends...`)

    // 1. Hashtag Trend Analysis
    const hashtagStats: Record<string, {
      frequency: number
      totalEngagement: number
      influencers: Set<string>
      posts: typeof content
    }> = {}

    content.forEach(post => {
      const engagement = ((post as any).like_count || 0) + ((post as any).comment_count || 0)
      const influencerData = (post as any).korean_influencers
      let handle = 'unknown'
      if (influencerData && influencerData.handle) {
        handle = influencerData.handle
      }

      (post as any).hashtags?.forEach((hashtag: any) => {
        if (!hashtagStats[hashtag]) {
          hashtagStats[hashtag] = {
            frequency: 0,
            totalEngagement: 0,
            influencers: new Set(),
            posts: []
          }
        }
        hashtagStats[hashtag].frequency++
        hashtagStats[hashtag].totalEngagement += engagement
        hashtagStats[hashtag].influencers.add(handle)
        hashtagStats[hashtag].posts.push(post)
      })
    })

    const hashtagTrends = Object.entries(hashtagStats)
      .map(([hashtag, stats]) => ({
        hashtag,
        frequency: stats.frequency,
        totalEngagement: stats.totalEngagement,
        averageEngagement: Math.round(stats.totalEngagement / stats.frequency),
        trendDirection: stats.frequency >= 2 ? 'rising' : 'stable' as 'rising' | 'stable' | 'declining',
        influencersUsing: Array.from(stats.influencers)
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 15)

    // 2. Influencer Performance Analysis
    const influencerStats: Record<string, {
      posts: typeof content
      totalEngagement: number
      hashtags: string[]
    }> = {}

    content.forEach(post => {
      const influencerData = (post as any).korean_influencers
      let handle = 'unknown'
      if (influencerData && influencerData.handle) {
        handle = influencerData.handle
      }
      const engagement = ((post as any).like_count || 0) + ((post as any).comment_count || 0)

      if (!influencerStats[handle]) {
        influencerStats[handle] = {
          posts: [],
          totalEngagement: 0,
          hashtags: []
        }
      }
      influencerStats[handle].posts.push(post)
      influencerStats[handle].totalEngagement += engagement
      influencerStats[handle].hashtags.push(...((post as any).hashtags || []))
    })

    const influencerPerformance = Object.entries(influencerStats)
      .map(([handle, stats]) => {
        const topPost = stats.posts.reduce((top, post) => {
          const engagement = ((post as any).like_count || 0) + ((post as any).comment_count || 0)
          const topEngagement = ((top as any).like_count || 0) + ((top as any).comment_count || 0)
          return engagement > topEngagement ? post : top
        })

        const hashtagFreq: Record<string, number> = {}
        stats.hashtags.forEach(tag => {
          hashtagFreq[tag] = (hashtagFreq[tag] || 0) + 1
        })

        return {
          handle,
          totalPosts: stats.posts.length,
          averageEngagement: Math.round(stats.totalEngagement / stats.posts.length),
          topPerformingPost: {
            id: (topPost as any).id,
            engagement: ((topPost as any).like_count || 0) + ((topPost as any).comment_count || 0),
            caption: (topPost as any).caption?.substring(0, 100) + '...' || ''
          },
          trendingHashtags: Object.entries(hashtagFreq)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([tag]) => tag)
        }
      })
      .sort((a, b) => b.averageEngagement - a.averageEngagement)

    // 3. Engagement Pattern Analysis
    const allEngagements = content.map(post => ((post as any).like_count || 0) + ((post as any).comment_count || 0))
    const averageLikes = Math.round(content.reduce((sum, post) => sum + ((post as any).like_count || 0), 0) / content.length)
    const averageComments = Math.round(content.reduce((sum, post) => sum + ((post as any).comment_count || 0), 0) / content.length)
    const highPerformingThreshold = Math.round(allEngagements.reduce((sum, eng) => sum + eng, 0) / allEngagements.length * 1.5)

    const topPerformingPosts = content
      .map(post => ({
        id: (post as any).id,
        handle: (post as any).korean_influencers?.['handle'] || 'unknown',
        engagement: ((post as any).like_count || 0) + ((post as any).comment_count || 0),
        publishedAt: (post as any).published_at
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10)

    // 4. Time-Based Insights
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const postsLast24h = content.filter(post => new Date((post as any).published_at) > last24h).length
    const postsLast7d = content.filter(post => new Date((post as any).published_at) > last7d).length

    const influencerPostCounts: Record<string, number> = {}
    content.forEach(post => {
      const influencerData = (post as any).korean_influencers
      let handle = 'unknown'
      if (influencerData && influencerData.handle) {
        handle = influencerData.handle
      }
      influencerPostCounts[handle] = (influencerPostCounts[handle] || 0) + 1
    })
    const mostActiveInfluencer = Object.entries(influencerPostCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none'

    // 5. Korean Beauty Terms Analysis
    const koreanBeautyTerms = [
      'kbeauty', 'korean', 'skincare', 'seoul', 'glass skin', 'snail', 'essence',
      'ceramide', 'centella', 'cica', 'ginseng', 'rice', 'fermented', 'peptide'
    ]

    const termAnalysis = koreanBeautyTerms.map(term => {
      const relevantPosts = content.filter(post =>
        (post as any).caption?.toLowerCase().includes(term.toLowerCase()) ||
        (post as any).hashtags?.some((tag: any) => tag.toLowerCase().includes(term.toLowerCase()))
      )

      const totalEngagement = relevantPosts.reduce((sum, post) =>
        sum + ((post as any).like_count || 0) + ((post as any).comment_count || 0), 0
      )

      const associatedHashtags = Array.from(new Set(
        relevantPosts.flatMap(post => (post as any).hashtags || [])
      )).slice(0, 5)

      return {
        term,
        frequency: relevantPosts.length,
        associatedHashtags,
        engagementImpact: relevantPosts.length > 0 ? Math.round(totalEngagement / relevantPosts.length) : 0
      }
    }).filter(analysis => analysis.frequency > 0)
     .sort((a, b) => b.frequency - a.frequency)

    const trendAnalysis: TrendAnalysis = {
      hashtagTrends,
      influencerPerformance,
      engagementPatterns: {
        averageLikes,
        averageComments,
        highPerformingThreshold,
        topPerformingPosts
      },
      timeBasedInsights: {
        postsLast24h,
        postsLast7d,
        engagementGrowth: postsLast24h > 0 ? Math.round((postsLast24h / Math.max(postsLast7d - postsLast24h, 1)) * 100) : 0,
        mostActiveInfluencer
      },
      koreanBeautyTerms: termAnalysis
    }

    console.log('✅ Trend analysis completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Korean beauty trend analysis completed',
      analysis: trendAnalysis,
      metadata: {
        totalPostsAnalyzed: content.length,
        uniqueInfluencers: new Set(content.map(p => (p as any).korean_influencers?.['handle'])).size,
        analysisTimestamp: new Date().toISOString(),
        dataTimeRange: {
          earliest: (content[content.length - 1] as any)?.published_at,
          latest: (content[0] as any)?.published_at
        }
      }
    })

  } catch (error) {
    console.error('❌ Trend analysis failed:', error)
    return NextResponse.json({
      error: 'Trend analysis failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: 'POST /api/intelligence/analyze-trends',
    purpose: 'Real-time Korean beauty trend analysis from collected Instagram data',
    features: [
      'Hashtag frequency and engagement analysis',
      'Influencer performance ranking',
      'Engagement pattern identification',
      'Time-based trend insights',
      'Korean beauty terms tracking'
    ],
    usage: 'POST request to analyze current stored Instagram content'
  })
}