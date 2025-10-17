// Dynamic import to handle package availability
let ApifyApi: any
try {
  ApifyApi = require('apify-client').ApifyApi
} catch (error) {
  console.warn('apify-client not available, using API fetch implementation')
  ApifyApi = null
}

type ApifyClient = any

interface ApifyConfig {
  apiKey: string
}

// Direct API implementation when package is not available
class ApifyAPIImplementation {
  private token: string
  private baseURL = 'https://api.apify.com/v2'

  constructor(token: string) {
    this.token = token
  }

  actor(actorId: string) {
    return {
      call: async (input: any) => {
        const response = await fetch(`${this.baseURL}/acts/${actorId}/runs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(input)
        })

        if (!response.ok) {
          throw new Error(`Apify API error: ${response.status}`)
        }

        const data = await response.json()
        return { defaultDatasetId: data.data?.defaultDatasetId }
      }
    }
  }

  dataset(datasetId: string) {
    return {
      listItems: async () => {
        const response = await fetch(`${this.baseURL}/datasets/${datasetId}/items`, {
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        })

        if (!response.ok) {
          throw new Error(`Apify Dataset API error: ${response.status}`)
        }

        const items = await response.json()
        return { items: Array.isArray(items) ? items : [] }
      }
    }
  }
}

interface InfluencerContent {
  platform: 'instagram' | 'tiktok'
  postId: string
  url: string
  caption: string
  hashtags: string[]
  mentions: string[]
  mediaUrls: string[]
  metrics: {
    views?: number
    likes: number
    comments: number
    shares?: number
  }
  publishedAt: string
  authorHandle: string
}

interface ScrapingResult {
  success: boolean
  data: InfluencerContent[]
  error?: string
  totalScraped: number
}

export class ApifyInfluencerMonitor {
  private apify: ApifyClient

  constructor(config: ApifyConfig) {
    if (ApifyApi) {
      this.apify = new ApifyApi({ token: config.apiKey })
    } else {
      // Use direct API calls when package not available
      this.apify = new ApifyAPIImplementation(config.apiKey)
    }
  }

  /**
   * Scrape Instagram posts from a specific influencer
   */
  async scrapeInstagramInfluencer(
    username: string,
    options: {
      maxPosts?: number
      includeStories?: boolean
      includeReels?: boolean
    } = {}
  ): Promise<ScrapingResult> {
    try {
      console.log(`🔍 Starting Instagram scrape for @${username}`)

      // Premium input with full feature access
      const input = {
        username: [username],
        resultsType: 'posts',
        resultsLimit: options.maxPosts || 30, // Higher limit for premium
        includeStories: options.includeStories || false,
        includeReels: options.includeReels || true,
        searchType: 'user',
        addParentData: true, // Get rich metadata
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      }

      // Use premium Instagram Scraper actor with residential proxy access
      const run = await this.apify.actor('shu8hvrXbJbY3Eb9W').call(input)

      if (!run.defaultDatasetId) {
        throw new Error('No dataset ID returned from Apify')
      }

      const dataset = await this.apify.dataset(run.defaultDatasetId).listItems()

      const processedData: InfluencerContent[] = dataset.items.map((item: any) => ({
        platform: 'instagram' as const,
        postId: item.id || item.shortCode,
        url: item.url || `https://instagram.com/p/${item.shortCode}`,
        caption: item.caption || '',
        hashtags: this.extractHashtags(item.caption || ''),
        mentions: this.extractMentions(item.caption || ''),
        mediaUrls: this.extractMediaUrls(item),
        metrics: {
          likes: item.likesCount || 0,
          comments: item.commentsCount || 0,
          views: item.videoViewCount || item.videoPlayCount
        },
        publishedAt: item.timestamp || item.takenAt,
        authorHandle: username
      }))

      console.log(`✅ Instagram scrape completed: ${processedData.length} posts from @${username}`)

      return {
        success: true,
        data: processedData,
        totalScraped: processedData.length
      }

    } catch (error) {
      console.error(`❌ Instagram scraping failed for @${username}:`, error)
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        totalScraped: 0
      }
    }
  }

  /**
   * Scrape TikTok posts from a specific influencer
   */
  async scrapeTikTokInfluencer(
    username: string,
    options: {
      maxPosts?: number
    } = {}
  ): Promise<ScrapingResult> {
    try {
      console.log(`🔍 Starting TikTok scrape for @${username}`)

      // Premium TikTok input with enhanced features
      const input = {
        profiles: [username],
        resultsPerPage: options.maxPosts || 25,
        shouldDownloadCovers: false,
        shouldDownloadVideos: false,
        shouldDownloadSubtitles: true, // For transcription analysis
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'],
          apifyProxyCountry: 'KR' // Korean proxies for better content relevance
        }
      }

      // Use premium TikTok scraper with enhanced capabilities
      const run = await this.apify.actor('clockworks/tiktok-scraper').call(input)

      if (!run.defaultDatasetId) {
        throw new Error('No dataset ID returned from Apify')
      }

      const dataset = await this.apify.dataset(run.defaultDatasetId).listItems()

      const processedData: InfluencerContent[] = dataset.items.map((item: any) => ({
        platform: 'tiktok' as const,
        postId: item.id,
        url: item.webVideoUrl || `https://tiktok.com/@${username}/video/${item.id}`,
        caption: item.text || '',
        hashtags: this.extractHashtags(item.text || ''),
        mentions: this.extractMentions(item.text || ''),
        mediaUrls: item.videoUrl ? [item.videoUrl] : [],
        metrics: {
          likes: item.diggCount || 0,
          comments: item.commentCount || 0,
          shares: item.shareCount || 0,
          views: item.playCount || 0
        },
        publishedAt: new Date(item.createTime * 1000).toISOString(),
        authorHandle: username
      }))

      console.log(`✅ TikTok scrape completed: ${processedData.length} posts from @${username}`)

      return {
        success: true,
        data: processedData,
        totalScraped: processedData.length
      }

    } catch (error) {
      console.error(`❌ TikTok scraping failed for @${username}:`, error)
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        totalScraped: 0
      }
    }
  }

  /**
   * Monitor multiple influencers across platforms
   */
  async monitorInfluencers(influencers: Array<{
    handle: string
    platform: 'instagram' | 'tiktok'
    maxPosts?: number
  }>): Promise<{
    totalResults: InfluencerContent[]
    summary: {
      totalInfluencers: number
      totalPosts: number
      successfulScrapes: number
      failedScrapes: number
    }
  }> {
    console.log(`🚀 Starting bulk influencer monitoring: ${influencers.length} influencers`)

    const results: InfluencerContent[] = []
    let successfulScrapes = 0
    let failedScrapes = 0

    // Process influencers in batches to avoid rate limits
    const batchSize = 3
    for (let i = 0; i < influencers.length; i += batchSize) {
      const batch = influencers.slice(i, i + batchSize)

      const batchPromises = batch.map(async (influencer) => {
        try {
          let result: ScrapingResult

          if (influencer.platform === 'instagram') {
            result = await this.scrapeInstagramInfluencer(influencer.handle, {
              maxPosts: influencer.maxPosts || 10,
              includeReels: true
            })
          } else {
            result = await this.scrapeTikTokInfluencer(influencer.handle, {
              maxPosts: influencer.maxPosts || 10
            })
          }

          if (result.success) {
            results.push(...result.data)
            successfulScrapes++
          } else {
            failedScrapes++
            console.error(`Failed to scrape ${influencer.platform}/@${influencer.handle}:`, result.error)
          }
        } catch (error) {
          failedScrapes++
          console.error(`Error processing ${influencer.platform}/@${influencer.handle}:`, error)
        }
      })

      await Promise.all(batchPromises)

      // Add delay between batches to respect rate limits
      if (i + batchSize < influencers.length) {
        console.log(`⏳ Waiting 30 seconds before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 30000))
      }
    }

    console.log(`🎯 Monitoring completed: ${results.length} total posts scraped`)

    return {
      totalResults: results,
      summary: {
        totalInfluencers: influencers.length,
        totalPosts: results.length,
        successfulScrapes,
        failedScrapes
      }
    }
  }

  /**
   * Search for trending Korean beauty content
   */
  async searchKoreanBeautyTrends(options: {
    platform: 'instagram' | 'tiktok'
    hashtags?: string[]
    keywords?: string[]
    maxResults?: number
  }): Promise<ScrapingResult> {
    try {
      const searchTerms = [
        ...(options.hashtags || []),
        ...(options.keywords || []),
        // Default Korean beauty terms
        '#kbeauty', '#koreanbeauty', '#스킨케어', '#화장품', '#뷰티',
        'korean skincare', 'k beauty', 'seoul beauty'
      ]

      console.log(`🔍 Searching for trending content: ${searchTerms.join(', ')}`)

      if (options.platform === 'instagram') {
        return await this.searchInstagramByHashtags(searchTerms, options.maxResults || 50)
      } else {
        return await this.searchTikTokByKeywords(searchTerms, options.maxResults || 50)
      }
    } catch (error) {
      console.error('❌ Trend search failed:', error)
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        totalScraped: 0
      }
    }
  }

  private async searchInstagramByHashtags(hashtags: string[], maxResults: number): Promise<ScrapingResult> {
    const input = {
      hashtags: hashtags.slice(0, 5), // Limit to avoid rate limits
      resultsType: 'posts',
      resultsLimit: maxResults,
      searchType: 'hashtag'
    }

    const run = await this.apify.actor('apify/instagram-scraper').call(input)
    const dataset = await this.apify.dataset(run.defaultDatasetId!).listItems()

    const processedData: InfluencerContent[] = dataset.items.map((item: any) => ({
      platform: 'instagram' as const,
      postId: item.id || item.shortCode,
      url: item.url || `https://instagram.com/p/${item.shortCode}`,
      caption: item.caption || '',
      hashtags: this.extractHashtags(item.caption || ''),
      mentions: this.extractMentions(item.caption || ''),
      mediaUrls: this.extractMediaUrls(item),
      metrics: {
        likes: item.likesCount || 0,
        comments: item.commentsCount || 0,
        views: item.videoViewCount
      },
      publishedAt: item.timestamp || item.takenAt,
      authorHandle: item.ownerUsername || 'unknown'
    }))

    return {
      success: true,
      data: processedData,
      totalScraped: processedData.length
    }
  }

  private async searchTikTokByKeywords(keywords: string[], maxResults: number): Promise<ScrapingResult> {
    const input = {
      searchQueries: keywords.slice(0, 3), // Limit searches
      resultsPerPage: Math.ceil(maxResults / keywords.length),
      shouldDownloadCovers: false,
      shouldDownloadVideos: false,
      shouldDownloadSubtitles: true
    }

    const run = await this.apify.actor('apify/tiktok-scraper').call(input)
    const dataset = await this.apify.dataset(run.defaultDatasetId!).listItems()

    const processedData: InfluencerContent[] = dataset.items.map((item: any) => ({
      platform: 'tiktok' as const,
      postId: item.id,
      url: item.webVideoUrl || `https://tiktok.com/video/${item.id}`,
      caption: item.text || '',
      hashtags: this.extractHashtags(item.text || ''),
      mentions: this.extractMentions(item.text || ''),
      mediaUrls: item.videoUrl ? [item.videoUrl] : [],
      metrics: {
        likes: item.diggCount || 0,
        comments: item.commentCount || 0,
        shares: item.shareCount || 0,
        views: item.playCount || 0
      },
      publishedAt: new Date(item.createTime * 1000).toISOString(),
      authorHandle: item.authorMeta?.name || 'unknown'
    }))

    return {
      success: true,
      data: processedData,
      totalScraped: processedData.length
    }
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w가-힣]+/g
    return text.match(hashtagRegex) || []
  }

  private extractMentions(text: string): string[] {
    const mentionRegex = /@[\w가-힣]+/g
    return text.match(mentionRegex) || []
  }

  private extractMediaUrls(item: any): string[] {
    const urls: string[] = []

    if (item.displayUrl) urls.push(item.displayUrl)
    if (item.videoUrl) urls.push(item.videoUrl)
    if (item.sidecarChildren) {
      item.sidecarChildren.forEach((child: any) => {
        if (child.displayUrl) urls.push(child.displayUrl)
        if (child.videoUrl) urls.push(child.videoUrl)
      })
    }

    return urls
  }
}

// Factory function for easy instantiation
export function createApifyMonitor(): ApifyInfluencerMonitor {
  const apiKey = process.env.APIFY_API_KEY

  if (!apiKey) {
    throw new Error('APIFY_API_KEY environment variable is required')
  }

  return new ApifyInfluencerMonitor({ apiKey })
}

// Helper function to get default Korean beauty influencers
export function getDefaultKoreanInfluencers() {
  return [
    { handle: 'ponysmakeup', platform: 'instagram' as const, maxPosts: 15 },
    { handle: 'ssin_makeup', platform: 'instagram' as const, maxPosts: 15 },
    { handle: 'directorpi', platform: 'instagram' as const, maxPosts: 10 },
    { handle: 'jella_cosmetic', platform: 'instagram' as const, maxPosts: 10 },
    { handle: 'liahyoo', platform: 'instagram' as const, maxPosts: 10 },
    { handle: 'gothamista', platform: 'instagram' as const, maxPosts: 10 },
    { handle: 'ponysmakeup', platform: 'tiktok' as const, maxPosts: 15 },
    { handle: 'ssinnim7', platform: 'tiktok' as const, maxPosts: 15 },
    { handle: 'jellacosmetic', platform: 'tiktok' as const, maxPosts: 10 }
  ]
}