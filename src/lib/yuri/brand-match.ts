/**
 * Which query terms name a product's BRAND (Nov 2026).
 *
 * THE DEFECT. The last-resort product search scored a brand match 3 and a name
 * match 1, and "brand match" was a bare substring test. A short query word
 * sitting inside an unrelated brand name won the ranking: "gel" inside
 * Physiogel (a visitor asking for a lightweight gel moisturizer got five
 * Physiogel products), "no" inside COSNORI, "acne" inside Acnes, "free" inside
 * Innisfree.
 *
 * Whole-word matching alone moves the defect up a level: "skin" IS a word of
 * It's Skin and April Skin, "barrier" of Real Barrier, "green" of Bring Green.
 * So a single brand word earns the bonus only when it is not an ordinary
 * product-name word, measured across the whole catalog, never from the rows
 * one search happened to fetch. On Nov 11 2026 the verified catalog had 492
 * brands and 38 such ordinary words (skin, barrier, green, real, lab, body...).
 *
 * A brand of two or more words typed IN FULL always earns the bonus, however
 * ordinary its words ("Real Barrier", "It's Skin", "Skin&Lab").
 *
 * KNOWN LIMIT, measured and not solved here. "Ordinary" is judged from product
 * NAMES, so an everyday word that no other brand puts in a product name still
 * counts as a brand word: "happy" (Happy Bath), "shop" (The Face Shop),
 * "seoul" (Purito Seoul), "ready" (B.Ready), "whipped" (Whipped), "school",
 * "thing". "happy glowy skin serum" leads with Happy Bath, and such a word
 * also triggers the fetch of that brand's rows. Product descriptions were
 * measured as a second vocabulary and do not contain these words either. The
 * right instrument is an English word list, which this repo does not carry.
 * A second review counted 149 brand words that are dictionary words and not
 * ordinary, and found 16 of 340 stored real searches naming a brand only
 * through one; 14 of those were another brand typed in full ("Round Lab" also
 * naming Round Around), which wordsOfBrandsTypedInFull now stops. Function
 * words and articles (from, too, what, la...) are handled below.
 *
 * One cleaning rule (`brandTokens`) is used for brands, queries and product
 * names. Two rules that disagree about punctuation is how Dr. Jart+, Skin&Lab,
 * d'Alba and Ma:nyo lost their brand weight in an earlier attempt.
 *
 * No imports: the test harnesses inline this file next to smartProductSearch.
 */

/**
 * Function words and articles: they never identify a brand on their own ("the"
 * in The Saem, "from" in I'm From, "too" in Too Cool For School, "la" in LA
 * DOLF). A closed grammatical class, not a list of troublesome brands.
 */
const BRAND_FILLER_WORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'by', 'with', 'in', 'of', 'to',
  'my', 'me', 'is', 'it', 'do', 'you', 'on', 'so', 'de', 'la', 'le', 'el',
  'from', 'too', 'what', 'at', 'as', 'be', 'not', 'no', 'this', 'that', 'im',
  'we', 'us', 'our', 'your', 'its', 'into', 'over', 'up', 'out', 'off',
  'than', 'then', 'very', 'more', 'most', 'just', 'only', 'also', 'how',
  'why', 'when', 'where', 'who', 'which', 'are', 'was', 'can', 'will',
])

/** A word used in product names by this many OTHER brands is ordinary. */
export const ORDINARY_WORD_MIN_OTHER_BRANDS = 3

