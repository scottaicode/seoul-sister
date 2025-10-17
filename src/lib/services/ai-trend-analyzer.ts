import Anthropic from '@anthropic-ai/sdk'

interface TrendAnalysisInput {
  content: Array<{
    platform: string
    caption: string
    hashtags: string[]
    transcription?: string
    authorHandle: string
    metrics: {
      likes: number
      views?: number
      comments: number
      shares?: number
    }
    publishedAt: string
  }>
  timeframe: 'daily' | 'weekly' | 'monthly'
  focusArea?: 'products' | 'ingredients' | 'techniques' | 'brands' | 'all'
}

interface TrendAnalysisResult {
  summary: {
    totalContentAnalyzed: number
    timeframeCovered: string
    confidenceScore: number
    generatedAt: string
  }
  emergingTrends: Array<{
    name: string
    category: 'product' | 'ingredient' | 'technique' | 'brand'
    description: string
    confidenceScore: number
    momentum: 'rising' | 'stable' | 'declining'
    koreanOrigin: boolean
    estimatedUSArrival: string // When trend might hit US market
    relatedKeywords: string[]
    influencerMentions: string[]
  }>
  productIntelligence: Array<{
    productName: string
    brandName: string
    category: string
    mentionCount: number
    sentimentScore: number
    priceIntelligence: {
      estimatedSeoulPrice: string
      estimatedUSPrice: string
      arbitrageOpportunity: number
    }
    availabilityStatus: 'widely_available' | 'limited' | 'exclusive' | 'upcoming'
  }>
  ingredientSpotlight: Array<{
    name: string
    koreanName?: string
    category: string
    trendingReason: string
    scientificBenefits: string[]
    skinTypeCompatibility: string[]
    cautionsAndAllergies: string[]
    combinationAdvice: string[]
  }>
  marketPredictions: {
    nextBigTrend: string
    trendsToWatch: string[]
    decliningTrends: string[]
    usMarketTimeline: Array<{
      trend: string
      estimatedArrival: string
      preparationAdvice: string
    }>
  }
  actionableInsights: Array<{
    insight: string
    category: 'sourcing' | 'marketing' | 'product_development' | 'customer_education'
    priority: 'high' | 'medium' | 'low'
    timeline: 'immediate' | 'short_term' | 'long_term'
  }>
}

