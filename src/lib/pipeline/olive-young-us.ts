/**
 * Olive Young US: product-feed reads and STRICT catalog matching.
 *
 * Why (Oct 21 2026): Olive Young Global stopped shipping to the US on May 29
 * 2026. To show a price a US shopper can actually pay, we match catalog
 * products to Olive Young US listings. The store's product feed is readable
 * server-side with a plain fetch; its search is server-rendered, so candidate
 * discovery happens in a local Playwright script (scripts/match-olive-young-us.ts)
 * and only the feed read runs in the monthly cron.
 *
 * Wrong-product discipline (CLAUDE.md): a confident wrong match is worse than
 * none. A numbered line's number IS the product (numbuzin No.3 vs No.9), a
 * twin pack is not a single, and a 50ml is not a 200ml. Every check below fails
 * closed; a product with zero or 2+ passing candidates stays unmatched.
 */

export const OY_US_FEED = 'https://us.oliveyoung.com/api/proxy/storefront/api/v1/q/products/'
export const OY_US_PRODUCT_URL = 'https://us.oliveyoung.com/products/'

export interface OyUsProduct {
  id: string
  name: string
  brand: string
  price: number | null
  inStock: boolean
  hasVariants: boolean
}

/** Read one Olive Young US product. Throws on HTTP or shape errors — never returns a silent null for a failure. */
export async function fetchOyUsProduct(id: string, fetchImpl: typeof fetch = fetch): Promise<OyUsProduct | null> {
  const res = await fetchImpl(`${OY_US_FEED}${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    },
  })
  if (res.status === 404) return null // gone from the store: a fact, not an error
  if (!res.ok) throw new Error(`Olive Young US feed ${id}: HTTP ${res.status}`)
  const body = (await res.json()) as { data?: Record<string, unknown> }
  const d = body.data
  if (!d || typeof d.name !== 'string') throw new Error(`Olive Young US feed ${id}: unexpected shape`)
  const pricing = d.pricing as { price?: { amount?: number } } | undefined
  const amount = pricing?.price?.amount
  return {
    id: String(d.product_id ?? id),
    name: d.name,
    brand: String((d.brand as { name?: string } | undefined)?.name ?? ''),
    price: typeof amount === 'number' && amount > 0 ? amount : null,
    inStock: d.is_soldout !== true,
    hasVariants: d.has_variants === true,
  }
}

const NOISE = new Set([
  'double', 'twin', 'triple', 'set', 'duo', 'pack', 'deal', 'special', 'edition', 'gift',
  'kit', 'exclusive', 'limited', 'bundle', 'value', 'the', 'and', 'with', 'for', 'of',
  'ea', 'uv', 'fl', 'oz', 'ml', 'g', 'options', 'types', 'net', 'wt',
])

/** Words that name what KIND of product it is. */
const FORM_WORDS = new Set([
  'cream', 'fluid', 'lotion', 'gel', 'toner', 'serum', 'essence', 'ampoule', 'mist', 'pad', 'pads',
  'mask', 'sheet', 'balm', 'oil', 'foam', 'cleanser', 'milk', 'stick', 'jelly', 'emulsion', 'patch', 'spray',
])

/**
 * Words that make a different product or a different size of it. A listing that
 * adds one of these is refused outright (review of Oct 21 2026: "Marine Care
 * Cream" accepted an EYE cream, a toner accepted its REFILL, "Lip Sleeping Mask"
 * a flavour, "Soothing Cream" its PLUS version).
 */
const REFUSE_WORDS = new Set([
  'eye', 'lip', 'hand', 'body', 'foot', 'hair', 'scalp', 'refill', 'mini', 'jumbo', 'travel', 'plus',
  'advanced', 'intensive', 'tone', 'toneup', 'men', 'homme', 'baby', 'kids', 'berry', 'mint', 'vanilla',
])

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9.+]+/g, ' ').trim()
const brandKey = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '')

/** Strip bracketed text, sizes and SPF/PA specs; keep identity numbers like "1025", "no.9", "5+". */
function cleanName(name: string): string {
  return norm(
    name
      .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
      // Multipliers first ("X 2ea", "*2"), or the size rule eats "2ea" and leaves a stray "x".
      .replace(/(^|\s|\d)[*x×]\s*\d+\s*(ea|pcs?)?\b/gi, '$1 ')
      .replace(/\b\d+(\.\d+)?\s*(ml|g|fl\.?\s*oz\.?|oz\.?|ea|pcs?|sheets?|pads?|p)(?![a-z])/gi, ' ')
      // Only real ratings: a bare "\bpa" also ate "Pad" (the first dry run
      // matched toner PADS to a liquid toner and to sheet masks).
      .replace(/\bspf\s*\d*\+?|\bpa\+{1,4}/gi, ' ')
  )
}

export function coreTokens(name: string): string[] {
  return cleanName(name)
    .replace(/[.+]/g, (m) => (m === '.' ? '' : ' '))
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t))
}

/** Identity numbers, with a trailing "+" kept: numbuzin No.5+ and No.5 are different products. */
export function identityNumbers(name: string): string[] {
  return (cleanName(name).match(/\d+\+?/g) || []).sort()
}

/** Pack count implied by a name/volume: 1 for a single, 2+ for multipacks, 0 when unclear. */
export function packCount(text: string): number {
  const t = text.toLowerCase()
  // A set, a gift bundle, bracketed contents, or "A + B": unclear what one unit
  // is. Checked FIRST so "[Main] 200ml*2ea + [Gift] ..." can't read as a twin.
  if (/\bset\b|\bkit\b|\bgift\b|\[|\+\s*\d|\d+\s*\+\s*\d+/.test(t)) return 0
  const m = t.match(/(?:[x×*]\s*(\d+)\s*(?:ea|pcs?)?|\b(\d+)\s*(?:ea|pcs?)\b)/)
  if (m) return Number(m[1] ?? m[2])
  if (/\b(twin|double|duo)\b/.test(t)) return 2
  if (/\btriple\b/.test(t)) return 3
  return 1
}

/** Count of pads / sheets / patches, when stated ("60 pads", "10 Sheets"). */
export function unitCount(text: string): { n: number; unit: string } | null {
  const m = text.toLowerCase().match(/(\d+)\s*(pads?|sheets?|patch(?:es)?|p)\b/)
  return m ? { n: Number(m[1]), unit: m[2].replace(/(es|s)$/, '').replace(/^p$/, 'pad') } : null
}

/** Every distinct size stated, in ml/g. Falls back to fl. oz converted when no ml/g is given. */
export function sizesMl(text: string): number[] {
  const t = text.toLowerCase()
  const metric = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(ml|g)(?![a-z])/g)].map((m) => Number(m[1]))
  if (metric.length) return [...new Set(metric)]
  const oz = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz/g)].map((m) => Math.round(Number(m[1]) * 29.57))
  return [...new Set(oz)]
}

const sameSize = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, a * 0.08)

export interface CatalogProduct {
  brand: string
  name: string
  volume: string | null
}

/**
 * match:  every word lines up; safe to write.
 * review: nothing contradicts, but the listing adds words we can't judge (or our
 *         size is unknown). A person decides; the script never writes these alone.
 * reject: anything uncertain about brand, identity number, pack, count, size or form.
 */
export type MatchVerdict =
  | { verdict: 'match' }
  | { verdict: 'review'; note: string }
  | { verdict: 'reject'; reason: string }

export function verifyOyUsMatch(ours: CatalogProduct, theirs: OyUsProduct): MatchVerdict {
  const reject = (reason: string): MatchVerdict => ({ verdict: 'reject', reason })

  // Whole-brand equality, not substring: "Dr.G" must not accept "Dr.Gem".
  if (!brandKey(ours.brand) || brandKey(ours.brand) !== brandKey(theirs.brand)) return reject(`brand ${theirs.brand}`)
  if (theirs.hasVariants) return reject('listing has variants (size/shade ambiguous)')
  if (theirs.price === null) return reject('no price')

  const ourText = `${ours.name} ${ours.volume ?? ''}`
  // Bundles: "+"/gift/"original product" contents, or two different sizes on our side.
  if (/\+\s*[a-z0-9[]|gift|original product/i.test(ours.volume ?? '') || sizesMl(ourText).length > 1) {
    return reject('our listing is a bundle')
  }

  const brandTokens = new Set([...coreTokens(ours.brand), ...coreTokens(theirs.brand)])
  const ourCore = coreTokens(ours.name).filter((t) => !brandTokens.has(t))
  const theirCore = coreTokens(theirs.name).filter((t) => !brandTokens.has(t))
  const theirSet = new Set(theirCore)
  const theirJoined = theirCore.join('')
  const missing = ourCore.filter((t) => !theirSet.has(t) && !theirJoined.includes(t))
  if (ourCore.length === 0 || missing.length > 0) return reject(`name missing ${missing.join(',')}`)

  // Brand names carry digits too ("SKIN1004"), and the US store prefixes names
  // with the brand. Compare the numbers in the PRODUCT part only.
  const stripBrand = (n: string) =>
    [ours.brand, theirs.brand].reduce(
      (acc, b) => (b ? acc.replace(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ') : acc),
      n
    )
  const ourNums = identityNumbers(stripBrand(ours.name)).join(',')
  const theirNums = identityNumbers(stripBrand(theirs.name)).join(',')
  if (ourNums !== theirNums) return reject(`identity numbers ${ourNums || '-'} vs ${theirNums || '-'}`)

  const ourPack = packCount(ourText)
  const theirPack = packCount(theirs.name)
  if (ourPack === 0 || theirPack === 0 || ourPack !== theirPack) return reject(`pack ${ourPack} vs ${theirPack}`)

  const ourUnits = unitCount(ourText)
  const theirUnits = unitCount(theirs.name)
  if (ourUnits && theirUnits && (ourUnits.n !== theirUnits.n || ourUnits.unit !== theirUnits.unit)) {
    return reject(`count ${ourUnits.n} ${ourUnits.unit} vs ${theirUnits.n} ${theirUnits.unit}`)
  }
  if (!!ourUnits !== !!theirUnits && (ourUnits?.unit === 'pad' || theirUnits?.unit === 'pad' || theirUnits?.unit === 'sheet')) {
    return reject('pad/sheet count on one side only')
  }

  // Words the listing adds. A different product type or variant is refused; any
  // other extra goes to a person.
  const ourAll = new Set(coreTokens(ourText))
  const has = (t: string) => ourAll.has(t) || ourAll.has(`${t}s`) || ourAll.has(t.replace(/s$/, ''))
  const extras = theirCore.filter((t) => !has(t) && !/^\d+\+?$/.test(t))
  const fatal = extras.filter((t) => FORM_WORDS.has(t) || REFUSE_WORDS.has(t))
  if (fatal.length) return reject(`listing adds ${fatal.join(',')}`)

  const ourSizes = sizesMl(ourText)
  const theirSizes = sizesMl(theirs.name)
  if (theirSizes.length > 1) return reject(`listing has several sizes ${theirSizes.join('/')}`)
  if (ourSizes.length === 1) {
    if (theirSizes.length === 0) return reject('listing size unknown')
    if (!sameSize(ourSizes[0], theirSizes[0])) return reject(`size ${ourSizes[0]} vs ${theirSizes[0]}`)
  }

  if (extras.length) return { verdict: 'review', note: `listing adds: ${extras.join(' ')}` }
  if (ourSizes.length === 0 && !ourUnits) return { verdict: 'review', note: 'our size is unknown' }
  return { verdict: 'match' }
}

/** Brand + first three core words: the store's search needs every word to match. */
export function oyUsSearchQuery(brand: string, name: string): string {
  const brandTokens = new Set(coreTokens(brand))
  const core = coreTokens(name).filter((t) => !brandTokens.has(t)).slice(0, 3)
  return [brand.trim(), ...core].join(' ')
}
