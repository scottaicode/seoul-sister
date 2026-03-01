/**
 * One-time cleanup: Remove non-skincare products (makeup, body care, hair care)
 * from ss_products and cascade to related tables.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NON_SKINCARE_SUBCATEGORIES = [
  // Eye makeup
  'eyeshadow palette', 'eyebrow pencil', 'gel eyeliner', 'mascara',
  'brow pencil', 'brow mascara', 'liquid eyeliner', 'eyeshadow',
  'pen eyeliner', 'false lashes', 'eye palette', 'eyeshadow stick',
  'eyeshadow single', 'brow product', 'eye pencil',
  // Face makeup
  'cushion foundation', 'concealer', 'foundation', 'blush',
  'setting powder', 'contour', 'tone up cushion', 'bb cream',
  // Lip color (NOT lip balm/treatment)
  'lip tint', 'lipstick',
  // Body & hair
  'body lotion', 'body wash', 'scalp care', 'shampoo bar',
]

async function main() {
  console.log('=== Non-Skincare Product Cleanup ===\n')

  // Step 0: Fetch product IDs to delete
  const { data: products, error: fetchErr } = await supabase
    .from('ss_products')
    .select('id')
    .in('subcategory', NON_SKINCARE_SUBCATEGORIES)

  if (fetchErr) {
    console.error('Fetch error:', fetchErr)
    process.exit(1)
  }

  if (!products || products.length === 0) {
    console.log('No non-skincare products found. Already clean!')
    process.exit(0)
  }

  console.log(`Products to delete: ${products.length}`)
  const ids = products.map((p) => p.id)

  // Process in chunks of 50
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const label = `Chunk ${Math.floor(i / 50) + 1}/${Math.ceil(ids.length / 50)}`

    // 1. Delete trending rows
    const { error: e1 } = await supabase
      .from('ss_trending_products')
      .delete()
      .in('product_id', chunk)
    if (e1) console.error(`${label} trending error:`, e1.message)

    // 2. Unlink staging rows (preserve audit trail)
    const { error: e2 } = await supabase
      .from('ss_product_staging')
      .update({
        processed_product_id: null,
        status: 'duplicate',
        error_message: 'Cleaned: not a skincare product',
      })
      .in('processed_product_id', chunk)
    if (e2) console.error(`${label} staging error:`, e2.message)

    // 3. Delete ingredient links
    const { error: e3 } = await supabase
      .from('ss_product_ingredients')
      .delete()
      .in('product_id', chunk)
    if (e3) console.error(`${label} ingredients error:`, e3.message)

    // 4. Delete the products
    const { error: e4 } = await supabase
      .from('ss_products')
      .delete()
      .in('id', chunk)
    if (e4) console.error(`${label} products error:`, e4.message)

    console.log(`${label} done — deleted ${chunk.length} products`)
  }

  // Verify
  const { count: remaining } = await supabase
    .from('ss_products')
    .select('*', { count: 'exact', head: true })
    .in('subcategory', NON_SKINCARE_SUBCATEGORIES)
  console.log(`\nRemaining non-skincare products: ${remaining}`)

  const { count: total } = await supabase
    .from('ss_products')
    .select('*', { count: 'exact', head: true })
  console.log(`Total products remaining: ${total}`)

  console.log('\n=== Cleanup complete ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
