import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Product image health — detect & repair blank product images.
 *
 * Two blank-image causes are repairable here (see PRODUCT-IMAGE-HEALTH.md §2):
 *   - DEAD url:  image_url is set but 404/403s at origin (brand-direct / Shopify
 *                / YesStyle drift). The *silent* bug — renders blank, no error.
 *   - NULL:      image_url is empty.
 *
 * Repair = re-point to the product's OWN Olive Young CDN image from
 * ss_product_staging (content-hashed, reliable). Strict matcher enforces the
 * wrong-product discipline (§3): a box icon beats a wrong photo.
 *
 * This module backs both:
 *   - the daily image-health cron (bounded batch per 60s run), and
 *   - scripts/backfill-catalog-images.ts (full catalog, manual).
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'

// Product-category words — if a candidate staging name introduces a category
// word the product doesn't have (or vice versa), it's likely a DIFFERENT product
// (e.g. "Cream" vs "Cream Cleanser"), so the match is rejected.
const CAT_WORDS = [
  'serum', 'cream', 'toner', 'essence', 'ampoule', 'oil', 'mask', 'cleanser',
  'foam', 'lotion', 'pad', 'mist', 'balm', 'gel', 'patch', 'sheet', 'water',
  'cushion', 'powder',
]
// Multi-product bundle markers — staging photo may show the wrong item.
const BUNDLE_RE = /\bset\b|\bdouble pack\b|\+|\bspecial\b|\bgift\b|\bduo\b|\btrio\b/

function host(u: string): string {
  try { return new URL(u).hostname } catch { return '' }
}
function isOliveYoung(u: string): boolean {
  return host(u).includes('oliveyoung.com')
}
function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}
function catWordsOf(s: string): Set<string> {
  return new Set(CAT_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(s)))
}

const reachCache = new Map<string, boolean>()
/** True if the URL returns 200 with image bytes (or octet-stream from Olive Young). */
export async function imageReachable(url: string): Promise<boolean> {
  if (reachCache.has(url)) return reachCache.get(url)!
  let ok = false
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    const ct = r.headers.get('content-type') || ''
    ok = r.status === 200 && (ct.startsWith('image/') || ct.includes('octet-stream'))
  } catch {
    ok = false
  }
  reachCache.set(url, ok)
  return ok
}

// ---------------------------------------------------------------------------
// Staging image index
// ---------------------------------------------------------------------------

export interface StagingImage { name: string; brand: string; url: string }

/** Paginate a full table (PostgREST caps at 1000/req — v10.8.6 lesson). */
async function pageAll(db: SupabaseClient, table: string, cols: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = []
  let from = 0
  for (;;) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999)
    if (error || !data || data.length === 0) break
    all.push(...(data as unknown as Record<string, unknown>[]))
    from += 1000
    if (data.length < 1000) break
  }
  return all
}

/** Build an index of staging products that carry an Olive Young image. */
export async function loadStagingImageIndex(db: SupabaseClient): Promise<{
  images: StagingImage[]
  exact: Map<string, string>
}> {
  const staging = await pageAll(db, 'ss_product_staging', 'raw_data')
  const images: StagingImage[] = []
  for (const s of staging) {
    const rd = (s.raw_data as Record<string, unknown> | null) || {}
    const name = (rd.name_en as string) || (rd.name as string) || ''
    const brand = (rd.brand_en as string) || (rd.brand as string) || ''
    const url = rd.image_url as string | undefined
    if (name && url && isOliveYoung(url)) {
      images.push({ name: normalize(name), brand: normalize(brand), url })
    }
  }
  const exact = new Map<string, string>()
  for (const s of images) if (!exact.has(s.name)) exact.set(s.name, s.url)
  return { images, exact }
}

/**
 * STRICT match: return a staging Olive Young url for a product, or null.
 * Exact-name match, or containment-match only when brand matches, staging isn't
 * a bundle (unless product is), and category-word sets are identical. (§3)
 */
