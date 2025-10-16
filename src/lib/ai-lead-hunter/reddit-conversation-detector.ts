import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RedditPost {
  id: string;
  title: string;
  content: string;
  author: string;
  subreddit: string;
  url: string;
  score: number;
  created_utc: number;
  num_comments: number;
  intent_score: number;
  keywords_matched: string[];
  engagement_priority: 'high' | 'medium' | 'low';
  conversation_type: 'help_request' | 'product_question' | 'routine_advice' | 'authenticity_concern' | 'price_complaint';
}

interface ConversationOpportunity {
  post: RedditPost;
  response_strategy: string;
  cultural_angle: string;
  qualification_approach: string;
  engagement_timing: 'immediate' | 'delayed' | 'follow_conversation';
  confidence_score: number;
}

export class RedditConversationDetector {
  private readonly HIGH_INTENT_KEYWORDS = [
    // Help requests (highest intent)
    'help me find', 'looking for korean', 'need korean skincare', 'korean routine help',
    'authentic korean products', 'real korean skincare', 'korean beauty advice',

    // Product questions (high commercial intent)
    'where to buy korean', 'korean skincare online', 'best korean products',
    'korean vs american skincare', 'korean beauty brands', 'k-beauty recommendations',

    // Authenticity concerns (perfect Seoul Sister angle)
    'fake korean products', 'authentic korean beauty', 'real vs fake korean',
    'korean products authentic', 'counterfeit korean skincare', 'genuine korean beauty',

    // Price complaints (pricing intelligence opportunity)
    'korean skincare expensive', 'k-beauty overpriced', 'korean products cost',
    'sephora korean prices', 'korean beauty budget', 'affordable korean skincare',

    // Cultural interest (authority positioning)
    'korean beauty secrets', 'korean skincare routine', 'korean beauty culture',
    'seoul skincare', 'korean glass skin', 'korean 7-skin method', 'korean ingredients'
  ];

  private readonly TARGET_SUBREDDITS = [
    'AsianBeauty',
    'KoreanBeauty',
    'SkincareAddiction',
    '30PlusSkinCare',
    'beauty',
    'MakeupAddiction',
    'PanPorn',
    'scacjdiscussion'
  ];

  private readonly CULTURAL_KEYWORDS = [
    // Korean beauty terms
    'glass skin', 'honey skin', 'chok-chok', 'mul-gwang',
    '7-skin method', 'double cleansing', 'essences', 'ampoules',

    // Korean brands
    'cosrx', 'innisfree', 'etude house', 'laneige', 'sulwhasoo',
    'beauty of joseon', 'purito', 'klairs', 'iope', 'hera',

    // Korean ingredients
    'centella asiatica', 'snail mucin', 'ginseng', 'rice water',
    'fermented ingredients', 'hanbang', 'propolis', 'bamboo sap'
  ];

  async detectConversationOpportunities(): Promise<ConversationOpportunity[]> {
    try {
      console.log('🔍 Starting Reddit conversation detection for Korean beauty leads...');

      const opportunities: ConversationOpportunity[] = [];

      // Simulate Reddit API calls for each target subreddit
      for (const subreddit of this.TARGET_SUBREDDITS) {
        const posts = await this.scanSubredditForOpportunities(subreddit);

        for (const post of posts) {
          const opportunity = await this.analyzePostForEngagement(post);
          if (opportunity && opportunity.confidence_score >= 0.7) {
            opportunities.push(opportunity);
          }
        }
      }

      // Sort by engagement priority and confidence
      opportunities.sort((a, b) => {
        const priorityScore = { high: 3, medium: 2, low: 1 };
        const aScore = priorityScore[a.post.engagement_priority] + a.confidence_score;
        const bScore = priorityScore[b.post.engagement_priority] + b.confidence_score;
        return bScore - aScore;
      });

      // Store opportunities in database
      await this.storeConversationOpportunities(opportunities);

      console.log(`🎯 Found ${opportunities.length} high-quality conversation opportunities`);
      return opportunities.slice(0, 20); // Return top 20 opportunities

    } catch (error) {
      console.error('❌ Error detecting Reddit conversations:', error);
      throw error;
    }
  }

