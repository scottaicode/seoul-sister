import Anthropic from '@anthropic-ai/sdk'

interface ContentSummary {
  summary: string
  keyInsights: string[]
  productMentions: string[]
  trendSignals: string[]
  koreanBeautyTerms: string[]
  mainPoints: string[]
  sentimentScore: number
  intelligenceValue: 'high' | 'medium' | 'low'
  viewerValueProp: string
}

interface ContentToSummarize {
  platform: 'instagram' | 'tiktok'
  authorHandle: string
  caption: string
  hashtags: string[]
  metrics: {
    likes: number
    comments: number
    views?: number
  }
  publishedAt: string
  transcriptText?: string
  mediaUrls?: string[]
}

export class AIContentSummarizer {
  private anthropic: Anthropic

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }
    this.anthropic = new Anthropic({ apiKey })
  }

  /**
   * Generate intelligent content summary for Seoul Sister users
   */
  async summarizeContent(content: ContentToSummarize): Promise<ContentSummary> {
    try {
      console.log(`🤖 Generating AI summary for @${content.authorHandle} content`)

      const prompt = this.buildSummaryPrompt(content)

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })

      const responseText = response.content[0].type === 'text' ? response.content[0].text : ''
      const summary = this.parseAIResponse(responseText)

      console.log(`✅ AI summary generated for @${content.authorHandle}`)
      return summary

    } catch (error) {
      console.error(`❌ AI summarization failed for @${content.authorHandle}:`, error)
      return this.createFallbackSummary(content)
    }
  }

  /**
   * Batch summarize multiple content pieces
   */
  async batchSummarizeContent(contentList: ContentToSummarize[]): Promise<ContentSummary[]> {
    console.log(`🤖 Starting batch AI summarization: ${contentList.length} content pieces`)

    const summaries: ContentSummary[] = []

    // Process in batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < contentList.length; i += batchSize) {
      const batch = contentList.slice(i, i + batchSize)

      const batchPromises = batch.map(content => this.summarizeContent(content))
      const batchResults = await Promise.all(batchPromises)

      summaries.push(...batchResults)

      // Add delay between batches
      if (i + batchSize < contentList.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    console.log(`✅ Batch AI summarization completed: ${summaries.length} summaries`)
    return summaries
  }

  private buildSummaryPrompt(content: ContentToSummarize): string {
    return `You are an expert Korean beauty intelligence analyst for Seoul Sister, a premium $20/month Korean beauty platform. Analyze this ${content.platform} content from @${content.authorHandle} and provide a comprehensive summary.

CONTENT TO ANALYZE:
Caption: "${content.caption}"
Hashtags: ${content.hashtags.join(', ')}
Engagement: ${content.metrics.likes} likes, ${content.metrics.comments} comments${content.metrics.views ? `, ${content.metrics.views} views` : ''}
${content.transcriptText ? `\nVideo Transcript: "${content.transcriptText}"` : ''}
Published: ${content.publishedAt}

Please provide a JSON response with the following structure:
{
  "summary": "One compelling sentence describing the main content value",
  "keyInsights": ["3-4 specific beauty insights or tips mentioned"],
  "productMentions": ["Specific products mentioned with brands"],
  "trendSignals": ["Korean beauty trends or movements discussed"],
  "koreanBeautyTerms": ["Korean beauty terms or concepts mentioned"],
  "mainPoints": ["3-4 main points users would find valuable"],
  "sentimentScore": 0.8,
  "intelligenceValue": "high",
  "viewerValueProp": "Why Seoul Sister users would find this valuable"
}

ANALYSIS GUIDELINES:
- Focus on actionable Korean beauty insights
- Identify trending products, ingredients, or techniques
- Note Korean cultural beauty concepts
- Assess intelligence value: high (breakthrough trends), medium (useful tips), low (basic content)
- Sentiment: -1 (negative) to 1 (positive)
- Make the summary compelling for premium users paying $20/month

Respond only with valid JSON.`
  }

  private parseAIResponse(responseText: string): ContentSummary {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        summary: parsed.summary || 'Korean beauty content analysis',
        keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
        productMentions: Array.isArray(parsed.productMentions) ? parsed.productMentions : [],
        trendSignals: Array.isArray(parsed.trendSignals) ? parsed.trendSignals : [],
        koreanBeautyTerms: Array.isArray(parsed.koreanBeautyTerms) ? parsed.koreanBeautyTerms : [],
        mainPoints: Array.isArray(parsed.mainPoints) ? parsed.mainPoints : [],
        sentimentScore: typeof parsed.sentimentScore === 'number' ? parsed.sentimentScore : 0.5,
        intelligenceValue: ['high', 'medium', 'low'].includes(parsed.intelligenceValue) ? parsed.intelligenceValue : 'medium',
        viewerValueProp: parsed.viewerValueProp || 'Valuable Korean beauty insights'
      }
    } catch (error) {
      console.error('❌ Failed to parse AI response:', error)
      throw error
    }
  }

  private createFallbackSummary(content: ContentToSummarize): ContentSummary {
    return {
      summary: `${content.platform} content from @${content.authorHandle}`,
      keyInsights: ['Korean beauty content'],
      productMentions: this.extractProductsFromCaption(content.caption),
      trendSignals: this.extractTrendsFromHashtags(content.hashtags),
      koreanBeautyTerms: this.extractKoreanTerms(content.caption),
      mainPoints: [content.caption.substring(0, 100) + '...'],
      sentimentScore: 0.5,
      intelligenceValue: 'medium',
      viewerValueProp: 'Korean beauty insights from top influencer'
    }
  }

  private extractProductsFromCaption(caption: string): string[] {
    const products: string[] = []
    const productKeywords = [
      'COSRX', 'Beauty of Joseon', 'Laneige', 'Innisfree', 'The Ordinary',
      'Klairs', 'Purito', 'Some By Mi', 'Benton', 'Missha', 'Etude House'
    ]

    productKeywords.forEach(keyword => {
      if (caption.toLowerCase().includes(keyword.toLowerCase())) {
        products.push(keyword)
      }
    })

    return products
  }

  private extractTrendsFromHashtags(hashtags: string[]): string[] {
    const trendingHashtags = hashtags.filter(tag =>
      tag.toLowerCase().includes('trend') ||
      tag.toLowerCase().includes('viral') ||
      tag.toLowerCase().includes('glassskin') ||
      tag.toLowerCase().includes('kbeauty')
    )
    return trendingHashtags
  }

  private extractKoreanTerms(caption: string): string[] {
    const koreanTerms: string[] = []
    const terms = ['글래스스킨', '물광피부', '스킨케어', '화장품', '뷰티']

    terms.forEach(term => {
      if (caption.includes(term)) {
        koreanTerms.push(term)
      }
    })

    return koreanTerms
  }
}

// Factory function
export function createAIContentSummarizer(): AIContentSummarizer {
  return new AIContentSummarizer()
}