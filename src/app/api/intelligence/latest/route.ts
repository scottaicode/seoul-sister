import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    // Fetch latest AI-processed content from the last 24 hours
    const { data: content, error } = await supabaseAdmin
      .from('beauty_intelligence_reports')
      .select(`
        *,
        ai_summary
      `)
      .order('scraped_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Failed to fetch latest content:', error)
      return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
    }

    // Process the content to show the hybrid AI approach
    const processedContent = content?.map(item => ({
      id: item.id,
      platform: item.platform,
      authorHandle: item.author_handle,
      url: item.url,
      caption: item.caption?.substring(0, 200) + '...',
      metrics: {
        likes: item.like_count,
        comments: item.comment_count,
        views: item.view_count
      },
      publishedAt: item.published_at,
      scrapedAt: item.scraped_at,
      intelligenceScore: item.intelligence_score,
      priorityLevel: item.priority_level,
      aiSummary: item.ai_summary ? {
        summary: item.ai_summary.summary,
        keyInsights: item.ai_summary.keyInsights || [],
        productMentions: item.ai_summary.productMentions || [],
        trendSignals: item.ai_summary.trendSignals || [],
        koreanBeautyTerms: item.ai_summary.koreanBeautyTerms || [],
        mainPoints: item.ai_summary.mainPoints || [],
        sentimentScore: item.ai_summary.sentimentScore,
        intelligenceValue: item.ai_summary.intelligenceValue,
        viewerValueProp: item.ai_summary.viewerValueProp
      } : null,
      transcriptText: item.transcript_text ? item.transcript_text.substring(0, 300) + '...' : null
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