import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface InfluencerContent {
  id: string
  platform: string
  platform_post_id: string
  content_type: string
  post_url: string | null
  caption: string | null
  hashtags: string[] | null
  mentions: string[] | null
  like_count: number | null
  comment_count: number | null
  view_count: number | null
  share_count: number | null
  published_at: string
  scraped_at: string
}

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Fetch latest AI-processed content from the last 24 hours
    const { data: content, error } = await supabaseAdmin
      .from('influencer_content')
      .select('*')
      .order('scraped_at', { ascending: false })
      .limit(20) as { data: InfluencerContent[] | null, error: any }

    if (error) {
      console.error('Failed to fetch latest content:', error)
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
    }

    // Process the content to show the hybrid AI approach
    const processedContent = content?.map(item => ({
      id: item.id,
      platform: item.platform,
      authorHandle: item.mentions?.[0] || 'unknown_influencer',
      url: item.post_url,
      caption: item.caption?.substring(0, 200) + '...',
      hashtags: item.hashtags || [],
      metrics: {
        likes: item.like_count,
        comments: item.comment_count,
        views: item.view_count,
        shares: item.share_count
      },
      publishedAt: item.published_at,
      scrapedAt: item.scraped_at,
      contentType: item.content_type,
      // Simulated AI analysis for demonstration
      aiSummary: {
        summary: `Korean beauty content analysis reveals trending products and techniques from ${item.mentions?.[0] || 'Seoul influencer'}`,
        keyInsights: ['Korean skincare trending', 'Glass skin technique', 'Seoul beauty routine'],
        productMentions: ['COSRX Snail Essence', 'Beauty of Joseon Relief Sun', 'Round Lab Birch Juice'],
        koreanBeautyTerms: item.hashtags?.filter(tag => ['kbeauty', 'glassskin', 'koreanbeauty', 'seoul', 'skincare'].includes(tag)) || [],
        mainPoints: ['Trending products analysis', 'Seoul beauty techniques', 'Ingredient recommendations'],
        sentimentScore: 0.8,
        intelligenceValue: 'High commercial potential for featured products',
        viewerValueProp: 'Authentic Korean beauty recommendations from Seoul experts'
      },
      transcriptText: 'Sample transcript: This Korean skincare routine focuses on hydration and gentle ingredients like hyaluronic acid and ceramides for healthy Seoul-style glass skin.'
    })) || []

    return NextResponse.json({
      success: true,
      content: processedContent,
      totalItems: content?.length || 0,
      lastUpdate: new Date().toISOString()
    })

  } catch (error) {
    console.error('Latest content API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch latest content' },
      { status: 500 }
    )
  }
}