/** Lower-cased tokens of a brand, query or product name. Punctuation separates. */
export function brandTokens(text: string): string[] {
  return (text || '')
    .toLowerCase()
    // Every character that is not a letter or a digit separates, so no brand
    // escapes through a mark nobody listed (su:m37°, Cica·go).
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Brand tokens that can identify the brand on their own. */
function identifyingBrandWords(tokens: string[]): string[] {
  return tokens.filter((w) => w.length > 1 && !BRAND_FILLER_WORDS.has(w))
}

/** The query tokens that spell the whole brand, as one word or several, in order. Empty if it is not typed in full. */
function fullBrandRun(tokens: string[], queryTokens: string[]): Set<string> {
  const run = new Set<string>()
  const joined = tokens.join('')
  if (!joined) return run
  for (let i = 0; i < queryTokens.length && run.size === 0; i++) {
    let acc = ''
    for (let j = i; j < queryTokens.length; j++) {
      acc += queryTokens[j]
      if (acc.length > joined.length || !joined.startsWith(acc)) break
      if (acc === joined) {
        for (let k = i; k <= j; k++) run.add(queryTokens[k])
        break
      }
    }
  }
  return run
}

/**
 * Query words that belong to a brand of two or more words typed IN FULL. They
 * cannot also name a DIFFERENT brand on their own: in "Round Lab 1025 Dokdo
 * Toner", "round" is Round Lab's word and does not name Round Around; in
 * "House of Hur sunscreen", "house" does not name House of B. Measured on the
 * 340 stored real searches (second review, Nov 11 2026): 14 named a second
 * brand this way. One-word brands are left out on purpose: the catalog stores
 * "Klairs" beside "Dear, Klairs" and "Purito" beside "Purito Seoul", and the
 * short form must still name the long one. For the same reason a brand whose
 * every word belongs to the brand typed in full is not blocked by it: "The
 * Whoo" is "The History of Whoo" stored a second way.
 */
export interface TakenBrandWords {
  /** Words of brands typed in full. */
  words: Set<string>
  /** The tokens of each brand typed in full. */
  brands: string[][]
}

export function wordsOfBrandsTypedInFull(brands: string[], queryTokens: string[]): TakenBrandWords {
  const taken: TakenBrandWords = { words: new Set<string>(), brands: [] }
  for (const brand of brands) {
    const tokens = brandTokens(brand)
    if (tokens.length < 2) continue
    const run = fullBrandRun(tokens, queryTokens)
    if (run.size === 0) continue
    for (const w of run) taken.words.add(w)
    taken.brands.push(tokens)
  }
  return taken
}

/**
 * The query terms that earn the brand bonus for a product of `brand`.
 *
 * `queryTokens` is `brandTokens(rawQuery)`; `terms` are the search terms the
 * caller scores (already lower-cased). `isOrdinary` answers for one word.
 * `singleWords: false` accepts only a brand typed in full: used when the
 * catalog could not be read, so nothing is known about which words are ordinary.
 * `taken` are words of another brand typed in full (wordsOfBrandsTypedInFull).
 */
export function brandBonusTerms(
  brand: string,
  queryTokens: string[],
  terms: string[],
  isOrdinary: (word: string) => boolean,
  singleWords: boolean = true,
  taken?: TakenBrandWords
): Set<string> {
  const bonus = new Set<string>()
  const tokens = brandTokens(brand)
  if (tokens.length === 0) return bonus
  const fullRun = fullBrandRun(tokens, queryTokens)

  // A one-word brand whose word is ordinary ("Cure") is not named by that
  // word alone: "acne cure" is a description, not a brand.
  if (tokens.length === 1 && isOrdinary(tokens[0])) fullRun.clear()

  const identifying = new Set(identifyingBrandWords(tokens))
  // Words of another brand typed in full cannot name this one, unless this
  // brand is that brand stored a second way (all its words are that brand's).
  const sameBrandTyped = taken?.brands.some((full) => tokens.every((w) => full.includes(w))) ?? false
  const takenWords = sameBrandTyped ? undefined : taken?.words
  for (const t of terms) {
    const pieces = brandTokens(t)
    if (pieces.length === 0) continue
    if (fullRun.size > 0 && pieces.every((p) => fullRun.has(p))) {
      bonus.add(t)
      continue
    }
    // One typed term can hold several words ("skin&lab", "d'alba"). Every
    // one of them must be this brand's, or "skin&lab" would name Mild Lab.
    const words = identifyingBrandWords(pieces)
    if (singleWords && words.length > 0 && words.every((p) => identifying.has(p) && !isOrdinary(p) && !takenWords?.has(p))) bonus.add(t)
  }
  return bonus
}

/**
 * The query terms that are this brand's own words, ordinary or not. Used for
 * COVERAGE ("does this product match the term at all"), where "skin" does
 * match It's Skin, and "gel" does not match Physiogel.
 */
export function brandWordTerms(brand: string, queryTokens: string[], terms: string[], taken?: TakenBrandWords): Set<string> {
  return brandBonusTerms(brand, queryTokens, terms, () => false, true, taken)
}

/**
 * The terms a product matches: found in its NAME, or naming its BRAND by the
 * brand's own word(s). A term that only sits inside the brand name ("gel" in
 * Physiogel, "on" in ON:THE BODY's neighbours) is not a match. `name` is
 * already normalized by the caller; `nameMatches` is the caller's term matcher.
 */
export function termsCoveredBy(
  brand: string,
  name: string,
  queryTokens: string[],
  terms: string[],
  nameMatches: (name: string, term: string) => boolean,
  taken?: TakenBrandWords
): string[] {
  const own = brandWordTerms(brand, queryTokens, terms, taken)
  return terms.filter((t) => own.has(t) || nameMatches(name, t))
}

/**
 * Brand words that three or more OTHER brands use as a word in product names.
 * Pure: takes every verified product's brand and name.
 */
export function computeOrdinaryBrandWords(
  rows: Array<{ brand_en: string | null; name_en: string | null }>
): Set<string> {
  const brandWordOwners = new Map<string, Set<string>>()
  const nameWordBrands = new Map<string, Set<string>>()
  for (const r of rows) {
    const tokens = brandTokens(r.brand_en || '')
    if (tokens.length === 0) continue
    // Joined, so two spellings of one brand ("Dr.Different", "Dr. Different")
    // are one brand and do not count against their own word.
    const brandKey = tokens.join('')
    for (const w of identifyingBrandWords(tokens)) {
      if (!brandWordOwners.has(w)) brandWordOwners.set(w, new Set())
      brandWordOwners.get(w)!.add(brandKey)
    }
    for (const w of brandTokens(r.name_en || '')) {
      if (!nameWordBrands.has(w)) nameWordBrands.set(w, new Set())
      nameWordBrands.get(w)!.add(brandKey)
    }
  }
  const ordinary = new Set<string>()
  for (const [word, owners] of brandWordOwners) {
    const users = nameWordBrands.get(word)
    if (!users) continue
    let others = 0
    for (const b of users) if (!owners.has(b)) others++
    if (others >= ORDINARY_WORD_MIN_OTHER_BRANDS) ordinary.add(word)
  }
  return ordinary
}

/** What the search needs to know about the catalog's brands. */
export interface BrandCatalog {
  /** Brand words that are ordinary product-name words. */
  ordinary: Set<string>
  /** Every distinct `brand_en`, exactly as stored. */
  brands: string[]
}

/** Rows fetched for the brands a query names. */
export const NAMED_BRAND_ROW_LIMIT = 300

/** Most brands one query may pull rows for ("dear" names three). */
export const MAX_NAMED_BRANDS = 8

/**
 * The stored brands a query names: typed in full ("ma:nyo", "manyo",
 * "dr jart"), or by a word that is not an ordinary product-name word
 * ("klairs", "joseon").
 *
 * WHY THE SEARCH NEEDS THIS, not only the ranking. The last-resort search
 * fetches the best-RATED rows matching any term, then ranks them. A named
 * brand's rows are often not among them: "Klairs vitamin drop fragrance free"
 * fetched 150 rows and the 4.0-rated Klairs Freshly Juiced Vitamin Drop was
 * not one. And a punctuated brand typed plainly is never fetched at all:
 * `brand_en ILIKE '%manyo%'` cannot match "ma:nyo" (measured Nov 11 2026).
 * Ranking cannot choose a row that was not fetched.
 */
export function brandsNamedInQuery(
  catalog: BrandCatalog,
  queryTokens: string[],
  terms: string[]
): string[] {
  const named: string[] = []
  const taken = wordsOfBrandsTypedInFull(catalog.brands, queryTokens)
  for (const brand of catalog.brands) {
    if (brandBonusTerms(brand, queryTokens, terms, (w) => catalog.ordinary.has(w), true, taken).size > 0) {
      named.push(brand)
      if (named.length >= MAX_NAMED_BRANDS) break
    }
  }
  return named
}

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000
/** After a failed read, how long before the catalog is asked for again. */
const CATALOG_RETRY_MS = 60 * 1000
const PAGE = 1000
let catalogCache: { at: number; catalog: BrandCatalog } | null = null
let catalogFailedAt: number | null = null
let catalogInFlight: Promise<BrandCatalog | null> | null = null

/** Minimal shape of the Supabase client this loader uses. */
interface BrandWordsDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any
}

