/**
 * What's the image_url rate of products that came in via different pipeline
 * sources? Hypothesis: Olive Young pipeline products have ~100% image
 * coverage, v10.3.9 stub-enriched products have ~0% image coverage,
 * original Feb seed has whatever Bailey set manually.
 *
 * If true, the fix is to either (a) backfill images for the stub-enriched
 * cohort, or (b) prefer image-bearing products in the /browse candidate
 * ordering so the visual experience improves without backfilling everything.
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

  // Image coverage by creation date bucket — proxy for cohort
  console.log('## Image coverage by created_at bucket\n')

  const buckets = [
    { name: 'Feb 2026 (original seed)', start: '2026-02-01', end: '2026-02-28' },
    { name: 'March 2026', start: '2026-03-01', end: '2026-03-31' },
    { name: 'April 2026', start: '2026-04-01', end: '2026-04-30' },
    { name: 'May 1-7 2026 (incl v10.3.9 backfill May 7)', start: '2026-05-01', end: '2026-05-07' },
    { name: 'May 8+ 2026', start: '2026-05-08', end: '2026-05-31' },
  ]

  for (const b of buckets) {
    const { count: total } = await db
      .from('ss_products')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', true)
      .gte('created_at', b.start)
      .lte('created_at', b.end + 'T23:59:59')

    const { count: withImage } = await db
      .from('ss_products')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', true)
      .gte('created_at', b.start)
      .lte('created_at', b.end + 'T23:59:59')
      .not('image_url', 'is', null)
      .neq('image_url', '')

    const pct = total ? ((withImage! / total) * 100).toFixed(1) : '0'
    console.log(`  ${b.name}`)
    console.log(`    Total: ${total}  With image: ${withImage}  Coverage: ${pct}%`)
  }

  // What does the /browse default ordering actually return?
  console.log('\n## /browse default ordering — what comes back?\n')
  // The API does .eq('is_verified', true).limit(400) with no .order() — so
  // Supabase returns rows in primary key order (uuid created_at order is
  // not guaranteed, but in practice insertion order roughly correlates)
  const { data: first50 } = await db
    .from('ss_products')
    .select('id, image_url, brand_en, name_en, created_at')
    .eq('is_verified', true)
    .limit(50)

  let withImg = 0
  let withoutImg = 0
  for (const p of first50 || []) {
    const row = p as { image_url: string | null }
    if (row.image_url && row.image_url.trim().length > 0) withImg++
    else withoutImg++
  }
  console.log(`  First 50 rows in default order:`)
  console.log(`    With image: ${withImg}`)
  console.log(`    Without: ${withoutImg}`)
  console.log(`    Coverage: ${first50?.length ? ((withImg / first50.length) * 100).toFixed(1) : 0}%`)

  // What if we order by image_url desc (NULL last)?
  console.log('\n## Test: order by image_url (NULL last) — would this help?\n')
  const { data: ordered50 } = await db
    .from('ss_products')
    .select('id, image_url, brand_en, name_en')
    .eq('is_verified', true)
    .order('image_url', { ascending: false, nullsFirst: false })
    .limit(50)

  let orderedWithImg = 0
  for (const p of ordered50 || []) {
    const row = p as { image_url: string | null }
    if (row.image_url && row.image_url.trim().length > 0) orderedWithImg++
  }
  console.log(`  First 50 rows ordered by image_url (NULL last):`)
  console.log(`    With image: ${orderedWithImg}`)
  console.log(`    Coverage: ${ordered50?.length ? ((orderedWithImg / ordered50.length) * 100).toFixed(1) : 0}%`)

  // Total population we could order from
  const { count: totalNoImage } = await db
    .from('ss_products')
    .select('*', { count: 'exact', head: true })
    .eq('is_verified', true)
    .or('image_url.is.null,image_url.eq.')

  console.log(`\n  Total verified products WITHOUT image: ${totalNoImage}`)
  console.log(`  (Even with ordering, these would only appear when image-bearing pool is exhausted)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
