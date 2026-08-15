/**
 * Olive Young live price lookup — fetch-only, no browser.
 *
 * WHY THIS EXISTS (measured Aug 15 2026, after ~130 nights of silent failure).
 *
 * The nightly OY price refresher had failed 100% since ~Jul 6: `scanned: 40,
 * updated: 0, fetchFailed: 40`, every run, while logging `status: "completed"`.
 * 4,889 of 4,917 Olive Young prices (99.4% of ~96% of all our price data) sat
 * frozen at Apr 7 2026, and Yuri quoted six of them to a real buyer as current.
 *
 * ROOT CAUSE. `OliveYoungScraper.scrapeProductDetail` reads the price from the
 * RENDERED DOM via `document.querySelector('.price-info')`. The detail page is a
 * Vue SPA that now loads its price asynchronously — verified by fetching the
 * served HTML for eight popular products and finding NO `saleAmt` anywhere in
 * it. When `.price-info` is absent the extractor returns null WITHOUT throwing,
 * so the refresher counted a silent null as `fetchFailed` and moved on. The
 * listing scraper kept working the whole time (96 products/night, 0 failures),
 * which is why this looked healthy from every angle except the price column.
 *
 * THE FIX. The page's own JS (`shop.product.detail.init.js`) calls
 * `axios.post('detail-data', {prdtNo})`. That endpoint returns the price as
 * JSON with no rendering required. Verified with plain `curl` against 10 real
 * products: it answers in one round trip, no browser, no Playwright, no
 * `@sparticuz/chromium` cold start.
 *
 * WHY THIS MATTERS BEYOND SPEED. Playwright on Vercel is ~5-10s/page and is the
 * reason the batch was capped at 40 rows/night (a ~4-month full cycle). A fetch
 * costs ~0.3s, so the same time budget covers far more rows — the staleness
 * problem stops being structural.
 *
 * TWO FIELDS, AND THE DISTINCTION IS LOAD-BEARING:
 *   nrmlAmt = list price      saleAmt = what you actually pay today
 * We store what the shopper pays, so `saleAmt` wins. Measured on 8 popular
 * products, six were discounted — Beauty of Joseon Revive Eye Serum listed at
 * $17.00 but sells at $13.89, and our stored $25.99 was 47% high. Storing
 * `nrmlAmt` would have quietly reintroduced the overquote this fixes.
 *
 * DELISTING IS A REAL, DISTINCT OUTCOME. Two of the six products Yuri quoted to
 * the Aug 15 visitor return an EMPTY body — they are gone from Olive Young
 * Global. `null` price and "product delisted" must not be conflated: the first
 * means we failed to read, the second means there is nothing to read. The
 * caller needs to tell those apart, so this returns a discriminated result
 * rather than a bare `number | null`.
 */

/**
 * Measured before relying on this endpoint (Aug 15 2026), so a later session
 * does not have to re-derive it:
 *
 *   Throughput — 25 sequential requests in 12s, zero HTTP errors, no rate
 *   limiting, no cookie or session requirement. At ~0.5s/row a 400-row batch
 *   lands around 200s, inside the route's 270s budget.
 *
 *   Currency — the response carries `currency: null` and `currencySymbol: null`,
 *   and prices are byte-identical with `Accept-Language: es-ES`. Olive Young
 *   Global is a single USD storefront, so what we store is what every shopper
 *   sees regardless of country. This mattered: the visitor who triggered this
 *   work was in Spain, and a per-region price would have made the stored number
 *   wrong for her in a way no amount of refreshing could fix.
 */
const DETAIL_DATA_URL = 'https://global.oliveyoung.com/product/detail-data'

/** A real browser UA. The endpoint is the site's own XHR and expects one. */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export type OyPriceOutcome =
  /** Live price read successfully. `saleAmt` — what the shopper actually pays. */
  | { kind: 'ok'; priceUsd: number; listPriceUsd: number | null }
  /**
   * The endpoint answered, but with nothing — the product is no longer carried.
   * Distinct from a fetch error: retrying will not help, and the stored price is
   * not merely stale, it is unbuyable.
   */
  | { kind: 'delisted' }
  /** Transport/parse failure. Says nothing about the product; retrying may help. */
  | { kind: 'error'; reason: string }

/**
 * Parse the price out of a detail-data payload.
 *
 * Exported for testing so the guard test can execute the REAL parser against
 * real captured payload shapes rather than asserting on source text — per
 * CLAUDE.md, a source-regex test passes against broken code.
 */
export function parseDetailData(body: string): OyPriceOutcome {
  const trimmed = body.trim()
  // An empty body is how this endpoint reports "no such live product".
  if (!trimmed) return { kind: 'delisted' }

  let json: unknown
  try {
    json = JSON.parse(trimmed)
  } catch {
    return { kind: 'error', reason: 'non-JSON response' }
  }

  const product = (json as Record<string, unknown>)?.product as
    | Record<string, unknown>
    | undefined
  if (!product) return { kind: 'delisted' }

  // saleAmt is what the shopper pays; nrmlAmt is the struck-through list price.
  const sale = toPrice(product.saleAmt)
  const list = toPrice(product.nrmlAmt)

  // A live product with no readable sale price is an ERROR, not a delisting —
  // we reached a real product record and failed to understand it. Calling that
  // "delisted" would let a parse regression masquerade as catalog churn, which
  // is the exact silent-failure shape this whole file exists to fix.
  if (sale == null) {
    return list == null
      ? { kind: 'error', reason: 'no saleAmt or nrmlAmt in payload' }
      : { kind: 'error', reason: 'saleAmt missing (only list price present)' }
  }

  return { kind: 'ok', priceUsd: sale, listPriceUsd: list }
}

/** Coerce a JSON number/string price, rejecting junk and non-positive values. */
function toPrice(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

/**
 * Fetch one product's live Olive Young price. One round trip, no browser.
 */
export async function fetchOliveYoungPrice(
  prdtNo: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<OyPriceOutcome> {
  const { timeoutMs = 20_000, fetchImpl = fetch } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetchImpl(DETAIL_DATA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({ prdtNo }),
      signal: controller.signal,
    })

    // A non-2xx is a transport problem, never evidence about the product.
    if (!res.ok) return { kind: 'error', reason: `HTTP ${res.status}` }

    return parseDetailData(await res.text())
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { kind: 'error', reason }
  } finally {
    clearTimeout(timer)
  }
}
