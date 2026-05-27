import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const BAILEY = '551569d3-aed0-4feb-a340-47bfb146a835'
const APPLY = process.argv.includes('--apply')

// The 4 custom-entry library rows that are actually real catalog products.
// We search the catalog by brand + distinctive name tokens, require ALL tokens
// to appear, and require the matched product to have a non-null image_url.
// Never attach a product whose name doesn't clearly match (v10.7.0 resolver
// discipline — a wrong-product link is worse than a box icon).
const TARGETS = [
  {
    label: 'Anua Heartleaf 70% Rice Ceramide Serum',
    brand: 'Anua',
    mustInclude: ['heartleaf', 'rice'], // distinctive tokens
    category: 'serum',
  },
  {
    label: 'Medicube PDRN Pink Peptide Eye Cream',
    brand: 'Medicube',
    mustInclude: ['pdrn', 'eye'],
    category: 'eye_care',
  },
  {
    label: 'Hero Mighty Patches',
    brand: 'Hero',
    mustInclude: ['mighty', 'patch'],
    category: null, // US brand, may not be in K-beauty catalog
  },
  {
    label: 'Ma:nyo Pure Cleansing Oil',
    brand: 'ma:nyo', // catalog stores the brand with the colon
    mustInclude: ['pure', 'cleansing', 'oil'],
    category: null,
  },
]

interface Candidate {
  id: string
  name_en: string
  brand_en: string
  image_url: string | null
  category: string | null
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'

async function urlReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/*' },
      redirect: 'follow',
    })
    const ct = res.headers.get('content-type') || ''
    // Olive Young serves octet-stream but is a valid image; accept 200 with
    // image/* OR octet-stream from the known reliable CDN.
    return res.status === 200 && (ct.startsWith('image/') || ct.includes('octet-stream'))
  } catch {
    return false
  }
}

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Find Bailey's custom-entry owned rows (NULL product_id, not discarded)
  const { data: owned } = await db
    .from('ss_user_products')
    .select('id, custom_name, custom_brand')
    .eq('user_id', BAILEY)
    .is('product_id', null)
    .neq('status', 'discarded')

  console.log(`Bailey has ${owned?.length ?? 0} custom-entry owned rows.\n`)

  for (const target of TARGETS) {
    console.log(`\n=== ${target.label} ===`)

    // Find the matching custom-entry row to relink
    const row = (owned ?? []).find((o) => {
      const name = (o.custom_name || '').toLowerCase()
      return target.mustInclude.every((t) => name.includes(t))
    })
    if (!row) {
      console.log('  ⚠ No matching custom-entry row in Bailey library — skip.')
      continue
    }

    // Search catalog by brand, then post-filter ALL tokens + require image
    const { data: cands } = await db
      .from('ss_products')
      .select('id, name_en, brand_en, image_url, category')
      .ilike('brand_en', `%${target.brand}%`)
      .limit(50)

    const matches = (cands ?? []).filter((c: Candidate) => {
      const hay = `${c.brand_en} ${c.name_en}`.toLowerCase()
      return target.mustInclude.every((t) => hay.includes(t))
    }) as Candidate[]

    if (matches.length === 0) {
      console.log(`  ✗ No catalog match for brand="${target.brand}" tokens=[${target.mustInclude}] — leave as custom entry.`)
      continue
    }

    // Prefer a match WITH a reachable image; among those, shortest name (closest fit)
    const withImg = matches.filter((m) => m.image_url)
    const pool = withImg.length > 0 ? withImg : matches
    pool.sort((a, b) => `${a.brand_en} ${a.name_en}`.length - `${b.brand_en} ${b.name_en}`.length)

    // Verify the chosen image actually loads before committing
    let chosen: Candidate | null = null
    for (const cand of pool) {
      if (!cand.image_url) continue
      const ok = await urlReachable(cand.image_url)
      console.log(`  candidate: ${cand.brand_en} — ${cand.name_en}`)
      console.log(`      image: ${ok ? 'REACHABLE ✓' : 'dead ✗'} ${cand.image_url}`)
      if (ok) {
        chosen = cand
        break
      }
    }

    if (!chosen) {
      console.log('  ✗ No candidate with a REACHABLE image — leaving as custom entry (a box icon beats a wrong/dead link).')
      continue
    }

    console.log(`  → RELINK row ${row.id} ("${row.custom_name}") → product ${chosen.id} (${chosen.brand_en} — ${chosen.name_en})`)

    if (APPLY) {
      const { error } = await db
        .from('ss_user_products')
        .update({ product_id: chosen.id })
        .eq('id', row.id)
        .eq('user_id', BAILEY)
      if (error) console.log(`  ✗ UPDATE failed: ${error.message}`)
      else console.log('  ✓ Relinked.')
    } else {
      console.log('  (dry run — pass --apply to write)')
    }
  }

  console.log('\nDone.')
}
main()
