/**
 * Phase 9.3 — Ingredient Matcher
 *
 * Matches parsed INCI ingredient names against the ss_ingredients table.
 * If no match is found, creates a new ingredient record using Sonnet for metadata.
 *
 * Uses an in-memory cache during batch runs to avoid repeated DB lookups
 * and Sonnet calls for the same ingredient across different products.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { CostTracker } from './cost-tracker'

export interface MatchResult {
  ingredient_id: string
  match_type: 'exact' | 'fuzzy' | 'created'
}

/**
 * Well-known INCI name variations that should resolve to the same ingredient.
 * Key = alternate name (lowercase), Value = canonical INCI name.
 */
const KNOWN_ALIASES: Record<string, string> = {
  'water': 'Aqua',
  'aqua': 'Aqua',
  'aqua/water': 'Aqua',
  'water/aqua': 'Aqua',
  'water (aqua)': 'Aqua',
  'aqua (water)': 'Aqua',
  'eau': 'Aqua',
  'purified water': 'Aqua',
  'deionized water': 'Aqua',
  'fragrance': 'Fragrance (Parfum)',
  'parfum': 'Fragrance (Parfum)',
  'fragrance (parfum)': 'Fragrance (Parfum)',
  'parfum (fragrance)': 'Fragrance (Parfum)',
  'fragrance/parfum': 'Fragrance (Parfum)',
  'sodium hyaluronate': 'Sodium Hyaluronate',
  'hyaluronic acid': 'Hyaluronic Acid',
  'retinol': 'Retinol',
  'niacinamide': 'Niacinamide',
  'ascorbic acid': 'Ascorbic Acid',
  'vitamin c': 'Ascorbic Acid',
  'l-ascorbic acid': 'Ascorbic Acid',
  'tocopherol': 'Tocopherol',
  'vitamin e': 'Tocopherol',
  'alpha-tocopherol': 'Tocopherol',
  'butylene glycol': 'Butylene Glycol',
  '1,3-butylene glycol': 'Butylene Glycol',
  'titanium dioxide': 'Titanium Dioxide',
  'ci 77891': 'Titanium Dioxide',
  'zinc oxide': 'Zinc Oxide',
  'ci 77947': 'Zinc Oxide',
}

/**
 * In-memory cache: lowercase INCI name → ingredient UUID.
 * Populated on first use by loading all existing ingredients,
 * then updated as new ingredients are created.
 */
export class IngredientCache {
  private cache = new Map<string, string>()
  private loaded = false

  /** Load all existing ingredients from the DB into cache */
  async load(supabase: SupabaseClient): Promise<void> {
    if (this.loaded) return

    // Fetch all ingredients (expecting 30 initially, growing to ~5000)
    let allIngredients: Array<{ id: string; name_inci: string }> = []
    let offset = 0
    const pageSize = 1000

    while (true) {
      const { data, error } = await supabase
        .from('ss_ingredients')
        .select('id, name_inci')
        .range(offset, offset + pageSize - 1)

      if (error) throw new Error(`Failed to load ingredients cache: ${error.message}`)
      if (!data || data.length === 0) break

      allIngredients = allIngredients.concat(data)
      if (data.length < pageSize) break
      offset += pageSize
    }

    for (const row of allIngredients) {
      this.cache.set(row.name_inci.toLowerCase(), row.id)
    }

    this.loaded = true
  }

  /** Look up an ingredient by INCI name (case-insensitive) */
  get(nameInci: string): string | undefined {
    return this.cache.get(nameInci.toLowerCase())
  }

  /** Add a new ingredient to the cache */
  set(nameInci: string, id: string): void {
    this.cache.set(nameInci.toLowerCase(), id)
  }

  get size(): number {
    return this.cache.size
  }
}

/**
 * Match a single INCI ingredient name against the database.
 * Returns the ingredient_id (existing or newly created).
 *
 * Match order:
 * 1. In-memory cache (fastest)
 * 2. Known alias resolution → cache lookup
 * 3. DB exact match (case-insensitive) — fallback if cache somehow missed
 * 4. Create new ingredient via Sonnet enrichment
 */
export async function matchOrCreateIngredient(
  supabase: SupabaseClient,
  nameInci: string,
  cache: IngredientCache,
  costTracker: CostTracker
): Promise<MatchResult> {
  const lower = nameInci.toLowerCase().trim()

  // 1. Direct cache hit
  const cachedId = cache.get(lower)
  if (cachedId) {
    return { ingredient_id: cachedId, match_type: 'exact' }
  }

  // 2. Alias resolution
  const canonical = KNOWN_ALIASES[lower]
  if (canonical) {
    const aliasId = cache.get(canonical.toLowerCase())
    if (aliasId) {
      // Also cache the alias for future lookups
      cache.set(lower, aliasId)
      return { ingredient_id: aliasId, match_type: 'fuzzy' }
    }
    // Alias known but canonical not in DB yet — will create below using canonical name
  }

  // 3. DB exact match (case-insensitive fallback)
  const resolvedName = canonical || nameInci
  const { data: dbMatch } = await supabase
    .from('ss_ingredients')
    .select('id')
    .ilike('name_inci', resolvedName)
    .limit(1)

  if (dbMatch && dbMatch.length > 0) {
    const id = dbMatch[0].id as string
    cache.set(lower, id)
    if (canonical) cache.set(canonical.toLowerCase(), id)
    return { ingredient_id: id, match_type: 'exact' }
  }

  // 4. Create new ingredient with Sonnet-generated metadata
  const newId = await createIngredient(supabase, resolvedName, costTracker)
  cache.set(lower, newId)
  if (canonical) cache.set(canonical.toLowerCase(), newId)

  return { ingredient_id: newId, match_type: 'created' }
}

