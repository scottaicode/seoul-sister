import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/utils/cron-auth'
import { getServiceClient } from '@/lib/supabase'
import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'

export const maxDuration = 300 // Content generation needs full Vercel Pro budget

// Topic generators — each queries real data and returns a blog post topic with context
type TopicGenerator = (supabase: ReturnType<typeof getServiceClient>) => Promise<TopicResult | null>

interface TopicResult {
  title: string
  slug: string
  category: string
  primary_keyword: string
  secondary_keywords: string[]
  tags: string[]
  prompt_context: string // Real data to inject into the generation prompt
}

// ─── Topic Generators ────────────────────────────────────────────────

async function trendingProductRoundup(supabase: ReturnType<typeof getServiceClient>): Promise<TopicResult | null> {
  const { data: trending } = await supabase
    .from('ss_trending_products')
    .select('product_id, trend_score, source, source_product_name, source_product_brand, rank_position, gap_score')
    .order('trend_score', { ascending: false })
    .limit(10)

  if (!trending?.length) return null

  // Fetch matched product details
  const productIds = trending.filter(t => t.product_id).map(t => t.product_id)
  const { data: products } = productIds.length
    ? await supabase
        .from('ss_products')
        .select('id, name_en, brand_en, category, rating_avg, description_en')
        .in('id', productIds)
      : { data: [] }

  const productMap = new Map((products || []).map(p => [p.id, p]))
  const lines = trending.map((t, i) => {
    const p = t.product_id ? productMap.get(t.product_id) : null
    const name = p?.name_en || t.source_product_name || 'Unknown'
    const brand = p?.brand_en || t.source_product_brand || ''
    const desc = p?.description_en || ''
    return `${i + 1}. ${brand} ${name} — Score: ${t.trend_score}, Source: ${t.source}, Rank: ${t.rank_position || 'N/A'}${t.gap_score && t.gap_score > 50 ? `, Gap Score: ${t.gap_score} (trending in Korea, not yet known in US)` : ''}${desc ? `\n   Description: ${desc}` : ''}`
  }).join('\n')

  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  return {
    title: `Top 10 Trending K-Beauty Products in ${month}`,
    slug: `trending-k-beauty-products-${new Date().toISOString().slice(0, 7)}`,
    category: 'trends',
    primary_keyword: 'trending K-beauty products',
    secondary_keywords: ['Korean skincare trends', 'Olive Young bestsellers', 'K-beauty 2026', 'viral Korean skincare'],
    tags: ['trends', 'K-beauty', 'bestsellers', 'Olive Young'],
    prompt_context: `Here are the current top 10 trending K-beauty products based on real Olive Young Korean sales data and Reddit community mentions:\n\n${lines}`,
  }
}

async function ingredientDeepDive(supabase: ReturnType<typeof getServiceClient>): Promise<TopicResult | null> {
  const { data: effective } = await supabase
    .from('ss_ingredient_effectiveness')
    .select('ingredient_id, skin_type, concern, effectiveness_score, sample_size, positive_reports')
    .gte('effectiveness_score', 0.75)
    .order('effectiveness_score', { ascending: false })
    .limit(30)

  if (!effective?.length) return null

  const ingredientIds = [...new Set(effective.map(e => e.ingredient_id))]
  const { data: ingredients } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci, name_en, function, is_active, safety_rating')
    .in('id', ingredientIds)

  if (!ingredients?.length) return null

  // Pick a random top ingredient that hasn't been written about recently
  const { data: existingPosts } = await supabase
    .from('ss_content_posts')
    .select('primary_keyword')
    .not('primary_keyword', 'is', null)

  const existingKeywords = new Set((existingPosts || []).map(p => p.primary_keyword?.toLowerCase()))
  const candidates = ingredients.filter(i =>
    !existingKeywords.has(i.name_inci?.toLowerCase()) && !existingKeywords.has(i.name_en?.toLowerCase())
  )

  const ingredient = candidates[0] || ingredients[0]
  const effData = effective.filter(e => e.ingredient_id === ingredient.id)
  const effLines = effData.map(e =>
    `- Skin type: ${e.skin_type}, Concern: ${e.concern}, Effectiveness: ${Math.round(e.effectiveness_score * 100)}% (${e.sample_size} reports)`
  ).join('\n')

  const slugName = (ingredient.name_en || ingredient.name_inci).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return {
    title: `${ingredient.name_en || ingredient.name_inci}: The Complete K-Beauty Ingredient Guide`,
    slug: `${slugName}-k-beauty-ingredient-guide`,
    category: 'ingredients',
    primary_keyword: ingredient.name_en || ingredient.name_inci,
    secondary_keywords: [`${ingredient.name_en} skincare`, `${ingredient.name_en} benefits`, `K-beauty ${ingredient.name_en}`, `${ingredient.name_en} for skin`],
    tags: ['ingredients', 'skincare science', ingredient.name_en || ingredient.name_inci, 'K-beauty'],
    prompt_context: `Ingredient: ${ingredient.name_inci} (${ingredient.name_en})\nFunction: ${ingredient.function}\nActive: ${ingredient.is_active}\nSafety: ${ingredient.safety_rating}\n\nEffectiveness data from Seoul Sister's database:\n${effLines}`,
  }
}

