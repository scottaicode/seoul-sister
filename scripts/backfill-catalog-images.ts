import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

/**
 * Catalog-wide image backfill (v10.8.13).
 *
 * Fixes two buckets of blank product images by re-pointing to each product's
 * OWN Olive Young CDN image sourced from ss_product_staging (the original
 * scrape data — reliable, content-hashed URLs):
 *   1. DEAD URLs   — product has an image_url but it 404/403s at origin
 *                    (brand-direct/Shopify/YesStyle drift; ~62% dead rate).
 *   2. NULL images — product has no image_url at all.
 *
 * SAFETY (earned across v10.7.0 / v10.8.12 wrong-product incidents):
 *   - STRICT name match: a staging row only matches a product when their
 *     normalized names are equal, or one fully contains the other AND the
 *     brand matches. No loose token matching — a box icon beats a wrong photo.
 *   - Reachability verified at write time. Never writes a URL that isn't 200.
 *   - Only touches products whose current image is dead or null. Never
 *     overwrites a working image.
 *   - Dry-run by default. --apply to write. --sample N to limit (testing).
 *
 * Run:  npx tsx --tsconfig tsconfig.json scripts/backfill-catalog-images.ts
 *       npx tsx --tsconfig tsconfig.json scripts/backfill-catalog-images.ts --apply
 */

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const APPLY = process.argv.includes('--apply')
const sampleArg = process.argv.find((a) => a.startsWith('--sample='))
const SAMPLE_LIMIT = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : Infinity

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'

