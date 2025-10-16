import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  content: string;
  author: string;
  url: string;
  score: number;
  numComments: number;
  upvoteRatio: number;
  createdUtc: Date;
  isVideo: boolean;
  linkFlairText?: string;
  totalAwardsReceived: number;
}

export interface KBeautyAnalysis {
  detectedBrands: string[];
  detectedIngredients: string[];
  detectedProducts: string[];
  skinConcerns: string[];
  routineType?: string;
  priceMentions: any[];
  sentimentScore: number;
  isQuestion: boolean;
  isReview: boolean;
  isRoutine: boolean;
  aiConfidence: number;
}

export class RedditKBeautyIntelligence {
  private readonly kbeautySubreddits = [
    'AsianBeauty',
    'KoreanBeauty',
    'SkincareAddiction',
    '30PlusSkinCare',
    'SkincareAddicts',
    'KBeauty',
    'kbeauty',
    'AsianBeautyAdvice',
    'AsianSkincare'
  ];

  private readonly apiBase = 'https://www.reddit.com';

  async scrapeKBeautyPosts(subreddit: string, limit: number = 25): Promise<RedditPost[]> {
    try {
      const url = `${this.apiBase}/r/${subreddit}/hot.json?limit=${limit}`;
      console.log(`🔍 Scraping r/${subreddit}...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Seoul-Sister-Intelligence/1.0 (Korean Beauty Trend Analysis)'
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API responded with status: ${response.status}`);
      }

      const data = await response.json();
      const posts: RedditPost[] = [];

      for (const postData of data.data.children) {
        const post = postData.data;

        // Filter for K-beauty relevant content
        if (this.isKBeautyRelevant(post.title, post.selftext)) {
          posts.push({
            id: post.id,
            subreddit: post.subreddit,
            title: post.title,
            content: post.selftext || '',
            author: post.author,
            url: post.url,
            score: post.score,
            numComments: post.num_comments,
            upvoteRatio: post.upvote_ratio,
            createdUtc: new Date(post.created_utc * 1000),
            isVideo: post.is_video || false,
            linkFlairText: post.link_flair_text,
            totalAwardsReceived: post.total_awards_received || 0
          });
        }
      }

      console.log(`✅ Found ${posts.length} K-beauty relevant posts in r/${subreddit}`);
      return posts;
    } catch (error) {
      console.error(`❌ Error scraping r/${subreddit}:`, error);
      return [];
    }
  }

  private isKBeautyRelevant(title: string, content: string): boolean {
    const text = `${title} ${content}`.toLowerCase();

    // Dynamic keyword detection - these will be learned and expanded by AI
    const kbeautyKeywords = [
      'korean', 'k-beauty', 'kbeauty', 'seoul', 'cosrx', 'beauty of joseon',
      'innisfree', 'etude house', 'laneige', 'centella', 'snail mucin',
      'glass skin', 'double cleansing', '10-step', 'essence', 'ampoule',
      'sheet mask', 'cushion foundation', 'bb cream', 'fermented', 'ginseng',
      'hwahae', 'olive young', 'yesstyle', 'stylevana'
    ];

    return kbeautyKeywords.some(keyword => text.includes(keyword));
  }

  async analyzeWithAI(post: RedditPost): Promise<KBeautyAnalysis> {
    const prompt = `
Analyze this Reddit post for Korean beauty intelligence:

Title: ${post.title}
Content: ${post.content}
Subreddit: r/${post.subreddit}

Extract:
1. Korean beauty brands mentioned (exact names)
2. Ingredients mentioned (scientific or common names)
3. Specific products mentioned
4. Skin concerns discussed (acne, aging, dryness, etc.)
5. Routine type (morning, evening, weekly, etc.)
6. Price mentions with amounts and sources
7. Sentiment score (-1 to 1, negative to positive)
8. Post classification (question, review, routine sharing)
9. Your confidence in this analysis (0-1)

Respond in JSON format:
{
  "detectedBrands": ["brand1", "brand2"],
  "detectedIngredients": ["ingredient1", "ingredient2"],
  "detectedProducts": ["product1", "product2"],
  "skinConcerns": ["concern1", "concern2"],
  "routineType": "morning|evening|weekly|null",
  "priceMentions": [{"product": "name", "price": "$25", "source": "amazon"}],
  "sentimentScore": 0.8,
  "isQuestion": false,
  "isReview": true,
  "isRoutine": false,
  "aiConfidence": 0.95
}
`;

    try {
      const response = await fetch('/api/ai/analyze-kbeauty-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, post })
      });

      if (!response.ok) {
        throw new Error('AI analysis failed');
      }

      const analysis = await response.json();
      return analysis;
    } catch (error) {
      console.error('❌ AI analysis failed:', error);

      // Fallback analysis using simple keyword matching
      return this.basicAnalysis(post);
    }
  }

  private basicAnalysis(post: RedditPost): KBeautyAnalysis {
    const text = `${post.title} ${post.content}`.toLowerCase();

    const brandDetection = [
      'cosrx', 'beauty of joseon', 'innisfree', 'etude house', 'laneige',
      'the ordinary', 'cerave', 'paula\s choice', 'skinceuticals'
    ];

    const ingredientDetection = [
      'centella asiatica', 'snail mucin', 'niacinamide', 'hyaluronic acid',
      'retinol', 'vitamin c', 'aha', 'bha', 'salicylic acid'
    ];

    return {
      detectedBrands: brandDetection.filter(brand => text.includes(brand)),
      detectedIngredients: ingredientDetection.filter(ingredient => text.includes(ingredient)),
      detectedProducts: [],
      skinConcerns: [],
      routineType: undefined,
      priceMentions: [],
      sentimentScore: 0.5,
      isQuestion: text.includes('?'),
      isReview: text.includes('review') || text.includes('tried'),
      isRoutine: text.includes('routine') || text.includes('step'),
      aiConfidence: 0.3
    };
  }

  async storePost(post: RedditPost, analysis: KBeautyAnalysis): Promise<void> {
    try {
      const { error } = await supabase
        .from('reddit_kbeauty_posts')
        .insert({
          post_id: post.id,
          subreddit: post.subreddit,
          title: post.title,
          content: post.content,
          author: post.author,
          url: post.url,
          score: post.score,
          num_comments: post.numComments,
          upvote_ratio: post.upvoteRatio,
          created_utc: post.createdUtc,
          is_video: post.isVideo,
          link_flair_text: post.linkFlairText,
          total_awards_received: post.totalAwardsReceived,
          detected_brands: analysis.detectedBrands,
          detected_ingredients: analysis.detectedIngredients,
          detected_products: analysis.detectedProducts,
          skin_concerns: analysis.skinConcerns,
          routine_type: analysis.routineType,
          price_mentions: analysis.priceMentions,
          sentiment_score: analysis.sentimentScore,
          is_question: analysis.isQuestion,
          is_review: analysis.isReview,
          is_routine: analysis.isRoutine
        });

      if (error) {
        console.error('❌ Error storing post:', error);
      }
    } catch (error) {
      console.error('❌ Database error:', error);
    }
  }

  async updateTrends(): Promise<void> {
    try {
      console.log('🧠 Updating K-beauty trends from Reddit data...');

      // Get recent posts for trend analysis
      const { data: recentPosts } = await supabase
        .from('reddit_kbeauty_posts')
        .select('post_id, detected_brands, detected_ingredients, detected_products, score, created_utc')
        .gte('created_utc', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (!recentPosts) return;

      // Analyze brand trends
      const brandCounts = new Map<string, { count: number; totalScore: number; posts: string[] }>();
      const ingredientCounts = new Map<string, { count: number; totalScore: number; posts: string[] }>();
      const productCounts = new Map<string, { count: number; totalScore: number; posts: string[] }>();

      recentPosts.forEach(post => {
        // Count brands
        post.detected_brands?.forEach((brand: string) => {
          const current = brandCounts.get(brand) || { count: 0, totalScore: 0, posts: [] };
          brandCounts.set(brand, {
            count: current.count + 1,
            totalScore: current.totalScore + (post.score || 0),
            posts: [...current.posts, post.post_id].slice(0, 5)
          });
        });

        // Count ingredients
        post.detected_ingredients?.forEach((ingredient: string) => {
          const current = ingredientCounts.get(ingredient) || { count: 0, totalScore: 0, posts: [] };
          ingredientCounts.set(ingredient, {
            count: current.count + 1,
            totalScore: current.totalScore + (post.score || 0),
            posts: [...current.posts, post.post_id].slice(0, 5)
          });
        });

        // Count products
        post.detected_products?.forEach((product: string) => {
          const current = productCounts.get(product) || { count: 0, totalScore: 0, posts: [] };
          productCounts.set(product, {
            count: current.count + 1,
            totalScore: current.totalScore + (post.score || 0),
            posts: [...current.posts, post.post_id].slice(0, 5)
          });
        });
      });

      // Update trends in database
      await this.updateTrendTable(brandCounts, 'brand');
      await this.updateTrendTable(ingredientCounts, 'ingredient');
      await this.updateTrendTable(productCounts, 'product');

      console.log('✅ K-beauty trends updated successfully');
    } catch (error) {
      console.error('❌ Error updating trends:', error);
    }
  }

  private async updateTrendTable(
    counts: Map<string, { count: number; totalScore: number; posts: string[] }>,
    type: string
  ): Promise<void> {
    for (const [term, data] of counts) {
      if (data.count < 2) continue; // Only track items mentioned at least twice

      const velocityScore = data.count * 10; // Base velocity on mention frequency
      const growthRate = data.count > 5 ? 50 : data.count > 2 ? 25 : 10;
      const avgEngagement = data.totalScore / data.count;

      await supabase
        .from('reddit_kbeauty_trends')
        .upsert({
          trend_term: term,
          trend_type: type,
          mention_count: data.count,
          total_score: data.totalScore,
          avg_engagement: avgEngagement,
          sample_posts: data.posts,
          subreddits: ['AsianBeauty', 'KoreanBeauty'], // Will be dynamic
          growth_rate: growthRate,
          velocity_score: velocityScore,
          trend_status: velocityScore > 80 ? 'trending' : velocityScore > 40 ? 'emerging' : 'stable',
          ai_confidence: 0.8,
          korean_origin: this.isKoreanOrigin(term),
          last_seen: new Date(),
          updated_at: new Date()
        });
    }
  }

  private isKoreanOrigin(term: string): boolean {
    const koreanBrands = [
      'cosrx', 'beauty of joseon', 'innisfree', 'etude house', 'laneige',
      'missha', 'skinfood', 'tony moly', 'the face shop', 'amore pacific'
    ];

    const koreanIngredients = [
      'centella asiatica', 'snail mucin', 'ginseng', 'rice water', 'bamboo'
    ];

    return koreanBrands.includes(term.toLowerCase()) ||
           koreanIngredients.includes(term.toLowerCase());
  }

  async discoverNewKeywords(): Promise<string[]> {
    console.log('🔍 Discovering new K-beauty keywords from Reddit...');

    const { data: recentPosts } = await supabase
      .from('reddit_kbeauty_posts')
      .select('title, content')
      .gte('created_utc', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    if (!recentPosts) return [];

    // Use AI to discover new trending terms
    const allText = recentPosts.map(p => `${p.title} ${p.content}`).join(' ');

    try {
      const response = await fetch('/api/ai/discover-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: allText, domain: 'korean_beauty' })
      });

      const { keywords } = await response.json();

      // Store discovered keywords
      for (const keyword of keywords) {
        await supabase
          .from('reddit_kbeauty_keywords')
          .upsert({
            keyword: keyword.term,
            keyword_type: keyword.type,
            discovery_method: 'ai_discovered',
            mention_frequency: keyword.frequency,
            korean_verified: keyword.korean_origin,
            ai_notes: keyword.reasoning,
            updated_at: new Date()
          });
      }

      console.log(`✅ Discovered ${keywords.length} new keywords`);
      return keywords.map((k: any) => k.term);
    } catch (error) {
      console.error('❌ Keyword discovery failed:', error);
      return [];
    }
  }

  async runFullIntelligencePipeline(): Promise<{
    postsScraped: number;
    trendsUpdated: number;
    newKeywords: number;
    insights: number;
  }> {
    console.log('🇰🇷 Starting Reddit K-beauty intelligence pipeline...');

    let totalPosts = 0;
    let totalTrends = 0;
    let newKeywords: string[] = [];

    // Scrape all K-beauty subreddits
    for (const subreddit of this.kbeautySubreddits) {
      try {
        const posts = await this.scrapeKBeautyPosts(subreddit, 25);

        for (const post of posts) {
          const analysis = await this.analyzeWithAI(post);
          await this.storePost(post, analysis);
          totalPosts++;

          // Add small delay to be respectful to Reddit API
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Error processing r/${subreddit}:`, error);
      }
    }

    // Update trends based on new data
    await this.updateTrends();
    totalTrends = await this.getTrendCount();

    // Discover new keywords
    newKeywords = await this.discoverNewKeywords();

    // Generate insights
    const insights = await this.generateInsights();

    console.log(`🎯 Pipeline complete: ${totalPosts} posts, ${totalTrends} trends, ${newKeywords.length} keywords, ${insights} insights`);

    return {
      postsScraped: totalPosts,
      trendsUpdated: totalTrends,
      newKeywords: newKeywords.length,
      insights
    };
  }

  private async getTrendCount(): Promise<number> {
    const { count } = await supabase
      .from('reddit_kbeauty_trends')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  private async generateInsights(): Promise<number> {
    // This will be expanded to generate actionable business insights
    return 0;
  }
}