async function categoryBestOf(supabase: ReturnType<typeof getServiceClient>): Promise<TopicResult | null> {
  const categories = ['sunscreen', 'serum', 'moisturizer', 'cleanser', 'toner', 'essence', 'ampoule', 'mask']

  // Pick category not recently written about
  const { data: existingPosts } = await supabase
    .from('ss_content_posts')
    .select('slug')
    .like('slug', '%best-korean%')

  const existingSlugs = new Set((existingPosts || []).map(p => p.slug))
  const year = new Date().getFullYear()
  const category = categories.find(c => !existingSlugs.has(`best-korean-${c}s-${year}`)) || categories[0]

  const { data: products } = await supabase
    .from('ss_products')
    .select('id, name_en, brand_en, rating_avg, review_count, description_en, price_usd')
    .eq('category', category)
    .not('rating_avg', 'is', null)
    .order('rating_avg', { ascending: false })
    .limit(15)

  if (!products?.length) return null

  const lines = products.map((p, i) =>
    `${i + 1}. ${p.brand_en} ${p.name_en} — Rating: ${p.rating_avg}/5 (${p.review_count || 0} reviews)${p.price_usd ? `, $${p.price_usd}` : ''}${p.description_en ? `\n   ${p.description_en}` : ''}`
  ).join('\n')

  const catPlural = category === 'essence' ? 'essences' : `${category}s`
  return {
    title: `Best Korean ${catPlural.charAt(0).toUpperCase() + catPlural.slice(1)} of ${year}: Top ${products.length} Picks`,
    slug: `best-korean-${catPlural}-${year}`,
    category: category === 'sunscreen' ? 'sunscreen' : category === 'serum' ? 'serums' : category === 'moisturizer' ? 'moisturizers' : category === 'cleanser' ? 'cleansers' : 'general',
    primary_keyword: `best Korean ${catPlural}`,
    secondary_keywords: [`top K-beauty ${catPlural}`, `Korean ${category} recommendations`, `${catPlural} for sensitive skin`, `affordable Korean ${catPlural}`],
    tags: ['best of', category, 'K-beauty', 'product recommendations'],
    prompt_context: `Top ${products.length} Korean ${catPlural} by community rating from Seoul Sister's database of 5,800+ K-beauty products:\n\n${lines}`,
  }
}

