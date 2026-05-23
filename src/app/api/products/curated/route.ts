/**
 * v10.8.0 Path B — GET /api/products/curated
 *
 * Returns subscriber-curated product list split into `fits` and `skipped`
 * based on Layer 1 structural phase filter (allergens + decision memory
 * exclusions + active treatment phase watch_for items).
 *
 * No AI calls. Pure SQL + JS structural filtering. The Opus reasoning for
 * individual skipped products is lazy-fetched on demand via the
 * /api/products/curated/[id]/reasoning endpoint.
 *
 * Architecture: PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md
 */

export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServiceClient } from '@/lib/supabase'
import { hasActiveSubscription } from '@/lib/subscription'
import { logAIUsage } from '@/lib/ai-usage-logger'
import {
  buildCurationContext,
  applyPhaseFilter,
  type CurationVerdictResult,
} from '@/lib/intelligence/product-curation'

const curatedQuerySchema = z.object({
  query: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
  brand: z.string().max(100).optional(),
  min_price: z.number().min(0).max(10000).optional(),
  max_price: z.number().min(0).max(10000).optional(),
  page: z.number().int().min(1).max(50).default(1),
  limit: z.number().int().min(1).max(40).default(20),
})

function sanitizeLikeInput(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function GET(request: NextRequest) {
  try {
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
        { error: 'Active subscription required for curated browse.' },
        { status: 403 }
      )
    }

    // ---------------------------------------------------------------
    // Parse + validate query params
    // ---------------------------------------------------------------
    const { searchParams } = new URL(request.url)
    const parsed = curatedQuerySchema.parse({
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      brand: searchParams.get('brand') || undefined,
      min_price: searchParams.get('min_price') ? Number(searchParams.get('min_price')) : undefined,
      max_price: searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    })

    // ---------------------------------------------------------------
    // Build curation context (profile + phase + decision memory + routine)
    // ---------------------------------------------------------------
    const context = await buildCurationContext(user.id)
    if (!context) {
      return NextResponse.json(
        { error: 'Set up your skin profile before using curated browse.' },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------------
    // Candidate query — pull filtered product IDs from ss_products
    // v10.8.2: also fetch category + name for the Layer 1.5 category filter
    // ---------------------------------------------------------------
    let candidateQuery = db.from('ss_products').select('id, category, name_en')
    if (parsed.query) {
      const q = sanitizeLikeInput(parsed.query.trim())
      candidateQuery = candidateQuery.or(`name_en.ilike.%${q}%,brand_en.ilike.%${q}%`)
    }
    if (parsed.category) {
      candidateQuery = candidateQuery.eq('category', parsed.category)
    }
    if (parsed.brand) {
      candidateQuery = candidateQuery.ilike('brand_en', `%${sanitizeLikeInput(parsed.brand)}%`)
    }
    if (parsed.min_price !== undefined) {
      candidateQuery = candidateQuery.gte('price_usd', parsed.min_price)
    }
    if (parsed.max_price !== undefined) {
      candidateQuery = candidateQuery.lte('price_usd', parsed.max_price)
    }
    // Verified-only by default — same filter the public products surface
    // uses. Prevents noise from un-enriched listings.
    candidateQuery = candidateQuery.eq('is_verified', true)

    // v10.8.8 (fixes v10.8.7 critical regression): order by image_url
    // ascending with nulls last. This puts image-bearing products first
    // (nullsFirst:false) AND lexically surfaces cdn-image.oliveyoung.com
    // URLs ahead of brand-direct Shopify slug URLs because 'cdn-i' sorts
    // before 'us.' / 'www.' / brand domain names in ascending order.
    //
    // v10.8.7 shipped this with ascending:false — descending alphabetical
    // sort put www.cosrx.com / medicube.us / theisntree.com / us.laneige.com
    // (all Shopify slug-based URLs with high CDN drift rate) at the TOP
    // of the candidate window, and pushed cdn-image.oliveyoung.com
    // (content-hashed UUIDs, ~100% reachable) to the bottom past the 400
    // limit. Reachability sample under v10.8.7 ordering: 0 of 30 returned
    // HTTP 200. Under ASC ordering: 27 of 30.
    //
    // Pattern 4 lesson encoded in changelog: don't conflate "ORDER BY
    // is_not_null" with "ORDER BY value asc/desc". For visual-quality
    // NULL-vs-non-NULL ordering, the value direction matters because
    // PostgreSQL sorts the non-null values lexically. ASC here happens
    // to surface reliable Olive Young CDN first as a fortunate
    // side-effect of cdn-image.* preceding brand-direct hostnames
    // alphabetically. A more architecturally correct fix would be a
    // reliability key column or CASE expression — deferred to a future
    // session.
    candidateQuery = candidateQuery.order('image_url', { ascending: true, nullsFirst: false })

    const { data: candidates, error: candError } = await candidateQuery.limit(400)
    if (candError) throw candError

    const candidateIds = (candidates || []).map((r) => r.id as string)
    // v10.8.2: build product → category + name maps for Layer 1.5 filter
    const productCategories = new Map<string, string>()
    const productNames = new Map<string, string>()
    for (const c of candidates || []) {
      const row = c as { id: string; category: string | null; name_en: string | null }
      if (row.category) productCategories.set(row.id, row.category)
      if (row.name_en) productNames.set(row.id, row.name_en)
    }
    if (candidateIds.length === 0) {
      return NextResponse.json({
        fits: [],
        skipped: [],
        total_fits: 0,
        total_skipped: 0,
        page: parsed.page,
        active_phase: context.activePhase
          ? {
              phase_number: context.activePhase.phaseNumber,
              name: context.activePhase.name,
            }
          : null,
      })
    }

    // ---------------------------------------------------------------
    // Bulk-fetch ingredient names for candidates.
    //
    // v10.8.6 — fix silent batch-fetch truncation. PostgREST hard-caps every
    // SELECT at 1000 rows on this Supabase instance, and explicit .limit()
    // overrides are silently IGNORED by the platform. Before v10.8.6 we were
    // requesting 200 product_ids in a single .in() query expecting ~5,000
    // link rows back; we were silently getting 1,000 (~20% of the data) and
    // most products fell through Layer 1 as `neutral` because their ingredient
    // names never made it into the productIngredients map.
    //
    // The bullet-proof fix is internal .range() pagination within each
    // product-id batch: keep advancing the range window until the response
    // is smaller than the page size (last page reached). This works
    // regardless of how many ingredients per product, and is robust against
    // any future PostgREST cap changes that don't reduce the 1000 floor.
    //
    // We keep the outer batch (slice of product_ids per .in() call) modest
    // for URL length safety — 50 product_ids per batch, plenty of headroom
    // under PostgREST's URL limit.
    //
    // Defensive logging: if any single .range() page returns exactly
    // PAGE_SIZE rows, we're at risk of the next page being needed; the loop
    // already handles this correctly, but we also log a console.warn if we
    // ever advance past 10 pages on a single batch — that's a signal that
    // OUTER_BATCH should drop to be smaller, since at 10+ pages we're
    // wasting roundtrips.
    // ---------------------------------------------------------------
    const productIngredients = new Map<string, string[]>()
    const OUTER_BATCH = 50  // product_ids per .in() call (URL length safety)
    const PAGE_SIZE = 1000  // matches PostgREST hard cap on this instance

    type Link = {
      product_id: string
      ingredient: { name_en: string | null; name_inci: string | null } | Array<{ name_en: string | null; name_inci: string | null }> | null
    }

    for (let i = 0; i < candidateIds.length; i += OUTER_BATCH) {
      const slice = candidateIds.slice(i, i + OUTER_BATCH)
      let pageStart = 0
      let pageNum = 0
      // Inner pagination loop — keep pulling pages until the response
      // is smaller than PAGE_SIZE (last page).
      while (true) {
        const { data: links, error } = await db
          .from('ss_product_ingredients')
          .select('product_id, ingredient:ss_ingredients(name_en, name_inci)')
          .in('product_id', slice)
          .range(pageStart, pageStart + PAGE_SIZE - 1)

        if (error) {
          console.error('[/api/products/curated] ingredient fetch error:', error)
          break
        }

        const pageRows = links?.length ?? 0
        for (const link of (links || []) as Link[]) {
          const rawIng = link.ingredient
          const ing = Array.isArray(rawIng) ? rawIng[0] : rawIng
          if (!ing) continue
          if (!productIngredients.has(link.product_id)) {
            productIngredients.set(link.product_id, [])
          }
          const arr = productIngredients.get(link.product_id)!
          if (ing.name_en) arr.push(ing.name_en)
          if (ing.name_inci && ing.name_inci !== ing.name_en) arr.push(ing.name_inci)
        }

        if (pageRows < PAGE_SIZE) break  // last page
        pageStart += PAGE_SIZE
        pageNum += 1
        if (pageNum > 10) {
          console.warn(`[/api/products/curated] ingredient fetch hit >10 pages for batch ${i} — consider lowering OUTER_BATCH from ${OUTER_BATCH}`)
          break
        }
      }
    }

    // ---------------------------------------------------------------
    // Layer 1 — Deterministic phase filter
    // ---------------------------------------------------------------
    const verdicts: CurationVerdictResult[] = applyPhaseFilter(
      candidateIds,
      productIngredients,
      context,
      productCategories,
      productNames
    )

    const fitsIds: string[] = []
    const skippedVerdicts = new Map<string, CurationVerdictResult>()
    for (const v of verdicts) {
      if (v.verdict === 'skip') {
        skippedVerdicts.set(v.productId, v)
      } else {
        // 'fits' and 'neutral' both show in the curated list
        fitsIds.push(v.productId)
      }
    }
    const skippedIds = Array.from(skippedVerdicts.keys())

    // ---------------------------------------------------------------
    // Paginate over the `fits` list. Skipped products returned in full
    // (toggle is collapsed by default, lazy-fetched reasoning).
    // ---------------------------------------------------------------
    const totalFits = fitsIds.length
    const totalSkipped = skippedIds.length
    const offset = (parsed.page - 1) * parsed.limit
    const pageFitsIds = fitsIds.slice(offset, offset + parsed.limit)

    // Fetch full product records (only for what we'll actually render —
    // page of fits + ALL skipped to keep the toggle responsive without
    // a second request).
    const idsToFetch = [...pageFitsIds, ...skippedIds]
    let fitsProducts: Record<string, unknown>[] = []
    let skippedProducts: Record<string, unknown>[] = []

    if (idsToFetch.length > 0) {
      const { data: prods, error: prodError } = await db
        .from('ss_products')
        .select('*')
        .in('id', idsToFetch)
      if (prodError) throw prodError

      const prodMap = new Map(
        (prods || []).map((p) => [(p as { id: string }).id, p as Record<string, unknown>])
      )
      fitsProducts = pageFitsIds
        .map((id) => prodMap.get(id))
        .filter(Boolean) as Record<string, unknown>[]
      skippedProducts = skippedIds
        .map((id) => {
          const prod = prodMap.get(id)
          if (!prod) return null
          // Attach matched_items preview so the UI can show skip reason chips
          // without a second round trip
          const verdict = skippedVerdicts.get(id)
          return {
            ...prod,
            skip_preview: {
              matched_items: verdict?.matchedItems || [],
            },
          }
        })
        .filter(Boolean) as Record<string, unknown>[]
    }

    // ---------------------------------------------------------------
    // Telemetry — fire-and-forget per v10.3.5 audit pattern
    // ---------------------------------------------------------------
    void logAIUsage({
      feature: 'curated_browse_view',
      model: 'n/a',
      inputTokens: 0,
      outputTokens: 0,
      userId: user.id,
    }).catch(() => {
      // logger swallows its own errors; this catch is defensive belt+suspenders
    })

    return NextResponse.json({
      fits: fitsProducts,
      skipped: skippedProducts,
      total_fits: totalFits,
      total_skipped: totalSkipped,
      page: parsed.page,
      total_pages: Math.ceil(totalFits / parsed.limit),
      active_phase: context.activePhase
        ? {
            phase_number: context.activePhase.phaseNumber,
            name: context.activePhase.name,
            goal: context.activePhase.goal,
          }
        : null,
      has_decision_memory_exclusions: context.excludedSubstances.length > 0,
      allergens: context.allergies,
    })
  } catch (error) {
    console.error('[/api/products/curated] error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.issues }, { status: 400 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