export class AITrendAnalyzer {
  private anthropic: Anthropic

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }

    this.anthropic = new Anthropic({
      apiKey: apiKey
    })
  }

  /**
   * Analyze content for Korean beauty trends using Claude Opus 4.1
   */
  async analyzeTrends(input: TrendAnalysisInput): Promise<TrendAnalysisResult> {
    try {
      console.log(`🤖 Starting AI trend analysis on ${input.content.length} pieces of content`)

      const analysisPrompt = this.buildAnalysisPrompt(input)

      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1-20250805', // Seoul Sister's specified AI model
        max_tokens: 4000,
        temperature: 0.3, // Lower temperature for more consistent analysis
        system: this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: analysisPrompt
          }
        ]
      })

      const analysisText = response.content[0].type === 'text' ? response.content[0].text : ''

      // Parse the structured response from Claude
      const result = this.parseAnalysisResponse(analysisText, input)

      console.log(`✅ AI trend analysis completed with ${result.emergingTrends.length} trends identified`)

      return result

    } catch (error) {
      console.error('❌ AI trend analysis failed:', error)
      throw new Error(`AI trend analysis failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Analyze a single product for market potential
   */
  async analyzeProductPotential(productData: {
    name: string
    brand: string
    ingredients: string[]
    priceInSeoul: number
    priceInUS: number
    mentionCount: number
    influencerFeedback: string[]
  }): Promise<{
    marketPotential: 'high' | 'medium' | 'low'
    reasoning: string
    arbitrageScore: number
    riskFactors: string[]
    recommendations: string[]
  }> {
    try {
      const prompt = `
Analyze this Korean beauty product for Seoul Sister's marketplace:

Product: ${productData.name} by ${productData.brand}
Ingredients: ${productData.ingredients.join(', ')}
Seoul Price: $${productData.priceInSeoul}
US Price: $${productData.priceInUS}
Mention Count: ${productData.mentionCount}
Influencer Feedback: ${productData.influencerFeedback.join(' | ')}

Provide analysis in JSON format with marketPotential, reasoning, arbitrageScore (0-100), riskFactors array, and recommendations array.
`

      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 1000,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }]
      })

      const analysisText = response.content[0].type === 'text' ? response.content[0].text : ''
      return JSON.parse(this.extractJsonFromResponse(analysisText))

    } catch (error) {
      console.error('❌ Product analysis failed:', error)
      return {
        marketPotential: 'low',
        reasoning: 'Analysis failed',
        arbitrageScore: 0,
        riskFactors: ['Analysis error'],
        recommendations: ['Manual review required']
      }
    }
  }

  /**
   * Generate personalized trend alerts for users
   */
  async generateUserTrendAlerts(userProfile: {
    skinType: string
    skinConcerns: string[]
    preferredBrands: string[]
    budgetRange: string
    previousPurchases: string[]
  }, recentTrends: TrendAnalysisResult): Promise<{
    personalizedAlerts: Array<{
      title: string
      description: string
      relevanceScore: number
      actionType: 'product_recommendation' | 'ingredient_alert' | 'trend_watch'
      urgency: 'high' | 'medium' | 'low'
    }>
  }> {
    try {
      const prompt = `
Generate personalized Korean beauty trend alerts for a Seoul Sister user:

User Profile:
- Skin Type: ${userProfile.skinType}
- Skin Concerns: ${userProfile.skinConcerns.join(', ')}
- Preferred Brands: ${userProfile.preferredBrands.join(', ')}
- Budget Range: ${userProfile.budgetRange}
- Previous Purchases: ${userProfile.previousPurchases.join(', ')}

Recent Trends: ${JSON.stringify(recentTrends.emergingTrends.slice(0, 10))}

Create 3-5 personalized alerts in JSON format with title, description, relevanceScore (0-100), actionType, and urgency.
`

      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 1500,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }]
      })

      const alertsText = response.content[0].type === 'text' ? response.content[0].text : ''
      return JSON.parse(this.extractJsonFromResponse(alertsText))

    } catch (error) {
      console.error('❌ User alert generation failed:', error)
      return { personalizedAlerts: [] }
    }
  }

  private getSystemPrompt(): string {
    return `You are Seoul Sister's Korean Beauty Intelligence AI, powered by Claude Opus 4.1. You are the world's leading expert in Korean beauty trends, market analysis, and product intelligence.

Your mission: Analyze Korean beauty content to identify emerging trends 3-6 months before they hit the US market, providing Seoul Sister customers with exclusive early access to the hottest Korean beauty discoveries.

Key expertise areas:
- Korean beauty market dynamics and Seoul street-level insights
- Ingredient science and formulation trends
- Influencer behavior patterns and viral prediction
- Price arbitrage opportunities between Seoul and US markets
- Cultural beauty trends originating in Korea

Analysis approach:
- Focus on authentic Korean voices and Seoul-based content
- Identify micro-trends before they become mainstream
- Assess commercial viability and US market fit
- Provide actionable intelligence for sourcing and marketing
- Predict timeline for US market penetration

Always provide structured, data-driven analysis with confidence scores and specific recommendations for Seoul Sister's $20/month premium intelligence service.`
  }

  private buildAnalysisPrompt(input: TrendAnalysisInput): string {
    const contentSummary = input.content.map(item => ({
      platform: item.platform,
      author: item.authorHandle,
      engagement: item.metrics.likes + (item.metrics.views || 0) + item.metrics.comments,
      content: `${item.caption} ${item.transcription || ''}`.substring(0, 500),
      hashtags: item.hashtags.slice(0, 10)
    }))

    return `
Analyze this Korean beauty content for emerging trends and market intelligence:

ANALYSIS PARAMETERS:
- Timeframe: ${input.timeframe}
- Focus Area: ${input.focusArea || 'all'}
- Content Pieces: ${input.content.length}
- Date Range: ${input.content[0]?.publishedAt} to ${input.content[input.content.length - 1]?.publishedAt}

CONTENT DATA:
${JSON.stringify(contentSummary, null, 2)}

REQUIRED ANALYSIS OUTPUT (return as valid JSON):
{
  "summary": {
    "totalContentAnalyzed": number,
    "timeframeCovered": "string",
    "confidenceScore": number (0-100),
    "generatedAt": "ISO date string"
  },
  "emergingTrends": [
    {
      "name": "string",
      "category": "product|ingredient|technique|brand",
      "description": "string",
      "confidenceScore": number (0-100),
      "momentum": "rising|stable|declining",
      "koreanOrigin": boolean,
      "estimatedUSArrival": "timeframe string",
      "relatedKeywords": ["string"],
      "influencerMentions": ["string"]
    }
  ],
  "productIntelligence": [
    {
      "productName": "string",
      "brandName": "string",
      "category": "string",
      "mentionCount": number,
      "sentimentScore": number (-1 to 1),
      "priceIntelligence": {
        "estimatedSeoulPrice": "string",
        "estimatedUSPrice": "string",
        "arbitrageOpportunity": number (percentage)
      },
      "availabilityStatus": "widely_available|limited|exclusive|upcoming"
    }
  ],
  "ingredientSpotlight": [
    {
      "name": "string",
      "koreanName": "string",
      "category": "string",
      "trendingReason": "string",
      "scientificBenefits": ["string"],
      "skinTypeCompatibility": ["string"],
      "cautionsAndAllergies": ["string"],
      "combinationAdvice": ["string"]
    }
  ],
  "marketPredictions": {
    "nextBigTrend": "string",
    "trendsToWatch": ["string"],
    "decliningTrends": ["string"],
    "usMarketTimeline": [
      {
        "trend": "string",
        "estimatedArrival": "string",
        "preparationAdvice": "string"
      }
    ]
  },
  "actionableInsights": [
    {
      "insight": "string",
      "category": "sourcing|marketing|product_development|customer_education",
      "priority": "high|medium|low",
      "timeline": "immediate|short_term|long_term"
    }
  ]
}

Focus on identifying trends that are:
1. Originating in Korea (especially Seoul)
2. Not yet mainstream in the US market
3. Showing strong engagement/momentum
4. Commercially viable for Seoul Sister's model
5. Aligned with Gen Z beauty preferences

Provide specific, actionable intelligence that gives Seoul Sister customers a 3-6 month head start on trends.
`
  }

  private parseAnalysisResponse(responseText: string, input: TrendAnalysisInput): TrendAnalysisResult {
    try {
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      // Ensure all required fields are present with defaults
      return {
        summary: {
          totalContentAnalyzed: parsed.summary?.totalContentAnalyzed || input.content.length,
          timeframeCovered: parsed.summary?.timeframeCovered || input.timeframe,
          confidenceScore: parsed.summary?.confidenceScore || 75,
          generatedAt: parsed.summary?.generatedAt || new Date().toISOString()
        },
        emergingTrends: parsed.emergingTrends || [],
        productIntelligence: parsed.productIntelligence || [],
        ingredientSpotlight: parsed.ingredientSpotlight || [],
        marketPredictions: parsed.marketPredictions || {
          nextBigTrend: 'Analysis in progress',
          trendsToWatch: [],
          decliningTrends: [],
          usMarketTimeline: []
        },
        actionableInsights: parsed.actionableInsights || []
      }

    } catch (error) {
      console.error('❌ Failed to parse AI response:', error)

      // Return fallback result
      return {
        summary: {
          totalContentAnalyzed: input.content.length,
          timeframeCovered: input.timeframe,
          confidenceScore: 0,
          generatedAt: new Date().toISOString()
        },
        emergingTrends: [],
        productIntelligence: [],
        ingredientSpotlight: [],
        marketPredictions: {
          nextBigTrend: 'Analysis failed',
          trendsToWatch: [],
          decliningTrends: [],
          usMarketTimeline: []
        },
        actionableInsights: [{
          insight: 'AI analysis failed - manual review required',
          category: 'product_development',
          priority: 'high',
          timeline: 'immediate'
        }]
      }
    }
  }

  private extractJsonFromResponse(text: string): string {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? jsonMatch[0] : '{}'
  }
}