async function skinTypeguide(supabase: ReturnType<typeof getServiceClient>): Promise<TopicResult | null> {
  const skinTypes = ['oily', 'dry', 'combination', 'sensitive']

  const { data: existingPosts } = await supabase
    .from('ss_content_posts')
    .select('slug')
    .like('slug', '%skin-routine-guide%')

  const existingSlugs = new Set((existingPosts || []).map(p => p.slug))
  const skinType = skinTypes.find(s => !existingSlugs.has(`${s}-skin-routine-guide`)) || skinTypes[0]

  // Get ingredient effectiveness for this skin type
  const { data: effData } = await supabase
    .from('ss_ingredient_effectiveness')
    .select('ingredient_id, concern, effectiveness_score')
    .eq('skin_type', skinType)
    .gte('effectiveness_score', 0.70)
    .order('effectiveness_score', { ascending: false })
    .limit(10)

  const ingredientIds = (effData || []).map(e => e.ingredient_id)
  const { data: ingredients } = ingredientIds.length
    ? await supabase.from('ss_ingredients').select('id, name_en').in('id', ingredientIds)
    : { data: [] }

  const ingredientMap = new Map((ingredients || []).map(i => [i.id, i.name_en]))
  const effLines = (effData || []).map(e =>
    `- ${ingredientMap.get(e.ingredient_id) || 'Unknown'}: ${Math.round(e.effectiveness_score * 100)}% effective for ${e.concern}`
  ).join('\n')

  return {
    title: `The Ultimate K-Beauty Routine for ${skinType.charAt(0).toUpperCase() + skinType.slice(1)} Skin`,
    slug: `${skinType}-skin-routine-guide`,
    category: 'routines',
    primary_keyword: `K-beauty routine ${skinType} skin`,
    secondary_keywords: [`Korean skincare ${skinType} skin`, `${skinType} skin products`, `best K-beauty for ${skinType} skin`, `${skinType} skin routine steps`],
    tags: ['routines', skinType, 'skin type guide', 'K-beauty'],
    prompt_context: `Top effective ingredients for ${skinType} skin from Seoul Sister's learning engine:\n\n${effLines}`,
  }
}

// ─── Topic Selection ─────────────────────────────────────────────────

const TOPIC_GENERATORS: TopicGenerator[] = [
  trendingProductRoundup,
  ingredientDeepDive,
  categoryBestOf,
  skinTypeguide,
]

async function pickTopic(supabase: ReturnType<typeof getServiceClient>): Promise<TopicResult | null> {
  // Rotate through generators based on day of month
  const dayOfMonth = new Date().getDate()
  const generatorIndex = dayOfMonth % TOPIC_GENERATORS.length
  const orderedGenerators = [
    ...TOPIC_GENERATORS.slice(generatorIndex),
    ...TOPIC_GENERATORS.slice(0, generatorIndex),
  ]

  for (const gen of orderedGenerators) {
    const topic = await gen(supabase)
    if (topic) {
      // Check if slug already exists
      const { data: existing } = await supabase
        .from('ss_content_posts')
        .select('id')
        .eq('slug', topic.slug)
        .maybeSingle()
      if (!existing) return topic
    }
  }
  return null
}

// ─── Content Generation ──────────────────────────────────────────────

