import { createClient } from '@supabase/supabase-js'
import { createApifyMonitor, getDefaultKoreanInfluencers } from './apify-service'
import { createSupaDataService, extractVideoUrls } from './supadata-service'
import { createAITrendAnalyzer, prepareContentForAnalysis } from './ai-trend-analyzer'
import { ContentManager } from './content-manager'
import { createAIContentSummarizer } from './ai-content-summarizer'
import {
  KOREAN_BEAUTY_INFLUENCERS,
  TIKTOK_VALIDATION_INFLUENCERS,
  getAllMonitoredInfluencers,
  getInfluencersBySchedule,
  getInfluencersByTier,
  MONITORING_SCHEDULE
} from '../config/korean-influencers'

interface IntelligenceConfig {
  supabaseUrl: string
  supabaseKey: string
  monitoring?: {
    enableScheduledRuns: boolean
    intervalHours: number
    maxContentPerRun: number
  }
}

interface MonitoringResult {
  success: boolean
  summary: {
    influencersMonitored: number
    contentScraped: number
    videosTranscribed: number
    trendsIdentified: number
    processingTimeMs: number
  }
  trends?: any
  error?: string
}

export class KoreanBeautyIntelligenceOrchestrator {
  private supabase: any
  private apifyMonitor: any
  private supaDataService: any
  private aiAnalyzer: any
  private contentManager: ContentManager
  private aiSummarizer: any
  private config: IntelligenceConfig

