import type { SupabaseClient } from '@supabase/supabase-js'
import { OliveYoungScraper } from './sources/olive-young'

/**
 * Olive Young price refresher.
 *
 * The gap this closes (diagnosed Jul 6 2026): Olive Young is ~96% of Seoul
 * Sister's price data (4,908 rows), but NO job refreshes those prices. The daily
 * `scan-korean-products` cron is a PRODUCT scraper — it re-sees a handful of
 * listing pages (mostly duplicates) and only writes an OY price as a side effect
 * of discovering a product. It never cycles the existing catalog, so the 4,908
 * OY prices sat frozen at Apr 7 2026 for ~3 months. `refresh-prices` only does
 * Soko Glam; `refresh-prices-yesstyle` only YesStyle. Olive Young had no refresher.
 *
 * This walks existing OY price rows STALEST-FIRST past a keyset cursor, re-fetches
 * the live price from each product's own `prdtNo` detail page (reusing the proven
 * `OliveYoungScraper.scrapeProductDetail`), and upserts `price_usd` + `last_checked`
 * (+ a `ss_price_history` snapshot on change). A bounded batch per run keeps it
 * inside the Vercel budget (Playwright is ~5-10s/page). The cron drives the cursor
 * across runs so the whole catalog refreshes on a rolling ~2-week cycle, same
 * pattern as the image-health cron.
 *
 * Wrong-price discipline: we ONLY update a row we already have for THIS product +
 * Olive Young. We parse the `prdtNo` from the row's own stored url, so there is no
 * fuzzy re-matching — the price we write is for the exact product the row is for.
 */

const OY_RETAILER_NAME = 'Olive Young'

export interface OyPriceRefreshResult {
  scanned: number // rows we attempted this run
  updated: number // rows whose price_usd + last_checked were written
  priceChanges: number // subset of `updated` where the price actually moved
  unscrapeable: number // rows we couldn't derive a prdtNo for (skipped)
  fetchFailed: number // prdtNo derived but the live page returned no price
  sweptCount: number // phase-2 (long-tail sweep) rows seen this run; 0 => cursor wrap
  lastCheckedCursor: string | null // ISO of the last row's PRIOR last_checked (keyset)
}

/** Pull the Olive Young `prdtNo` out of a stored product-detail url. */
export function parsePrdtNo(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/[?&]prdtNo=([A-Za-z0-9]+)/)
  return m ? m[1] : null
}

/** A product is "popular" (worth keeping fresh) at/above this OY review count. */
const POPULAR_REVIEW_THRESHOLD = 500
/** Re-refresh a popular product once its price is older than this. */
const POPULAR_STALE_DAYS = 21

/**
 * Refresh a bounded batch of Olive Young prices, popular-first.
 *
 * Two phases per run, because with ~4,900 products and Playwright at ~8s/page a
 * pure rolling sweep takes months — too slow for the products strangers actually
 * ask Yuri about. So:
 *
 *   PHASE 1 (priority): refresh any POPULAR product (review_count >= threshold)
 *   whose price is older than POPULAR_STALE_DAYS. This keeps the products Yuri
 *   cites fresh on a ~3-week cadence. Self-balancing: once all popular products
 *   are fresh, this phase finds nothing and the whole budget goes to phase 2.
 *
 *   PHASE 2 (sweep): the long tail, stalest-first, via a `last_checked` keyset
 *   cursor (rows with `last_checked > afterCheckedAt`, ascending). Advances
 *   monotonically across runs; the caller wraps to the start when it finds nothing.
 *
 * The cursor only governs phase 2 — phase 1 is a bounded top-up that re-queries
 * fresh each run, so it needs no cursor of its own.
 */