async function fetchBrandCatalog(db: BrandWordsDb): Promise<BrandCatalog | null> {
  try {
    const rows: Array<{ brand_en: string | null; name_en: string | null }> = []
    let total: number | null = null
    for (let from = 0; ; from += PAGE) {
      const { data, error, count } = await db
        .from('ss_products')
        .select('brand_en, name_en', { count: 'exact' })
        .eq('is_verified', true)
        .order('id')
        .range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      if (typeof count === 'number') total = count
      rows.push(...((data || []) as typeof rows))
      if (!data || data.length < PAGE) break
    }
    // PostgREST caps a page at 1,000 rows without an error. A partial scan
    // would call ordinary words rare, so it must not pass as a full one.
    if (total === null || rows.length !== total) {
      throw new Error(`partial catalog scan: ${rows.length} rows of ${total ?? 'unknown'}`)
    }
    // Case-insensitive order, so the cap in brandsNamedInQuery does not drop
    // lower-case brands (ma:nyo, d'Alba) first.
    const brands = [...new Set(rows.map((r) => r.brand_en).filter((b): b is string => !!b && b.trim() !== ''))].sort((a, b) => {
      const x = a.toLowerCase()
      const y = b.toLowerCase()
      return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0
    })
    return { ordinary: computeOrdinaryBrandWords(rows), brands }
  } catch (e) {
    console.error(
      '[brand-match] the brand catalog could not be loaded:',
      e instanceof Error ? e.message : e
    )
    return null
  }
}

