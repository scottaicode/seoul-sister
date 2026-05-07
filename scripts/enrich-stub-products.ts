/**
 * Phase 15.1 follow-up: Re-enrich stub products that have NULL ingredients_raw.
 *
 * Background:
 *   - 43 flagship K-beauty products were manually seeded into ss_products on Feb 17 2026
 *     with 1-7 stub ingredient links each.
 *   - 50+ additional products were seeded Feb 19 2026 in the brand-expansion batch
 *     (20260219000007–20260219000011) with ZERO ingredient links — bare product rows.
 *   - The Phase 9 Sonnet pipeline never re-enriched any of them because they bypass staging.
 *   - COSRX Snail 96 (fixed in v10.2.1) was the original canary — Yuri confidently
 *     cited beta-glucan at position 5 when actual ingredient is betaine.
 *   - May 6 2026: a Reddit response draft cited "alcohol and lavender oil pretty far down
 *     the list" of Haruharu Wonder Black Rice Hyaluronic Toner — same training-data
 *     adjacency confabulation pattern. Haruharu Wonder is one of the Feb 19 batch brands
 *     with bare product rows (zero links). Loader was filtering count >= 1 which skipped
 *     the entire Feb 19 batch. Loader now picks them up via count >= 0.
 *
 * Methodology (Approach 3b — Brave + page fetch + Sonnet verification):
 *   1. For each product: Brave web search for "{brand} {name} ingredients incidecoder"
 *   2. Pick top authoritative result (Incidecoder > brand official > Soko Glam > Sephora)
 *   3. Fetch the page and strip HTML to plain text (~3000 char window around "ingredient")
 *   4. Sonnet 4.5 extracts the INCI list from the actual page content (not truncated snippets)
 *   5. Returns: structured ingredient array + source URL + confidence score
 *   6. Skip if confidence < 0.7 (manual review required)
 *   7. UPSERT ingredients_raw + replace stub link rows with verified list
 *
 * Cost: ~$0.013 per product × N. Brave free tier covers a Feb 19 backfill (~50 products).
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/enrich-stub-products.ts
 *      npx tsx --tsconfig tsconfig.json scripts/enrich-stub-products.ts --dry-run
 *      npx tsx --tsconfig tsconfig.json scripts/enrich-stub-products.ts --product-id <uuid>
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ──────────────────────────────────────────────────────────────
// Bootstrap: load .env.local manually (no dotenv dependency)
// ──────────────────────────────────────────────────────────────
const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const k = trimmed.slice(0, eqIdx).trim()
    const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
} catch {
  // .env.local not found — assume env is already loaded
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY')
  process.exit(1)
}
if (!BRAVE_API_KEY) {
  console.error('Missing BRAVE_SEARCH_API_KEY (set up in v10.2.1)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// CLI args
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const productIdIdx = args.indexOf('--product-id')
const TARGET_PRODUCT_ID = productIdIdx !== -1 ? args[productIdIdx + 1] : undefined

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
interface StubProduct {
  id: string
  brand_en: string
  name_en: string
  category: string
  link_count: number
}

interface BraveSearchResult {
  title: string
  url: string
  description: string
}

interface ExtractionResult {
  ingredients: string[]
  source_url: string
  confidence: number
  reasoning: string
}

// ──────────────────────────────────────────────────────────────
// Brave Search
// ──────────────────────────────────────────────────────────────
async function braveSearch(query: string): Promise<BraveSearchResult[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', '5')
  url.searchParams.set('country', 'us')

  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': BRAVE_API_KEY!,
    },
  })

  if (!res.ok) {
    throw new Error(`Brave API ${res.status}: ${await res.text()}`)
  }

  const json = await res.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } }
  const results = json.web?.results || []

  return results.slice(0, 5).map(r => ({
    title: r.title,
    url: r.url,
    description: r.description || '',
  }))
}

// ──────────────────────────────────────────────────────────────
// Page fetch + cleanup
// ──────────────────────────────────────────────────────────────
const AUTHORITATIVE_DOMAINS = [
  'incidecoder.com',
  'sokoglam.com',
  'sephora.com',
  'ulta.com',
  'beautypedia.com',
]

const NON_AUTHORITATIVE_DOMAINS = [
  'reddit.com',
  'youtube.com',
  'tiktok.com',
  'instagram.com',
  'pinterest.com',
  'quora.com',
  'medium.com',
  'amazon.com',  // listings often have wrong/marketing-flavored INCI
]

function pickBestUrl(brand: string, results: BraveSearchResult[]): BraveSearchResult | null {
  const lcBrand = brand.toLowerCase().replace(/[^a-z0-9]+/g, '')

  // Score each result
  const scored = results.map(r => {
    const url = r.url.toLowerCase()
    let score = 0

    // Authoritative third-party
    for (const d of AUTHORITATIVE_DOMAINS) {
      if (url.includes(d)) {
        score += d === 'incidecoder.com' ? 100 : 70
      }
    }

    // Brand official site (heuristic: domain contains brand)
    const hostMatch = url.match(/^https?:\/\/(?:www\.)?([^/]+)/)
    if (hostMatch) {
      const host = hostMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '')
      if (host.includes(lcBrand) || lcBrand.includes(host.replace(/com$/, ''))) {
        score += 50
      }
    }

    // Penalty for non-authoritative
    for (const d of NON_AUTHORITATIVE_DOMAINS) {
      if (url.includes(d)) {
        score -= 100
      }
    }

    // Small bonus if URL contains "ingredient"
    if (url.includes('ingredient')) score += 10

    return { result: r, score }
  })

  scored.sort((a, b) => b.score - a.score)

  // Only return if top result actually scored positive
  return scored[0]?.score > 0 ? scored[0].result : null
}

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`Page fetch ${res.status} for ${url}`)
  }

  const html = await res.text()

  // Strip HTML aggressively, keep text content
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  return text
}

function extractIngredientWindow(pageText: string): string {
  // Find the densest "ingredient" mention region and return ~4000 chars around it
  const lower = pageText.toLowerCase()

  // Try to find INCI-style markers (most specific first)
  const markers = [
    'ingredients list:',
    'full ingredients:',
    'ingredient list:',
    'ingredients:',
    'inci:',
    'all ingredients',
    'ingredients',
  ]

  let bestIdx = -1
  for (const m of markers) {
    const idx = lower.indexOf(m)
    if (idx !== -1) {
      bestIdx = idx
      break
    }
  }

  if (bestIdx === -1) {
    // No marker — return middle of page
    return pageText.slice(0, 4000)
  }

  const start = Math.max(0, bestIdx - 200)
  const end = Math.min(pageText.length, bestIdx + 4000)
  return pageText.slice(start, end)
}

// ──────────────────────────────────────────────────────────────
// Sonnet INCI Extraction
// ──────────────────────────────────────────────────────────────
async function extractInci(
  product: StubProduct,
  primaryUrl: string,
  pageContent: string,
  searchResults: BraveSearchResult[],
): Promise<ExtractionResult> {
  // Always include search snippets as cross-reference even when we have a primary page
  const snippetsContext = searchResults.slice(0, 5).map((r, i) =>
    `[Snippet ${i + 1}] ${r.url}\n${r.description}`
  ).join('\n\n')

  const systemPrompt = `You are a K-beauty INCI extraction specialist. You will be given the CONTENT of an authoritative page about a specific product, plus search result snippets as cross-reference. Extract the verified ingredient list (INCI names in concentration order — water/aqua first, preservatives last).

Rules:
- The PRIMARY PAGE CONTENT is from an authoritative source (Incidecoder, brand official, Soko Glam, etc.) — trust it as the source of truth
- Use search snippets as cross-reference: if snippets disagree with the primary page about ingredient ORDER or MEMBERSHIP, downgrade confidence
- A complete K-beauty INCI list typically has 12-40 ingredients. If you only find 5-8, the list is likely truncated — confidence should be MODERATE (0.5-0.7)
- If ingredient names appear comma-separated in a clear sequence after a marker like "Ingredients:" or "INCI:", that's the full list — confidence HIGH (0.8-1.0)
- Reformulation warning: if the page mentions multiple versions or you see conflicting INCI lists in the content, extract the MOST RECENT version and note it in reasoning
- Return ingredients in the EXACT concentration order shown on the page
- Use canonical INCI names (e.g., "Sodium Hyaluronate" not "sodium hyaluronate" or "Hyaluronate Sodium")
- Strip percentages, parenthetical notes about function, and asterisks (e.g., "Niacinamide (5%)" → "Niacinamide", "Glycerin*" → "Glycerin")
- Keep parenthetical synonyms only when they're part of the canonical INCI name (e.g., "Water (Aqua)" stays as "Water (Aqua)" or use just "Aqua")

Return ONLY valid JSON in this exact schema:
{
  "ingredients": ["INCI Name 1", "INCI Name 2", ...],
  "source_url": "https://...",
  "confidence": 0.0-1.0,
  "reasoning": "1-2 sentence explanation: which page you used, ingredient count, and any reformulation/disagreement notes"
}`

  const userPrompt = `Product: ${product.brand_en} ${product.name_en}
Category: ${product.category}

PRIMARY PAGE: ${primaryUrl}

PRIMARY PAGE CONTENT (relevant excerpt):
${pageContent.slice(0, 6000)}

CROSS-REFERENCE SNIPPETS:
${snippetsContext}

Extract the INCI list, source URL, and confidence.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')

  // Extract JSON from response (handle ```json fences)
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || text.match(/(\{[\s\S]*\})/)
  if (!jsonMatch) {
    throw new Error(`No JSON in Sonnet response: ${text.slice(0, 300)}`)
  }

  const parsed = JSON.parse(jsonMatch[1]) as ExtractionResult

  // Validate shape
  if (!Array.isArray(parsed.ingredients)) {
    throw new Error('ingredients must be an array')
  }
  if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
    throw new Error('confidence must be 0.0-1.0')
  }

  // Estimate cost (Sonnet 4.5 = $3 input / $15 output per M tokens)
  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000

  console.log(`    Sonnet: ${inputTokens}in + ${outputTokens}out = $${cost.toFixed(4)}`)

  return parsed
}

// ──────────────────────────────────────────────────────────────
// Database operations
// ──────────────────────────────────────────────────────────────
async function loadStubProducts(): Promise<StubProduct[]> {
  if (TARGET_PRODUCT_ID) {
    const { data, error } = await supabase
      .from('ss_products')
      .select('id, brand_en, name_en, category')
      .eq('id', TARGET_PRODUCT_ID)
      .single()
    if (error || !data) throw new Error(`Product ${TARGET_PRODUCT_ID} not found`)
    return [{ ...data, link_count: 0 }]
  }

  // Fetch all stubs: NULL ingredients_raw + 0-7 ingredient links.
  // 0 links = Feb 19 brand-expansion batch (bare product rows from
  //   20260219000007–20260219000011, never went through Phase 9 ingestion).
  // 1-7 links = original Feb 17 manual seed stubs.
  // Both classes need the same Brave + Incidecoder + Sonnet enrichment.
  const { data: products, error } = await supabase
    .from('ss_products')
    .select('id, brand_en, name_en, category')
    .is('ingredients_raw', null)
    .order('brand_en')

  if (error) throw new Error(`Failed to load products: ${error.message}`)
  if (!products) return []

  // Filter to those with 0-7 links. Products with >7 links are already enriched
  // via the Phase 9 Sonnet pipeline and shouldn't be touched.
  const results: StubProduct[] = []
  for (const p of products) {
    const { count } = await supabase
      .from('ss_product_ingredients')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', p.id)
    if (count !== null && count >= 0 && count <= 7) {
      results.push({ ...p, link_count: count })
    }
  }

  return results
}

async function getOrCreateIngredient(
  inciName: string,
): Promise<{ id: string; created: boolean }> {
  // Try exact match (case-insensitive)
  const { data: existing } = await supabase
    .from('ss_ingredients')
    .select('id, name_inci')
    .ilike('name_inci', inciName)
    .maybeSingle()

  if (existing) return { id: existing.id, created: false }

  // Create with minimal metadata — daily Sonnet enrichment cron can fill rest later
  const { data: created, error: insErr } = await supabase
    .from('ss_ingredients')
    .insert({
      name_inci: inciName,
      name_en: inciName,
      function: 'Pending enrichment',
      safety_rating: 3,
      comedogenic_rating: 0,
      is_active: false,
      is_fragrance: inciName.toLowerCase().includes('fragrance') || inciName.toLowerCase().includes('parfum'),
    })
    .select('id')
    .single()

  if (insErr || !created) throw new Error(`Failed to create ingredient ${inciName}: ${insErr?.message}`)
  return { id: created.id, created: true }
}

async function applyEnrichment(
  product: StubProduct,
  result: ExtractionResult,
): Promise<{ ingredients_created: number; links_inserted: number }> {
  if (DRY_RUN) {
    console.log(`    DRY-RUN: would replace ${product.link_count} stub links with ${result.ingredients.length} verified`)
    return { ingredients_created: 0, links_inserted: 0 }
  }

  // 1. Resolve ingredient IDs (create if missing)
  let createdCount = 0
  const resolved: Array<{ id: string; position: number }> = []
  for (let i = 0; i < result.ingredients.length; i++) {
    const { id, created } = await getOrCreateIngredient(result.ingredients[i])
    if (created) createdCount++
    resolved.push({ id, position: i + 1 })
  }

  // 2. Delete existing stub links
  const { error: delErr } = await supabase
    .from('ss_product_ingredients')
    .delete()
    .eq('product_id', product.id)
  if (delErr) throw new Error(`Failed to delete stub links: ${delErr.message}`)

  // 3. Dedupe by ingredient_id (rare but possible)
  const seen = new Set<string>()
  const uniqueLinks = resolved.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })

  // 4. Insert verified links
  const linkRows = uniqueLinks.map(r => ({
    product_id: product.id,
    ingredient_id: r.id,
    position: r.position,
  }))

  const { error: insErr } = await supabase
    .from('ss_product_ingredients')
    .insert(linkRows)
  if (insErr) throw new Error(`Failed to insert links: ${insErr.message}`)

  // 5. Set ingredients_raw on the product
  const rawString = result.ingredients.join(', ')
  const { error: updErr } = await supabase
    .from('ss_products')
    .update({
      ingredients_raw: rawString,
      updated_at: new Date().toISOString(),
    })
    .eq('id', product.id)
  if (updErr) throw new Error(`Failed to update product: ${updErr.message}`)

  return { ingredients_created: createdCount, links_inserted: linkRows.length }
}

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Stub Product Re-Enrichment (Phase 15.1 follow-up) ===')
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no DB writes)' : 'LIVE'}`)
  if (TARGET_PRODUCT_ID) console.log(`Target: ${TARGET_PRODUCT_ID}`)
  console.log('')

  const stubs = await loadStubProducts()
  console.log(`Loaded ${stubs.length} stub products\n`)

  if (stubs.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let succeeded = 0
  let skippedLowConfidence = 0
  let failed = 0
  let totalIngredientsCreated = 0
  let totalLinksInserted = 0
  const reviewQueue: Array<{ product: StubProduct; result: ExtractionResult; reason: string }> = []

  for (let i = 0; i < stubs.length; i++) {
    const p = stubs[i]
    const prefix = `[${i + 1}/${stubs.length}]`

    try {
      console.log(`${prefix} ${p.brand_en} — ${p.name_en} (${p.link_count} stub links)`)

      // Step 1: Brave search
      const query = `${p.brand_en} ${p.name_en} ingredients incidecoder`
      console.log(`    Brave: "${query}"`)
      const searchResults = await braveSearch(query)
      console.log(`    Brave: ${searchResults.length} results`)

      if (searchResults.length === 0) {
        console.log(`    SKIP: no Brave results`)
        reviewQueue.push({ product: p, result: { ingredients: [], source_url: '', confidence: 0, reasoning: 'No Brave results' }, reason: 'No Brave results' })
        skippedLowConfidence++
        continue
      }

      // Step 2: Pick best authoritative URL
      const best = pickBestUrl(p.brand_en, searchResults)
      if (!best) {
        console.log(`    SKIP: no authoritative URL among Brave results`)
        reviewQueue.push({
          product: p,
          result: { ingredients: [], source_url: searchResults[0]?.url || '', confidence: 0, reasoning: 'No authoritative source in Brave results' },
          reason: 'No authoritative source',
        })
        skippedLowConfidence++
        continue
      }
      console.log(`    Top URL: ${best.url}`)

      // Step 3: Fetch the page
      let pageText: string
      try {
        const fullText = await fetchPageText(best.url)
        pageText = extractIngredientWindow(fullText)
        console.log(`    Page: ${fullText.length} chars total, ${pageText.length} char window around 'ingredient'`)
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        console.log(`    SKIP: page fetch failed — ${msg}`)
        reviewQueue.push({
          product: p,
          result: { ingredients: [], source_url: best.url, confidence: 0, reasoning: `Page fetch failed: ${msg}` },
          reason: 'Page fetch failed',
        })
        skippedLowConfidence++
        continue
      }

      // Step 4: Sonnet extraction
      const result = await extractInci(p, best.url, pageText, searchResults)
      console.log(`    Sonnet: ${result.ingredients.length} ingredients, confidence ${result.confidence.toFixed(2)}`)
      console.log(`    Source: ${result.source_url}`)
      console.log(`    Reasoning: ${result.reasoning}`)

      // Step 5: Confidence gate
      if (result.confidence < 0.7) {
        console.log(`    SKIP: confidence too low (${result.confidence.toFixed(2)} < 0.7) — added to review queue`)
        reviewQueue.push({ product: p, result, reason: `Low confidence ${result.confidence.toFixed(2)}` })
        skippedLowConfidence++
        continue
      }

      if (result.ingredients.length === 0) {
        console.log(`    SKIP: empty ingredients array`)
        reviewQueue.push({ product: p, result, reason: 'Empty ingredients' })
        skippedLowConfidence++
        continue
      }

      // Step 6: Apply
      const { ingredients_created, links_inserted } = await applyEnrichment(p, result)
      totalIngredientsCreated += ingredients_created
      totalLinksInserted += links_inserted
      succeeded++
      console.log(`    OK: ${links_inserted} links inserted, ${ingredients_created} new master ingredients`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`    FAIL: ${msg}`)
      failed++
    }

    console.log('')

    // Rate limit Brave (1 req/sec free tier safety margin)
    if (i < stubs.length - 1) {
      await new Promise(r => setTimeout(r, 1100))
    }
  }

  console.log('=== Summary ===')
  console.log(`Succeeded: ${succeeded}`)
  console.log(`Skipped (low confidence or empty): ${skippedLowConfidence}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total new master ingredients created: ${totalIngredientsCreated}`)
  console.log(`Total link rows inserted: ${totalLinksInserted}`)

  if (reviewQueue.length > 0) {
    console.log(`\n=== Review Queue (${reviewQueue.length} products need manual INCI lookup) ===`)
    for (const item of reviewQueue) {
      console.log(`\n${item.product.brand_en} — ${item.product.name_en}`)
      console.log(`  Reason: ${item.reason}`)
      console.log(`  Product ID: ${item.product.id}`)
      if (item.result.source_url) console.log(`  Best URL found: ${item.result.source_url}`)
      if (item.result.reasoning) console.log(`  Sonnet's note: ${item.result.reasoning}`)
    }
  }

  console.log('\n=== Done ===')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
