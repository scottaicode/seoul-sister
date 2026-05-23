/**
 * Inspect what the API ACTUALLY returns to the client for a fit/skipped product.
 * Goal: confirm image_url is present in the response payload, or find where
 * it's getting dropped between DB query → client.
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

  // Simulate the exact flow: candidate query → fits IDs → final fetch
  console.log('## Step 1: candidate query (skinny — only id, category, name_en)')
  const { data: candidates } = await db
    .from('ss_products')
    .select('id, category, name_en')
    .eq('is_verified', true)
    .order('image_url', { ascending: false, nullsFirst: false })
    .limit(20)
  console.log(`  Candidates: ${candidates?.length}`)
  console.log(`  First candidate keys: ${candidates?.[0] ? Object.keys(candidates[0]).join(', ') : '(none)'}`)
  console.log(`  First candidate sample: ${JSON.stringify(candidates?.[0], null, 2)}`)

  // Now do the final fetch for ALL columns including image_url
  console.log('\n## Step 2: final fetch (.select(*) for full records)')
  const candidateIds = (candidates || []).map((r) => (r as { id: string }).id)
  const { data: prods } = await db
    .from('ss_products')
    .select('*')
    .in('id', candidateIds)
  console.log(`  Products: ${prods?.length}`)
  console.log(`  First product keys: ${prods?.[0] ? Object.keys(prods[0]).join(', ') : '(none)'}`)

  const withImage = (prods || []).filter((p) => {
    const url = (p as { image_url: string | null }).image_url
    return url && url.trim().length > 0
  })
  console.log(`  With image_url populated: ${withImage.length} / ${prods?.length}`)
  console.log(`\n  Sample image_url values:`)
  for (const p of withImage.slice(0, 5)) {
    const row = p as { name_en: string; image_url: string }
    console.log(`    ${row.name_en}: ${row.image_url}`)
  }

  console.log('\n## Step 3: products WITHOUT image_url in this sample')
  const withoutImage = (prods || []).filter((p) => {
    const url = (p as { image_url: string | null }).image_url
    return !url || url.trim().length === 0
  })
  console.log(`  Count: ${withoutImage.length}`)
  for (const p of withoutImage.slice(0, 10)) {
    const row = p as { name_en: string; brand_en: string; image_url: string | null }
    console.log(`    ${row.brand_en} ${row.name_en}: image_url=${JSON.stringify(row.image_url)}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
