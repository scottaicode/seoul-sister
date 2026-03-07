/**
 * AI-Enrich Top Ingredients with Deep Content for SEO
 * Run: npx tsx scripts/enrich-ingredients.ts
 *
 * Generates structured rich_content JSONB for the most-used ingredients
 * that currently have thin descriptions. Uses Sonnet for cost efficiency.
 *
 * Idempotent: only processes WHERE rich_content IS NULL.
 * Cost: ~$0.02-0.04 per ingredient, ~$4-8 for 200 ingredients.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Parse .env.local (no dotenv dependency)
const envContent = readFileSync('.env.local', 'utf8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! })

const BATCH_SIZE = 200
const DELAY_MS = 500
const MODEL = 'claude-sonnet-4-5-20250929'

interface IngredientToEnrich {
  id: string
  name_inci: string
  name_en: string
  name_ko: string | null
  function: string | null
  description: string | null
  safety_rating: number | null
  comedogenic_rating: number | null
  is_fragrance: boolean
  is_active: boolean
  common_concerns: string[] | null
  product_count: number
}

interface EffectivenessData {
  skin_type: string
  concern: string
  effectiveness_score: number
  sample_size: number
}

interface ConflictData {
  severity: string
  description: string
  other_ingredient: string
}

interface ProductData {
  name_en: string
  brand_en: string
  rating_avg: number | null
}

const SYSTEM_PROMPT = `You are a cosmetic chemist and K-beauty expert writing ingredient encyclopedia content for Seoul Sister, an AI-powered K-beauty intelligence platform.

VOICE:
- Authoritative and scientific but accessible to Gen Z women (18-30) interested in skincare
- Reference real data when provided (effectiveness scores, product names, conflict info)
- Natural tone — informative but not clinical or dry
- NO AI buzzwords (no "delve", "crucial", "landscape", "harness", "game-changer")
- NO em dashes — use commas, periods, or parentheses instead

FORMAT:
Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "overview": "200-400 word deep explanation of what this ingredient is, how it benefits skin, and why it matters in K-beauty. Write in paragraphs, not bullets.",
  "how_it_works": "150-250 word explanation of the mechanism of action at a molecular/cellular level, simplified for an educated consumer.",
  "skin_types": {
    "oily": "2-3 sentences on how this ingredient works for oily skin. If not relevant, say so honestly.",
    "dry": "2-3 sentences for dry skin.",
    "combination": "2-3 sentences for combination skin.",
    "sensitive": "2-3 sentences for sensitive skin.",
    "normal": "2-3 sentences for normal skin."
  },
  "usage_tips": ["tip 1", "tip 2", "tip 3", "tip 4"],
  "history_origin": "100-150 word background on where this ingredient comes from, its history in skincare or traditional medicine, and how it became popular in K-beauty.",
  "faq": [
    { "question": "Natural question someone would Google", "answer": "Concise 2-3 sentence answer referencing real data when available." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
  ]
}

RULES:
- Generate exactly 3-5 FAQ items
- Generate exactly 3-5 usage tips
- All text must be factual and scientifically grounded
- Reference Seoul Sister data (products, effectiveness scores) when provided
- If effectiveness data shows this ingredient works better for certain skin types, reflect that
- If there are known conflicts, mention them in relevant skin_type sections and FAQs
- Do NOT invent product names or data not provided`

async function getTopIngredients(): Promise<IngredientToEnrich[]> {
  // Get top ingredients by product count that haven't been enriched yet
  // Using a subquery to count products per ingredient
  const { data, error } = await supabase.rpc('get_unenriched_ingredients', {
    batch_limit: BATCH_SIZE,
  })

  if (error) {
    // Fallback: if RPC doesn't exist, do it manually
    console.log('RPC not available, using manual query...')

    // Step 1: Get product counts per ingredient
    const { data: ingredients, error: ingErr } = await supabase
      .from('ss_ingredients')
      .select('id, name_inci, name_en, name_ko, function, description, safety_rating, comedogenic_rating, is_fragrance, is_active, common_concerns')
      .is('rich_content', null)
      .eq('is_active', true)
      .limit(1000)

    if (ingErr || !ingredients) {
      console.error('Failed to fetch ingredients:', ingErr?.message)
      return []
    }

    // Step 2: Get product counts for each
    const counts: Record<string, number> = {}
    for (let i = 0; i < ingredients.length; i += 50) {
      const batch = ingredients.slice(i, i + 50)
      const ids = batch.map(ing => ing.id)
      const { data: countData } = await supabase
        .from('ss_product_ingredients')
        .select('ingredient_id', { count: 'exact' })
        .in('ingredient_id', ids)

      // Count per ingredient from the rows
      if (countData) {
        for (const row of countData) {
          const ingId = (row as { ingredient_id: string }).ingredient_id
          counts[ingId] = (counts[ingId] || 0) + 1
        }
      }
    }

    // Combine and sort by product count
    const enriched = ingredients.map(ing => ({
      ...ing,
      product_count: counts[ing.id] || 0,
    }))

    enriched.sort((a, b) => b.product_count - a.product_count)
    return enriched.slice(0, BATCH_SIZE) as IngredientToEnrich[]
  }

  return data as IngredientToEnrich[]
}

async function getIngredientContext(ingredientId: string) {
  const [effectivenessRes, conflictsARes, conflictsBRes, productsRes, countRes] = await Promise.all([
    // Top 5 effectiveness rows
    supabase
      .from('ss_ingredient_effectiveness')
      .select('skin_type, concern, effectiveness_score, sample_size')
      .eq('ingredient_id', ingredientId)
      .gte('sample_size', 3)
      .order('effectiveness_score', { ascending: false })
      .limit(5),

    // Conflicts (as ingredient_a)
    supabase
      .from('ss_ingredient_conflicts')
      .select('severity, description, other:ingredient_b_id(name_en)')
      .eq('ingredient_a_id', ingredientId)
      .limit(5),

    // Conflicts (as ingredient_b)
    supabase
      .from('ss_ingredient_conflicts')
      .select('severity, description, other:ingredient_a_id(name_en)')
      .eq('ingredient_b_id', ingredientId)
      .limit(5),

    // Top 5 products by rating
    supabase
      .from('ss_product_ingredients')
      .select('product:ss_products(name_en, brand_en, rating_avg)')
      .eq('ingredient_id', ingredientId)
      .limit(20),

    // Total product count
    supabase
      .from('ss_product_ingredients')
      .select('id', { count: 'exact', head: true })
      .eq('ingredient_id', ingredientId),
  ])

  const effectiveness = (effectivenessRes.data || []) as EffectivenessData[]

  const conflicts: ConflictData[] = [
    ...(conflictsARes.data || []).map((c: Record<string, unknown>) => {
      const other = c.other as { name_en: string } | null
      return {
        severity: c.severity as string,
        description: c.description as string,
        other_ingredient: other?.name_en || 'Unknown',
      }
    }),
    ...(conflictsBRes.data || []).map((c: Record<string, unknown>) => {
      const other = c.other as { name_en: string } | null
      return {
        severity: c.severity as string,
        description: c.description as string,
        other_ingredient: other?.name_en || 'Unknown',
      }
    }),
  ]

  const products: ProductData[] = (productsRes.data || [])
    .map((row: Record<string, unknown>) => {
      const p = row.product as ProductData | null
      return p
    })
    .filter((p: ProductData | null): p is ProductData => p !== null)
    .sort((a: ProductData, b: ProductData) => (b.rating_avg || 0) - (a.rating_avg || 0))
    .slice(0, 5)

  const totalProducts = countRes.count || 0

  return { effectiveness, conflicts, products, totalProducts }
}

async function enrichIngredient(ingredient: IngredientToEnrich): Promise<boolean> {
  const ctx = await getIngredientContext(ingredient.id)
  const displayName = ingredient.name_en || ingredient.name_inci

  // Build context block for AI
  let contextBlock = `INGREDIENT: ${displayName} (INCI: ${ingredient.name_inci})`
  if (ingredient.name_ko) contextBlock += `\nKorean name: ${ingredient.name_ko}`
  if (ingredient.function) contextBlock += `\nFunction: ${ingredient.function}`
  if (ingredient.description) contextBlock += `\nCurrent description: ${ingredient.description}`
  if (ingredient.safety_rating != null) contextBlock += `\nSafety rating: ${ingredient.safety_rating}/5`
  if (ingredient.comedogenic_rating != null) contextBlock += `\nComedogenic rating: ${ingredient.comedogenic_rating}/5`
  if (ingredient.is_fragrance) contextBlock += `\nNote: This is a fragrance ingredient`
  if (ingredient.common_concerns?.length) contextBlock += `\nAddresses concerns: ${ingredient.common_concerns.join(', ')}`
  contextBlock += `\nFound in: ${ctx.totalProducts} K-beauty products on Seoul Sister`

  if (ctx.effectiveness.length > 0) {
    contextBlock += `\n\nEFFECTIVENESS DATA (from Seoul Sister community reports):`
    for (const e of ctx.effectiveness) {
      contextBlock += `\n- ${e.skin_type} skin / ${e.concern}: ${Math.round(e.effectiveness_score * 100)}% effective (${e.sample_size} reports)`
    }
  }

  if (ctx.conflicts.length > 0) {
    contextBlock += `\n\nKNOWN CONFLICTS:`
    for (const c of ctx.conflicts) {
      contextBlock += `\n- ${c.severity} conflict with ${c.other_ingredient}: ${c.description}`
    }
  }

  if (ctx.products.length > 0) {
    contextBlock += `\n\nTOP PRODUCTS CONTAINING ${displayName.toUpperCase()}:`
    for (const p of ctx.products) {
      contextBlock += `\n- ${p.name_en} by ${p.brand_en}${p.rating_avg ? ` (${Number(p.rating_avg).toFixed(1)}/5)` : ''}`
    }
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Generate rich content for this ingredient:\n\n${contextBlock}`,
      }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => ('text' in b ? b.text : ''))
      .join('')

    // Parse JSON — strip any accidental code fences
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    // Validate required fields
    if (!parsed.overview || !parsed.how_it_works || !parsed.skin_types || !parsed.usage_tips || !parsed.faq) {
      console.error(`  Missing required fields for "${displayName}"`)
      return false
    }

    // Calculate word count
    const allText = [
      parsed.overview,
      parsed.how_it_works,
      ...Object.values(parsed.skin_types as Record<string, string>),
      ...(parsed.usage_tips as string[]),
      parsed.history_origin || '',
      ...(parsed.faq as Array<{ question: string; answer: string }>).map(f => `${f.question} ${f.answer}`),
    ].join(' ')
    const wordCount = allText.split(/\s+/).filter(Boolean).length

    const richContent = {
      ...parsed,
      word_count: wordCount,
      model_used: MODEL,
    }

    // Save to database
    const { error: updateErr } = await supabase
      .from('ss_ingredients')
      .update({
        rich_content: richContent,
        rich_content_generated_at: new Date().toISOString(),
      })
      .eq('id', ingredient.id)

    if (updateErr) {
      console.error(`  DB update failed for "${displayName}":`, updateErr.message)
      return false
    }

    // Cost tracking
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    const cost = (inputTokens * 3 / 1_000_000) + (outputTokens * 15 / 1_000_000)

    console.log(`  ${wordCount} words, ${parsed.faq.length} FAQs, ${parsed.usage_tips.length} tips`)
    console.log(`  Tokens: ${inputTokens} in / ${outputTokens} out (~$${cost.toFixed(3)})`)

    return true
  } catch (err) {
    console.error(`  AI generation failed for "${displayName}":`, (err as Error).message)
    return false
  }
}

async function main() {
  console.log('=== Seoul Sister Ingredient Enrichment ===\n')

  // Get top ingredients
  console.log(`Fetching top ${BATCH_SIZE} un-enriched active ingredients by product count...`)
  const ingredients = await getTopIngredients()
  console.log(`Found ${ingredients.length} ingredients to enrich\n`)

  if (ingredients.length === 0) {
    console.log('All active ingredients already enriched. Nothing to do.')
    return
  }

  let success = 0
  let failed = 0
  let totalCost = 0
  const startTime = Date.now()

  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i]
    const displayName = ing.name_en || ing.name_inci
    console.log(`[${i + 1}/${ingredients.length}] ${displayName} (${ing.product_count} products)...`)

    const ok = await enrichIngredient(ing)
    if (ok) {
      success++
    } else {
      failed++
    }

    // Rate limit
    if (i < ingredients.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  console.log(`\n=== Done ===`)
  console.log(`Enriched: ${success}/${ingredients.length} (${failed} failed)`)
  console.log(`Time: ${elapsed} minutes`)

  // Final count
  const { count } = await supabase
    .from('ss_ingredients')
    .select('*', { count: 'exact', head: true })
    .not('rich_content', 'is', null)

  console.log(`Total enriched ingredients in database: ${count}`)
}

main().catch(console.error)
