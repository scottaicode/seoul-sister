import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { getServiceClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { hasActiveSubscription } from '@/lib/subscription'
import type { ShelfScanProduct, ShelfScanCollectionAnalysis } from '@/types/database'
import { quotedIlikePattern } from '@/lib/utils/sanitize-search'

export const maxDuration = 60
export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// What this route does, and what it deliberately does not (Nov 13 2026)
//
// It IDENTIFIES the products in a photo and reports facts about them: which
// ones are in our database, which the member already has in their library, an
// estimated value, and any ingredient that matches an allergy on their profile.
//
// It used to also grade the shelf A to F by how many categories were filled,
// list "missing categories", redundancies and guessed ingredient overlap, and
// write recommendations, all from one photo plus skin type and climate. On
// Nov 13 2026 it told a 60-year-old trial member with a precancer history that
// she was missing an exfoliator and a toner, twenty minutes after Yuri had
// told her to leave exfoliation out on purpose. She added a daily BHA toner.
// What a member should add or change is advice, and advice is Yuri's (Yuri
// Sole Authority, CLAUDE.md): she has the history, the medical facts and the
// decisions this call never sees. The page hands her the identified list.
// tests/shelf-scan-identifies-only.test.mjs fails if a verdict comes back.
// ---------------------------------------------------------------------------

async function loadAllergies(userId: string): Promise<string[]> {
  const { data, error } = await getServiceClient()
    .from('ss_user_profiles')
    .select('allergies')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    // Not fatal for identification, but never silent: an allergy check that
    // did not run must not look like one that found nothing.
    console.error('[shelf-scan] allergy lookup failed:', error.message)
    throw new AppError('Could not load your profile to check allergies. Please try again.', 503)
  }
  // An empty string would match every ingredient.
  return ((data?.allergies as string[] | null) ?? []).map((a) => (typeof a === 'string' ? a.trim() : '')).filter(Boolean)
}

const SHELF_SCAN_SYSTEM_PROMPT = `You identify skincare products in a photo of someone's shelf or collection. Identification only: say what each product is. Do not grade the collection, say what is missing, call anything redundant, or suggest what to buy, add, stop or change. Someone with the person's full history does that separately.

For each visually distinct product, give the brand, the product name, a category, and how confident you are.

List each distinct product ONCE, even if it is visible from several angles or there are several bottles of it. If two items might be the same product, list the one you are surer of and leave the other out. Never write "duplicate", "variant" or "or similar" in a product name.

Category is one of: cleanser, toner, essence, serum, ampoule, moisturizer, sunscreen, mask, eye_care, lip_care, exfoliator, oil, mist, spot_treatment

If you cannot read a label with confidence, still include the product with your best guess and a lower confidence.

Respond with JSON only:
{
  "products_identified": [
    {
      "name": "product name in English",
      "brand": "brand name in English",
      "category": "one of the categories above",
      "confidence": 0.0 to 1.0,
      "position_in_image": "brief description like 'front left' or 'back row center'"
    }
  ],
  "collection_analysis": {
    "total_estimated_value": estimated total USD retail value of the visible products
  }
}`

// ---------------------------------------------------------------------------
// Post-match allergen cross-reference
// ---------------------------------------------------------------------------

/**
 * `checked` is false whenever no comparison actually ran (no allergies to
 * compare is handled by the caller): no ingredient list on file, or the lookup
 * failed. An empty `warnings` with `checked: false` means "not checked".
 */
async function checkAllergens(
  productId: string,
  allergies: string[]
): Promise<{ checked: boolean; warnings: string[] }> {
  const { data: ingredients, error } = await getServiceClient()
    .from('ss_product_ingredients')
    .select('ingredient:ss_ingredients(name_inci, name_en)')
    .eq('product_id', productId)

  if (error) {
    console.error('[shelf-scan] ingredient lookup failed:', productId, error.message)
    return { checked: false, warnings: [] }
  }
  if (!ingredients?.length) return { checked: false, warnings: [] }

  const warnings: string[] = []
  for (const row of ingredients) {
    const ing = row.ingredient as unknown as Record<string, unknown> | null
    if (!ing) continue
    const ingName = (ing.name_en as string) || (ing.name_inci as string) || ''
    const ingNameLower = ingName.trim().toLowerCase()
    if (!ingNameLower) continue

    for (const allergy of allergies) {
      const allergyLower = allergy.toLowerCase()
      if (ingNameLower.includes(allergyLower) || allergyLower.includes(ingNameLower)) {
        warnings.push(`Contains ${ingName}. You listed "${allergy}" as an allergy`)
      }
    }
  }

  return { checked: true, warnings: [...new Set(warnings)] }
}