  constructor(config: IntelligenceConfig) {
    this.config = config
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey)
    this.apifyMonitor = createApifyMonitor()
    this.supaDataService = createSupaDataService()
    this.aiAnalyzer = createAITrendAnalyzer()
    this.contentManager = new ContentManager()
    this.aiSummarizer = createAIContentSummarizer()
  }

  /**
   * Run a complete intelligence gathering cycle using premium 12-influencer strategy
   */
  async runIntelligenceCycle(options: {
    influencers?: Array<{ handle: string; platform: 'instagram' | 'tiktok' }>
    maxContentPerInfluencer?: number
    includeTranscription?: boolean
    generateTrendReport?: boolean
    tier?: 'mega' | 'rising' | 'niche' | 'all'
    scheduleSlot?: 'morning' | 'afternoon' | 'evening' | 'all'
  } = {}): Promise<MonitoringResult> {
    const startTime = Date.now()

    try {
      console.log('🚀 Starting Premium Korean Beauty Intelligence Cycle')

      // Step 1: Get influencers to monitor using tier-based strategy
      const influencersToMonitor = await this.getInfluencersForMonitoring(options)
      console.log(`👥 Monitoring ${influencersToMonitor.length} influencers across ${new Set(influencersToMonitor.map(i => i.tier)).size} tiers`)

      // Step 2: Filter and prioritize content using ContentManager
      console.log('🔍 Pre-filtering content to avoid duplicates...')
      const influencerConfig = influencersToMonitor.map(inf => ({
        handle: inf.handle,
        platform: inf.platform,
        maxPosts: inf.maxPosts || options.maxContentPerInfluencer || 15
      }))

      // Step 3: Scrape content from influencers with premium actors
      console.log('📱 Scraping influencer content with premium actors...')
      const scrapingResult = await this.apifyMonitor.monitorInfluencers(influencerConfig)

      if (!scrapingResult.totalResults.length) {
        throw new Error('No content scraped from influencers')
      }

      // Step 4: Smart content filtering and deduplication
      console.log('🧠 Applying intelligent content filtering...')
      const filteredContent = await this.contentManager.filterContentForProcessing(
        scrapingResult.totalResults,
        { hours: 48 } // Only process content from last 48 hours
      )

      if (!filteredContent.length) {
        console.log('⚠️  All content was filtered out (likely duplicates or too old)')
        return {
          success: true,
          summary: {
            influencersMonitored: influencersToMonitor.length,
            contentScraped: 0,
            videosTranscribed: 0,
            trendsIdentified: 0,
            processingTimeMs: Date.now() - startTime
          }
        }
      }

      // Step 5: Calculate Seoul Sister Intelligence Scores
      console.log('⭐ Calculating Seoul Sister Intelligence Scores...')
      const scoredContent = await this.scoreAndPrioritizeContent(filteredContent, influencersToMonitor)

      // Step 6: Generate AI content summaries for high-value content
      console.log('🤖 Generating AI content summaries...')
      const contentWithSummaries = await this.generateContentSummaries(scoredContent)

      // Step 7: Save scraped content to database with intelligence tracking
      console.log('💾 Saving content to database with intelligence scores...')
      const savedContent = await this.saveContentToDatabase(contentWithSummaries)

      // Step 8: Mark content as processed to prevent future duplicates
      console.log('🔄 Updating content tracking database...')
      await this.markContentAsProcessed(savedContent)

      // Step 9: Extract and transcribe videos (if enabled)
      let transcriptionResults: any[] = []
      if (options.includeTranscription !== false) {
        console.log('🎬 Processing video transcriptions...')
        transcriptionResults = await this.processVideoTranscriptions(savedContent)
      }

      // Step 10: Cross-platform trend validation
      console.log('🔗 Running cross-platform trend validation...')
      const crossPlatformInsights = await this.runCrossPlatformValidation(savedContent, influencersToMonitor)

      // Step 11: Generate AI trend analysis (if enabled)
      let trendAnalysis = null
      if (options.generateTrendReport !== false) {
        console.log('🤖 Generating AI trend analysis with cross-platform insights...')
        trendAnalysis = await this.generateTrendAnalysis(savedContent, transcriptionResults, crossPlatformInsights)
      }

      const processingTime = Date.now() - startTime

      console.log(`✅ Premium Intelligence cycle completed in ${processingTime}ms`)
      console.log(`📊 Results: ${savedContent.length} content pieces, ${transcriptionResults.length} transcriptions, ${trendAnalysis?.emergingTrends?.length || 0} trends`)

      const result: MonitoringResult = {
        success: true,
        summary: {
          influencersMonitored: influencersToMonitor.length,
          contentScraped: savedContent.length,
          videosTranscribed: transcriptionResults.length,
          trendsIdentified: trendAnalysis?.emergingTrends?.length || 0,
          processingTimeMs: processingTime
        },
        trends: trendAnalysis
      }

      // Save cycle results to database
      await this.saveCycleResults(result)

      return result

    } catch (error) {
      console.error('❌ Premium Intelligence cycle failed:', error)
      return {
        success: false,
        summary: {
          influencersMonitored: 0,
          contentScraped: 0,
          videosTranscribed: 0,
          trendsIdentified: 0,
          processingTimeMs: Date.now() - startTime
        },
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Monitor trending Korean beauty hashtags and keywords
   */
  async monitorTrendingContent(options: {
    platform: 'instagram' | 'tiktok'
    hashtags?: string[]
    maxResults?: number
  }): Promise<{
    content: any[]
    insights: any
  }> {
    try {
      console.log(`🔍 Monitoring trending content on ${options.platform}`)

      // Default Korean beauty hashtags
      const defaultHashtags = [
        '#kbeauty', '#koreanbeauty', '#스킨케어', '#화장품',
        '#glassskin', '#koreanskincare', '#seoul', '#뷰티팁'
      ]

      const hashtagsToMonitor = options.hashtags || defaultHashtags

      const trendingContent = await this.apifyMonitor.searchKoreanBeautyTrends({
        platform: options.platform,
        hashtags: hashtagsToMonitor,
        maxResults: options.maxResults || 100
      })

      if (trendingContent.success && trendingContent.data.length > 0) {
        // Save trending content
        const savedContent = await this.saveContentToDatabase(trendingContent.data)

        // Quick AI analysis of trending patterns
        const insights = await this.aiAnalyzer.analyzeTrends({
          content: prepareContentForAnalysis(savedContent, []),
          timeframe: 'daily',
          focusArea: 'all'
        })

        return {
          content: savedContent,
          insights
        }
      }

      return {
        content: [],
        insights: null
      }

    } catch (error) {
      console.error('❌ Trending content monitoring failed:', error)
      return {
        content: [],
        insights: null
      }
    }
  }

  /**
   * Get intelligence dashboard data
   */
  async getDashboardData(timeframe: 'daily' | 'weekly' | 'monthly' = 'weekly'): Promise<{
    overview: {
      totalInfluencers: number
      totalContent: number
      activeTrends: number
      lastUpdate: string
    }
    emergingTrends: any[]
    topProducts: any[]
    trendingIngredients: any[]
    recentAlerts: any[]
  }> {
    try {
      // Get overview statistics
      const { data: influencerCount } = await this.supabase
        .from('korean_influencers')
        .select('id', { count: 'exact' })
        .eq('monitoring_active', true)

      const { data: contentCount } = await this.supabase
        .from('influencer_content')
        .select('id', { count: 'exact' })
        .gte('scraped_at', this.getTimeframeStart(timeframe))

      const { data: latestAnalysis } = await this.supabase
        .from('trend_analysis')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      // Get trending products
      const { data: topProducts } = await this.supabase
        .from('product_mentions')
        .select('*')
        .eq('is_trending', true)
        .gte('analyzed_at', this.getTimeframeStart(timeframe))
        .order('virality_score', { ascending: false })
        .limit(10)

      // Get trending ingredients
      const { data: trendingIngredients } = await this.supabase
        .from('ingredient_mentions')
        .select('*')
        .eq('is_trending', true)
        .gte('analyzed_at', this.getTimeframeStart(timeframe))
        .order('virality_score', { ascending: false })
        .limit(10)

      return {
        overview: {
          totalInfluencers: influencerCount?.length || 0,
          totalContent: contentCount?.length || 0,
          activeTrends: (latestAnalysis?.trending_products?.length || 0) + (latestAnalysis?.trending_ingredients?.length || 0),
          lastUpdate: latestAnalysis?.generated_at || new Date().toISOString()
        },
        emergingTrends: latestAnalysis?.emerging_trends || [],
        topProducts: topProducts || [],
        trendingIngredients: trendingIngredients || [],
        recentAlerts: [] // TODO: Implement user alerts
      }

    } catch (error) {
      console.error('❌ Dashboard data retrieval failed:', error)
      return {
        overview: {
          totalInfluencers: 0,
          totalContent: 0,
          activeTrends: 0,
          lastUpdate: new Date().toISOString()
        },
        emergingTrends: [],
        topProducts: [],
        trendingIngredients: [],
        recentAlerts: []
      }
    }
  }

  /**
   * Get influencers for monitoring based on tier and schedule preferences
   */
  private async getInfluencersForMonitoring(options: {
    tier?: 'mega' | 'rising' | 'niche' | 'all'
    scheduleSlot?: 'morning' | 'afternoon' | 'evening' | 'all'
  }): Promise<any[]> {
    let influencers = []

    if (options.tier && options.tier !== 'all') {
      influencers = getInfluencersByTier(options.tier)
    } else if (options.scheduleSlot && options.scheduleSlot !== 'all') {
      influencers = getInfluencersBySchedule(options.scheduleSlot)
    } else {
      // Use all 12 Korean beauty influencers + TikTok validation set
      influencers = getAllMonitoredInfluencers()
    }

    // Update last scraped timestamp for selected influencers
    influencers.forEach(inf => {
      inf.lastScraped = new Date().toISOString()
    })

    return influencers
  }

  /**
   * Score and prioritize content using Seoul Sister Intelligence algorithm
   */
  private async scoreAndPrioritizeContent(content: any[], influencers: any[]): Promise<any[]> {
    const scoredContent = []

    for (const item of content) {
      try {
        // Find influencer data for authority scoring
        const influencerData = influencers.find(inf =>
          inf.handle === item.authorHandle && inf.platform === item.platform
        )

        if (!influencerData) continue

        // Calculate time since posting
        const publishedAt = new Date(item.publishedAt)
        const hoursAgo = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60)

        // Calculate Seoul Sister Intelligence Score
        const contentScore = this.contentManager.calculateContentScore(
          item,
          influencerData,
          { hoursAgo }
        )

        // Add score to content item
        const scoredItem = {
          ...item,
          intelligenceScore: contentScore.total_score,
          priorityLevel: contentScore.priority_level,
          scoreBreakdown: {
            engagementVelocity: contentScore.engagement_velocity,
            influencerAuthority: contentScore.influencer_authority,
            contentRichness: contentScore.content_richness,
            trendNovelty: contentScore.trend_novelty
          }
        }

        scoredContent.push(scoredItem)
      } catch (error) {
        console.error('❌ Failed to score content item:', error)
        // Include unscored content with default values
        scoredContent.push({
          ...item,
          intelligenceScore: 0,
          priorityLevel: 'low',
          scoreBreakdown: null
        })
      }
    }

    // Sort by intelligence score (highest first)
    return scoredContent.sort((a, b) => b.intelligenceScore - a.intelligenceScore)
  }

  /**
   * Mark content as processed to prevent future duplicates
   */
  private async markContentAsProcessed(content: any[]): Promise<void> {
    for (const item of content) {
      try {
        await this.contentManager.markContentAsProcessed({
          post_id: item.platform_post_id || item.postId,
          platform: item.platform,
          influencer_handle: item.authorHandle,
          scraped_at: new Date().toISOString(),
          engagement_score: item.like_count + (item.comment_count * 10),
          content_hash: this.generateContentHash(item),
          virality_score: item.intelligenceScore || 0,
          trend_signals: item.hashtags || []
        })
      } catch (error) {
        console.error('❌ Failed to mark content as processed:', error)
      }
    }
  }

  /**
   * Run cross-platform trend validation
   */
  private async runCrossPlatformValidation(content: any[], influencers: any[]): Promise<any> {
    try {
      // Group content by platform
      const instagramContent = content.filter(c => c.platform === 'instagram')
      const tiktokContent = content.filter(c => c.platform === 'tiktok')

      // Find common hashtags across platforms
      const instagramHashtags = new Set(
        instagramContent.flatMap(c => c.hashtags || [])
      )
      const tiktokHashtags = new Set(
        tiktokContent.flatMap(c => c.hashtags || [])
      )

      const crossPlatformTags = [...instagramHashtags].filter(tag =>
        tiktokHashtags.has(tag)
      )

      // Find influencers active on both platforms
      const dualPlatformInfluencers = influencers.filter(inf => {
        const handle = inf.handle
        return influencers.some(other =>
          other.handle === handle && other.platform !== inf.platform
        )
      })

      // Calculate cross-platform validation score
      const validationScore = Math.min(100,
        (crossPlatformTags.length * 10) +
        (dualPlatformInfluencers.length * 5)
      )

      return {
        crossPlatformHashtags: crossPlatformTags,
        dualPlatformInfluencers: dualPlatformInfluencers.map(inf => inf.handle),
        validationScore,
        platformDistribution: {
          instagram: instagramContent.length,
          tiktok: tiktokContent.length
        },
        trendConsistency: crossPlatformTags.length > 0 ? 'high' : 'low'
      }
    } catch (error) {
      console.error('❌ Cross-platform validation failed:', error)
      return {
        crossPlatformHashtags: [],
        dualPlatformInfluencers: [],
        validationScore: 0,
        platformDistribution: { instagram: 0, tiktok: 0 },
        trendConsistency: 'unknown'
      }
    }
  }

  /**
   * Generate AI content summaries for premium hybrid approach
   */
  private async generateContentSummaries(content: any[]): Promise<any[]> {
    try {
      // Only summarize high and medium priority content to save API costs
      const highValueContent = content.filter(item =>
        item.priorityLevel === 'high' || item.priorityLevel === 'medium'
      )

      if (highValueContent.length === 0) {
        console.log('📝 No high-value content to summarize')
        return content
      }

      console.log(`📝 Generating AI summaries for ${highValueContent.length} high-value content pieces`)

      // Prepare content for AI summarization
      const contentForSummary = highValueContent.map(item => ({
        platform: item.platform,
        authorHandle: item.authorHandle,
        caption: item.caption || '',
        hashtags: item.hashtags || [],
        metrics: {
          likes: item.metrics?.likes || item.like_count || 0,
          comments: item.metrics?.comments || item.comment_count || 0,
          views: item.metrics?.views || item.view_count || 0
        },
        publishedAt: item.publishedAt,
        transcriptText: item.transcriptText || undefined,
        mediaUrls: item.mediaUrls || item.media_urls || []
      }))

      // Generate AI summaries
      const summaries = await this.aiSummarizer.batchSummarizeContent(contentForSummary)

      // Merge summaries back into content
      const contentWithSummaries = content.map(item => {
        const summaryIndex = highValueContent.findIndex(hvc =>
          hvc.postId === item.postId && hvc.platform === item.platform
        )

        if (summaryIndex >= 0 && summaries[summaryIndex]) {
          return {
            ...item,
            aiSummary: summaries[summaryIndex]
          }
        }

        return item
      })

      console.log(`✅ AI summaries generated for ${summaries.length} content pieces`)
      return contentWithSummaries

    } catch (error) {
      console.error('❌ Content summarization failed:', error)
      return content // Return original content if summarization fails
    }
  }

  /**
   * Generate content hash for duplicate detection
   */
  private generateContentHash(content: any): string {
    const hashString = `${content.authorHandle}-${content.caption?.substring(0, 100) || ''}-${content.publishedAt}`
    return Buffer.from(hashString).toString('base64').substring(0, 32)
  }

  private async saveContentToDatabase(content: any[]): Promise<any[]> {
    const savedContent: any[] = []

    for (const item of content) {
      try {
        // First, ensure influencer exists
        const { data: influencer } = await this.supabase
          .from('korean_influencers')
          .select('id')
          .eq('handle', item.authorHandle)
          .eq('platform', item.platform)
          .single()

        let currentInfluencer = influencer

        if (!influencer) {
          // Create influencer record
          const { data: newInfluencer } = await this.supabase
            .from('korean_influencers')
            .insert({
              name: item.authorHandle,
              handle: item.authorHandle,
              platform: item.platform,
              category: 'kbeauty_expert'
            })
            .select()
            .single()

          if (!newInfluencer) continue
          currentInfluencer = newInfluencer
        }

        // Save content with intelligence scoring data
        const { data: savedItem } = await this.supabase
          .from('influencer_content')
          .upsert({
            influencer_id: currentInfluencer.id,
            platform_post_id: item.postId || item.platform_post_id,
            platform: item.platform,
            post_url: item.url,
            caption: item.caption,
            hashtags: item.hashtags,
            mentions: item.mentions,
            media_urls: item.mediaUrls || item.media_urls,
            view_count: item.metrics?.views || item.view_count,
            like_count: item.metrics?.likes || item.like_count,
            comment_count: item.metrics?.comments || item.comment_count,
            share_count: item.metrics?.shares || item.share_count,
            published_at: item.publishedAt,
            intelligence_score: item.intelligenceScore || 0,
            priority_level: item.priorityLevel || 'low',
            content_richness: item.scoreBreakdown?.contentRichness || 0,
            trend_novelty: item.scoreBreakdown?.trendNovelty || 0,
            ai_summary: item.aiSummary || null,
            scraped_at: new Date().toISOString()
          }, {
            onConflict: 'platform_post_id,platform'
          })
          .select()
          .single()

        if (savedItem) {
          savedContent.push(savedItem)
        }

      } catch (error) {
        console.error(`❌ Failed to save content item:`, error)
      }
    }

    return savedContent
  }

  private async processVideoTranscriptions(content: any[]): Promise<any[]> {
    const transcriptions: any[] = []

    // Extract video URLs from content
    const videoUrls = extractVideoUrls(content)

    if (videoUrls.length === 0) {
      return transcriptions
    }

    // Process videos in batches
    const batchResult = await this.supaDataService.transcribeVideoBatch(
      videoUrls.slice(0, 20), // Limit to prevent overwhelming the API
      {
        language: 'auto',
        includeTimestamps: true
      }
    )

    // Save transcriptions to database
    for (const result of batchResult.results) {
      if (result.transcription.success) {
        try {
          // Find content ID for this video URL
          const contentItem = content.find(c =>
            c.media_urls?.includes(result.videoUrl)
          )

          if (contentItem) {
            const { data: savedTranscription } = await this.supabase
              .from('content_transcriptions')
              .insert({
                content_id: contentItem.id,
                video_url: result.videoUrl,
                transcript_text: result.transcription.text,
                language: result.transcription.language,
                confidence_score: result.transcription.confidence,
                processing_status: 'completed'
              })
              .select()
              .single()

            if (savedTranscription) {
              transcriptions.push(savedTranscription)
            }
          }
        } catch (error) {
          console.error('❌ Failed to save transcription:', error)
        }
      }
    }

    return transcriptions
  }

  private async generateTrendAnalysis(content: any[], transcriptions: any[], crossPlatformInsights?: any): Promise<any> {
    try {
      const analysisInput = prepareContentForAnalysis(content, transcriptions)

      const analysis = await this.aiAnalyzer.analyzeTrends({
        content: analysisInput,
        timeframe: 'weekly',
        focusArea: 'all'
      })

      // Save analysis to database
      const { data: savedAnalysis } = await this.supabase
        .from('trend_analysis')
        .insert({
          analysis_type: 'weekly',
          time_period_start: this.getTimeframeStart('weekly'),
          time_period_end: new Date().toISOString(),
          trending_products: analysis.productIntelligence,
          trending_ingredients: analysis.ingredientSpotlight,
          emerging_trends: analysis.emergingTrends,
          key_insights: analysis.actionableInsights.map((i: any) => i.insight),
          market_predictions: analysis.marketPredictions.trendsToWatch,
          total_content_analyzed: content.length,
          total_influencers_monitored: new Set(content.map(c => c.influencer_id)).size,
          ai_confidence_score: analysis.summary.confidenceScore
        })
        .select()
        .single()

      // Extract and save product mentions
      await this.extractAndSaveProductMentions(content, transcriptions, analysis)

      return analysis

    } catch (error) {
      console.error('❌ Trend analysis generation failed:', error)
      return null
    }
  }

  private async extractAndSaveProductMentions(content: any[], transcriptions: any[], analysis: any): Promise<void> {
    try {
      for (const product of analysis.productIntelligence || []) {
        await this.supabase
          .from('product_mentions')
          .upsert({
            product_name: product.productName,
            brand_name: product.brandName,
            product_category: product.category,
            mention_context: `Trending product identified in ${product.mentionCount} mentions`,
            sentiment: product.sentimentScore > 0.1 ? 'positive' : product.sentimentScore < -0.1 ? 'negative' : 'neutral',
            sentiment_score: product.sentimentScore,
            is_trending: true,
            virality_score: Math.min(100, product.mentionCount * 10)
          }, {
            onConflict: 'product_name,brand_name'
          })
      }

      for (const ingredient of analysis.ingredientSpotlight || []) {
        await this.supabase
          .from('ingredient_mentions')
          .upsert({
            ingredient_name: ingredient.name,
            korean_name: ingredient.koreanName,
            ingredient_category: ingredient.category,
            mention_context: ingredient.trendingReason,
            sentiment: 'positive', // Trending ingredients are typically positive
            sentiment_score: 0.7,
            is_trending: true,
            virality_score: 75,
            skin_type_compatibility: ingredient.skinTypeCompatibility,
            safety_concerns: ingredient.cautionsAndAllergies
          }, {
            onConflict: 'ingredient_name'
          })
      }

    } catch (error) {
      console.error('❌ Failed to save product/ingredient mentions:', error)
    }
  }

  private async saveCycleResults(result: MonitoringResult): Promise<void> {
    try {
      await this.supabase
        .from('monitoring_jobs')
        .insert({
          job_type: 'intelligence_cycle',
          job_status: result.success ? 'completed' : 'failed',
          job_config: {
            automated: true,
            timestamp: new Date().toISOString()
          },
          results_summary: result.summary,
          error_message: result.error,
          completed_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('❌ Failed to save cycle results:', error)
    }
  }

  private getTimeframeStart(timeframe: 'daily' | 'weekly' | 'monthly'): string {
    const now = new Date()
    switch (timeframe) {
      case 'daily':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      case 'weekly':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      case 'monthly':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  }
}

// Factory function for easy instantiation
export function createIntelligenceOrchestrator(): KoreanBeautyIntelligenceOrchestrator {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration required for intelligence orchestrator')
  }

  return new KoreanBeautyIntelligenceOrchestrator({
    supabaseUrl,
    supabaseKey,
    monitoring: {
      enableScheduledRuns: true,
      intervalHours: 6, // Run every 6 hours
      maxContentPerRun: 200
    }
  })
}