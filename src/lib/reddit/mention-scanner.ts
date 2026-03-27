/**
 * Reddit K-Beauty Mention Scanner
 *
 * Scans K-beauty subreddits for product mentions, matches them against
 * the Seoul Sister product database, and calculates mention counts +
 * sentiment scores for trend detection.
 *
 * Designed to run as a daily cron job at 8:30 AM UTC.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { redditFetch } from './oauth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubredditConfig {
  name: string
  weight: number // Relevance weight for scoring (0-1)
}

interface RedditPost {
  id: string
  title: string
  selftext: string
  subreddit: string
  score: number        // upvotes
  num_comments: number
  created_utc: number
  permalink: string
  url: string
}

export interface ProductMention {
  product_id: string
  product_name: string
  product_brand: string
  subreddit: string
  post_id: string
  post_title: string
  post_url: string
  post_score: number
  post_comments: number
  sentiment: number // 0-1
  created_utc: number
}

export interface MentionAggregate {
  product_id: string
  product_name: string
  product_brand: string
  mention_count: number
  weighted_mention_count: number
  total_upvotes: number
  total_comments: number
  avg_sentiment: number
  subreddits: string[]
  top_post_url: string
  top_post_title: string
  posts: Array<{
    post_id: string
    subreddit: string
    score: number
    comments: number
    sentiment: number
    url: string
  }>
}

export interface ScanResult {
  posts_scanned: number
  mentions_found: number
  products_mentioned: number
  subreddits_scanned: number
  errors: string[]
  aggregates: MentionAggregate[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const KBEAUTY_SUBREDDITS: SubredditConfig[] = [
  { name: 'AsianBeauty', weight: 1.0 },
  { name: 'koreanskincare', weight: 0.95 },
  { name: 'KoreanBeauty', weight: 0.9 },
  { name: 'SkincareAddiction', weight: 0.6 },
  { name: 'AsianBeautyAdvice', weight: 0.8 },
  { name: '30PlusSkinCare', weight: 0.5 },
]

// Minimum post score (upvotes) to count as a mention — filters spam/low-quality
const MIN_POST_SCORE = 2

// How many posts to fetch per subreddit (Reddit returns max 100 per page)
const POSTS_PER_SUBREDDIT = 100

// ---------------------------------------------------------------------------
// Sentiment keywords
// ---------------------------------------------------------------------------

const POSITIVE_KEYWORDS = [
  'love', 'holy grail', 'hg', 'amazing', 'incredible', 'favorite', 'favourite',
  'repurchase', 'repurchased', 'obsessed', 'transformed', 'cleared', 'glowing',
  'best', 'miracle', 'game changer', 'game-changer', 'recommend', 'recommended',
  'worth it', 'beautiful', 'saved my skin', 'perfect', 'smooth', 'hydrated',
  'hydrating', 'moisturizing', 'soothing', 'calming', 'gentle', 'effective',
  'must have', 'must-have', 'staple', 'absolute favorite',
]

const NEGATIVE_KEYWORDS = [
  'broke me out', 'breakout', 'break out', 'broke out', 'irritated',
  'irritation', 'allergic', 'reaction', 'rash', 'burning', 'stinging',
  'waste', 'wasted', 'returned', 'disappointing', 'disappointed',
  'overrated', 'overhyped', 'not worth', 'terrible', 'awful', 'horrible',
  'clogged', 'clogging', 'comedogenic', 'greasy', 'sticky',
  'fake', 'counterfeit', 'didn\'t work', 'no difference',
]

// ---------------------------------------------------------------------------
// Product index for matching
// ---------------------------------------------------------------------------

interface ProductRecord {
  id: string
  name_en: string
  brand_en: string
  name_normalized: string
  brand_normalized: string
  search_tokens: Set<string>
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Common brand abbreviations/aliases used on Reddit.
 * Maps common short forms to the canonical brand name in our DB.
 */