// ---------------------------------------------------------------------------
// POST /api/shelf-scan — Analyze a shelf/collection photo
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Check active subscription
    const isSubscribed = await hasActiveSubscription(user.id)
    if (!isSubscribed) {
      throw new AppError('Active subscription required.', 403)
    }

    const body = await request.json()
    if (!body.image) {
      throw new AppError('Missing image data', 400)
    }

    const match = body.image.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/)
    if (!match) {
      throw new AppError('Invalid image format. Expected base64 data URL.', 400)
    }
    const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    const imageBase64 = match[3]

    const userAllergies = await loadAllergies(user.id)

    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: MODELS.primary,
      max_tokens: 4096,
      system: SHELF_SCAN_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'Identify every skincare product in this photo.',
            },
          ],
        },
      ],
    })

    const textContent = response.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new AppError('No analysis result from AI', 500)
    }

    let analysis: { products_identified?: Array<Record<string, unknown>>; collection_analysis?: { total_estimated_value?: number } }
    try {
      analysis = JSON.parse(textContent.text.trim())
    } catch {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new AppError('Failed to parse analysis result', 500)
      }
      analysis = JSON.parse(jsonMatch[0])
    }

    // Only a number is read from collection_analysis. Anything else the model
    // adds (a grade, gaps, suggestions) is dropped here and never returned.
    const rawValue = Number(analysis.collection_analysis?.total_estimated_value)
    const aiEstimatedValue = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0

    // Post-process: filter out Claude-flagged duplicates and dedupe by brand+name.
    // Even with the DEDUPLICATION RULE in the prompt, Claude occasionally embeds
    // "(duplicate or similar variant)" in names. Belt and suspenders.
    const DUP_PATTERN = /\b(duplicate|similar variant|or variant|appears twice|same as)\b/i
    const seenKeys = new Set<string>()
    // Only these five fields are read from each product the model returns.
    // Anything else it adds (a note, a verdict, a "replace with") stops here.
    const identified = (analysis.products_identified ?? []).map((raw) => ({
      name: typeof raw?.name === 'string' ? raw.name : '',
      brand: typeof raw?.brand === 'string' ? raw.brand : '',
      category: typeof raw?.category === 'string' ? raw.category : '',
      confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0,
      position_in_image: typeof raw?.position_in_image === 'string' ? raw.position_in_image : '',
    })).filter((p) => {
      if (!p.name) return false
      if (DUP_PATTERN.test(p.name)) return false
      // Dedupe by normalized brand + first 3 meaningful tokens of name
      const key = `${(p.brand || '').toLowerCase().trim()}|${p.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .slice(0, 3)
        .join(' ')}`
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

    // Try to match identified products against our database
    const supabase = getServiceClient()

    const matchedProducts: ShelfScanProduct[] = []
    const unmatched = { matched_product_id: null, allergen_warnings: [], allergens_checked: false }
    for (const product of identified) {
      try {
        const searchTerm = product.name || product.brand
        if (!searchTerm) {
          matchedProducts.push({ ...product, ...unmatched })
          continue
        }

        // Quoted: an unquoted "." inside .or() is read as filter syntax and
        // silently returns nothing. Ordered, so the same photo matches the
        // same row every time.
        const pattern = quotedIlikePattern(searchTerm)
        const { data, error: matchError } = await supabase
          .from('ss_products')
          .select('id, name_en, brand_en, category, price_usd')
          .or(`name_en.ilike.${pattern},brand_en.ilike.${pattern}`)
          .order('is_verified', { ascending: false })
          .order('rating_avg', { ascending: false, nullsFirst: false })
          .order('id', { ascending: true })
          .limit(1)
        if (matchError) throw new Error(matchError.message)

        if (data && data.length > 0) {
          // Post-match allergen cross-reference
          const allergens = userAllergies.length
            ? await checkAllergens(data[0].id, userAllergies)
            : { checked: false, warnings: [] }

          matchedProducts.push({
            ...product,
            matched_product_id: data[0].id,
            name: data[0].name_en || product.name,
            brand: data[0].brand_en || product.brand,
            category: data[0].category || product.category,
            allergen_warnings: allergens.warnings,
            allergens_checked: allergens.checked,
          })
        } else {
          matchedProducts.push({ ...product, ...unmatched })
        }
      } catch (err) {
        console.error('[shelf-scan] product match failed:', product.name, err)
        matchedProducts.push({ ...product, ...unmatched })
      }
    }

    // Cross-reference with user's product inventory
    const matchedDbIds = matchedProducts
      .map((p) => p.matched_product_id)
      .filter(Boolean) as string[]

    let inventoryProductIds = new Set<string>()
    if (matchedDbIds.length > 0) {
      try {
        const { data: inventoryRows } = await supabase
          .from('ss_user_products')
          .select('product_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .in('product_id', matchedDbIds)

        inventoryProductIds = new Set(
          (inventoryRows ?? []).map((r) => r.product_id).filter(Boolean) as string[]
        )
      } catch {
        // Non-critical
      }
    }

    // Tag each product with ownership status
    for (const product of matchedProducts) {
      if (product.matched_product_id && inventoryProductIds.has(product.matched_product_id)) {
        product.already_in_inventory = true
      }
    }

    // Refine estimated value using DB prices where matched
    let refinedValue = 0
    let unmatchedEstimate = 0
    let matchedCount = 0

    for (const product of matchedProducts) {
      if (product.matched_product_id) {
        try {
          const { data: prices } = await supabase
            .from('ss_product_prices')
            .select('price_usd')
            .eq('product_id', product.matched_product_id)
            .order('price_usd', { ascending: true })
            .limit(1)

          if (prices && prices.length > 0) {
            refinedValue += prices[0].price_usd
            matchedCount++
            continue
          }
        } catch {
          // Fall through
        }
      }
      // Estimate per-product from AI total / count
      const productCount = matchedProducts.length || 1
      unmatchedEstimate += aiEstimatedValue / productCount
    }

    const totalValue = matchedCount > 0
      ? refinedValue + unmatchedEstimate
      : aiEstimatedValue

    return NextResponse.json({
      success: true,
      products_identified: matchedProducts,
      collection_analysis: {
        total_estimated_value: Math.round(totalValue * 100) / 100,
      } satisfies ShelfScanCollectionAnalysis,
      products_count: matchedProducts.length,
      matched_count: matchedProducts.filter(p => p.matched_product_id).length,
      already_owned_count: matchedProducts.filter(p => p.already_in_inventory).length,
      allergies_on_profile: userAllergies.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