  private async scanSubredditForOpportunities(subreddit: string): Promise<RedditPost[]> {
    // In production, this would use Reddit API
    // For now, simulating realistic Korean beauty posts
    const simulatedPosts: RedditPost[] = [
      {
        id: `post_${subreddit}_1`,
        title: "Help! Looking for authentic Korean skincare routine for sensitive skin",
        content: "I've been burned by fake Korean products before. Need real recommendations for sensitive skin prone to redness. Heard about 7-skin method but not sure where to start with authentic products.",
        author: "skincare_newbie_23",
        subreddit,
        url: `https://reddit.com/r/${subreddit}/comments/fake1`,
        score: 47,
        created_utc: Date.now() / 1000 - 3600, // 1 hour ago
        num_comments: 12,
        intent_score: 0.9,
        keywords_matched: ['authentic korean', 'korean skincare routine', 'real recommendations', '7-skin method'],
        engagement_priority: 'high',
        conversation_type: 'help_request'
      },
      {
        id: `post_${subreddit}_2`,
        title: "Korean skincare is so expensive in the US - where do you buy yours?",
        content: "Seeing the same Korean products at Sephora for 3x what they probably cost in Seoul. Are there better sources for authentic Korean beauty products that don't break the bank?",
        author: "budget_beauty_lover",
        subreddit,
        url: `https://reddit.com/r/${subreddit}/comments/fake2`,
        score: 89,
        created_utc: Date.now() / 1000 - 7200, // 2 hours ago
        num_comments: 34,
        intent_score: 0.85,
        keywords_matched: ['korean skincare expensive', 'authentic korean beauty', 'sephora korean prices'],
        engagement_priority: 'high',
        conversation_type: 'price_complaint'
      },
      {
        id: `post_${subreddit}_3`,
        title: "Glass skin routine - what am I missing?",
        content: "Following Korean glass skin routine for 2 months but not seeing the 'chok-chok' effect Korean influencers get. Using Laneige, COSRX, Beauty of Joseon. Am I missing some Korean secret?",
        author: "glowing_goals",
        subreddit,
        url: `https://reddit.com/r/${subreddit}/comments/fake3`,
        score: 156,
        created_utc: Date.now() / 1000 - 10800, // 3 hours ago
        num_comments: 67,
        intent_score: 0.8,
        keywords_matched: ['glass skin', 'chok-chok', 'korean secret'],
        engagement_priority: 'medium',
        conversation_type: 'routine_advice'
      }
    ];

    return simulatedPosts;
  }

  private async analyzePostForEngagement(post: RedditPost): Promise<ConversationOpportunity | null> {
    const combinedText = `${post.title} ${post.content}`.toLowerCase();

    // Calculate intent score based on keywords
    let intentScore = 0;
    const matchedKeywords: string[] = [];

    this.HIGH_INTENT_KEYWORDS.forEach(keyword => {
      if (combinedText.includes(keyword.toLowerCase())) {
        intentScore += 0.1;
        matchedKeywords.push(keyword);
      }
    });

    this.CULTURAL_KEYWORDS.forEach(keyword => {
      if (combinedText.includes(keyword.toLowerCase())) {
        intentScore += 0.05;
        matchedKeywords.push(keyword);
      }
    });

    // Boost score for engagement indicators
    if (post.num_comments > 20) intentScore += 0.1;
    if (post.score > 50) intentScore += 0.1;
    if (post.created_utc > (Date.now() / 1000 - 7200)) intentScore += 0.1; // Recent posts

    post.intent_score = Math.min(intentScore, 1.0);
    post.keywords_matched = matchedKeywords;

    if (post.intent_score < 0.5) return null;

    // Generate engagement strategy based on post type
    const strategy = this.generateEngagementStrategy(post);

    return {
      post,
      response_strategy: strategy.response,
      cultural_angle: strategy.cultural_approach,
      qualification_approach: strategy.qualification,
      engagement_timing: strategy.timing,
      confidence_score: post.intent_score
    };
  }

