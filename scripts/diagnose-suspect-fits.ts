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

  // Products from screenshot #2 fits list — diagnose why they're rendering as fits
  const targets = [
    'Clean & Glow Green Barley LHA Gel Cleanser',
    'Daily UV Protection Cream SPF35',
    'Dual-Balance Waterlock Lotion',
    'Red Blemish Cica S.O.S Recovery Cream',
    '6 Peptide Complex Serum',
    'Aqua Soothing Gel Cream',
    'Full Fit Propolis Synergy Toner',
    'Comfy Water Sun Block SPF50',
  ]

  for (const t of targets) {
    const { data } = await db
      .from('ss_products')
      .select('id, brand_en, name_en, category, is_verified, ingredients_raw')
      .ilike('name_en', `%${t}%`)
      .limit(1)
    if (!data?.length) {
      console.log(`NOT FOUND: ${t}`)
      continue
    }
    const p = data[0] as { id: string; brand_en: string; name_en: string; category: string | null; is_verified: boolean; ingredients_raw: string | null }
    const { count } = await db
      .from('ss_product_ingredients')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', p.id)
    console.log(`${p.brand_en} | ${p.name_en}`)
    console.log(`  category: ${p.category}`)
    console.log(`  is_verified: ${p.is_verified}`)
    console.log(`  ingredient links: ${count}`)
    console.log(`  ingredients_raw length: ${(p.ingredients_raw || '').length}`)
    console.log()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
