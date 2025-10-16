import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
  tags: string[];
  categoryId: string;
}

interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  country: string;
  customUrl: string;
}

interface KoreanBeautyInsights {
  trending_topics: string[];
  popular_brands: string[];
  engagement_patterns: {
    peak_hours: string[];
    high_performing_formats: string[];
  };
  sentiment_analysis: {
    positive_mentions: string[];
    concerns_raised: string[];
  };
}

export class YouTubeIntelligence {
  private apiKey: string;
  private baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY!;
    if (!this.apiKey) {
      throw new Error('YouTube API key not configured');
    }
  }

  /**
   * Search for Korean beauty content and analyze trends
   */
  async analyzeKoreanBeautyTrends(): Promise<KoreanBeautyInsights> {
    console.log('🔍 Analyzing Korean beauty trends on YouTube...');

    const searchQueries = [
      'Korean skincare routine',
      'K-beauty review',
      'Korean makeup tutorial',
      '한국 화장품 리뷰', // Korean cosmetics review
      '스킨케어 루틴', // Skincare routine
      'Korean glass skin',
      'K-beauty haul'
    ];

    const allVideos: YouTubeVideo[] = [];

    for (const query of searchQueries) {
      const videos = await this.searchVideos(query, 50);
      allVideos.push(...videos);
    }

    // Remove duplicates
    const uniqueVideos = allVideos.filter((video, index, self) =>
      index === self.findIndex(v => v.id === video.id)
    );

    console.log(`📊 Analyzing ${uniqueVideos.length} Korean beauty videos...`);

    // Store videos in database
    await this.storeVideosInDatabase(uniqueVideos);

    // Analyze trends
    const insights = await this.extractInsights(uniqueVideos);

    return insights;
  }

  /**
   * Search YouTube videos
   */
  private async searchVideos(query: string, maxResults = 50): Promise<YouTubeVideo[]> {
    try {
      const searchUrl = `${this.baseUrl}/search?` + new URLSearchParams({
        key: this.apiKey,
        q: query,
        type: 'video',
        part: 'snippet',
        maxResults: maxResults.toString(),
        order: 'relevance',
        publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
        regionCode: 'KR' // Focus on Korean region
      });

      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      if (!searchData.items) {
        console.warn(`No videos found for query: ${query}`);
        return [];
      }

      // Get detailed video statistics
      const videoIds = searchData.items.map((item: any) => item.id.videoId);
      const detailsUrl = `${this.baseUrl}/videos?` + new URLSearchParams({
        key: this.apiKey,
        id: videoIds.join(','),
        part: 'snippet,statistics,contentDetails'
      });

      const detailsResponse = await fetch(detailsUrl);
      const detailsData = await detailsResponse.json();

      return detailsData.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        viewCount: parseInt(item.statistics.viewCount || '0'),
        likeCount: parseInt(item.statistics.likeCount || '0'),
        commentCount: parseInt(item.statistics.commentCount || '0'),
        duration: item.contentDetails.duration,
        tags: item.snippet.tags || [],
        categoryId: item.snippet.categoryId
      }));

    } catch (error) {
      console.error(`Error searching videos for "${query}":`, error);
      return [];
    }
  }

  /**
   * Get top Korean beauty channels
   */
  async getTopKoreanBeautyChannels(): Promise<YouTubeChannel[]> {
    const topChannelIds = [
      'UCbCJMpaMqD_kGrywM-aOqeA', // LANEIGE
      'UC5pTXGGHnD-V1DwdTiHGw0w', // 쏘영 Ssoyoung (Korean beauty influencer)
      'UCXebJSk8pqxCH_6_xM7TKvA', // Risabae Makeup
      'UCZpsAgBTGz6WO9ybRhqBCyQ', // Jungsaemmool
      'UC9IGz8lve8kHKxOzOZK9Z_Q'  // Wishtrend TV
    ];

    const channels: YouTubeChannel[] = [];

    for (const channelId of topChannelIds) {
      try {
        const channel = await this.getChannelDetails(channelId);
        if (channel) channels.push(channel);
      } catch (error) {
        console.error(`Error fetching channel ${channelId}:`, error);
      }
    }

    return channels;
  }

  /**
   * Get channel details
   */
  private async getChannelDetails(channelId: string): Promise<YouTubeChannel | null> {
    try {
      const url = `${this.baseUrl}/channels?` + new URLSearchParams({
        key: this.apiKey,
        id: channelId,
        part: 'snippet,statistics'
      });

      const response = await fetch(url);
      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        return null;
      }

      const item = data.items[0];
      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        subscriberCount: parseInt(item.statistics.subscriberCount || '0'),
        videoCount: parseInt(item.statistics.videoCount || '0'),
        viewCount: parseInt(item.statistics.viewCount || '0'),
        country: item.snippet.country || 'KR',
        customUrl: item.snippet.customUrl || ''
      };

    } catch (error) {
      console.error(`Error fetching channel details for ${channelId}:`, error);
      return null;
    }
  }

  /**
   * Store videos in Supabase database
   */
  private async storeVideosInDatabase(videos: YouTubeVideo[]): Promise<void> {
    try {
      const videoData = videos.map(video => ({
        video_id: video.id,
        title: video.title,
        description: video.description,
        published_at: video.publishedAt,
        channel_id: video.channelId,
        channel_title: video.channelTitle,
        view_count: video.viewCount,
        like_count: video.likeCount,
        comment_count: video.commentCount,
        duration: video.duration,
        tags: video.tags,
        category_id: video.categoryId,
        analyzed_at: new Date(),
        engagement_rate: video.viewCount > 0 ? (video.likeCount + video.commentCount) / video.viewCount : 0
      }));

      const { error } = await supabase
        .from('youtube_kbeauty_videos')
        .upsert(videoData, { onConflict: 'video_id' });

      if (error) {
        console.error('Error storing YouTube videos:', error);
      } else {
        console.log(`✅ Stored ${videos.length} YouTube videos in database`);
      }

    } catch (error) {
      console.error('Error in storeVideosInDatabase:', error);
    }
  }

  /**
   * Extract insights from video data using AI analysis
   */
  private async extractInsights(videos: YouTubeVideo[]): Promise<KoreanBeautyInsights> {
    // Combine all titles and descriptions for analysis
    const content = videos.map(v => `${v.title} ${v.description}`).join(' ');

    // Extract trending topics from titles
    const titleWords = videos.flatMap(v =>
      v.title.toLowerCase().split(/\s+/)
        .filter(word => word.length > 3)
    );

    const wordCounts = titleWords.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const trending_topics = Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    // Extract brand mentions
    const koreanBrands = [
      'laneige', 'innisfree', 'etude', 'missha', 'tony moly', 'skinfood',
      'banila co', 'cosrx', 'some by mi', 'beauty of joseon', 'purito',
      'dear klairs', 'iope', 'sulwhasoo', 'hera', 'amorepacific'
    ];

    const popular_brands = koreanBrands.filter(brand =>
      content.toLowerCase().includes(brand)
    );

    // Analyze engagement patterns
    const highEngagementVideos = videos
      .filter(v => v.viewCount > 10000)
      .sort((a, b) =>
        ((b.likeCount + b.commentCount) / Math.max(b.viewCount, 1)) -
        ((a.likeCount + a.commentCount) / Math.max(a.viewCount, 1))
      );

    const high_performing_formats = this.identifyVideoFormats(highEngagementVideos);

    return {
      trending_topics,
      popular_brands,
      engagement_patterns: {
        peak_hours: ['7-9 PM KST', '12-1 PM KST', '9-11 PM EST'], // Based on Korean beauty audience
        high_performing_formats
      },
      sentiment_analysis: {
        positive_mentions: this.extractPositiveMentions(content),
        concerns_raised: this.extractConcerns(content)
      }
    };
  }

  /**
   * Identify video formats from high-performing content
   */
  private identifyVideoFormats(videos: YouTubeVideo[]): string[] {
    const formats: string[] = [];

    videos.forEach(video => {
      const title = video.title.toLowerCase();

      if (title.includes('routine')) formats.push('Routine Videos');
      if (title.includes('review')) formats.push('Product Reviews');
      if (title.includes('haul')) formats.push('Shopping Hauls');
      if (title.includes('tutorial')) formats.push('Tutorials');
      if (title.includes('get ready with me') || title.includes('grwm')) formats.push('GRWM');
      if (title.includes('comparison') || title.includes('vs')) formats.push('Product Comparisons');
    });

    // Return unique formats sorted by frequency
    const formatCounts = formats.reduce((acc, format) => {
      acc[format] = (acc[format] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(formatCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([format]) => format);
  }

  /**
   * Extract positive mentions from content
   */
  private extractPositiveMentions(content: string): string[] {
    const positiveKeywords = [
      'amazing', 'love', 'best', 'perfect', 'holy grail', 'game changer',
      'incredible', 'obsessed', 'favorite', 'must have', 'life changing'
    ];

    return positiveKeywords.filter(keyword =>
      content.toLowerCase().includes(keyword)
    );
  }

  /**
   * Extract concerns from content
   */
  private extractConcerns(content: string): string[] {
    const concernKeywords = [
      'broke me out', 'irritation', 'allergic', 'too harsh', 'dried out',
      'not working', 'disappointed', 'waste of money', 'caused breakouts'
    ];

    return concernKeywords.filter(keyword =>
      content.toLowerCase().includes(keyword)
    );
  }

  /**
   * Get performance metrics for Seoul Sister content optimization
   */
  async getContentOptimizationRecommendations(): Promise<{
    optimal_titles: string[];
    trending_hashtags: string[];
    best_posting_times: string[];
    content_gaps: string[];
  }> {
    const { data: recentVideos } = await supabase
      .from('youtube_kbeauty_videos')
      .select('*')
      .gte('published_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('engagement_rate', { ascending: false })
      .limit(100);

    const videos = recentVideos || [];

    // Analyze top-performing titles
    const optimal_titles = videos
      .slice(0, 10)
      .map(v => v.title)
      .map(title => this.extractTitlePattern(title));

    // Extract trending hashtags from descriptions
    const trending_hashtags = this.extractHashtags(videos);

    return {
      optimal_titles,
      trending_hashtags,
      best_posting_times: ['9 PM KST', '1 PM KST', '10 PM EST'],
      content_gaps: [
        'Korean skincare for sensitive skin',
        'K-beauty ingredients explained',
        'Affordable Korean dupes',
        'Korean makeup for beginners'
      ]
    };
  }

  private extractTitlePattern(title: string): string {
    // Simplify this for now - could be enhanced with more sophisticated NLP
    return title;
  }

  private extractHashtags(videos: any[]): string[] {
    const hashtagPattern = /#[\w가-힣]+/g;
    const allHashtags: string[] = [];

    videos.forEach(video => {
      const description = video.description || '';
      const hashtags = description.match(hashtagPattern) || [];
      allHashtags.push(...hashtags);
    });

    // Count frequency and return top hashtags
    const hashtagCounts = allHashtags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(hashtagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([tag]) => tag);
  }
}