async function generateBlogPost(topic: TopicResult): Promise<{
  body: string
  meta_description: string
  excerpt: string
  faq_schema: { questions: Array<{ question: string; answer: string }> }
  read_time_minutes: number
}> {
  const anthropic = getAnthropicClient()

  const systemPrompt = `You are a K-beauty content writer for Seoul Sister, the world's first English-language K-beauty intelligence platform. Write authoritative, data-backed blog posts.

VOICE:
- Expert but approachable — a knowledgeable Korean beauty advisor, not a textbook
- Reference specific products and ingredients by name from the data provided
- Include actionable advice people can use immediately
- Write for Gen Z women (18-30) who are ingredient-literate and budget-conscious
- Natural, conversational tone — not corporate or overly formal
- NO generic filler — every sentence should inform or advise

FORMAT:
- Write in Markdown
- Start with a compelling intro paragraph (no H1 — the page template adds the title)
- Use H2 (##) for major sections, H3 (###) for subsections
- Include specific product names, prices, ingredients from the data
- Bold key takeaways and product names
- End with a clear summary or "bottom line" section
- Target 1,200-1,800 words
- Write for SEO: naturally include the primary keyword 3-5 times and secondary keywords 1-2 times each

ALSO GENERATE (as JSON after the markdown, separated by ===JSON===):
{
  "meta_description": "155 chars max, includes primary keyword, compelling for search results",
  "faq": [
    { "question": "Natural question someone would Google", "answer": "Concise 2-3 sentence answer" },
    // 4-6 FAQs
  ]
}`

  const userPrompt = `Write a blog post titled: "${topic.title}"

Primary keyword: ${topic.primary_keyword}
Secondary keywords: ${topic.secondary_keywords.join(', ')}

DATA FROM SEOUL SISTER'S DATABASE:
${topic.prompt_context}

Remember: Reference the actual products and data above. This is what makes Seoul Sister's content authoritative — it's backed by real data from 5,800+ K-beauty products and community intelligence.`

  const response = await callAnthropicWithRetry(() =>
    anthropic.messages.create({
      model: MODELS.background, // Sonnet for cost-efficiency
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
  )

  const fullText = response.content
    .filter(b => b.type === 'text')
    .map(b => ('text' in b ? b.text : ''))
    .join('')

  // Split markdown body from JSON metadata
  const jsonSplit = fullText.split('===JSON===')
  const body = jsonSplit[0].trim()
  let meta_description = `${topic.title} — Data-backed K-beauty intelligence from Seoul Sister.`
  let faq_schema: { questions: Array<{ question: string; answer: string }> } = { questions: [] }

  if (jsonSplit[1]) {
    try {
      // Extract JSON from the second part (may have markdown code fences)
      const jsonStr = jsonSplit[1].replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      meta_description = parsed.meta_description || meta_description
      faq_schema = { questions: parsed.faq || [] }
    } catch {
      console.warn('[generate-content] Failed to parse JSON metadata, using defaults')
    }
  }

  const wordCount = body.split(/\s+/).length
  const read_time_minutes = Math.ceil(wordCount / 200)

  // Generate excerpt from first paragraph
  const firstPara = body.replace(/^#+\s+.+\n+/, '').split('\n\n')[0] || ''
  const excerpt = firstPara.replace(/[*_#\[\]]/g, '').slice(0, 300).trim()

  return { body, meta_description, excerpt, faq_schema, read_time_minutes }
}

// ─── Main Handler ────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // DISABLED: Blog generation now handled entirely by LGAAS lead generation platform.
    // Seoul Sister receives blog posts via /api/admin/content/ingest webhook from LGAAS.
    // Disabled 2026-03-09 to prevent duplicate, lower-quality posts without hero images or human voice enforcement.
    return NextResponse.json({
      success: true,
      generated: false,
      reason: 'Blog generation disabled — handled by LGAAS platform',
      ran_at: new Date().toISOString(),
    })

    const authError = verifyCronAuth(request)
    if (authError) return authError

    const supabase = getServiceClient()
    const startMs = Date.now()

    // Pick a topic that hasn't been written about
    const topic = await pickTopic(supabase)
    if (!topic) {
      return NextResponse.json({
        success: true,
        generated: false,
        reason: 'No new topics available — all topic generators returned existing slugs',
        ran_at: new Date().toISOString(),
      })
    }

    // Generate the post via Sonnet
    const content = await generateBlogPost(topic)

    // Insert into ss_content_posts
    const { data: post, error } = await supabase
      .from('ss_content_posts')
      .insert({
        title: topic.title,
        slug: topic.slug,
        body: content.body,
        category: topic.category,
        tags: topic.tags,
        meta_description: content.meta_description,
        excerpt: content.excerpt,
        primary_keyword: topic.primary_keyword,
        secondary_keywords: topic.secondary_keywords,
        faq_schema: content.faq_schema,
        read_time_minutes: content.read_time_minutes,
        author: 'Seoul Sister Team',
        source: 'manual',
        published_at: new Date().toISOString(),
      })
      .select('id, slug, title')
      .single()

    if (error) {
      console.error('[generate-content] Insert error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const durationMs = Date.now() - startMs
    console.log(`[generate-content] Published: "${post.title}" -> /blog/${post.slug} (${durationMs}ms)`)

    return NextResponse.json({
      success: true,
      generated: true,
      post: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        url: `https://www.seoulsister.com/blog/${post.slug}`,
      },
      topic_type: topic.category,
      duration_ms: durationMs,
      ran_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[generate-content] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate content', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// Vercel cron jobs send GET requests
export { POST as GET }