  private generateEngagementStrategy(post: RedditPost): {
    response: string;
    cultural_approach: string;
    qualification: string;
    timing: 'immediate' | 'delayed' | 'follow_conversation';
  } {
    switch (post.conversation_type) {
      case 'help_request':
        return {
          response: "Lead with Korean cultural knowledge and traditional methods, then provide specific product guidance with Seoul insights",
          cultural_approach: "Share traditional Korean beauty philosophy: prevention over correction, gentle consistency, cultural context for ingredients",
          qualification: "Ask about previous experiences with authentic vs fake products, gauge interest in cultural education",
          timing: 'immediate'
        };

      case 'price_complaint':
        return {
          response: "Acknowledge pricing concerns, share Seoul vs US price intelligence, position Seoul Sister as solution",
          cultural_approach: "Explain Korean beauty pricing psychology, value vs cost cultural differences, authentic sourcing challenges",
          qualification: "Assess budget sensitivity, authenticity priorities, interest in Seoul wholesale access",
          timing: 'immediate'
        };

      case 'routine_advice':
        return {
          response: "Provide missing cultural context for routine effectiveness, share traditional Korean techniques",
          cultural_approach: "Explain Korean routine philosophy, seasonal adjustments, cultural significance of steps",
          qualification: "Gauge commitment to Korean beauty philosophy, interest in authentic cultural guidance",
          timing: 'delayed'
        };

      case 'authenticity_concern':
        return {
          response: "Share expertise on identifying authentic Korean products, provide Seoul market insights",
          cultural_approach: "Explain Korean beauty industry standards, authentic vs counterfeit indicators, Seoul market dynamics",
          qualification: "Assess past experiences with fakes, willingness to invest in authenticity, trust factors",
          timing: 'immediate'
        };

      case 'product_question':
        return {
          response: "Answer with Seoul-based product intelligence, share trending insights from Korean communities",
          cultural_approach: "Provide Korean consumer perspective, traditional ingredient knowledge, cultural preferences",
          qualification: "Understand product needs, assess interest in insider Korean beauty intelligence",
          timing: 'follow_conversation'
        };

      default:
        return {
          response: "Provide value-first Korean beauty insights relevant to their question",
          cultural_approach: "Share authentic Korean beauty culture and philosophy",
          qualification: "Gauge general interest in Korean beauty authenticity and cultural education",
          timing: 'delayed'
        };
    }
  }

  private async storeConversationOpportunities(opportunities: ConversationOpportunity[]): Promise<void> {
    try {
      const dbRecords = opportunities.map(opp => ({
        reddit_post_id: opp.post.id,
        title: opp.post.title,
        content: opp.post.content,
        author: opp.post.author,
        subreddit: opp.post.subreddit,
        url: opp.post.url,
        score: opp.post.score,
        num_comments: opp.post.num_comments,
        intent_score: opp.post.intent_score,
        keywords_matched: opp.post.keywords_matched,
        engagement_priority: opp.post.engagement_priority,
        conversation_type: opp.post.conversation_type,
        response_strategy: opp.response_strategy,
        cultural_angle: opp.cultural_angle,
        qualification_approach: opp.qualification_approach,
        engagement_timing: opp.engagement_timing,
        confidence_score: opp.confidence_score,
        status: 'detected',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      await supabase
        .from('reddit_conversation_opportunities')
        .upsert(dbRecords, { onConflict: 'reddit_post_id' });

      console.log(`💾 Stored ${dbRecords.length} conversation opportunities in database`);
    } catch (error) {
      console.error('❌ Error storing conversation opportunities:', error);
    }
  }

  async getTopOpportunities(limit: number = 10): Promise<ConversationOpportunity[]> {
    try {
      const { data, error } = await supabase
        .from('reddit_conversation_opportunities')
        .select('*')
        .eq('status', 'detected')
        .order('confidence_score', { ascending: false })
        .order('intent_score', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data.map(record => ({
        post: {
          id: record.reddit_post_id,
          title: record.title,
          content: record.content,
          author: record.author,
          subreddit: record.subreddit,
          url: record.url,
          score: record.score,
          created_utc: new Date(record.created_at).getTime() / 1000,
          num_comments: record.num_comments,
          intent_score: record.intent_score,
          keywords_matched: record.keywords_matched,
          engagement_priority: record.engagement_priority,
          conversation_type: record.conversation_type
        },
        response_strategy: record.response_strategy,
        cultural_angle: record.cultural_angle,
        qualification_approach: record.qualification_approach,
        engagement_timing: record.engagement_timing,
        confidence_score: record.confidence_score
      }));
    } catch (error) {
      console.error('❌ Error fetching conversation opportunities:', error);
      return [];
    }
  }
}

export default RedditConversationDetector;