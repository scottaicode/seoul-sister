/**
 * Seed initial blog posts using Sonnet AI generation backed by real product data.
 * Run: npx tsx scripts/seed-blog-posts.ts
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

interface BlogPost {
  title: string
  slug: string
  category: string
  primary_keyword: string
  secondary_keywords: string[]
  tags: string[]
  data_context: string
  author: string
}

const POSTS: BlogPost[] = [
  {
    title: 'The 10 Best Korean Sunscreens of 2026, Ranked by Real Reviews',
    slug: 'best-korean-sunscreens-2026',
    category: 'sunscreen',
    primary_keyword: 'best Korean sunscreens',
    secondary_keywords: ['K-beauty sunscreen', 'Korean SPF', 'PA++++ sunscreen', 'lightweight sunscreen'],
    tags: ['sunscreen', 'best of', 'K-beauty', 'SPF', 'PA++++'],
    author: 'Seoul Sister Team',
    data_context: `Top Korean sunscreens from Seoul Sister's database of 683 sunscreens across 6,200+ K-beauty products:

1. Beauty of Joseon Relief Sun: Rice + Probiotics SPF50+ PA++++ — Rating: 4.90/5, $18.00. Beloved chemical sunscreen combining rice bran extract (brightening, antioxidant) with probiotics for skin barrier support. #1 trending on Olive Young.
2. ROUND LAB Birch Juice Moisturizing Sunscreen SPF50+ PA++++ — Rating: 4.80/5, $21.00. Lightweight, hydrating formula with birch juice. #2 trending on Olive Young.
3. SKIN1004 Madagascar Centella Hyalu-Cica Water-Fit Sun Serum — Rating: 4.90/5. Centella-based sun serum with hyaluronic acid for sensitive skin. #3 trending.
4. numbuzin No. 1 Clear Filter Sun Essence SPF50+ PA++++ — Rating: 4.80/5, $24.11. Clean finish, no white cast.
5. BOHO All In One Tone Up Cream SPF50+ PA++++ — Rating: 5.00/5. Multifunctional tone-up with niacinamide and centella.
6. ANESSA Perfect UV Sunscreen Skincare Milk SPF50+ PA++++ — Rating: 5.00/5, $36.55. Japanese-Korean hybrid, ultra-lightweight.
7. Abib Airy Sunstick Smoothing Bar — Rating: 5.00/5, $19.80. Portable stick format for reapplication.
8. Anua Slowpure Glow Up Fluid Sun Serum SPF50+ PA++++ — Rating: 5.00/5, $22.56. Hybrid serum texture with tone-up.
9. Rovectin Intense Moisture Sunscreen SPF50+ PA++++ — Rating: 5.00/5. Hydrating formula for dry skin.
10. Dr.G Green Mild Up Sun+ SPF50+ PA++++ — Rating: 4.80/5. Mineral-heavy for sensitive skin.

Ingredient effectiveness data:
- Centella Asiatica: 100% effective for sensitivity (sensitive skin), 90.7% for redness
- Niacinamide: 100% effective for sensitivity (dry skin), great brightening agent
- Rice Bran Extract: 100% effective for dullness, antioxidant protection`,
  },
  {
    title: 'K-Beauty Ingredient Guide: 7 Powerhouse Ingredients Backed by Data',
    slug: 'k-beauty-ingredients-guide-data-backed',
    category: 'ingredients',
    primary_keyword: 'K-beauty ingredients',
    secondary_keywords: ['Korean skincare ingredients', 'centella asiatica', 'niacinamide skincare', 'hyaluronic acid K-beauty', 'snail mucin benefits'],
    tags: ['ingredients', 'skincare science', 'K-beauty', 'centella', 'niacinamide', 'hyaluronic acid'],
    author: 'Seoul Sister Team',
    data_context: `Ingredient effectiveness data from Seoul Sister's learning engine (based on community reports):

1. CENTELLA ASIATICA — The #1 K-beauty ingredient
   - 100% effective for sensitivity in sensitive skin (4 reports)
   - 90.7% effective for redness in sensitive skin (59 reports — highest sample size)
   - Function: soothing, healing, anti-inflammatory
   - Found in: SKIN1004 Madagascar Centella line, Purito Centella line, Dr.Jart+ Cicapair

2. HYALURONIC ACID / SODIUM HYALURONATE
   - 100% effective for dryness in dry skin (12 reports)
   - 88% effective for dehydration in dry skin (70 reports — largest sample)
   - Function: humectant, hydration
   - Found in: Torriden Dive In Serum (4.90 rating), Anua DPPR Hyalcube (5.00 rating, 1,216 reviews)

3. NIACINAMIDE (Vitamin B3)
   - 100% effective for sensitivity in dry skin (4 reports)
   - Function: brightening, pore-minimizing, barrier-support
   - Found in: ShionLe Laminaria Greenery Serum (5.00 rating, 2,259 reviews)

4. PANTHENOL (Vitamin B5)
   - 100% effective for dryness in dry skin (12 reports)
   - 100% effective for sensitivity in dry AND sensitive skin (4 reports each)
   - Function: soothing, moisturizing, healing
   - Found in: Anotherface Peptathenol10 Barrier Serum (5.00, 1,163 reviews)

5. CERAMIDE NP
   - 100% effective for sensitivity in dry skin (4 reports)
   - 90% effective for dehydration in dry skin (60 reports)
   - Function: barrier-repair, moisturizing
   - Found in: Neuraderm Medytox Derma Cream (5.00, 1,224 reviews — 7 types of ceramides)

6. SALICYLIC ACID (BHA)
   - 88% effective for blackheads in oily skin (55 reports)
   - Function: exfoliating, acne-fighting
   - K-beauty formulates at gentler concentrations than Western brands

7. SNAIL MUCIN
   - 100% effective for dryness in dry skin (4 reports)
   - Function: healing, moisturizing, anti-aging
   - Made famous by COSRX Advanced Snail 96 Mucin Power Essence`,
  },
  {
    title: 'What Korean Women Are Actually Buying Right Now: Olive Young Bestsellers',
    slug: 'olive-young-bestsellers-what-korea-is-buying',
    category: 'trends',
    primary_keyword: 'Olive Young bestsellers',
    secondary_keywords: ['trending in Korea', 'Korean skincare trends 2026', 'K-beauty trends', 'what\'s popular in Korea'],
    tags: ['trends', 'Olive Young', 'bestsellers', 'Korea', 'K-beauty'],
    author: 'Seoul Sister Team',
    data_context: `Live Olive Young bestseller data from Seoul Sister's daily Korean market intelligence scraper:

#1 Beauty of Joseon Relief Sun: Rice + Probiotics SPF50+ PA++++ (Score: 100)
   Category: Sunscreen | Rating: 4.90 | $25.99 for double pack
   Gap Score: 100 — massively trending in Korea, growing awareness in US

#2 ROUND LAB Birch Juice Moisturizing Sunscreen (Score: 97)
   Category: Sunscreen | Rating: 4.80 | $21.00
   Gap Score: 97 — huge in Korea, still emerging in US market

#3 SKIN1004 Madagascar Centella Sun Serum (Score: 94)
   Category: Sunscreen | Rating: 4.90
   Gap Score: 94 — centella + sun protection combo trending hard

#4 AESTURA Atobarrier 365 Cream (Score: 91)
   Category: Moisturizer | Rating: 4.70 | $19.00
   Gap Score: 91 — dermatologist-recommended barrier cream

#5 MEDIHEAL Toner Pad Double Pack (Score: 88)
   Category: Toner | Rating: 4.80 | $34.04
   Gap Score: 88 — toner pads are a massive category in Korea

#7 Torriden Dive In Hyaluronic Acid Mask Sheet 20ea (Score: 82)
   Category: Mask | Rating: 4.90 | $35.00
   Gap Score: 82 — bulk mask packs dominate Korean shopping

#9 Torriden Dive In Hyaluronic Acid Serum Refill Pack (Score: 76)
   Category: Serum | Rating: 4.90 | $35.00
   Gap Score: 76 — refill culture is huge in Korea (sustainability + savings)

#11 freshian (Fwee) Egg-like Cream Blush (Score: 70)
   Category: Cosmetics | Rating: 4.70 | $13.66
   Gap Score: 70 — Korean "glass skin" blush trend

KEY INSIGHT: 4 of the top 5 bestsellers are SUNSCREENS. Korean women prioritize sun protection above everything else — and the US market is finally catching on. Also notable: refill packs, toner pads, and bulk mask packs show how differently Koreans shop for skincare vs Americans.`,
  },
  {
    title: 'Best Korean Serums of 2026: Data-Driven Picks From 520+ Products',
    slug: 'best-korean-serums-2026',
    category: 'serums',
    primary_keyword: 'best Korean serums',
    secondary_keywords: ['K-beauty serums', 'Korean serum recommendations', 'niacinamide serum Korean', 'hyaluronic acid serum K-beauty'],
    tags: ['serums', 'best of', 'K-beauty', 'product recommendations', 'niacinamide', 'hyaluronic acid'],
    author: 'Seoul Sister Team',
    data_context: `Top Korean serums from Seoul Sister's database of 520 serums, ranked by community rating and review count:

1. ShionLe Laminaria Greenery Serum — 5.00/5 (2,259 reviews), $15.20
   20% kelp juice + niacinamide. Budget-friendly powerhouse.

2. Anua DPPR Hyalcube Flooding Serum — 5.00/5 (1,216 reviews), $22.56
   10 types of hyaluronic acid for multi-layer hydration. Anua's bestseller.

3. Anotherface Peptathenol10 Barrier Serum — 5.00/5 (1,163 reviews), $34.30
   10% panthenol + peptides for barrier repair. Panthenol is 100% effective for dry skin sensitivity.

4. Anua Cell In Shot TX Gluta Shot — 5.00/5 (525 reviews), $22.56
   3% tranexamic acid + glutathione for brightening/dark spots.

5. Anua DPPR Soycube Exorepair Serum — 5.00/5 (524 reviews), $22.56
   Soy isoflavones + peptides for aging concerns.

6. Anua Clear Tone Dark Spot Serum — 5.00/5 (237 reviews), $22.56
   7% niacinamide + 3% tranexamic acid. Targeted dark spot treatment.

7. Anua PDRN Bounce Ball Serum — 5.00/5 (72 reviews), $22.56
   PDRN (salmon DNA) is the hottest ingredient trend in Korea right now.

8. Demaf Here-Oh My First Serum — 5.00/5 (62 reviews), $34.00
   Evening primrose extract + oils for first-step hydration.

9. Beauty of Joseon Hanbang Serum Discovery Kit — 5.00/5 (37 reviews), $25.99
   4x10ml kit with ginseng, rice, calming, and revitalize serums.

10. Torriden Dive In Low Molecular Hyaluronic Acid Serum — 4.90/5, $35.00 (refill pack)
    Currently #9 on Olive Young bestseller list. The OG Korean hyaluronic acid serum.

KEY INSIGHT: Anua dominates the serum category with 5 products in the top 10. Their price point ($22.56) hits the sweet spot. PDRN serums are the emerging trend — salmon DNA for skin regeneration is everywhere in Korean clinics and now hitting consumer products.

Ingredient effectiveness context:
- Hyaluronic Acid: 88% effective for dehydration (70 reports)
- Niacinamide: 100% effective for sensitivity in dry skin
- Panthenol: 100% effective for both dryness and sensitivity`,
  },
  {
    title: 'Korean Skincare for Beginners: Your First K-Beauty Routine in 5 Steps',
    slug: 'korean-skincare-beginners-guide',
    category: 'guides',
    primary_keyword: 'Korean skincare routine for beginners',
    secondary_keywords: ['K-beauty routine', 'how to start Korean skincare', '10 step Korean skincare', 'Korean skincare steps'],
    tags: ['beginners', 'routines', 'K-beauty', 'skincare steps', 'guide'],
    author: 'Seoul Sister Team',
    data_context: `Product recommendations from Seoul Sister's database of 6,200+ products across 14 categories, with ingredient effectiveness data:

STEP 1 - CLEANSER (805 products in database):
Best rated: Anotherface Peptathenol Aqua Balance Cleanser, Anua Double Cleansing Oil
Key ingredients to look for: gentle surfactants, low pH (5.5), no harsh SLS

STEP 2 - TONER (461 products):
Best rated: MEDIHEAL Toner Pads (4.80, trending #5 on Olive Young)
Key ingredients: Hyaluronic Acid (88% effective for dehydration, 70 reports)

STEP 3 - SERUM/ESSENCE (520 serums + 130 essences):
Best rated: ShionLe Laminaria Greenery Serum (5.00, 2,259 reviews, only $15.20)
Key ingredients by skin type:
  - Oily/acne: Niacinamide, Salicylic Acid (88% effective for blackheads)
  - Dry: Hyaluronic Acid, Panthenol (100% effective for dryness)
  - Sensitive: Centella Asiatica (90.7% effective for redness, 59 reports)

STEP 4 - MOISTURIZER (974 products):
Best rated: ShionLe Laminaria Glazed Cream (5.00, 2,482 reviews, $28.00)
Budget pick: AESTURA Atobarrier 365 Cream (4.70, $19.00, trending #4 on Olive Young)
Key ingredients: Ceramide NP (90% effective for dehydration, 60 reports)

STEP 5 - SUNSCREEN (683 products — Korean sunscreens are unmatched):
Best rated: Beauty of Joseon Relief Sun SPF50+ PA++++ (4.90, $18.00, trending #1)
4 of top 5 Olive Young bestsellers are sunscreens — this is THE step Koreans never skip

Budget full routine estimate: $70-90 for all 5 steps
Premium full routine estimate: $120-180 for all 5 steps

Additional context:
- Seoul Sister has ingredient conflict detection — users can check if products work together
- The Korean "double cleanse" (oil + water cleanser) is step 0 for PM routines
- Korean women layer products thinnest to thickest consistency
- "Glass skin" (유리 피부) is the aspirational standard — luminous, poreless, translucent`,
  },
]

const SYSTEM_PROMPT = `You are a K-beauty content writer for Seoul Sister, the world's first English-language K-beauty intelligence platform backed by a database of 6,200+ Korean beauty products.

VOICE:
- Expert but approachable — a knowledgeable Korean beauty advisor who happens to have a massive product database
- Reference specific products, prices, and ratings from the data provided — this is what makes Seoul Sister's content unique
- Include actionable advice people can use immediately
- Write for Gen Z women (18-30) who are ingredient-literate and budget-conscious
- Natural, conversational tone — enthusiastic but never breathless or fake
- NO generic filler. Every sentence should inform, advise, or surprise

FORMAT:
- Write in Markdown
- Do NOT start with an H1 — the page template adds the title automatically
- Start with a compelling intro paragraph (2-3 sentences) that hooks the reader
- Use H2 (##) for major sections, H3 (###) for subsections
- Include specific product names, prices, and ratings from the provided data
- Bold key product names and important takeaways
- Use bullet points or numbered lists for product recommendations
- End with a "Bottom Line" or "TL;DR" section
- Target 1,400-1,800 words
- Naturally weave in the primary keyword 3-5 times and secondary keywords 1-2 times each

ALSO GENERATE (as JSON after the markdown, separated by ===JSON===):
{
  "meta_description": "155 characters max, includes primary keyword, written to entice clicks from Google search results",
  "faq": [
    { "question": "Natural question someone would search on Google about this topic", "answer": "Concise 2-3 sentence answer with specific product or data references" },
    // Generate 4-6 FAQs
  ]
}`

async function generatePost(post: BlogPost): Promise<void> {
  console.log(`\nGenerating: "${post.title}"...`)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Write a blog post titled: "${post.title}"

Primary keyword: ${post.primary_keyword}
Secondary keywords: ${post.secondary_keywords.join(', ')}

DATA FROM SEOUL SISTER'S DATABASE:
${post.data_context}

Remember: Reference the actual products, prices, ratings, and effectiveness data above. This content should feel like insider intelligence, not generic advice you'd find anywhere.`,
    }],
  })

  const fullText = response.content
    .filter(b => b.type === 'text')
    .map(b => ('text' in b ? b.text : ''))
    .join('')

  const jsonSplit = fullText.split('===JSON===')
  const body = jsonSplit[0].trim()
  let meta_description = `${post.title} — Data-backed K-beauty intelligence from Seoul Sister.`
  let faq_schema: { questions: Array<{ question: string; answer: string }> } = { questions: [] }

  if (jsonSplit[1]) {
    try {
      const jsonStr = jsonSplit[1].replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      meta_description = parsed.meta_description || meta_description
      faq_schema = { questions: parsed.faq || [] }
    } catch (e) {
      console.warn(`  Warning: Failed to parse JSON metadata for "${post.title}"`)
    }
  }

  const wordCount = body.split(/\s+/).length
  const read_time_minutes = Math.ceil(wordCount / 200)

  // Generate excerpt
  const firstPara = body.replace(/^#+\s+.+\n+/, '').split('\n\n')[0] || ''
  const excerpt = firstPara.replace(/[*_#\[\]]/g, '').slice(0, 300).trim()

  // Stagger published_at dates over the past 2 weeks for natural appearance
  const daysAgo = POSTS.indexOf(post) * 3 // 0, 3, 6, 9, 12 days ago
  const publishedAt = new Date()
  publishedAt.setDate(publishedAt.getDate() - daysAgo)
  publishedAt.setHours(10, 0, 0, 0)

  // Check if slug exists
  const { data: existing } = await supabase
    .from('ss_content_posts')
    .select('id')
    .eq('slug', post.slug)
    .maybeSingle()

  if (existing) {
    console.log(`  Skipping — slug "${post.slug}" already exists`)
    return
  }

  const { error } = await supabase
    .from('ss_content_posts')
    .insert({
      title: post.title,
      slug: post.slug,
      body,
      category: post.category,
      tags: post.tags,
      meta_description,
      excerpt,
      primary_keyword: post.primary_keyword,
      secondary_keywords: post.secondary_keywords,
      faq_schema,
      read_time_minutes,
      author: post.author,
      source: 'manual',
      published_at: publishedAt.toISOString(),
    })

  if (error) {
    console.error(`  ERROR inserting "${post.title}":`, error.message)
    return
  }

  console.log(`  Published: /blog/${post.slug} (${wordCount} words, ${read_time_minutes} min read)`)
  console.log(`  Meta: ${meta_description.slice(0, 80)}...`)
  console.log(`  FAQs: ${faq_schema.questions.length}`)

  // Cost tracking
  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cost = (inputTokens * 3 / 1_000_000) + (outputTokens * 15 / 1_000_000)
  console.log(`  Tokens: ${inputTokens} in / ${outputTokens} out (~$${cost.toFixed(3)})`)
}

async function main() {
  console.log('=== Seoul Sister Blog Seed ===')
  console.log(`Generating ${POSTS.length} blog posts using Sonnet...\n`)

  let totalCost = 0
  for (const post of POSTS) {
    const start = Date.now()
    await generatePost(post)
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`  Time: ${elapsed}s`)
  }

  // Verify
  const { count } = await supabase
    .from('ss_content_posts')
    .select('*', { count: 'exact', head: true })
    .not('published_at', 'is', null)

  console.log(`\n=== Done ===`)
  console.log(`Total published posts: ${count}`)
  console.log(`Blog URL: https://www.seoulsister.com/blog`)
}

main().catch(console.error)