export function matchStagingImage(
  index: { images: StagingImage[]; exact: Map<string, string> },
  brand: string,
  name: string,
): string | null {
  const pName = normalize(name)
  const pBrand = normalize(brand)
  if (!pName) return null

  const exact = index.exact.get(pName)
  if (exact) return exact

  if (!pBrand) return null
  const pCats = catWordsOf(pName)
  const pIsBundle = BUNDLE_RE.test(pName)
  let best: { url: string; len: number } | null = null
  for (const s of index.images) {
    if (!s.brand.includes(pBrand) && !pBrand.includes(s.brand)) continue
    const contains = s.name.includes(pName) || pName.includes(s.name)
    if (!contains) continue
    if (!pIsBundle && BUNDLE_RE.test(s.name)) continue
    const sCats = catWordsOf(s.name)
    const catsEqual = pCats.size === sCats.size && [...pCats].every((c) => sCats.has(c))
    if (!catsEqual) continue
    const len = Math.abs(s.name.length - pName.length)
    if (!best || len < best.len) best = { url: s.url, len }
  }
  return best?.url ?? null
}

// ---------------------------------------------------------------------------
// Repair run
// ---------------------------------------------------------------------------

export interface ImageHealthResult {
  scanned: number            // products examined this run
  deadDetected: number       // had a url, but it was dead (404/403)
  nullDetected: number       // had no url
  fixed: number              // re-pointed to a reachable staging OY image
  unfixableDead: number      // dead url, no staging match (need live scrape)
  unfixableNull: number      // null, no staging match (need live scrape)
  staleStaging: number       // staging match existed but its url was also dead
  /** Sample of products that couldn't be fixed — makes the silent bug VISIBLE. */
  unfixableSample: { id: string; brand: string; name: string; reason: 'dead' | 'null' }[]
}

interface RepairOptions {
  /** Max products to EXAMINE per run (caps network time). Cron passes a small N. */
  limit?: number
  /** When true, write changes. Default false (dry run). */
  apply?: boolean
  /**
   * Cursor: only examine products whose id is > afterId (keyset pagination so the
   * cron walks the catalog across runs instead of re-checking the same head every
   * time). Returns the last id examined so the caller can persist it.
   */
  afterId?: string | null
}

/**
 * Examine a batch of products, repair blank images where a safe staging match
 * exists, and report what couldn't be fixed.
 *
 * Olive Young urls are assumed reliable and skipped (no network check) — only
 * NULL and non-OY urls are examined. This keeps the per-run network cost bounded
 * to the drift-prone minority.
 */
export async function runImageHealthRepair(
  db: SupabaseClient,
  opts: RepairOptions = {},
): Promise<ImageHealthResult & { lastIdExamined: string | null }> {
  const { limit = 150, apply = false, afterId = null } = opts

  const index = await loadStagingImageIndex(db)

  // Pull a window of products ordered by id (keyset cursor). We over-fetch a bit
  // because most rows will be OY-reliable and skipped without counting toward the
  // examine budget.
  let q = db
    .from('ss_products')
    .select('id, name_en, brand_en, image_url')
    .order('id', { ascending: true })
    .limit(Math.max(limit * 6, 600))
  if (afterId) q = q.gt('id', afterId)
  const { data: products } = await q

  const result: ImageHealthResult & { lastIdExamined: string | null } = {
    scanned: 0,
    deadDetected: 0,
    nullDetected: 0,
    fixed: 0,
    unfixableDead: 0,
    unfixableNull: 0,
    staleStaging: 0,
    unfixableSample: [],
    lastIdExamined: afterId,
  }

  let examined = 0
  for (const p of (products as { id: string; name_en: string | null; brand_en: string | null; image_url: string | null }[]) || []) {
    result.lastIdExamined = p.id
    // OY urls are reliable — skip without spending examine budget.
    if (p.image_url && isOliveYoung(p.image_url)) continue

    if (examined >= limit) break
    examined++

    const reason: 'dead' | 'null' = p.image_url ? 'dead' : 'null'
    if (reason === 'dead') {
      const ok = await imageReachable(p.image_url as string)
      if (ok) continue // non-OY but still alive — leave it
      result.deadDetected++
    } else {
      result.nullDetected++
    }

    const candidate = matchStagingImage(index, p.brand_en || '', p.name_en || '')
    if (!candidate) {
      if (reason === 'dead') result.unfixableDead++
      else result.unfixableNull++
      if (result.unfixableSample.length < 50) {
        result.unfixableSample.push({ id: p.id, brand: p.brand_en || '', name: p.name_en || '', reason })
      }
      continue
    }

    const candidateOk = await imageReachable(candidate)
    if (!candidateOk) { result.staleStaging++; continue }

    if (apply) {
      const { error } = await db.from('ss_products').update({ image_url: candidate }).eq('id', p.id)
      if (!error) result.fixed++
    } else {
      result.fixed++
    }
  }

  result.scanned = examined
  return result
}
