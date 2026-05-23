/**
 * Confirm the v10.8.7 ordering hypothesis: ascending=false sorted URL STRINGS
 * descending, putting brand-direct slug-based URLs (unreliable) ahead of
 * Olive Young content-hashed CDN URLs (reliable).
 *
 * If true: v10.8.7 ordering is structurally wrong. The fix is either to drop
 * the ordering entirely (back to query-plan luck, accept 43.8% coverage),
 * order by a different proxy column, or use NULLS LAST without value ordering.
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

  console.log('## Distribution of image_url hosts in first 50 candidates under v10.8.7 ordering')
  console.log('   (ascending=false → descending alphabetical sort of URL string)\n')

  const { data: rows } = await db
    .from('ss_products')
    .select('image_url')
    .eq('is_verified', true)
    .order('image_url', { ascending: false, nullsFirst: false })
    .limit(50)

  const hostCounts = new Map<string, number>()
  for (const r of rows || []) {
    const url = (r as { image_url: string | null }).image_url
    if (!url) {
      hostCounts.set('(null)', (hostCounts.get('(null)') || 0) + 1)
      continue
    }
    try {
      const host = new URL(url).hostname
      hostCounts.set(host, (hostCounts.get(host) || 0) + 1)
    } catch {
      hostCounts.set('(invalid)', (hostCounts.get('(invalid)') || 0) + 1)
    }
  }

  for (const [host, count] of Array.from(hostCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(3)} — ${host}`)
  }

  console.log('\n## Same query with ascending=TRUE')
  console.log('   (ascending alphabetical sort of URL string)\n')

  const { data: ascRows } = await db
    .from('ss_products')
    .select('image_url')
    .eq('is_verified', true)
    .order('image_url', { ascending: true, nullsFirst: false })
    .limit(50)

  const ascHostCounts = new Map<string, number>()
  for (const r of ascRows || []) {
    const url = (r as { image_url: string | null }).image_url
    if (!url) {
      ascHostCounts.set('(null)', (ascHostCounts.get('(null)') || 0) + 1)
      continue
    }
    try {
      const host = new URL(url).hostname
      ascHostCounts.set(host, (ascHostCounts.get(host) || 0) + 1)
    } catch {
      ascHostCounts.set('(invalid)', (ascHostCounts.get('(invalid)') || 0) + 1)
    }
  }

  for (const [host, count] of Array.from(ascHostCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(3)} — ${host}`)
  }

  // Test reachability of the first 30 from v10.8.7 (DESC) ordering
  console.log('\n## Reachability of first 30 image_urls under v10.8.7 (DESC) ordering')
  let ok = 0
  let bad = 0
  const samples: string[] = []
  for (const r of (rows || []).slice(0, 30)) {
    const url = (r as { image_url: string | null }).image_url
    if (!url) continue
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      })
      if (res.status === 200) {
        ok++
      } else {
        bad++
        samples.push(`HTTP ${res.status}: ${url.slice(0, 80)}`)
      }
    } catch (e) {
      bad++
      samples.push(`error: ${url.slice(0, 80)}`)
    }
  }
  console.log(`  OK (HTTP 200): ${ok}`)
  console.log(`  Failed: ${bad}`)
  for (const s of samples.slice(0, 10)) console.log(`    ${s}`)

  // Same test, ASC ordering
  console.log('\n## Reachability of first 30 image_urls under ASC ordering')
  let asc_ok = 0
  let asc_bad = 0
  const asc_samples: string[] = []
  for (const r of (ascRows || []).slice(0, 30)) {
    const url = (r as { image_url: string | null }).image_url
    if (!url) continue
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      })
      if (res.status === 200) {
        asc_ok++
      } else {
        asc_bad++
        asc_samples.push(`HTTP ${res.status}: ${url.slice(0, 80)}`)
      }
    } catch (e) {
      asc_bad++
      asc_samples.push(`error: ${url.slice(0, 80)}`)
    }
  }
  console.log(`  OK (HTTP 200): ${asc_ok}`)
  console.log(`  Failed: ${asc_bad}`)
  for (const s of asc_samples.slice(0, 10)) console.log(`    ${s}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