const BRAND_ALIASES: Record<string, string[]> = {
  'cosrx': ['cos rx', 'cos-rx'],
  'dr jart': ['dr jart+', 'dr. jart', 'dr. jart+'],
  'beauty of joseon': ['boj'],
  'innisfree': ['innisfree'],
  'laneige': ['laneige'],
  'missha': ['missha'],
  'some by mi': ['some by mi', 'somebymi'],
  'etude house': ['etude', 'etude house'],
  'klairs': ['dear klairs', 'klairs'],
  'purito': ['purito'],
  'numbuzin': ['numbuzin', 'no 5', 'numbuzin no'],
  'isntree': ['isntree', "isn'tree"],
  'torriden': ['torriden'],
  'anua': ['anua'],
  'medicube': ['medicube'],
  'skin1004': ['skin1004', 'skin 1004'],
  'round lab': ['roundlab', 'round lab'],
  'illiyoon': ['illiyoon'],
  'aestura': ['aestura'],
  'beplain': ['beplain', 'be plain'],
  'cnp': ['cnp laboratory', 'cnp lab'],
  'zeroid': ['zeroid'],
  'real barrier': ['real barrier', 'realbarrier'],
  'biodance': ['biodance', 'bio dance'],
  'vt': ['vt cosmetics', 'vt cosme', 'reedle shot', 'reedleshot'],
  'medi peel': ['medipeel', 'medi-peel', 'medi peel'],
  'dong-a': ['dong-a pharmaceutical', 'dongkook', 'dong a'],
}

// Common words that should NOT count as distinctive product name tokens.
// These appear in many product names and don't help distinguish one product from another.
const COMMON_WORDS = new Set([
  'the', 'and', 'for', 'with', 'all', 'one', 'set', 'new', 'plus', 'pro',
  'special', 'limited', 'edition', 'pack', 'refill', 'gift', 'mini', 'duo',
  'cream', 'serum', 'toner', 'lotion', 'mask', 'cleanser', 'moisturizer',
  'gel', 'oil', 'water', 'essence', 'ampoule', 'mist', 'balm', 'foam',
  'light', 'deep', 'soft', 'pure', 'clear', 'fresh', 'rich', 'ultra',
  'daily', 'night', 'morning', 'original', 'natural', 'gentle', 'mild',
  'skin', 'face', 'body', 'eye', 'lip', 'hand', 'hair', 'scalp',
  'care', 'type', 'line', 'size', 'sheet', 'tone', 'spot', 'stick',
  'cover', 'base', 'perfect', 'first', 'repair', 'barrier', 'moisture',
  'moisturizing', 'hydrating', 'calming', 'soothing', 'brightening',
  'glow', 'glowing', 'radiance', 'treatment', 'total', 'double',
  'cleansing', 'sleeping', 'peeling', 'modeling',
])