export async function runOliveYoungPriceRefresh(
  db: SupabaseClient,
  opts: { limit: number; afterCheckedAt?: string | null; budgetMs?: number }
): Promise<OyPriceRefreshResult> {
  const { limit, afterCheckedAt = null, budgetMs } = opts
  const deadline = budgetMs ? Date.now() + budgetMs : null

  // Resolve the Olive Young retailer id once.
  const { data: retailer } = await db
    .from('ss_retailers')
    .select('id')
    .eq('name', OY_RETAILER_NAME)
    .single()

  if (!retailer) {
    console.error('[oy-price-refresh] Olive Young retailer row not found — aborting')
    return { scanned: 0, updated: 0, priceChanges: 0, unscrapeable: 0, fetchFailed: 0, sweptCount: 0, lastCheckedCursor: afterCheckedAt }
  }

  const popularCutoff = new Date(Date.now() - POPULAR_STALE_DAYS * 86_400_000).toISOString()

  // PHASE 1 — stale popular products (review_count high, price aged past cutoff).
  // Ordered most-reviewed first so the very top products refresh earliest.
  const { data: popularRows } = await db
    .from('ss_product_prices')
    .select('id, product_id, url, price_usd, last_checked, ss_products!inner(review_count)')
    .eq('retailer_id', retailer.id)
    .gte('ss_products.review_count', POPULAR_REVIEW_THRESHOLD)
    .lt('last_checked', popularCutoff)
    .order('review_count', { ascending: false, foreignTable: 'ss_products' })
    .limit(limit)

  // PHASE 2 — long-tail sweep, stalest-first, past the keyset cursor. Only fetch
  // enough to top the batch up to `limit` after phase 1 takes its share.
  const sweepBudget = Math.max(0, limit - (popularRows?.length ?? 0))
  let sweepRows: typeof popularRows = []
  if (sweepBudget > 0) {
    let query = db
      .from('ss_product_prices')
      .select('id, product_id, url, price_usd, last_checked, ss_products!inner(review_count)')
      .eq('retailer_id', retailer.id)
      .order('last_checked', { ascending: true, nullsFirst: true })
      .limit(sweepBudget)
    if (afterCheckedAt) {
      query = query.gt('last_checked', afterCheckedAt)
    }
    const { data } = await query
    sweepRows = data ?? []
  }

  // Only phase-2 sweep rows drive the keyset cursor. A phase-1 popular row can sit
  // anywhere in the `last_checked` timeline, so advancing the cursor off it would
  // corrupt the monotonic sweep. Track sweep ids so the loop knows which is which.
  const sweepIds = new Set<string>((sweepRows ?? []).map((r) => r.id as string))

  // Phase 1 rows first (priority), then phase 2 sweep rows. De-dupe by price id so
  // a popular row that's also stalest isn't scraped twice in one run.
  const seen = new Set<string>()
  const rows = [...(popularRows ?? []), ...(sweepRows ?? [])].filter((r) => {
    const id = r.id as string
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  const result: OyPriceRefreshResult = {
    scanned: 0,
    updated: 0,
    priceChanges: 0,
    unscrapeable: 0,
    fetchFailed: 0,
    sweptCount: sweepIds.size,
    lastCheckedCursor: afterCheckedAt,
  }

  if (!rows || rows.length === 0) {
    return result
  }

  // The scraper reuses one Chromium instance across sequential calls. In practice
  // Olive Young occasionally tears the headless browser down mid-batch (observed
  // Jul 6: a clean fetch, then "Target page/context/browser has been closed" on the
  // next call). A dead browser fails EVERY subsequent call, which would kill the
  // whole run after one product. So the scraper is reassignable and we recreate it
  // once when a browser-closed error is seen, then retry that same product.
  let scraper = new OliveYoungScraper({ delayMs: 800 })

  const isBrowserGone = (err: unknown): boolean => {
    const m = err instanceof Error ? err.message : String(err)
    return /closed|Target page|context|crashed|disconnected/i.test(m)
  }

  const fetchPrice = async (prdtNo: string): Promise<number | null | undefined> => {
    try {
      const detail = await scraper.scrapeProductDetail(prdtNo)
      return detail?.price_usd ?? null
    } catch (err) {
      if (isBrowserGone(err)) {
        console.warn('[oy-price-refresh] browser died mid-batch — recreating and retrying once')
        try { await scraper.closeBrowser() } catch { /* already gone */ }
        scraper = new OliveYoungScraper({ delayMs: 800 })
        try {
          const detail = await scraper.scrapeProductDetail(prdtNo)
          return detail?.price_usd ?? null
        } catch (retryErr) {
          console.error(`[oy-price-refresh] retry failed for prdtNo=${prdtNo}:`, retryErr instanceof Error ? retryErr.message : retryErr)
          return undefined
        }
      }
      console.error(`[oy-price-refresh] scrape threw for prdtNo=${prdtNo}:`, err instanceof Error ? err.message : err)
      return undefined
    }
  }

  try {
    for (const row of rows) {
      if (deadline && Date.now() > deadline) {
        console.warn(`[oy-price-refresh] Budget reached after ${result.scanned} rows — stopping cleanly`)
        break
      }
      result.scanned++
      // Advance the sweep cursor only for phase-2 rows, and regardless of scrape
      // outcome, so a persistently-unscrapeable tail row can't wedge the sweep.
      if (sweepIds.has(row.id as string)) {
        result.lastCheckedCursor = (row.last_checked as string | null) ?? result.lastCheckedCursor
      }

      const prdtNo = parsePrdtNo(row.url as string | null)
      if (!prdtNo) {
        result.unscrapeable++
        continue
      }

      const newPrice = await fetchPrice(prdtNo)
      if (newPrice == null) {
        result.fetchFailed++
        continue
      }

      const now = new Date().toISOString()
      const oldPrice = row.price_usd == null ? null : Number(row.price_usd)
      const priceChanged = oldPrice == null || Math.abs(oldPrice - newPrice) > 0.01

      const { error: updateError } = await db
        .from('ss_product_prices')
        .update({ price_usd: newPrice, last_checked: now })
        .eq('id', row.id)

      if (updateError) {
        console.error(`[oy-price-refresh] update failed for price ${row.id}: ${updateError.message}`)
        result.fetchFailed++
        continue
      }

      result.updated++
      if (priceChanged) {
        result.priceChanges++
        // Snapshot only on real movement, matching price-matcher's history behavior.
        await db.from('ss_price_history').insert({
          product_id: row.product_id,
          retailer: OY_RETAILER_NAME,
          price: newPrice,
          currency: 'USD',
          recorded_at: now,
        })
      }
    }
  } finally {
    await scraper.closeBrowser()
  }

  // Silent-failure tripwire (May 5 scraper-zero-result lesson): we had rows to
  // refresh but wrote none — surface it instead of "completing" quietly.
  if (result.scanned > 0 && result.updated === 0) {
    console.warn(
      `[oy-price-refresh] examined ${result.scanned} rows but updated 0 — Olive Young may have changed structure or be blocking. unscrapeable=${result.unscrapeable} fetchFailed=${result.fetchFailed}`
    )
  }

  return result
}
