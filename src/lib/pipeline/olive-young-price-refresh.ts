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
  lastCheckedCursor: string | null // ISO of the last row's PRIOR last_checked (keyset)
}

/** Pull the Olive Young `prdtNo` out of a stored product-detail url. */
export function parsePrdtNo(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/[?&]prdtNo=([A-Za-z0-9]+)/)
  return m ? m[1] : null
}

/**
 * Refresh a bounded batch of the stalest Olive Young prices.
 *
 * The cursor is a `last_checked` timestamp: each run processes rows with
 * `last_checked > afterCheckedAt` (or all rows on the first run), ordered ascending,
 * so we always attack the stalest prices first and advance monotonically. When a
 * run finds nothing past the cursor, the caller wraps back to the start.
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
    return { scanned: 0, updated: 0, priceChanges: 0, unscrapeable: 0, fetchFailed: 0, lastCheckedCursor: afterCheckedAt }
  }

  // Stalest-first page of OY price rows past the cursor. We over-select slightly
  // vs `limit` is unnecessary — the batch size IS the network budget here.
  let query = db
    .from('ss_product_prices')
    .select('id, product_id, url, price_usd, last_checked')
    .eq('retailer_id', retailer.id)
    .order('last_checked', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (afterCheckedAt) {
    query = query.gt('last_checked', afterCheckedAt)
  }

  const { data: rows, error } = await query
  if (error) {
    console.error(`[oy-price-refresh] Failed to read price rows: ${error.message}`)
    return { scanned: 0, updated: 0, priceChanges: 0, unscrapeable: 0, fetchFailed: 0, lastCheckedCursor: afterCheckedAt }
  }

  const result: OyPriceRefreshResult = {
    scanned: 0,
    updated: 0,
    priceChanges: 0,
    unscrapeable: 0,
    fetchFailed: 0,
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
      // Advance the cursor to this row's PRIOR last_checked regardless of outcome,
      // so a persistently-unscrapeable row can't wedge the sweep forever.
      result.lastCheckedCursor = (row.last_checked as string | null) ?? result.lastCheckedCursor

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
