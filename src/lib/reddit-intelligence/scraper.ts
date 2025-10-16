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

  private readonly apiBase = 'https://oauth.reddit.com';
  private readonly authBase = 'https://www.reddit.com/api/v1';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private async authenticate(): Promise<void> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return;
    }

    try {
      console.log('🔐 Authenticating with Reddit API...');

      const credentials = Buffer.from(
        `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
      ).toString('base64');

      const response = await fetch(`${this.authBase}/access_token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'User-Agent': 'Seoul-Sister-Intelligence/1.0 (Korean Beauty Trend Analysis)',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials'
        })
      });

      if (!response.ok) {
        throw new Error(`Reddit OAuth failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer

      console.log('✅ Reddit API authentication successful');
    } catch (error) {
      console.error('❌ Reddit authentication failed:', error);
      // Fallback to public API
      this.accessToken = null;
    }
  }

  async scrapeKBeautyPosts(subreddit: string, limit: number = 25): Promise<RedditPost[]> {
    try {
      // Authenticate first
      await this.authenticate();

      // Use OAuth API if authenticated, otherwise fallback to public JSON
      const url = this.accessToken
        ? `${this.apiBase}/r/${subreddit}/hot?limit=${Math.min(limit, 100)}`
        : `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;

      console.log(`🔍 Scraping r/${subreddit} with ${this.accessToken ? 'OAuth API' : 'public JSON'}...`);

      const headers: Record<string, string> = {
        'User-Agent': 'Seoul-Sister-Intelligence/1.0 (Korean Beauty Trend Analysis)'
      };

      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Reddit API responded with status: ${response.status}`);
      }

      const data = await response.json();
      const posts: RedditPost[] = [];

      // Handle both OAuth and public API response formats
      const children = data.data?.children || data.children || [];

      for (const postData of children) {
        const post = postData.data || postData;

        // Enhanced K-beauty relevance filtering
        if (await this.isKBeautyRelevantEnhanced(post.title, post.selftext || '', post.subreddit)) {
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

  private async isKBeautyRelevantEnhanced(title: string, content: string, subreddit: string): boolean {
    // First check basic relevance
    if (this.isKBeautyRelevant(title, content)) {
      return true;
    }

    // Enhanced detection for specific subreddits
    const text = `${title} ${content}`.toLowerCase();

    // K-beauty specific subreddits - everything is potentially relevant
    const kbeautySubreddits = ['asianbeauty', 'koreanbeauty', 'kbeauty'];
    if (kbeautySubreddits.includes(subreddit.toLowerCase())) {
      return true;
    }

    // Advanced Korean brand detection
    const koreanBrands = [
      'cosrx', 'beauty of joseon', 'innisfree', 'etude house', 'laneige',
      'missha', 'skinfood', 'tony moly', 'the face shop', 'amore pacific',
      'sulwhasoo', 'hera', 'iope', 'mamonde', 'banila co', 'klairs',
      'purito', 'some by mi', 'torriden', 'isntree', 'round lab',
      'dr jart', 'goodal', 'romand', 'peripera', '3ce', 'heimish'
    ];

    // Advanced ingredient detection
    const koreanIngredients = [
      'centella', 'snail', 'ginseng', 'rice', 'bamboo', 'green tea',
      'fermented', 'galactomyces', 'bifida', 'propolis', 'honey',
      'black tea', 'ceramide', 'peptide', 'cica'
    ];

    // Advanced technique detection
    const koreanTechniques = [
      'glass skin', 'honey skin', 'cloudless skin', 'dewy skin',
      'double cleansing', 'oil cleansing', '7-skin method', '10-step',
      'layering', 'patting', 'essence first', 'skip care'
    ];

    // Check all categories
    const allKeywords = [...koreanBrands, ...koreanIngredients, ...koreanTechniques];
    return allKeywords.some(keyword => text.includes(keyword));
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
    console.log('🇰🇷 Starting enhanced Reddit K-beauty intelligence pipeline...');

    let totalPosts = 0;
    let totalTrends = 0;
    let newKeywords: string[] = [];

    // Scrape all K-beauty subreddits with enhanced limits
    for (const subreddit of this.kbeautySubreddits) {
      try {
        // Use higher limits with OAuth authentication
        const limit = this.accessToken ? 50 : 25;
        const posts = await this.scrapeKBeautyPosts(subreddit, limit);

        for (const post of posts) {
          const analysis = await this.analyzeWithAI(post);
          await this.storePost(post, analysis);
          totalPosts++;

          // Reduced delay for OAuth requests (higher rate limits)
          const delay = this.accessToken ? 50 : 100;
          await new Promise(resolve => setTimeout(resolve, delay));
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

  async getPostComments(subreddit: string, postId: string): Promise<any[]> {
    try {
      if (!this.accessToken) {
        console.log('⚠️ No OAuth token - skipping comment analysis');
        return [];
      }

      await this.authenticate();

      const url = `${this.apiBase}/r/${subreddit}/comments/${postId}?limit=50&sort=top`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': 'Seoul-Sister-Intelligence/1.0 (Korean Beauty Trend Analysis)'
        }
      });

      if (!response.ok) {
        throw new Error(`Comments API failed: ${response.status}`);
      }

      const data = await response.json();

      // Extract comments (second element in response array)
      const comments = data[1]?.data?.children || [];

      return comments.map((comment: any) => ({
        id: comment.data.id,
        body: comment.data.body,
        score: comment.data.score,
        author: comment.data.author,
        created_utc: new Date(comment.data.created_utc * 1000)
      }));

    } catch (error) {
      console.error('❌ Error fetching comments:', error);
      return [];
    }
  }

  async analyzeHighEngagementPosts(): Promise<void> {
    try {
      console.log('🔥 Analyzing high-engagement posts for deeper insights...');

      // Get top posts from last 24 hours with high engagement
      const { data: highEngagementPosts } = await supabase
        .from('reddit_kbeauty_posts')
        .select('post_id, subreddit, title, score, num_comments')
        .gte('created_utc', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .gt('score', 10)
        .gt('num_comments', 5)
        .order('score', { ascending: false })
        .limit(10);

      if (!highEngagementPosts) return;

      for (const post of highEngagementPosts) {
        try {
          const comments = await this.getPostComments(post.subreddit, post.post_id);

          if (comments.length > 0) {
            // Analyze comments for additional insights
            const commentText = comments.map(c => c.body).join(' ');
            const additionalKeywords = this.extractKeywordsFromText(commentText);

            // Store additional keywords discovered from comments
            for (const keyword of additionalKeywords) {
              await supabase
                .from('reddit_kbeauty_keywords')
                .upsert({
                  keyword: keyword.term,
                  keyword_type: keyword.type,
                  discovery_method: 'comment_analysis',
                  mention_frequency: keyword.frequency,
                  korean_verified: keyword.korean_origin,
                  ai_notes: `Discovered in comments of high-engagement post: ${post.title}`
                }, { onConflict: 'keyword' });
            }
          }

          // Small delay to be respectful
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`❌ Error analyzing post ${post.post_id}:`, error);
        }
      }

      console.log('✅ High-engagement post analysis complete');
    } catch (error) {
      console.error('❌ Error in high-engagement analysis:', error);
    }
  }

  private extractKeywordsFromText(text: string): Array<{term: string, type: string, frequency: number, korean_origin: boolean}> {
    // Simple keyword extraction - could be enhanced with NLP
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordCounts: {[key: string]: number} = {};

    words.forEach(word => {
      if (word.length > 3) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });

    const koreanBrands = ['cosrx', 'innisfree', 'laneige', 'missha', 'sulwhasoo'];
    const koreanIngredients = ['centella', 'snail', 'ginseng', 'galactomyces'];

    return Object.entries(wordCounts)
      .filter(([word, count]) => count >= 2)
      .map(([word, count]) => ({
        term: word,
        type: koreanBrands.includes(word) ? 'brand' :
              koreanIngredients.includes(word) ? 'ingredient' : 'general',
        frequency: count,
        korean_origin: koreanBrands.includes(word) || koreanIngredients.includes(word)
      }))
      .slice(0, 10); // Top 10 keywords
  }

  private async generateInsights(): Promise<number> {
    // Enhanced insights generation
    await this.analyzeHighEngagementPosts();
    return 1;
  }
}