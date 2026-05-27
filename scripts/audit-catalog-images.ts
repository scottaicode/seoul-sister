import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'

async function reach(u: string): Promise<boolean> {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(10000) })
    const ct = r.headers.get('content-type') || ''
    return r.status === 200 && (ct.startsWith('image/') || ct.includes('octet-stream'))
  } catch {
    return false
  }
}

function host(u: string): string {
  try { return new URL(u).hostname } catch { return '(invalid)' }
}

async function pageAll(db: ReturnType<typeof createClient>, table: string, cols: string, filter?: (q: any) => any) {
  let all: any[] = []
  let from = 0
  while (true) {
    let q = db.from(table).select(cols).range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) { console.error(error.message); break }
    if (!data || data.length === 0) break
    all = all.concat(data)
    from += 1000
    if (data.length < 1000) break
  }
  return all
}

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)

  console.log('Loading catalog…')
  const products = await pageAll(db, 'ss_products', 'id, name_en, brand_en, image_url, is_verified')
  console.log(`Total products: ${products.length}`)

  const nullImg = products.filter((p) => !p.image_url)
  const withImg = products.filter((p) => p.image_url)
  console.log(`  null image_url:   ${nullImg.length}`)
  console.log(`  has image_url:    ${withImg.length}`)

  // Host distribution of products WITH a url — tells us where drift risk is
  const hostCount = new Map<string, number>()
  for (const p of withImg) {
    const h = host(p.image_url)
    hostCount.set(h, (hostCount.get(h) || 0) + 1)
  }
  console.log('\nHost distribution (products with image_url):')
  ;[...hostCount.entries()].sort((a, b) => b[1] - a[1]).forEach(([h, n]) => {
    console.log(`  ${String(n).padStart(5)}  ${h}`)
  })

  // Olive Young CDN is the reliable one; everything else is drift-prone.
  // SAMPLE reachability of the NON-Olive-Young urls (full check would be 10k requests).
  const nonOY = withImg.filter((p) => !host(p.image_url).includes('oliveyoung.com'))
  console.log(`\nNon-OliveYoung URLs (drift-prone): ${nonOY.length}`)
  const SAMPLE = Math.min(120, nonOY.length)
  // deterministic stride sample across the set
  const stride = Math.max(1, Math.floor(nonOY.length / SAMPLE))
  const sample = nonOY.filter((_, i) => i % stride === 0).slice(0, SAMPLE)
  let dead = 0
  let alive = 0
  const deadByHost = new Map<string, number>()
  console.log(`Sampling ${sample.length} of them for reachability…`)
  for (const p of sample) {
    const ok = await reach(p.image_url)
    if (ok) alive++
    else {
      dead++
      const h = host(p.image_url)
      deadByHost.set(h, (deadByHost.get(h) || 0) + 1)
    }
  }
  const deadRate = dead / sample.length
  console.log(`  sample alive: ${alive}  dead: ${dead}  (dead rate ${(deadRate * 100).toFixed(1)}%)`)
  console.log('  dead by host (in sample):')
  ;[...deadByHost.entries()].sort((a, b) => b[1] - a[1]).forEach(([h, n]) => console.log(`    ${n}  ${h}`))
  const estDead = Math.round(nonOY.length * deadRate)
  console.log(`\n  → ESTIMATED dead-URL products catalog-wide: ~${estDead} (of ${nonOY.length} non-OY)`)

  // How many of the broken set (null + estimated dead) are FIXABLE from staging?
  // Load staging product names→OY image map.
  console.log('\nLoading staging for fixability check…')
  const staging = await pageAll(db, 'ss_product_staging', 'raw_data')
  const stagingByName = new Map<string, string>() // normalized name -> reachable OY url (assume reachable; OY is reliable)
  for (const s of staging) {
    const rd = (s.raw_data as any) || {}
    const name = (rd.name_en || rd.name || '').toLowerCase().trim()
    const img = rd.image_url as string | undefined
    if (name && img && host(img).includes('oliveyoung.com')) {
      if (!stagingByName.has(name)) stagingByName.set(name, img)
    }
  }
  console.log(`  staging rows: ${staging.length}, with OY image: ${stagingByName.size}`)

  // Fixability: for null-image products, is there a staging row whose name shares
  // the brand + most tokens? (cheap heuristic — exact-name match first)
  function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() }
  const stagingNorm = new Map<string, string>()
  for (const [n, u] of stagingByName) stagingNorm.set(normalize(n), u)

  function findStagingImage(brand: string, name: string): boolean {
    const target = normalize(`${brand} ${name}`)
    const targetName = normalize(name)
    // exact-name match
    if (stagingNorm.has(targetName)) return true
    // contains match: a staging name that contains the product name or vice versa, sharing brand
    for (const [sn] of stagingNorm) {
      if ((sn.includes(targetName) || targetName.includes(sn)) && sn.includes(normalize(brand))) return true
    }
    // brand + first 3 tokens of name
    const toks = targetName.split(' ').filter((t) => t.length > 2).slice(0, 3)
    if (toks.length >= 2) {
      for (const [sn] of stagingNorm) {
        if (sn.includes(normalize(brand)) && toks.every((t) => sn.includes(t))) return true
      }
    }
    void target
    return false
  }

  let nullFixable = 0
  for (const p of nullImg) {
    if (findStagingImage(p.brand_en || '', p.name_en || '')) nullFixable++
  }
  console.log(`\nNull-image products fixable from staging (name match): ~${nullFixable} of ${nullImg.length}`)
  console.log(`Null-image NOT in staging (need live scrape or stay blank): ~${nullImg.length - nullFixable}`)

  console.log('\n=== SUMMARY ===')
  console.log(`Total products:        ${products.length}`)
  console.log(`Working OY images:     ${withImg.length - nonOY.length} (reliable)`)
  console.log(`Non-OY URLs:           ${nonOY.length}  (~${estDead} estimated DEAD/blank)`)
  console.log(`Null image_url:        ${nullImg.length}  (~${nullFixable} fixable from staging)`)
  console.log(`\nVerified products only:`)
  const vNull = nullImg.filter((p) => p.is_verified).length
  const vNonOY = nonOY.filter((p) => p.is_verified).length
  console.log(`  verified null:       ${vNull}`)
  console.log(`  verified non-OY url: ${vNonOY}  (~${Math.round(vNonOY * deadRate)} estimated dead)`)
}
main()
