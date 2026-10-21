import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchOyUsProduct } from './olive-young-us'

/**
 * Monthly refresh of Olive Young US prices (rows created by
 * scripts/match-olive-young-us.ts). Reads each row's product from the store's
 * JSON feed by the UA id in its stored url — no re-matching, so the price
 * written is for exactly the listing the row was verified against.
 *
 * Failure discipline, earned by the ~130-night Olive Young Global outage:
 *  - a fetch ERROR never changes the row (a rate limit must not mark the catalog
 *    sold out) and is counted;
 *  - a listing that is GONE (404) or sold out sets in_stock=false, reversibly;
 *  - the caller logs status 'failed' when rows existed and none updated, or when
 *    the retailer row is missing, so "nothing ran" never looks like "all fine".
 */

export interface OyUsRefreshResult {
  scanned: number
  updated: number
  priceChanges: number
  gone: number
  fetchFailed: number
  unparseable: number
  /** Listing returned no price, or became a multi-size page: row left untouched. */
  skipped: number
  retailerMissing: boolean
}

/**
 * The run's status. Zero rows is a failure too: before any match is written,
 * a 'completed' run would be indistinguishable from a healthy one forever.
 */
export function decideRefreshStatus(r: OyUsRefreshResult): { status: 'failed' | 'completed'; reason: string | null } {
  if (r.retailerMissing) return { status: 'failed', reason: 'retailer_missing' }
  if (r.scanned === 0) return { status: 'failed', reason: 'no_rows' }
  if (r.updated === 0) return { status: 'failed', reason: 'nothing_updated' }
  return { status: 'completed', reason: null }
}

export function parseOyUsId(url: string | null): string | null {
  const m = (url || '').match(/us\.oliveyoung\.com\/products\/(UA\d+)/)
  return m ? m[1] : null
}

export async function runOliveYoungUsRefresh(
  db: SupabaseClient,
  opts: { budgetMs: number; fetchImpl?: typeof fetch }
): Promise<OyUsRefreshResult> {
  const deadline = Date.now() + opts.budgetMs
  const result: OyUsRefreshResult = { scanned: 0, updated: 0, priceChanges: 0, gone: 0, fetchFailed: 0, unparseable: 0, skipped: 0, retailerMissing: false }

  const { data: retailer, error: rErr } = await db
    .from('ss_retailers').select('id').eq('website', 'https://us.oliveyoung.com').maybeSingle()
  if (rErr) throw new Error(`Olive Young US retailer lookup failed: ${rErr.message}`)
  if (!retailer) return { ...result, retailerMissing: true }

  // Paginated: PostgREST caps a query at 1,000 rows without an error.
  const rows: Array<{ id: string; url: string | null; price_usd: number | null }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('ss_product_prices').select('id, url, price_usd')
      .eq('retailer_id', retailer.id)
      .order('last_checked', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`Olive Young US rows lookup failed: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < 1000) break
  }

  for (const row of rows) {
    if (Date.now() > deadline) break
    result.scanned++
    const id = parseOyUsId(row.url)
    if (!id) { result.unparseable++; continue }
    let product
    try {
      product = await (opts.fetchImpl ? fetchOyUsProduct(id, opts.fetchImpl) : fetchOyUsProduct(id))
    } catch (e) {
      result.fetchFailed++
      console.warn(`[oy-us-refresh] ${id}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    const now = new Date().toISOString()
    if (!product) {
      const { error } = await db.from('ss_product_prices').update({ in_stock: false, last_checked: now }).eq('id', row.id)
      if (error) throw new Error(`update failed for ${row.id}: ${error.message}`)
      result.gone++
      result.updated++
      continue
    }
    // No price, or the listing became a size/shade parent: we can't say what this
    // row's product costs now. Leave it alone — touching last_checked would make
    // the old price read as freshly verified.
    if (product.price === null || product.hasVariants) {
      result.skipped++
      continue
    }
    const patch: Record<string, unknown> = { in_stock: product.inStock, last_checked: now, price_usd: product.price }
    if (row.price_usd === null || Number(row.price_usd) !== product.price) result.priceChanges++
    const { error } = await db.from('ss_product_prices').update(patch).eq('id', row.id)
    if (error) throw new Error(`update failed for ${row.id}: ${error.message}`)
    result.updated++
  }
  return result
}