const reachCache = new Map<string, boolean>()
async function reach(u: string): Promise<boolean> {
  if (reachCache.has(u)) return reachCache.get(u)!
  let ok = false
  try {
    const r = await fetch(u, {
      headers: { 'User-Agent': UA, Accept: 'image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })
    const ct = r.headers.get('content-type') || ''
    ok = r.status === 200 && (ct.startsWith('image/') || ct.includes('octet-stream'))
  } catch {
    ok = false
  }
  reachCache.set(u, ok)
  return ok
}

function host(u: string): string {
  try { return new URL(u).hostname } catch { return '' }
}
function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pageAll(db: any, table: string, cols: string) {
  let all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999)
    if (error) { console.error(`[${table}]`, error.message); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    from += 1000
    if (data.length < 1000) break
  }
  return all
}

interface StagingImg { name: string; brand: string; url: string }

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)

  console.log(`Mode: ${APPLY ? 'APPLY (writes)' : 'DRY RUN'}${SAMPLE_LIMIT !== Infinity ? `  sample=${SAMPLE_LIMIT}` : ''}\n`)

  // 1. Build staging name → OY image index (only Olive Young CDN urls — the reliable source)
  console.log('Indexing ss_product_staging…')
  const staging = await pageAll(db, 'ss_product_staging', 'raw_data')
  const stagingImgs: StagingImg[] = []
  for (const s of staging) {
    const rd = (s.raw_data as any) || {}
    const name = rd.name_en || rd.name || ''
    const brand = rd.brand_en || rd.brand || ''
    const url = rd.image_url as string | undefined
    if (name && url && host(url).includes('oliveyoung.com')) {
      stagingImgs.push({ name: normalize(name), brand: normalize(brand), url })
    }
  }
  // exact-name index (first url wins)
  const exactIdx = new Map<string, string>()
  for (const s of stagingImgs) if (!exactIdx.has(s.name)) exactIdx.set(s.name, s.url)
  console.log(`  staging OY images: ${stagingImgs.length} (${exactIdx.size} distinct names)\n`)

  // 2. Load all products; classify each as dead / null / ok
  console.log('Loading catalog…')
  const products = await pageAll(db, 'ss_products', 'id, name_en, brand_en, image_url')
  console.log(`  products: ${products.length}\n`)

  // Product-category words — if the staging name introduces a category word the
  // product name doesn't have (or vice versa), it's likely a DIFFERENT product
  // (e.g. "Cream" → "Cream Cleanser", "Lotion" → "Toner ... Lotion Set"), so we
  // reject the containment match. Exact-name matches are always safe.
  const CAT_WORDS = ['serum', 'cream', 'toner', 'essence', 'ampoule', 'oil', 'mask',
    'cleanser', 'foam', 'lotion', 'pad', 'mist', 'balm', 'gel', 'patch', 'sheet', 'water', 'cushion', 'powder']
  // Bundle markers — a staging name with these is a multi-product SKU whose photo
  // may show the wrong item. Reject unless the product name itself is a bundle.
  const BUNDLE_RE = /\bset\b|\bdouble pack\b|\+|\bspecial\b|\bgift\b|\bduo\b|\btrio\b/

  function catWordsOf(s: string): Set<string> {
    return new Set(CAT_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(s)))
  }

  // STRICT match: returns a staging OY url for a product, or null.
  function matchStaging(brand: string, name: string): string | null {
    const pName = normalize(name)
    const pBrand = normalize(brand)
    if (!pName) return null
    // a) exact name — always safe
    const exact = exactIdx.get(pName)
    if (exact) return exact
    // b) containment + brand match, but ONLY when category words match exactly
    //    and the staging row isn't a multi-product bundle the product isn't.
    const pCats = catWordsOf(pName)
    const pIsBundle = BUNDLE_RE.test(pName)
    let best: { url: string; len: number } | null = null
    for (const s of stagingImgs) {
      if (!pBrand) continue
      if (!s.brand.includes(pBrand) && !pBrand.includes(s.brand)) continue
      const contains = s.name.includes(pName) || pName.includes(s.name)
      if (!contains) continue
      // reject bundle staging rows unless the product is itself a bundle
      if (!pIsBundle && BUNDLE_RE.test(s.name)) continue
      // reject when category-word sets differ (different product type)
      const sCats = catWordsOf(s.name)
      const catsEqual = pCats.size === sCats.size && [...pCats].every((c) => sCats.has(c))
      if (!catsEqual) continue
      const len = Math.abs(s.name.length - pName.length)
      if (!best || len < best.len) best = { url: s.url, len }
    }
    return best?.url ?? null
  }

  // Determine which products need fixing
  const candidates: { id: string; brand: string; name: string; reason: 'dead' | 'null'; cur: string | null }[] = []
  console.log('Classifying current images (checking reachability of non-OY urls)…')
  let checked = 0
  for (const p of products) {
    if (!p.image_url) {
      candidates.push({ id: p.id, brand: p.brand_en, name: p.name_en, reason: 'null', cur: null })
      continue
    }
    // Olive Young urls are reliable — assume OK, skip the network check
    if (host(p.image_url).includes('oliveyoung.com')) continue
    // Non-OY: check reachability
    checked++
    const ok = await reach(p.image_url)
    if (!ok) candidates.push({ id: p.id, brand: p.brand_en, name: p.name_en, reason: 'dead', cur: p.image_url })
  }
  console.log(`  reachability-checked ${checked} non-OY urls`)
  const deadCount = candidates.filter((c) => c.reason === 'dead').length
  const nullCount = candidates.filter((c) => c.reason === 'null').length
  console.log(`  blank products: ${candidates.length} (dead: ${deadCount}, null: ${nullCount})\n`)

  // 3. For each candidate, find a staging image, verify it, write it
  let fixed = 0
  let noMatch = 0
  let staleStaging = 0
  const examples: string[] = []
  let processed = 0

  for (const c of candidates) {
    if (processed >= SAMPLE_LIMIT) break
    processed++

    const url = matchStaging(c.brand || '', c.name || '')
    if (!url) { noMatch++; continue }

    const ok = await reach(url)
    if (!ok) { staleStaging++; continue }

    if (examples.length < 25) {
      examples.push(`  [${c.reason}] ${c.brand} — ${c.name}\n        → ${url.slice(0, 90)}`)
    }

    if (APPLY) {
      const { error } = await db.from('ss_products').update({ image_url: url }).eq('id', c.id)
      if (!error) fixed++
      else console.error(`  ✗ ${c.id}: ${error.message}`)
    } else {
      fixed++ // count would-be fixes
    }
  }

  console.log('Sample of matches (eyeball for wrong-product pairings):')
  console.log(examples.join('\n'))

  console.log('\n=== RESULT ===')
  console.log(`Candidates processed:   ${processed}`)
  console.log(`${APPLY ? 'Fixed' : 'Would fix'}:              ${fixed}`)
  console.log(`No staging match:       ${noMatch}  (stay blank — need live scrape)`)
  console.log(`Staging url now dead:   ${staleStaging}  (skipped — refused to write dead url)`)
  if (!APPLY) console.log('\n(dry run — pass --apply to write)')
}
main()