// Flatten brand aliases for lookup
const ALIAS_TO_BRAND = new Map<string, string>()
for (const [canonical, aliases] of Object.entries(BRAND_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_BRAND.set(normalize(alias), normalize(canonical))
  }
  ALIAS_TO_BRAND.set(normalize(canonical), normalize(canonical))
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

export class RedditMentionScanner {
  private products: ProductRecord[] = []
  private productsByBrand = new Map<string, ProductRecord[]>()
  private brandNames: string[] = []
  private productsLoaded = false

  /**
   * Load all products from the database into an in-memory index
   * for fast mention matching.
   */
  async loadProducts(supabase: SupabaseClient): Promise<number> {
    this.products = []
    this.productsByBrand = new Map()

    const PAGE_SIZE = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('ss_products')
        .select('id, name_en, brand_en')
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw new Error(`Failed to load products: ${error.message}`)
      if (!data || data.length === 0) break

      for (const row of data) {
        const nameNorm = normalize(row.name_en)
        const brandNorm = normalize(row.brand_en)
        const record: ProductRecord = {
          id: row.id,
          name_en: row.name_en,
          brand_en: row.brand_en,
          name_normalized: nameNorm,
          brand_normalized: brandNorm,
          search_tokens: new Set(
            `${brandNorm} ${nameNorm}`.split(' ').filter(t => t.length > 1)
          ),
        }
        this.products.push(record)

        // Index by canonical brand name
        const canonicalBrand = ALIAS_TO_BRAND.get(brandNorm) ?? brandNorm
        if (!this.productsByBrand.has(canonicalBrand)) {
          this.productsByBrand.set(canonicalBrand, [])
        }
        this.productsByBrand.get(canonicalBrand)!.push(record)
      }

      offset += data.length
      hasMore = data.length === PAGE_SIZE
    }

    this.brandNames = [...this.productsByBrand.keys()].sort((a, b) => b.length - a.length)
    this.productsLoaded = true
    console.log(`[reddit] Loaded ${this.products.length} products across ${this.brandNames.length} brands`)
    return this.products.length
  }

  /**
   * Fetch recent posts from a subreddit.
   */
  async fetchPosts(subreddit: string, limit: number = POSTS_PER_SUBREDDIT): Promise<RedditPost[]> {
    const posts: RedditPost[] = []

    try {
      // Fetch "new" posts (last 24-48h typically)
      const data = await redditFetch(`/r/${subreddit}/new`, {
        limit: String(limit),
        t: 'week',
      }) as { data?: { children?: Array<{ data: Record<string, unknown> }> } }

      const children = data?.data?.children ?? []

      for (const child of children) {
        const d = child.data
        posts.push({
          id: d.id as string,
          title: (d.title as string) ?? '',
          selftext: (d.selftext as string) ?? '',
          subreddit: (d.subreddit as string) ?? subreddit,
          score: (d.score as number) ?? 0,
          num_comments: (d.num_comments as number) ?? 0,
          created_utc: (d.created_utc as number) ?? 0,
          permalink: (d.permalink as string) ?? '',
          url: (d.url as string) ?? '',
        })
      }

      // Also fetch "hot" posts for higher-engagement content
      const hotData = await redditFetch(`/r/${subreddit}/hot`, {
        limit: String(Math.min(50, limit)),
      }) as { data?: { children?: Array<{ data: Record<string, unknown> }> } }

      const hotChildren = hotData?.data?.children ?? []
      const existingIds = new Set(posts.map(p => p.id))

      for (const child of hotChildren) {
        const d = child.data
        const id = d.id as string
        if (!existingIds.has(id)) {
          posts.push({
            id,
            title: (d.title as string) ?? '',
            selftext: (d.selftext as string) ?? '',
            subreddit: (d.subreddit as string) ?? subreddit,
            score: (d.score as number) ?? 0,
            num_comments: (d.num_comments as number) ?? 0,
            created_utc: (d.created_utc as number) ?? 0,
            permalink: (d.permalink as string) ?? '',
            url: (d.url as string) ?? '',
          })
          existingIds.add(id)
        }
      }

      console.log(`[reddit] Fetched ${posts.length} posts from r/${subreddit}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[reddit] Failed to fetch r/${subreddit}: ${msg}`)
    }

    return posts
  }

  /**
   * Extract product mentions from a single Reddit post.
   * Checks post title and body against the product database.
   */
  extractMentions(post: RedditPost, subredditWeight: number): ProductMention[] {
    if (!this.productsLoaded) {
      throw new Error('Call loadProducts() before extracting mentions')
    }

    // Filter low-quality posts
    if (post.score < MIN_POST_SCORE) return []

    const text = `${post.title} ${post.selftext}`.toLowerCase()
    if (text.length < 20) return []

    const mentions: ProductMention[] = []
    const mentionedProductIds = new Set<string>()

    // Check each brand for mentions
    for (const brandName of this.brandNames) {
      // Skip if brand not mentioned in text
      if (!text.includes(brandName)) {
        // Check aliases
        let found = false
        for (const [alias, canonical] of ALIAS_TO_BRAND) {
          if (canonical === brandName && text.includes(alias)) {
            found = true
            break
          }
        }
        if (!found) continue
      }

      // Brand is mentioned — now check which specific products
      const brandProducts = this.productsByBrand.get(brandName) ?? []

      // Score each product in this brand for how well it matches the text.
      // Only the best-matching product per "product line" gets counted —
      // this prevents "SKIN1004 Madagascar Centella" from matching 20+ products.
      interface CandidateMatch {
        product: ProductRecord
        matchCount: number
        matchRatio: number
        distinctiveTokens: string[]
      }
      const candidates: CandidateMatch[] = []

      for (const product of brandProducts) {
        if (mentionedProductIds.has(product.id)) continue

        // Remove brand tokens from the product name to get unique identifiers
        const brandTokens = new Set(product.brand_normalized.split(' ').filter(t => t.length > 1))
        const nameTokens = product.name_normalized
          .split(' ')
          .filter(t => t.length > 2 && !brandTokens.has(t))

        // Skip products with no distinguishing tokens beyond the brand name
        if (nameTokens.length === 0) continue

        // Require distinctive product name keywords (not just brand + common words)
        const distinctiveTokens = nameTokens.filter(t => t.length > 3 && !COMMON_WORDS.has(t))

        if (distinctiveTokens.length === 0) continue

        const matchCount = distinctiveTokens.filter(t => text.includes(t)).length
        const matchRatio = matchCount / distinctiveTokens.length

        // Minimum 2 matches AND 50% ratio to even be a candidate
        if (matchCount < 2 || matchRatio < 0.5) continue

        candidates.push({ product, matchCount, matchRatio, distinctiveTokens })
      }

      if (candidates.length === 0) continue

      // Group candidates by their matched tokens to detect product line over-matching.
      // If 5+ products all match the same set of tokens, it's a product line mention
      // (e.g., "SKIN1004 Madagascar Centella") — pick only the single best match.
      const tokenSignature = (c: CandidateMatch) =>
        c.distinctiveTokens.filter(t => text.includes(t)).sort().join('|')

      const bySignature = new Map<string, CandidateMatch[]>()
      for (const c of candidates) {
        const sig = tokenSignature(c)
        const group = bySignature.get(sig) ?? []
        group.push(c)
        bySignature.set(sig, group)
      }

      // For each group of products sharing the same matched tokens:
      // - If 1-2 products: they're genuinely distinct mentions, keep all
      // - If 3+: it's a product line — keep only the best match
      const finalCandidates: CandidateMatch[] = []
      for (const [, group] of bySignature) {
        if (group.length <= 2) {
          finalCandidates.push(...group)
        } else {
          // Pick the single best match: highest matchRatio, then highest matchCount
          group.sort((a, b) =>
            b.matchRatio - a.matchRatio || b.matchCount - a.matchCount
          )
          finalCandidates.push(group[0])
        }
      }

      // Emit mentions for final candidates
      const sentiment = calculateSentiment(text)
      const postUrl = `https://reddit.com${post.permalink}`

      for (const { product } of finalCandidates) {
        if (mentionedProductIds.has(product.id)) continue
        mentionedProductIds.add(product.id)

        mentions.push({
          product_id: product.id,
          product_name: product.name_en,
          product_brand: product.brand_en,
          subreddit: post.subreddit,
          post_id: post.id,
          post_title: post.title,
          post_url: postUrl,
          post_score: post.score,
          post_comments: post.num_comments,
          sentiment: sentiment * subredditWeight,
          created_utc: post.created_utc,
        })
      }
    }

    return mentions
  }

  /**
   * Scan all configured subreddits and return aggregated mention data.
   */
  async scan(subreddits: SubredditConfig[] = KBEAUTY_SUBREDDITS): Promise<ScanResult> {
    if (!this.productsLoaded) {
      throw new Error('Call loadProducts() before scanning')
    }

    const result: ScanResult = {
      posts_scanned: 0,
      mentions_found: 0,
      products_mentioned: 0,
      subreddits_scanned: 0,
      errors: [],
      aggregates: [],
    }

    // Collect all mentions across subreddits
    const allMentions: ProductMention[] = []

    for (const sub of subreddits) {
      try {
        const posts = await this.fetchPosts(sub.name)
        result.posts_scanned += posts.length
        result.subreddits_scanned++

        for (const post of posts) {
          const mentions = this.extractMentions(post, sub.weight)
          allMentions.push(...mentions)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`r/${sub.name}: ${msg}`)
      }
    }

    result.mentions_found = allMentions.length

    // Aggregate by product
    const byProduct = new Map<string, ProductMention[]>()
    for (const mention of allMentions) {
      const existing = byProduct.get(mention.product_id) ?? []
      existing.push(mention)
      byProduct.set(mention.product_id, existing)
    }

    result.products_mentioned = byProduct.size

    // Build aggregates
    for (const [productId, mentions] of byProduct) {
      const first = mentions[0]
      const subredditSet = new Set(mentions.map(m => m.subreddit))
      const totalUpvotes = mentions.reduce((sum, m) => sum + m.post_score, 0)
      const totalComments = mentions.reduce((sum, m) => sum + m.post_comments, 0)
      const avgSentiment = mentions.reduce((sum, m) => sum + m.sentiment, 0) / mentions.length

      // Weighted mention count (accounts for subreddit relevance)
      const weightedCount = mentions.length // Already weighted in sentiment

      // Top post by score
      const topPost = mentions.reduce((best, m) =>
        m.post_score > best.post_score ? m : best
      , mentions[0])

      // Deduplicate posts (same post may match multiple products)
      const uniquePosts = new Map<string, ProductMention>()
      for (const m of mentions) {
        if (!uniquePosts.has(m.post_id) || m.post_score > (uniquePosts.get(m.post_id)?.post_score ?? 0)) {
          uniquePosts.set(m.post_id, m)
        }
      }

      result.aggregates.push({
        product_id: productId,
        product_name: first.product_name,
        product_brand: first.product_brand,
        mention_count: uniquePosts.size,
        weighted_mention_count: weightedCount,
        total_upvotes: totalUpvotes,
        total_comments: totalComments,
        avg_sentiment: Math.round(avgSentiment * 100) / 100,
        subreddits: [...subredditSet],
        top_post_url: topPost.post_url,
        top_post_title: topPost.post_title,
        posts: [...uniquePosts.values()].map(m => ({
          post_id: m.post_id,
          subreddit: m.subreddit,
          score: m.post_score,
          comments: m.post_comments,
          sentiment: m.sentiment,
          url: m.post_url,
        })),
      })
    }

    // Sort by weighted mention count descending
    result.aggregates.sort((a, b) => b.mention_count - a.mention_count)

    console.log(
      `[reddit] Scan complete: ${result.posts_scanned} posts, ` +
      `${result.mentions_found} mentions, ${result.products_mentioned} products`
    )

    return result
  }
}

// ---------------------------------------------------------------------------
// Sentiment analysis (keyword-based, no AI cost)
// ---------------------------------------------------------------------------

/**
 * Calculate sentiment score from post text using keyword matching.
 * Returns 0.0-1.0 where 0.5 is neutral.
 */
function calculateSentiment(text: string): number {
  const lower = text.toLowerCase()

  let positiveCount = 0
  let negativeCount = 0

  for (const keyword of POSITIVE_KEYWORDS) {
    if (lower.includes(keyword)) positiveCount++
  }

  for (const keyword of NEGATIVE_KEYWORDS) {
    if (lower.includes(keyword)) negativeCount++
  }

  const total = positiveCount + negativeCount
  if (total === 0) return 0.5 // Neutral if no sentiment keywords found

  // Score: 0.0 = very negative, 0.5 = neutral, 1.0 = very positive
  return Math.round((positiveCount / total) * 100) / 100
}
