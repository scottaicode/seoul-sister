import { createClient } from '@supabase/supabase-js'
import { createApifyMonitor, getDefaultKoreanInfluencers } from './apify-service'
import { createSupaDataService, extractVideoUrls } from './supadata-service'
import { createAITrendAnalyzer, prepareContentForAnalysis } from './ai-trend-analyzer'

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
  private config: IntelligenceConfig

  constructor(config: IntelligenceConfig) {
    this.config = config
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey)
    this.apifyMonitor = createApifyMonitor()
    this.supaDataService = createSupaDataService()
    this.aiAnalyzer = createAITrendAnalyzer()
  }

  /**
   * Run a complete intelligence gathering cycle
   */
  async runIntelligenceCycle(options: {
    influencers?: Array<{ handle: string; platform: 'instagram' | 'tiktok' }>
    maxContentPerInfluencer?: number
    includeTranscription?: boolean
    generateTrendReport?: boolean
  } = {}): Promise<MonitoringResult> {
    const startTime = Date.now()

    try {
      console.log('🚀 Starting Korean Beauty Intelligence Cycle')

      // Step 1: Get influencers to monitor
      const influencersToMonitor = options.influencers || getDefaultKoreanInfluencers()

      // Step 2: Scrape content from influencers
      console.log('📱 Scraping influencer content...')
      const scrapingResult = await this.apifyMonitor.monitorInfluencers(
        influencersToMonitor.map(inf => ({
          ...inf,
          maxPosts: options.maxContentPerInfluencer || 10
        }))
      )

      if (!scrapingResult.totalResults.length) {
        throw new Error('No content scraped from influencers')
      }

      // Step 3: Save scraped content to database
      console.log('💾 Saving content to database...')
      const savedContent = await this.saveContentToDatabase(scrapingResult.totalResults)

      // Step 4: Extract and transcribe videos (if enabled)
      let transcriptionResults: any[] = []
      if (options.includeTranscription !== false) {
        console.log('🎬 Processing video transcriptions...')
        transcriptionResults = await this.processVideoTranscriptions(savedContent)
      }

      // Step 5: Generate AI trend analysis (if enabled)
      let trendAnalysis = null
      if (options.generateTrendReport !== false) {
        console.log('🤖 Generating AI trend analysis...')
        trendAnalysis = await this.generateTrendAnalysis(savedContent, transcriptionResults)
      }

      const processingTime = Date.now() - startTime

      console.log(`✅ Intelligence cycle completed in ${processingTime}ms`)

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
      console.error('❌ Intelligence cycle failed:', error)
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
        }

        // Save content
        const { data: savedItem } = await this.supabase
          .from('influencer_content')
          .upsert({
            influencer_id: influencer?.id || newInfluencer.id,
            platform_post_id: item.postId,
            platform: item.platform,
            post_url: item.url,
            caption: item.caption,
            hashtags: item.hashtags,
            mentions: item.mentions,
            media_urls: item.mediaUrls,
            view_count: item.metrics.views,
            like_count: item.metrics.likes,
            comment_count: item.metrics.comments,
            share_count: item.metrics.shares,
            published_at: item.publishedAt
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

  private async generateTrendAnalysis(content: any[], transcriptions: any[]): Promise<any> {
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
          key_insights: analysis.actionableInsights.map(i => i.insight),
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