/**
 * The catalog's brands and ordinary brand words, cached per server instance
 * for 6 hours; concurrent callers share one read.
 *
 * When the catalog cannot be read in full, the failure is logged, the last
 * good catalog is returned if this instance has one, and the read is not tried
 * again for a minute. With no catalog at all this returns null, and the search
 * then gives the brand bonus only to a brand typed in full.
 */
export async function loadBrandCatalog(db: BrandWordsDb): Promise<BrandCatalog | null> {
  const now = Date.now()
  if (catalogCache && now - catalogCache.at < CATALOG_TTL_MS) return catalogCache.catalog
  if (catalogFailedAt !== null && now - catalogFailedAt < CATALOG_RETRY_MS) return catalogCache?.catalog ?? null
  if (!catalogInFlight) {
    catalogInFlight = fetchBrandCatalog(db).then((catalog) => {
      catalogInFlight = null
      if (catalog) {
        catalogCache = { at: Date.now(), catalog }
        catalogFailedAt = null
        return catalog
      }
      catalogFailedAt = Date.now()
      return catalogCache?.catalog ?? null
    })
  }
  return catalogInFlight
}

/** Tests only. */
export function resetBrandCatalogCache(): void {
  catalogCache = null
  catalogFailedAt = null
  catalogInFlight = null
}

/**
 * Whether a request to SAVE a product names the brand of the catalog product
 * the resolver matched it to (Nov 11 2026).
 *
 * A member said she used "a foaming acne cleanser with salicylic acid". Saved
 * as the step "Salicylic acid foaming cleanser", every word of it appears in
 * Jumiso's "Pore Purifying Salicylic Acid Foaming Cleanser", so the resolver
 * called it a confident match and the routine was written with a product she
 * had never named. Her real cleanser was a different brand with a different
 * active. A description is not an identity.
 *
 * "Names the brand" is the SAME rule the search uses (brandBonusTerms), on
 * whole words: the brand typed in full ("dr jart", "drjart", "ma:nyo"), or one
 * of its words that is not an ordinary product-name word ("klairs" for Dear,
 * Klairs). A first version compared squashed strings; a second-model review
 * ran it and showed both failures of that: "Klairs Supple Preparation Facial
 * Toner" did NOT name Dear, Klairs, while "acne spot patch" DID name Acnes
 * and "cica therapy cream" named HERA. The brand may be given in its own
 * field or inside the name. With no catalog (it could not be read) only a
 * brand typed in full counts.
 *
 * There is deliberately NO "they gave the whole product name" route. One was
 * tried and a second review pass counted 104 catalog products whose whole name
 * is a one- or two-word description only one brand sells ("Bakuchiol Serum",
 * "PDRN Toner", "Rice Toner", "Soothing Cream"), each of which it would have
 * linked. After two rounds of tuning, the rule is the simple one: name the
 * brand, or pass the product_id from a search.
 */
export function brandIsNamed(
  matchedBrand: string | null | undefined,
  requestedName: string,
  requestedBrand: string | null | undefined,
  catalog: BrandCatalog | null
): boolean {
  const brandWords = brandTokens(matchedBrand ?? '')
  if (!matchedBrand || brandWords.length === 0) return false
  // The brand field holding exactly this brand names it, whatever the word is.
  // (A one-word brand that is also an ordinary word, like "Cure", is otherwise
  // never named by that word: "acne cure" is a description.)
  const given = brandTokens(requestedBrand ?? '')
  if (given.length === brandWords.length && given.every((w, i) => w === brandWords[i])) return true
  const tokens = brandTokens(`${requestedBrand ?? ''} ${requestedName}`)
  if (tokens.length === 0) return false
  const taken = wordsOfBrandsTypedInFull(catalog ? catalog.brands : [matchedBrand], tokens)
  // With no catalog nothing is known about which words are ordinary, so single
  // words of a longer brand are not accepted (singleWords false); the brand
  // typed in full still is, including a one-word brand ("cosrx").
  return brandBonusTerms(matchedBrand, tokens, tokens, (w) => (catalog ? catalog.ordinary.has(w) : false), catalog !== null, taken).size > 0
}