const INGREDIENT_ENRICHMENT_PROMPT = `You are a cosmetic chemistry specialist. For the given INCI cosmetic ingredient, provide metadata in JSON format.

Rules:
- name_en: Plain English name (e.g., "Snail Secretion Filtrate" → "Snail Mucin"). If the INCI name IS the common English name, repeat it.
- function: Primary skin function in 3-8 words (e.g., "Humectant that attracts moisture to skin", "Antioxidant and skin brightener", "Emollient and texture enhancer")
- is_active: true if this is an active ingredient with a specific skin benefit. false for solvents (water, butylene glycol), emulsifiers, preservatives, thickeners, fillers, fragrances.
- is_fragrance: true if this is a fragrance component (parfum, linalool, limonene, citronellol, geraniol, etc.)
- safety_rating: Integer 1-5 scale. 1=avoid (banned/restricted), 2=caution (potential sensitizer), 3=generally safe (some concerns), 4=safe (well-studied, minimal concerns), 5=excellent (very safe, beneficial)
- comedogenic_rating: Integer 0-5 scale. 0=non-comedogenic, 5=highly comedogenic. Use 0 if unknown or if the ingredient is water-soluble.

Return ONLY a valid JSON object. No explanation.`

/**
 * Create a new ingredient record in ss_ingredients using Sonnet for metadata.
 */
async function createIngredient(
  supabase: SupabaseClient,
  nameInci: string,
  costTracker: CostTracker
): Promise<string> {
  const client = getAnthropicClient()

  const response = await client.messages.create({
    model: MODELS.background,
    max_tokens: 256,
    system: INGREDIENT_ENRICHMENT_PROMPT,
    messages: [
      { role: 'user', content: `Ingredient INCI name: ${nameInci}` },
    ],
  })

  costTracker.record({
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    // Fallback: create with minimal metadata
    return insertMinimalIngredient(supabase, nameInci)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(textBlock.text)
  } catch {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return insertMinimalIngredient(supabase, nameInci)
    }
    parsed = JSON.parse(jsonMatch[0])
  }

  const safetyRating = typeof parsed.safety_rating === 'number'
    ? Math.min(5, Math.max(1, Math.round(parsed.safety_rating)))
    : 4

  const comedogenicRating = typeof parsed.comedogenic_rating === 'number'
    ? Math.min(5, Math.max(0, Math.round(parsed.comedogenic_rating)))
    : 0

  const { data: inserted, error } = await supabase
    .from('ss_ingredients')
    .insert({
      name_inci: nameInci,
      name_en: typeof parsed.name_en === 'string' ? parsed.name_en.trim() : nameInci,
      function: typeof parsed.function === 'string' ? parsed.function.trim() : null,
      is_active: typeof parsed.is_active === 'boolean' ? parsed.is_active : false,
      is_fragrance: typeof parsed.is_fragrance === 'boolean' ? parsed.is_fragrance : false,
      safety_rating: safetyRating,
      comedogenic_rating: comedogenicRating,
    })
    .select('id')
    .single()

  if (error) {
    // Possible race condition: another process created it between our check and insert
    if (error.code === '23505') { // unique_violation
      const { data: existing } = await supabase
        .from('ss_ingredients')
        .select('id')
        .ilike('name_inci', nameInci)
        .limit(1)
      if (existing && existing.length > 0) {
        return existing[0].id as string
      }
    }
    throw new Error(`Failed to create ingredient "${nameInci}": ${error.message}`)
  }

  return inserted.id
}

/**
 * Insert an ingredient with minimal metadata when Sonnet enrichment fails.
 */
async function insertMinimalIngredient(
  supabase: SupabaseClient,
  nameInci: string
): Promise<string> {
  const { data: inserted, error } = await supabase
    .from('ss_ingredients')
    .insert({
      name_inci: nameInci,
      name_en: nameInci,
      is_active: false,
      is_fragrance: false,
      safety_rating: 4,
      comedogenic_rating: 0,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('ss_ingredients')
        .select('id')
        .ilike('name_inci', nameInci)
        .limit(1)
      if (existing && existing.length > 0) {
        return existing[0].id as string
      }
    }
    throw new Error(`Failed to create minimal ingredient "${nameInci}": ${error.message}`)
  }

  return inserted.id
}
