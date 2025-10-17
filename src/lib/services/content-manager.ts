import { createClient } from '@supabase/supabase-js'

interface ProcessedContent {
  post_id: string
  platform: 'instagram' | 'tiktok'
  influencer_handle: string
  scraped_at: string
  engagement_score: number
  last_updated: string
  content_hash: string
  virality_score: number
  trend_signals: string[]
}

interface ContentScore {
  post_id: string
  engagement_velocity: number
  influencer_authority: number
  content_richness: number
  trend_novelty: number
  total_score: number
  priority_level: 'high' | 'medium' | 'low'
}

export class ContentManager {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Check if content has already been processed to prevent duplicates
   */
  async isContentProcessed(postId: string, platform: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('processed_content')
        .select('post_id')
        .eq('post_id', postId)
        .eq('platform', platform)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking processed content:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error in isContentProcessed:', error)
      return false
    }
  }

  /**
   * Mark content as processed to prevent future duplicates
   */
  async markContentAsProcessed(content: Partial<ProcessedContent>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('processed_content')
        .upsert({
          post_id: content.post_id,
          platform: content.platform,
          influencer_handle: content.influencer_handle,
          scraped_at: content.scraped_at || new Date().toISOString(),
          engagement_score: content.engagement_score || 0,
          last_updated: new Date().toISOString(),
          content_hash: content.content_hash || '',
          virality_score: content.virality_score || 0,
          trend_signals: content.trend_signals || []
        })

      if (error) {
        console.error('Error marking content as processed:', error)
      }
    } catch (error) {
      console.error('Error in markContentAsProcessed:', error)
    }
  }

  /**
   * Calculate Seoul Sister Intelligence Score for content
   */
  calculateContentScore(
    content: any,
    influencerData: any,
    timeData: { hoursAgo: number }
  ): ContentScore {
    // Engagement Velocity (40% weight)
    const engagementVelocity = this.calculateEngagementVelocity(content, timeData.hoursAgo)

    // Influencer Authority (30% weight)
    const influencerAuthority = this.calculateInfluencerAuthority(influencerData)

    // Content Richness (20% weight)
    const contentRichness = this.calculateContentRichness(content)

    // Trend Novelty (10% weight)
    const trendNovelty = this.calculateTrendNovelty(content)

    const totalScore = (
      engagementVelocity * 0.4 +
      influencerAuthority * 0.3 +
      contentRichness * 0.2 +
      trendNovelty * 0.1
    )

    let priorityLevel: 'high' | 'medium' | 'low' = 'low'
    if (totalScore >= 80) priorityLevel = 'high'
    else if (totalScore >= 60) priorityLevel = 'medium'

    return {
      post_id: content.postId || content.id,
      engagement_velocity: engagementVelocity,
      influencer_authority: influencerAuthority,
      content_richness: contentRichness,
      trend_novelty: trendNovelty,
      total_score: totalScore,
      priority_level: priorityLevel
    }
  }

  /**
   * Calculate engagement velocity (likes + comments / hours since posted)
   */
  private calculateEngagementVelocity(content: any, hoursAgo: number): number {
    const likes = content.metrics?.likes || content.likesCount || 0
    const comments = content.metrics?.comments || content.commentsCount || 0
    const totalEngagement = likes + (comments * 10) // Comments worth 10x likes

    if (hoursAgo <= 0) hoursAgo = 0.5 // Minimum 30 minutes for calculation

    const velocity = totalEngagement / hoursAgo

    // Normalize to 0-100 scale (log scale for viral content)
    return Math.min(100, Math.log10(velocity + 1) * 25)
  }

  /**
   * Calculate influencer authority score
   */
  private calculateInfluencerAuthority(influencerData: any): number {
    const followers = influencerData.followers || influencerData.follower_count || 0
    const averageEngagement = influencerData.averageEngagement || 0.03 // Default 3%

    // Authority = follower count × engagement rate (normalized)
    const authority = followers * averageEngagement

    // Normalize to 0-100 scale
    return Math.min(100, Math.log10(authority + 1) * 15)
  }

  /**
   * Calculate content richness score
   */
  private calculateContentRichness(content: any): number {
    let richness = 0

    // Video content (+30 points)
    if (content.mediaUrls?.some((url: string) => url.includes('video') || url.includes('.mp4'))) {
      richness += 30
    }

    // Product tags/mentions (+25 points)
    const caption = content.caption || ''
    const productKeywords = ['COSRX', 'Beauty of Joseon', 'Laneige', 'Innisfree', 'The Ordinary', 'serum', 'essence', 'moisturizer']
    if (productKeywords.some(keyword => caption.toLowerCase().includes(keyword.toLowerCase()))) {
      richness += 25
    }

    // Long, detailed caption (+20 points)
    if (caption.length > 200) {
      richness += 20
    }

    // Multiple hashtags (+15 points)
    const hashtags = content.hashtags || []
    if (hashtags.length >= 5) {
      richness += 15
    }

    // Tutorial/educational content (+10 points)
    const tutorialKeywords = ['tutorial', 'how to', 'step by step', '단계', '방법']
    if (tutorialKeywords.some(keyword => caption.toLowerCase().includes(keyword.toLowerCase()))) {
      richness += 10
    }

    return Math.min(100, richness)
  }

  /**
   * Calculate trend novelty score (new ingredients, products, techniques)
   */
  private calculateTrendNovelty(content: any): number {
    let novelty = 0
    const caption = content.caption || ''
    const lowerCaption = caption.toLowerCase()

    // Trending ingredients 2025
    const trendingIngredients = [
      'bakuchiol', 'peptides', 'ceramides', 'centella asiatica', 'snail mucin',
      'niacinamide', 'hyaluronic acid', 'vitamin c', 'retinol', 'azelaic acid',
      '바쿠치올', '펩타이드', '세라마이드', '센텔라', '달팽이점액'
    ]

    const mentionedIngredients = trendingIngredients.filter(ingredient =>
      lowerCaption.includes(ingredient.toLowerCase())
    )
    novelty += mentionedIngredients.length * 15

    // New product launches
    const newProductKeywords = ['new', 'launch', 'debut', '신제품', '런칭', '출시']
    if (newProductKeywords.some(keyword => lowerCaption.includes(keyword))) {
      novelty += 25
    }

    // Viral challenges or trends
    const viralKeywords = ['challenge', 'trend', 'viral', '챌린지', '트렌드', '바이럴']
    if (viralKeywords.some(keyword => lowerCaption.includes(keyword))) {
      novelty += 20
    }

    return Math.min(100, novelty)
  }

  /**
   * Filter content based on freshness and avoid duplicates
   */
  async filterContentForProcessing(
    scrapedContent: any[],
    maxAge: { hours: number } = { hours: 48 }
  ): Promise<any[]> {
    const now = new Date()
    const maxAgeMs = maxAge.hours * 60 * 60 * 1000

    const filteredContent = []

    for (const content of scrapedContent) {
      // Check age
      const publishedAt = new Date(content.publishedAt)
      const ageMs = now.getTime() - publishedAt.getTime()

      if (ageMs > maxAgeMs) {
        console.log(`⏰ Skipping old content: ${content.postId} (${Math.round(ageMs / (60 * 60 * 1000))}h old)`)
        continue
      }

      // Check if already processed
      const isProcessed = await this.isContentProcessed(content.postId, content.platform)
      if (isProcessed) {
        console.log(`🔄 Skipping duplicate content: ${content.postId}`)
        continue
      }

      filteredContent.push(content)
    }

    console.log(`📊 Filtered ${scrapedContent.length} → ${filteredContent.length} content pieces`)
    return filteredContent
  }

  /**
   * Get content that needs engagement updates (viral detection)
   */
  async getContentForEngagementUpdate(
    maxAge: { hours: number } = { hours: 72 }
  ): Promise<ProcessedContent[]> {
    try {
      const cutoffTime = new Date(Date.now() - maxAge.hours * 60 * 60 * 1000).toISOString()

      const { data, error } = await this.supabase
        .from('processed_content')
        .select('*')
        .gte('scraped_at', cutoffTime)
        .order('engagement_score', { ascending: false })
        .limit(50) // Top 50 for re-analysis

      if (error) {
        console.error('Error getting content for updates:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getContentForEngagementUpdate:', error)
      return []
    }
  }

  /**
   * Update engagement metrics for existing content
   */
  async updateContentEngagement(postId: string, platform: string, newMetrics: any): Promise<void> {
    try {
      const engagementScore = newMetrics.likes + (newMetrics.comments * 10)

      const { error } = await this.supabase
        .from('processed_content')
        .update({
          engagement_score: engagementScore,
          last_updated: new Date().toISOString()
        })
        .eq('post_id', postId)
        .eq('platform', platform)

      if (error) {
        console.error('Error updating content engagement:', error)
      }
    } catch (error) {
      console.error('Error in updateContentEngagement:', error)
    }
  }
}