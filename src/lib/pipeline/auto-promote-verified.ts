import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Auto-promote products to is_verified=true when they meet the hardened
 * data-completeness criteria. Idempotent — safe to run repeatedly.
 *
 * History: Catalog seeded Feb 2026 with manual is_verified flags. Pipeline never
 * promoted new products, so by May 2026 only 10% of catalog (588/5,904) was
 * verified — the other 90% was invisible to Yuri's tools, which filter by
 * is_verified=true. The Phase 15.1 May 7 cleanup flipped 4,723 products in
 * one shot. This function runs daily so the gap doesn't re-open as new
 * products enter via the Olive Young scrape + Sonnet extraction pipeline.
 *
 * Hardened criteria (deliberately conservative):
 *   - name_en, brand_en, category present
 *   - category != 'not_skincare' (cosmetic/non-skincare contamination guard)
 *   - ingredients_raw populated
 *   - At least 1 price record from a retailer
 *   - At least 8 ingredient links (rules out half-enriched stubs)
 *
 * Why ≥8 links: Stub products have 0-7 links. A real K-beauty product
 * typically has 15-50 ingredients. ≥8 is a conservative threshold that lets
 * minimalist formulas (e.g. ONE THING Centella Asiatica = 3 ingredients) get
 * promoted via a separate path if needed, without auto-promoting half-stubs.
 */
export async function autoPromoteVerified(
  db: SupabaseClient
): Promise<{ promoted: number; checked: number }> {
  // Single SQL via RPC-style WHERE — much faster than per-row JS loops at scale.
  // We use the same boolean predicate as Phase 15.1 Step 7 (the May 7 1AM
  // manual UPDATE that flipped 4,723 products).
  const { data, error } = await db.rpc('auto_promote_verified_products')

  if (error) {
    // Fallback: if the RPC doesn't exist yet (e.g., migration not run),
    // do an in-process query. Slower but functionally equivalent.
    console.warn('[auto-promote] RPC not available, falling back to query:', error.message)
    return await fallbackPromote(db)
  }

  const result = data as { promoted: number; checked: number }
  return result
}

/**
 * Fallback path: same logic as the RPC but executed via Supabase JS client.
 * Used until the RPC migration lands. Idempotent.
 */
async function fallbackPromote(
  db: SupabaseClient
): Promise<{ promoted: number; checked: number }> {
  // Step 1: Find candidate IDs (read-only)
  const { data: candidates, error: queryError } = await db
    .from('ss_products')
    .select('id')
    .not('name_en', 'is', null)
    .not('brand_en', 'is', null)
    .not('category', 'is', null)
    .neq('category', 'not_skincare')
    .not('ingredients_raw', 'is', null)
    .or('is_verified.eq.false,is_verified.is.null')

  if (queryError) {
    console.error('[auto-promote] Candidate query failed:', queryError)
    return { promoted: 0, checked: 0 }
  }

  if (!candidates || candidates.length === 0) {
    return { promoted: 0, checked: 0 }
  }

  // Step 2: For each candidate, verify they have a price record AND ≥8 ingredient links.
  // We can't easily express this in a single Supabase JS query without RPC,
  // so we batch the checks.
  const candidateIds = candidates.map(c => c.id as string)
  const eligibleIds: string[] = []

  // Batch 1: products with at least 1 price record
  const { data: pricedRows } = await db
    .from('ss_product_prices')
    .select('product_id')
    .in('product_id', candidateIds)

  const pricedSet = new Set((pricedRows || []).map(p => p.product_id as string))

  // Batch 2: ingredient link counts. We have to do this per chunk because there's
  // no count-by-group helper in the Supabase JS client.
  for (let i = 0; i < candidateIds.length; i += 200) {
    const chunk = candidateIds.slice(i, i + 200).filter(id => pricedSet.has(id))
    if (chunk.length === 0) continue

    // Per-product link counts via individual count queries would be too slow.
    // Instead, fetch all ingredient links for the chunk and count in memory.
    const { data: links } = await db
      .from('ss_product_ingredients')
      .select('product_id')
      .in('product_id', chunk)

    if (!links) continue

    const linkCounts = new Map<string, number>()
    for (const link of links) {
      const pid = link.product_id as string
      linkCounts.set(pid, (linkCounts.get(pid) || 0) + 1)
    }

    for (const id of chunk) {
      if ((linkCounts.get(id) || 0) >= 8) {
        eligibleIds.push(id)
      }
    }
  }

  if (eligibleIds.length === 0) {
    return { promoted: 0, checked: candidates.length }
  }

  // Step 3: Flip is_verified=true on eligible products
  const { error: updateError } = await db
    .from('ss_products')
    .update({ is_verified: true, updated_at: new Date().toISOString() })
    .in('id', eligibleIds)

  if (updateError) {
    console.error('[auto-promote] Update failed:', updateError)
    return { promoted: 0, checked: candidates.length }
  }

  return { promoted: eligibleIds.length, checked: candidates.length }
}
