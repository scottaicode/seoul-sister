/**
 * Split a product's retailer prices into what a US shopper can actually pay
 * and what is an international-only price.
 *
 * Why (Oct 21 2026): Olive Young Global stopped shipping to US addresses on
 * May 29 2026, and it supplied 4,908 of our 5,157 price rows. Public pages kept
 * showing its price as THE price, and told Google the product was offered in
 * USD at that price — a number a US searcher cannot pay. The international
 * price is still real and useful as a comparison; it must never be presented
 * as the US price.
 *
 * The "US price" also requires a store we actually send people to. A second-
 * model review caught that YesStyle (ships to the US, never recommended, its
 * refresher retired) would otherwise have become the published US price for
 * 115 products — a frozen number from a store Yuri is told not to steer toward.
 *
 * Shared by the product page, best-of pages, the LGAAS search endpoint and the
 * subscriber price list so they cannot drift apart. Pure, so tests execute it.
 */

export interface ScopedPriceRow {
  price_usd: number | string | null
  last_checked?: string | null
  /** From ss_retailers.ships_to_us. null = unknown. */
  ships_to_us: boolean | null
  /** isRecommendedRetailer(name) — a store we actually send people to. */
  recommended: boolean
}

export interface ScopedPrices {
  /** Freshest (then cheapest) price at a recommended store that ships to the US. */
  us: number | null
  /** Freshest (then cheapest) price at a recommended store that does NOT ship to the US. */
  international: number | null
  /** Every US price (recommended + ships to the US), for a min/max range. */
  usAll: number[]
}

const toPrice = (v: number | string | null): number => (v == null ? NaN : Number(v))

/**
 * Unknown reach (ships_to_us null) and non-recommended stores are in neither
 * bucket: an unknown must never be published to Google or shown as payable,
 * and a store we don't send people to must never be "the price".
 */
export function scopePrices(rows: ScopedPriceRow[]): ScopedPrices {
  const pick = (scope: ScopedPriceRow[]): number | null => {
    let bestDay: string | null = null
    let best: number | null = null
    for (const r of scope) {
      const price = toPrice(r.price_usd)
      if (!Number.isFinite(price) || price <= 0) continue
      const day = (r.last_checked || '').slice(0, 10)
      if (best === null || day > (bestDay ?? '')) {
        bestDay = day
        best = price
      } else if (day === bestDay && price < best) {
        best = price
      }
    }
    return best
  }
  const usRows = rows.filter((r) => r.recommended && r.ships_to_us === true)
  const intlRows = rows.filter((r) => r.recommended && r.ships_to_us === false)
  return {
    us: pick(usRows),
    international: pick(intlRows),
    usAll: usRows.map((r) => toPrice(r.price_usd)).filter((p) => Number.isFinite(p) && p > 0),
  }
}

/** The US price range a page may show and publish. Never falls back to anything else. */
export function usPriceRange(scoped: ScopedPrices): { min: number | null; max: number | null } {
  if (scoped.usAll.length === 0) return { min: null, max: null }
  const min = Math.min(...scoped.usAll)
  const max = Math.max(...scoped.usAll)
  return { min, max: max > min ? max : null }
}

/**
 * Whether a listing can be ordered by this shopper. For a US shopper only a
 * store that ships to the US qualifies; outside the US, only a store that
 * ships internationally. Unknown reach never qualifies.
 */
export function isOrderableHere(
  shipsToUs: boolean | null,
  shopperInUs: boolean,
  shipsInternational: boolean | null = null
): boolean {
  return shopperInUs ? shipsToUs === true : shipsInternational === true
}

/**
 * The cheapest row a US shopper could actually be sent to: ships to the US AND
 * a store we recommend, in stock first. Rows must already be sorted by price
 * ascending. null when none exists — never a non-recommended stand-in.
 */
export function cheapestUsOrderable<
  T extends { ships_to_us: boolean | null; recommended_to_buy_from: boolean; in_stock: unknown }
>(rowsByPrice: T[]): T | null {
  const ok = rowsByPrice.filter((p) => p.ships_to_us === true && p.recommended_to_buy_from)
  return ok.find((p) => p.in_stock === true) ?? ok[0] ?? null
}
