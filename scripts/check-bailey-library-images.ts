import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const BAILEY = '551569d3-aed0-4feb-a340-47bfb146a835'

async function main() {
  const db = createClient(
    get('NEXT_PUBLIC_SUPABASE_URL')!,
    get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Owned products (ss_user_products), joined to catalog for image_url
  const { data: owned } = await db
    .from('ss_user_products')
    .select('id, product_id, custom_name, custom_brand, status, product:ss_products(name_en, brand_en, image_url)')
    .eq('user_id', BAILEY)
    .neq('status', 'discarded')

  console.log('=== OWNED LIBRARY ITEMS ===')
  for (const o of owned ?? []) {
    const p = o.product as unknown as { name_en: string; brand_en: string; image_url: string | null } | null
    const name = p?.name_en ?? o.custom_name ?? '(custom)'
    const img = o.product_id ? (p?.image_url ? 'HAS IMAGE' : 'NULL image_url') : 'CUSTOM (no product)'
    console.log(`  ${name.padEnd(50)} | ${o.product_id ? 'catalog' : 'custom '} | ${img}`)
    if (p?.image_url) console.log(`      → ${p.image_url}`)
  }

  // Routine products
  const { data: routines } = await db
    .from('ss_user_routines')
    .select('id, routine_type, products:ss_routine_products(step_order, product_id, notes, product:ss_products(name_en, brand_en, image_url))')
    .eq('user_id', BAILEY)
    .eq('is_active', true)

  console.log('\n=== ROUTINE STEPS ===')
  for (const r of routines ?? []) {
    console.log(`  [${(r as { routine_type: string }).routine_type.toUpperCase()}]`)
    const steps = ((r as { products: unknown[] }).products ?? []) as Array<{
      step_order: number; product_id: string | null; notes: string | null
      product: { name_en: string; image_url: string | null } | null
    }>
    for (const s of steps.sort((a, b) => a.step_order - b.step_order)) {
      const name = s.product?.name_en ?? s.notes ?? '(step)'
      const img = s.product_id ? (s.product?.image_url ? 'HAS IMAGE' : 'NULL image_url') : 'CUSTOM (no product)'
      console.log(`    ${s.step_order}. ${name.slice(0, 45).padEnd(46)} | ${img}`)
    }
  }
}
main()
