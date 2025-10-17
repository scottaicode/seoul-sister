import { NextRequest, NextResponse } from 'next/server'
import { createAIContentSummarizer } from '@/lib/services/ai-content-summarizer'
import { DEMO_KOREAN_BEAUTY_CONTENT, DEMO_TRENDING_TOPICS } from '@/lib/demo/korean-beauty-content'

export async function POST(request: NextRequest) {
  try {
    console.log('🎭 Running Seoul Sister Intelligence Demo with AI Summarization')

    const body = await request.json()
    const { generateSummaries = true, contentCount = 3 } = body

    // Use demo content (first N items)
    const demoContent = DEMO_KOREAN_BEAUTY_CONTENT.slice(0, contentCount)

    let processedContent = demoContent

    // Generate AI summaries if requested
    if (generateSummaries) {
      console.log('🤖 Generating AI summaries for demo content...')

      try {
        const summarizer = createAIContentSummarizer()

        // Convert demo content to summarization format
        const contentForSummary = demoContent.map(item => ({
          platform: item.platform,
          authorHandle: item.authorHandle,
          caption: item.caption,
          hashtags: item.hashtags,
          metrics: item.metrics,
          publishedAt: item.publishedAt,
          transcriptText: item.transcriptText,
          mediaUrls: item.mediaUrls
        }))

        // Generate summaries
        const summaries = await summarizer.batchSummarizeContent(contentForSummary)

        // Merge summaries back into content
        processedContent = demoContent.map((item, index) => ({
          ...item,
          aiSummary: summaries[index] || null,
          intelligenceScore: Math.random() * 40 + 60, // Demo score 60-100
          priorityLevel: summaries[index]?.intelligenceValue === 'high' ? 'high' :
                        summaries[index]?.intelligenceValue === 'medium' ? 'medium' : 'low'
        }))

        console.log(`✅ Generated ${summaries.length} AI summaries`)
      } catch (error) {
        console.error('❌ AI summarization failed, using demo content without summaries:', error)

        // Add mock summaries for demo
        processedContent = demoContent.map(item => ({
          ...item,
          aiSummary: {
            summary: `${item.platform} content from @${item.authorHandle} featuring Korean beauty insights`,
            keyInsights: ['Korean skincare routine', 'Product recommendations', 'Beauty tips'],
            productMentions: item.caption.match(/[A-Z][a-z]+ [A-Z][a-z]+/g) || [],
            trendSignals: item.hashtags.filter(tag => tag.includes('trend') || tag.includes('beauty')),
            koreanBeautyTerms: ['skincare', 'K-beauty'],
            mainPoints: [item.caption.substring(0, 100) + '...'],
            sentimentScore: 0.8,
            intelligenceValue: 'high' as const,
            viewerValueProp: 'Valuable Korean beauty insights for Seoul Sister users'
          },
          intelligenceScore: Math.random() * 40 + 60,
          priorityLevel: 'high' as const
        }))
      }
    }

    // Calculate demo analytics
    const totalLikes = processedContent.reduce((sum, item) => sum + item.metrics.likes, 0)
    const totalViews = processedContent.reduce((sum, item) => sum + (item.metrics.views || 0), 0)
    const avgEngagement = totalLikes / totalViews * 100

    const response = {
      success: true,
      demo: true,
      message: 'Seoul Sister Intelligence Demo - Hybrid AI Approach',
      data: {
        content: processedContent,
        analytics: {
          totalContent: processedContent.length,
          totalInfluencers: new Set(processedContent.map(c => c.authorHandle)).size,
          totalLikes,
          totalViews,
          avgEngagementRate: avgEngagement.toFixed(2) + '%',
          topPerformingInfluencer: processedContent.sort((a, b) => b.metrics.likes - a.metrics.likes)[0]?.authorHandle,
          trendingTopics: DEMO_TRENDING_TOPICS
        },
        summary: {
          approach: 'Hybrid AI Content Processing',
          features: [
            'Premium Apify scraping (when API key is valid)',
            'AI-powered content summarization with Claude Opus 4.1',
            'Seoul Sister Intelligence Scoring algorithm',
            'Cross-platform Korean beauty trend validation',
            'Processed insights instead of raw content'
          ],
          valueProposition: 'Competitive advantage through intelligent content processing for $20/month premium users'
        }
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Intelligence demo failed:', error)
    return NextResponse.json(
      {
        error: 'Demo intelligence cycle failed',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Seoul Sister Intelligence Demo API',
    description: 'Test the hybrid AI content processing approach with demo Korean beauty content',
    usage: {
      method: 'POST',
      body: {
        generateSummaries: 'boolean (default: true) - Generate AI summaries',
        contentCount: 'number (default: 3) - Number of demo content pieces to process'
      }
    },
    features: [
      'AI-powered content summarization',
      'Korean beauty trend analysis',
      'Intelligence scoring algorithm',
      'Hybrid approach demonstration'
    ]
  })
}