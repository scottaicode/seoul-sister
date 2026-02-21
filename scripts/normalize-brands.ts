import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dir, '..', '.env.local'), 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Canonical brand names: [canonical, ...variants_to_fix]
// Title Case brands
const titleCaseBrands = [
  'Beplain', 'Banila Co', 'Round Lab', 'Skinfood', 'The Face Shop',
  'Innisfree', 'Some By Mi', 'Laneige', 'Aestura', 'Jumiso',
  'Etude', 'Hanyul', 'Makeprem', 'Medi-Peel', 'Biodance',
  'Illiyoon', 'Frudia', 'Bringgreen', 'Rovectin', 'Sungboon Editor',
  'Rejuran', 'Skin&Lab', 'Fully', 'Dear, Klairs', 'Beyond',
  'Graymelin', 'Easydew', "Pond's", 'Numbuzin',
]

// Official non-standard casing brands
const specialCaseBrands: Record<string, string> = {
  "ma:nyo": "ma:nyo",
  "ilso": "ilso",
  "mixsoon": "mixsoon",
  "belif": "belif",
  "ongredients": "ongredients",
  "iunik": "iUNIK",
  "skin1004": "SKIN1004",
  "i'm from": "I'm From",
}

async function main() {
  let totalUpdated = 0

  // Normalize title case brands
  for (const canonical of titleCaseBrands) {
    const { data, error } = await sb
      .from('ss_products')
      .update({ brand_en: canonical })
      .ilike('brand_en', canonical)
      .neq('brand_en', canonical)
      .select('id')

    const count = data?.length ?? 0
    if (count > 0) {
      console.log(`  ${canonical}: ${count} rows fixed`)
      totalUpdated += count
    }
    if (error) console.error(`  Error on ${canonical}: ${error.message}`)
  }

  // Normalize special case brands
  for (const [lowerKey, canonical] of Object.entries(specialCaseBrands)) {
    const { data, error } = await sb
      .from('ss_products')
      .update({ brand_en: canonical })
      .ilike('brand_en', lowerKey)
      .neq('brand_en', canonical)
      .select('id')

    const count = data?.length ?? 0
    if (count > 0) {
      console.log(`  ${canonical}: ${count} rows fixed`)
      totalUpdated += count
    }
    if (error) console.error(`  Error on ${canonical}: ${error.message}`)
  }

  console.log(`\nTotal brand names normalized: ${totalUpdated}`)

  // Just count distinct brands
  const { count } = await sb
    .from('ss_products')
    .select('*', { count: 'exact', head: true })

  const { data: brandList } = await sb
    .from('ss_products')
    .select('brand_en')

  const uniqueBrands = new Set(brandList?.map(r => r.brand_en) ?? [])
  console.log(`Products: ${count}, Unique brands: ${uniqueBrands.size}`)
}

main().catch(e => console.error(e))
