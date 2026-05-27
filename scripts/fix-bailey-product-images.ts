import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const APPLY = process.argv.includes('--apply')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'

/**
 * Re-point 3 of Bailey's catalog products from dead/blocked brand-direct image
 * URLs (404/403) to their OWN, verified-reachable Olive Young CDN images.
 *
 * Discipline (v10.7.0 / v10.8.12): every replacement is the EXACT same product,
 * not a similar variant — sourced either from the same product's bundle SKU
 * (Green Tangerine) or from this product's own ss_product_staging scrape row
 * (PDRN Serum, Acne Pimple Master Patch). No wrong-product photos.
 *
 * Illiyoon Ceramide Ato Concentrate Cream is intentionally NOT included: it has
 * no staging image and no safe exact-match source. It stays NULL (a box icon)
 * until the deferred catalog-wide backfill, rather than borrowing a different
 * Illiyoon product's photo.
 */
const FIXES = [
  {
    product_id: 'f2948d93-6674-45dc-af27-545edfd4712d',
    label: 'Goodal — Green Tangerine Vita C Dark Spot Care Serum',
    deadUrl: 'image.yesstyle.com (403)',
    // This OY image 403s on the bare path — it requires the transform query
    // string. Keep the full URL; the /api/img proxy passes it through encoded.
    newUrl:
      'https://cdn-image.oliveyoung.com/prdtImg/1265/2620f83b-5aed-4a86-a107-1b948cce4301.jpg?RS=810x810&AR=0&SF=webp&QT=80',
    source: 'same serum, Olive Young listing (bundle SKU, identical product photo)',
  },
  {
    product_id: 'f2452824-63df-4885-93de-b4752dfa7a1f',
    label: 'Medicube — PDRN Pink Peptide Serum',
    deadUrl: 'medicube.us (404)',
    newUrl:
      'https://cdn-image.oliveyoung.com/prdtImg/1545/f8cd6671-5d86-46ce-9347-95435177eed9.jpg',
    source: 'exact product from ss_product_staging (Medicube PDRN Pink Peptide Serum 30ml)',
  },
  {
    product_id: '2c7c736f-0429-4971-a85e-f00519eb01f1',
    label: 'COSRX — Acne Pimple Master Patch',
    deadUrl: 'cosrx.com (404)',
    newUrl:
      'https://cdn-image.oliveyoung.com/prdtImg/1022/00c61b3d-21f2-4e7c-baa4-13ff954acaf5.jpg',
    source: 'exact product from ss_product_staging (COSRX Acne Pimple Master Patch 24 Count)',
  },
]

async function reachable(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'follow' })
    const ct = r.headers.get('content-type') || ''
    return r.status === 200 && (ct.startsWith('image/') || ct.includes('octet-stream'))
  } catch {
    return false
  }
}

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)

  for (const f of FIXES) {
    console.log(`\n=== ${f.label} ===`)
    console.log(`  was: ${f.deadUrl}`)
    console.log(`  new: ${f.newUrl}`)
    console.log(`  src: ${f.source}`)

    // Re-verify reachability at write time (don't write a URL that's gone dead since the scan)
    const ok = await reachable(f.newUrl)
    if (!ok) {
      console.log('  ✗ new URL not reachable right now — SKIP (refuse to write a dead URL)')
      continue
    }
    console.log('  image: REACHABLE ✓')

    // Confirm the product row still exists and its name matches expectation
    const { data: prod } = await db
      .from('ss_products')
      .select('id, brand_en, name_en, image_url')
      .eq('id', f.product_id)
      .maybeSingle()
    if (!prod) {
      console.log('  ✗ product row not found — SKIP')
      continue
    }
    console.log(`  target row confirmed: ${prod.brand_en} — ${prod.name_en}`)

    if (APPLY) {
      const { error } = await db
        .from('ss_products')
        .update({ image_url: f.newUrl })
        .eq('id', f.product_id)
      if (error) console.log(`  ✗ UPDATE failed: ${error.message}`)
      else console.log('  ✓ image_url updated.')
    } else {
      console.log('  (dry run — pass --apply to write)')
    }
  }
  console.log('\nDone.')
}
main()
