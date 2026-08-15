import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchOliveYoungPrice } from './sources/olive-young-price-api'

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
  fetchFailed: number // prdtNo derived but the live lookup errored
  /**
   * Rows whose product is GONE from Olive Young Global (the endpoint answers
   * with an empty body). Tracked separately from `fetchFailed` because it is a
   * fact about the catalog, not a failure of ours — and because a rising count
   * here is real signal: two of the six products Yuri quoted to the Aug 15
   * Spanish visitor were already delisted while we still advertised a price.
   */
  delisted: number
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
    return { scanned: 0, updated: 0, priceChanges: 0, unscrapeable: 0, fetchFailed: 0, delisted: 0, sweptCount: 0, lastCheckedCursor: afterCheckedAt }
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
    delisted: 0,
    sweptCount: sweepIds.size,
    lastCheckedCursor: afterCheckedAt,
  }

  if (!rows || rows.length === 0) {
    return result
  }

  // Price lookup is a single JSON fetch — no browser at all.
  //
  // This replaced a Playwright path that read the price out of the rendered DOM
  // via `.price-info`. That selector stopped existing when Olive Young moved the
  // detail page's price to an async XHR, and because a missing selector returns
  // null WITHOUT throwing, the refresher silently failed every night for ~130
  // nights while reporting success. See `olive-young-price-api.ts` for the full
  // diagnosis. The browser-death retry logic that used to live here is gone with
  // it: there is no browser left to die.
  {
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

      const outcome = await fetchOliveYoungPrice(prdtNo)

      if (outcome.kind === 'error') {
        result.fetchFailed++
        console.error(`[oy-price-refresh] lookup failed for prdtNo=${prdtNo}: ${outcome.reason}`)
        continue
      }

      if (outcome.kind === 'delisted') {
        // The product is gone from Olive Young Global.
        //
        // WHY `in_stock: false` AND NOT A DELETE. `in_stock` already exists, is
        // already NOT NULL, and is already read by `compare_prices` (which
        // prefers in-stock rows for `best_deal`/`cheapest_recommended`). So
        // flipping it routes around dead listings through machinery that is
        // already wired, with no schema change and no new concept for Yuri to
        // learn. Deleting the row would destroy the price history and the URL,
        // and Olive Young does relist — a soft flag is recoverable, a delete is
        // not. (`kind: 'error'` deliberately does NOT flip this: a rate limit
        // must never be able to mark a live product dead.)
        //
        // THE HARM THIS FIXES, measured Aug 15 2026: of the six products Yuri
        // recommended to the Spanish visitor, TWO were already delisted —
        // including her #1 pick, the Dr.G RTX Peptishot, quoted at $35.23. And
        // 8 of our 30 most-reviewed OY products (27%) are gone. Quoting a
        // confident price for something nobody can buy is worse than quoting a
        // stale one: the shopper follows the link and hits nothing.
        //
        // `last_checked` is stamped too — we genuinely looked today. Leaving it
        // at April would make the row look unexamined forever and wedge the
        // stalest-first cursor on dead products.
        result.delisted++
        const { error: touchError } = await db
          .from('ss_product_prices')
          .update({ in_stock: false, last_checked: new Date().toISOString() })
          .eq('id', row.id)
        if (touchError) {
          console.error(`[oy-price-refresh] delisted touch failed for ${row.id}: ${touchError.message}`)
        }
        continue
      }

      const newPrice = outcome.priceUsd
      const now = new Date().toISOString()
      const oldPrice = row.price_usd == null ? null : Number(row.price_usd)
      const priceChanged = oldPrice == null || Math.abs(oldPrice - newPrice) > 0.01

      // `in_stock: true` is written on every successful read, not just changed
      // ones. Olive Young relists products, and without this a row flipped false
      // by one delisted reading could never recover — a transient absence would
      // become a permanent one, silently hiding a product we do carry. The
      // delisting flag must be as reversible as the condition it describes.
      const { error: updateError } = await db
        .from('ss_product_prices')
        .update({ price_usd: newPrice, last_checked: now, in_stock: true })
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
  }

  // Silent-failure tripwire (May 5 scraper-zero-result lesson): we had rows to
  // refresh but wrote none.
  //
  // This tripwire WORKED and still cost us four months, which is the lesson
  // worth carrying: it fired correctly every night since Jul 6 — to
  // `console.warn`, which nobody reads. A log line is not observability. The
  // real fix lives in the cron route, which now writes `status: 'failed'` on a
  // zero-update run so the Guardian's 48h pipeline check (which keys on exactly
  // that) escalates it to the alert email. Kept here, at error level, because
  // the library should still say so loudly when called from anywhere else.
  //
  // Note `delisted` is deliberately NOT counted as a failure: a batch that is
  // genuinely all-delisted updated nothing and nothing is wrong with us.
  if (result.scanned > 0 && result.updated === 0 && result.delisted < result.scanned) {
    console.error(
      `[oy-price-refresh] examined ${result.scanned} rows but updated 0 — Olive Young may have changed structure or be blocking. ` +
        `unscrapeable=${result.unscrapeable} fetchFailed=${result.fetchFailed} delisted=${result.delisted}`
    )
  }

  return result
}
