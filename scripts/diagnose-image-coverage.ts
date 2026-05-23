/**
 * Diagnose the image-display situation Bailey commented on.
 *
 * Three hypotheses to test:
 *   H1: Most verified products genuinely lack `image_url` in the DB.
 *   H2: Most have image_url but they point to broken/inaccessible CDN paths.
 *   H3: image_url is fine but the proxy is failing per product.
 *
 * Strategy:
 *   1. Count image_url coverage across the catalog overall, then across
 *      Bailey's specific /browse candidate set (verified=true, 400 limit).
 *   2. Sample 30 random product image_urls and curl them directly to see
 *      how many return 2xx with image bytes.
 *   3. Test the same 30 through /api/img proxy locally to see if proxy
 *      changes the success rate.
 *   4. Look at the URL host distribution — is the catalog overwhelmingly
 *      Olive Young CDN, or are there other CDNs that might be failing?
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dir, '..', '.env.local'), 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  if (!process.env[key]) process.env[key] = val
}

async function main() {
  const { getServiceClient } = await import('../src/lib/supabase')
  const db = getServiceClient()

  console.log('=== Image coverage diagnosis ===\n')

  // ----------------------------------------------------------------------
  // H1: Overall coverage stats
  // ----------------------------------------------------------------------
  console.log('## Coverage stats\n')

  const { count: totalVerified } = await db
    .from('ss_products')
    .select('*', { count: 'exact', head: true })
    .eq('is_verified', true)

  const { count: verifiedWithImage } = await db
    .from('ss_products')
    .select('*', { count: 'exact', head: true })
    .eq('is_verified', true)
    .not('image_url', 'is', null)
    .neq('image_url', '')

  console.log(`  Total verified products: ${totalVerified}`)
  console.log(`  Verified WITH image_url: ${verifiedWithImage}`)
  console.log(`  Coverage: ${totalVerified ? ((verifiedWithImage! / totalVerified) * 100).toFixed(1) : 0}%`)

  // /browse uses limit(400). What does the actual candidate set look like?
  const { data: browseCandidates } = await db
    .from('ss_products')
    .select('id, image_url, brand_en, name_en')
    .eq('is_verified', true)
    .limit(400)

  const browseTotal = browseCandidates?.length ?? 0
  const browseWithImage = (browseCandidates || []).filter((p) => {
    const url = (p as { image_url: string | null }).image_url
    return url && url.trim().length > 0
  }).length
  console.log(`\n  /browse candidate set (limit=400):`)
  console.log(`    Total: ${browseTotal}`)
  console.log(`    With image_url: ${browseWithImage}`)
  console.log(`    Coverage: ${browseTotal ? ((browseWithImage / browseTotal) * 100).toFixed(1) : 0}%`)

  // ----------------------------------------------------------------------
  // URL host distribution
  // ----------------------------------------------------------------------
  console.log('\n## URL host distribution (across candidate set with image_url)\n')

  const hostCounts = new Map<string, number>()
  const sampleByHost = new Map<string, string>()
  for (const c of browseCandidates || []) {
    const row = c as { image_url: string | null }
    if (!row.image_url) continue
    try {
      const u = new URL(row.image_url)
      hostCounts.set(u.hostname, (hostCounts.get(u.hostname) || 0) + 1)
      if (!sampleByHost.has(u.hostname)) sampleByHost.set(u.hostname, row.image_url)
    } catch {
      hostCounts.set('(invalid URL)', (hostCounts.get('(invalid URL)') || 0) + 1)
    }
  }

  const sortedHosts = Array.from(hostCounts.entries()).sort((a, b) => b[1] - a[1])
  for (const [host, count] of sortedHosts) {
    console.log(`  ${count.toString().padStart(4)} — ${host}`)
    const sample = sampleByHost.get(host)
    if (sample) console.log(`         sample: ${sample.slice(0, 100)}`)
  }

  // ----------------------------------------------------------------------
  // H2: Test the actual image URLs — are they reachable?
  // ----------------------------------------------------------------------
  console.log('\n## Reachability sample — 30 random image_urls, direct fetch\n')

  // Pick 30 random products from the candidate set with image_url
  const productsWithImages = (browseCandidates || []).filter((p) => {
    const url = (p as { image_url: string | null }).image_url
    return url && url.trim().length > 0
  })

  // Shuffle and take 30
  const shuffled = [...productsWithImages].sort(() => Math.random() - 0.5).slice(0, 30)

  let direct200 = 0
  let direct200WithImageBytes = 0
  let directOther = 0
  let directNetwork = 0
  const failureReasons: Array<{ url: string; reason: string }> = []
  const successContentTypes = new Map<string, number>()

  for (const p of shuffled) {
    const row = p as { id: string; image_url: string; brand_en: string; name_en: string }
    try {
      const res = await fetch(row.image_url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        redirect: 'follow',
      })
      const ct = res.headers.get('content-type') || '(none)'
      successContentTypes.set(ct, (successContentTypes.get(ct) || 0) + 1)
      if (res.status === 200) {
        direct200++
        if (ct.startsWith('image/') || ct === 'application/octet-stream') {
          direct200WithImageBytes++
        }
      } else {
        directOther++
        failureReasons.push({ url: row.image_url.slice(0, 80), reason: `HTTP ${res.status}` })
      }
    } catch (err) {
      directNetwork++
      failureReasons.push({
        url: row.image_url.slice(0, 80),
        reason: `Network: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  console.log(`  Sample size: ${shuffled.length}`)
  console.log(`  HTTP 200: ${direct200}`)
  console.log(`  HTTP 200 with image bytes (image/* or octet-stream): ${direct200WithImageBytes}`)
  console.log(`  Other HTTP status: ${directOther}`)
  console.log(`  Network errors: ${directNetwork}`)

  console.log('\n  Content-Type distribution on responses:')
  for (const [ct, count] of Array.from(successContentTypes.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${count.toString().padStart(3)} — ${ct}`)
  }

  if (failureReasons.length > 0) {
    console.log('\n  Failure breakdown:')
    for (const f of failureReasons.slice(0, 10)) {
      console.log(`    [${f.reason}] ${f.url}`)
    }
  }

  // ----------------------------------------------------------------------
  // Check that v10.8.3 proxy allowlist actually covers the dominant hosts
  // ----------------------------------------------------------------------
  console.log('\n## Proxy allowlist coverage check\n')
  const { readFileSync: rfs } = await import('fs')
  const proxyHelperPath = resolve(__dir, '..', 'src', 'lib', 'utils', 'image-proxy.ts')
  let allowlistHosts: string[] = []
  try {
    const helperSrc = rfs(proxyHelperPath, 'utf-8')
    // Extract the hostname allowlist — naive but works for our format
    const allowlistMatch = helperSrc.match(/PROXIED_HOSTS[^=]*=\s*\[([^\]]+)\]/m)
    if (allowlistMatch) {
      allowlistHosts = allowlistMatch[1]
        .split(',')
        .map((s) => s.replace(/['"\s]/g, ''))
        .filter(Boolean)
      console.log(`  Allowlist hosts (${allowlistHosts.length}):`)
      for (const h of allowlistHosts) console.log(`    - ${h}`)
    }
  } catch (e) {
    console.log(`  Could not read proxy helper: ${e instanceof Error ? e.message : e}`)
  }

  console.log('\n  Host coverage check:')
  for (const [host, count] of sortedHosts) {
    const covered = allowlistHosts.some((h) => host === h || host.endsWith(`.${h}`))
    console.log(`    ${covered ? '✓' : '✗'} ${count.toString().padStart(4)} ${host}`)
  }

  console.log('\n=== Done ===')
}

main().catch((e) => { console.error(e); process.exit(1) })
