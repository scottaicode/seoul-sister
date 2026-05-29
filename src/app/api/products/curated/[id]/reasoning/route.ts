/**
 * v10.8.0 Path B — GET /api/products/curated/[id]/reasoning
 *
 * Returns Opus 4.8-generated reasoning for whether a specific product fits
 * or conflicts with the subscriber's current treatment phase + decision
 * memory + allergens. Lazy-fetched only when subscriber expands the
 * "Why Yuri would skip this" toggle on the /browse page.
 *
 * Cached in ss_product_curation_reasoning. Cache key includes a hash over
 * the user's load-bearing state (skin profile, allergies, active phase,
 * decision_memory exclusions), so reasoning automatically invalidates when
 * her state changes meaningfully.
 *
 * Architecture: PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md
 */

export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { hasActiveSubscription } from '@/lib/subscription'
import { logAIUsage } from '@/lib/ai-usage-logger'
import {
  buildCurationContext,
  computeCacheKeyHash,
  applyPhaseFilter,
  getCachedReasoning,
  saveReasoning,
  generateReasoning,
} from '@/lib/intelligence/product-curation'
import { AI_CONTEXTS } from '@/lib/ai-config'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await context.params
    if (!productId) {
      return NextResponse.json({ error: 'Missing product id' }, { status: 400 })
    }

    // ---------------------------------------------------------------
    // Auth + subscription gate
    // ---------------------------------------------------------------
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getServiceClient()
    const { data: { user }, error: authError } = await db.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSubscribed = await hasActiveSubscription(user.id)
    if (!isSubscribed) {
      return NextResponse.json(
        { error: 'Active subscription required.' },
        { status: 403 }
      )
    }

    // ---------------------------------------------------------------
    // Load curation context + compute cache key hash
    // ---------------------------------------------------------------
    const curationContext = await buildCurationContext(user.id)
    if (!curationContext) {
      return NextResponse.json(
        { error: 'Set up your skin profile to view Yuri\'s reasoning.' },
        { status: 400 }
      )
    }

    const cacheKeyHash = computeCacheKeyHash(curationContext)

    // ---------------------------------------------------------------
    // Cache lookup
    // ---------------------------------------------------------------
    const cached = await getCachedReasoning(user.id, productId, cacheKeyHash)
    if (cached) {
      // Telemetry — was_cached=true
      void logAIUsage({
        feature: 'skip_reasoning_expanded',
        model: cached.model,
        inputTokens: 0,
        outputTokens: 0,
        userId: user.id,
        cached: true,
      }).catch(() => {})

      return NextResponse.json({
        verdict: cached.verdict,
        reasoning_text: cached.reasoningText,
        matched_items: cached.matchedItems,
        cached: true,
        generated_at: cached.generatedAt,
        model: cached.model,
      })
    }

    // ---------------------------------------------------------------
    // Cache miss — fetch product + run phase filter + call Opus
    // ---------------------------------------------------------------
    const { data: productRow, error: prodError } = await db
      .from('ss_products')
      .select('id, name_en, brand_en, category, ingredients_raw')
      .eq('id', productId)
      .maybeSingle()

    if (prodError || !productRow) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Run Layer 1 filter for this single product to get the precomputed verdict
    // and matched_items (so Opus's reasoning aligns with the structural call)
    const { data: links } = await db
      .from('ss_product_ingredients')
      .select('ingredient:ss_ingredients(name_en, name_inci)')
      .eq('product_id', productId)

    type Link = {
      ingredient:
        | { name_en: string | null; name_inci: string | null }
        | Array<{ name_en: string | null; name_inci: string | null }>
        | null
    }
    const ingredientNames: string[] = []
    for (const link of (links || []) as Link[]) {
      const rawIng = link.ingredient
      const ing = Array.isArray(rawIng) ? rawIng[0] : rawIng
      if (!ing) continue
      if (ing.name_en) ingredientNames.push(ing.name_en)
      if (ing.name_inci && ing.name_inci !== ing.name_en) ingredientNames.push(ing.name_inci)
    }

    const productIngMap = new Map<string, string[]>([[productId, ingredientNames]])
    // v10.8.2: also pass product category + name so Layer 1.5 category filter
    // can match category_conflict matched_items (BHA-on-BHA, etc.)
    const productCatMap = new Map<string, string>()
    const productNameMap = new Map<string, string>()
    if (productRow.category) productCatMap.set(productId, productRow.category as string)
    if (productRow.name_en) productNameMap.set(productId, productRow.name_en as string)
    const verdicts = applyPhaseFilter([productId], productIngMap, curationContext, productCatMap, productNameMap)
    const verdict = verdicts[0]!

    // ---------------------------------------------------------------
    // Generate fresh Opus 4.8 reasoning
    // ---------------------------------------------------------------
    const result = await generateReasoning(
      {
        id: productId,
        name_en: productRow.name_en as string,
        brand_en: productRow.brand_en as string,
        category: (productRow.category as string) ?? null,
        ingredients_raw: (productRow.ingredients_raw as string) ?? null,
      },
      curationContext,
      verdict
    )

    // Persist (fire-and-forget so latency is just the Opus call)
    void saveReasoning(user.id, productId, cacheKeyHash, {
      verdict: result.verdict,
      reasoningText: result.reasoningText,
      matchedItems: result.matchedItems,
      // Token counts not exposed by generateReasoning — could be added later
      // when usage data shape stabilizes
    }).catch((err) => {
      console.error('[curated/reasoning] saveReasoning failed:', err)
    })

    // Telemetry — was_cached=false, log model + tokens
    void logAIUsage({
      feature: 'product_curation_reasoning',
      model: AI_CONTEXTS.PRODUCT_CURATION_REASONING.model,
      // Approximate token usage — actual values would require returning them
      // from generateReasoning. Logged as 0/0 to indicate "generation happened"
      // without claiming false numbers. Future cleanup: thread usage through.
      inputTokens: 0,
      outputTokens: 0,
      userId: user.id,
      cached: false,
    }).catch(() => {})

    void logAIUsage({
      feature: 'skip_reasoning_expanded',
      model: result.model,
      inputTokens: 0,
      outputTokens: 0,
      userId: user.id,
      cached: false,
    }).catch(() => {})

    return NextResponse.json({
      verdict: result.verdict,
      reasoning_text: result.reasoningText,
      matched_items: result.matchedItems,
      cached: false,
      generated_at: result.generatedAt,
      model: result.model,
    })
  } catch (error) {
    console.error('[/api/products/curated/[id]/reasoning] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