// Factory function for easy instantiation
export function createAITrendAnalyzer(): AITrendAnalyzer {
  return new AITrendAnalyzer()
}

// Helper function to prepare content for analysis
export function prepareContentForAnalysis(
  influencerContent: any[],
  transcriptions: any[]
): TrendAnalysisInput['content'] {
  return influencerContent.map(content => {
    // Find matching transcription
    const transcription = transcriptions.find(t =>
      t.content_id === content.id ||
      t.video_url === content.mediaUrls?.[0]
    )

    return {
      platform: content.platform,
      caption: content.caption || '',
      hashtags: content.hashtags || [],
      transcription: transcription?.transcript_text || undefined,
      authorHandle: content.authorHandle,
      metrics: {
        likes: content.metrics?.likes || 0,
        views: content.metrics?.views,
        comments: content.metrics?.comments || 0,
        shares: content.metrics?.shares
      },
      publishedAt: content.publishedAt
    }
  })
}

// Predefined trending categories for Korean beauty
export const KOREAN_BEAUTY_CATEGORIES = {
  products: [
    'essence', 'ampoule', 'serum', 'toner', 'cleanser', 'moisturizer',
    'sunscreen', 'mask', 'exfoliant', 'eye_cream', 'sleeping_mask',
    'cushion', 'foundation', 'concealer', 'lip_tint', 'eyeshadow'
  ],
  ingredients: [
    'snail_mucin', 'centella_asiatica', 'ginseng', 'green_tea',
    'hyaluronic_acid', 'niacinamide', 'vitamin_c', 'retinol',
    'ceramides', 'peptides', 'aha', 'bha', 'pha', 'bakuchiol'
  ],
  techniques: [
    'glass_skin', 'honey_skin', 'double_cleanse', 'layering',
    'slugging', 'facial_massage', 'gua_sha', 'ice_therapy',
    'sheet_masking', 'essence_patting', 'jamsu', 'gradient_lips'
  ],
  brands: [
    'innisfree', 'laneige', 'sulwhasoo', 'etude_house', 'missha',
    'cosrx', 'klairs', 'purito', 'beauty_of_joseon', 'benton',
    'some_by_mi', 'torriden', 'anua', 'round_lab', 'mixsoon'
  ]
}