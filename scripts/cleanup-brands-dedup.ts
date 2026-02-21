/**
 * Data cleanup script: Brand normalization + product deduplication
 * Run with: npx tsx --tsconfig tsconfig.json scripts/cleanup-brands-dedup.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local
const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  console.error('Failed to read .env.local')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Brand Normalization Mappings ─────────────────────────────────────────────
const BRAND_MAPPINGS: Array<{ canonical: string; variants: string[] }> = [
  { canonical: 'Mediheal', variants: ['MEDIHEAL'] },
  { canonical: 'Aestura', variants: ['AESTURA'] },
  { canonical: 'Skinfood', variants: ['SKINFOOD'] },
  { canonical: 'Round Lab', variants: ['ROUND LAB'] },
  { canonical: 'Bringgreen', variants: ['BRINGGREEN'] },
  { canonical: 'Numbuzin', variants: ['numbuzin'] },
  { canonical: 'Some By Mi', variants: ['SOME BY MI'] },
  { canonical: 'Belif', variants: ['belif'] },
  { canonical: 'Goodal', variants: ['goodal'] },
  { canonical: 'Bioheal BOH', variants: ['BIOHEAL BOH'] },
  { canonical: 'Innisfree', variants: ['INNISFREE'] },
  { canonical: 'Biodance', variants: ['BIODANCE'] },
  { canonical: 'Mixsoon', variants: ['mixsoon', 'MIXSOON'] },
  { canonical: 'Isoi', variants: ['isoi', 'ISOI'] },
  { canonical: "d'Alba", variants: ["D'Alba"] },
  { canonical: 'Dewytree', variants: ['DEWYTREE'] },
  { canonical: 'Hanyul', variants: ['HANYUL'] },
  { canonical: 'The Face Shop', variants: ['THE FACE SHOP'] },
  { canonical: 'Laneige', variants: ['LANEIGE'] },
  { canonical: 'Sungboon Editor', variants: ['SUNGBOON EDITOR'] },
  { canonical: 'Rovectin', variants: ['ROVECTIN'] },
  { canonical: "I'm From", variants: ["I'm from"] },
  { canonical: 'S.Nature', variants: ['S.NATURE'] },
  { canonical: 'Skin&Lab', variants: ['SKIN&LAB'] },
  { canonical: 'Rejuran', variants: ['REJURAN'] },
  { canonical: 'Ilso', variants: ['ilso'] },
  { canonical: 'Medi-Peel', variants: ['MEDI-PEEL'] },
  { canonical: 'Jumiso', variants: ['JUMISO'] },
  { canonical: 'Fation', variants: ['FATION'] },
  { canonical: 'Etude', variants: ['ETUDE'] },
  { canonical: 'Easydew', variants: ['easydew'] },
  { canonical: 'Wellage', variants: ['WELLAGE'] },
  { canonical: 'Athe', variants: ['athe'] },
  { canonical: 'Begins by JUNGSAEMMOOL', variants: ['begins by JUNGSAEMMOOL', 'BEGINS By JUNGSAEMMOOL'] },
  { canonical: 'Beyond', variants: ['BEYOND'] },
  { canonical: 'The Saem', variants: ['THE SAEM'] },
  { canonical: 'Neuraderm', variants: ['NEURADERM'] },
  { canonical: 'Nacific', variants: ['NACIFIC'] },
  { canonical: 'Bewants', variants: ['bewants'] },
  { canonical: 'The Lab by blanc doux', variants: ['THE LAB by blanc doux'] },
  { canonical: 'Illiyoon', variants: ['ILLIYOON'] },
  { canonical: 'Luvum', variants: ['luvum'] },
  { canonical: 'Ongredients', variants: ['ongredients'] },
  { canonical: 'Espoir', variants: ['espoir'] },
  { canonical: 'Mizon', variants: ['MIZON'] },
  { canonical: 'Anotherface', variants: ['anotherface'] },
  { canonical: 'Idplacosmetic', variants: ['idplacosmetic'] },
  { canonical: 'Shaishaishai', variants: ['shaishaishai'] },
  { canonical: 'Stridex', variants: ['STRIDEX'] },
  { canonical: 'Hatherine', variants: ['HATHERINE'] },
]

async function normalizeBrands() {
  console.log('=== BRAND NORMALIZATION ===')
  let totalFixed = 0

  for (const { canonical, variants } of BRAND_MAPPINGS) {
    const { data, error } = await supabase
      .from('ss_products')
      .update({ brand_en: canonical })
      .in('brand_en', variants)
      .select('id')

    if (error) {
      console.error(`  Failed to normalize "${canonical}":`, error.message)
      continue
    }

    const count = data?.length ?? 0
    if (count > 0) {
      totalFixed += count
      console.log(`  ${canonical}: ${count} products fixed (from ${variants.join(', ')})`)
    }
  }

  console.log(`\nTotal brand normalizations: ${totalFixed}`)
  return totalFixed
}

async function deduplicateProducts() {
  console.log('\n=== PRODUCT DEDUPLICATION ===')

  // Find case-insensitive duplicates
  const { data: dupes, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT LOWER(name_en) as name_lower, LOWER(brand_en) as brand_lower,
             COUNT(*) as cnt,
             ARRAY_AGG(id ORDER BY created_at ASC) as ids
      FROM ss_products
      GROUP BY LOWER(name_en), LOWER(brand_en)
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
    `
  })

  // If RPC doesn't exist, fall back to a manual approach
  if (error) {
    console.log('  RPC not available, using manual dedup approach...')
    await manualDedup()
    return
  }

  if (!dupes || dupes.length === 0) {
    console.log('  No duplicate products found!')
    return
  }

  console.log(`  Found ${dupes.length} duplicate groups`)
  let totalRemoved = 0

  for (const group of dupes) {
    const ids = group.ids as string[]
    const keepId = ids[0] // Keep the oldest
    const removeIds = ids.slice(1)

    // Move ingredient links to the kept product
    for (const removeId of removeIds) {
      // Delete ingredient links for the duplicate
      await supabase
        .from('ss_product_ingredients')
        .delete()
        .eq('product_id', removeId)

      // Update staging references
      await supabase
        .from('ss_product_staging')
        .update({ processed_product_id: keepId })
        .eq('processed_product_id', removeId)

      // Delete the duplicate product
      const { error: delError } = await supabase
        .from('ss_products')
        .delete()
        .eq('id', removeId)

      if (delError) {
        console.log(`  Failed to delete ${removeId}: ${delError.message}`)
      } else {
        totalRemoved++
      }
    }
  }

  console.log(`\nTotal duplicates removed: ${totalRemoved}`)
}

async function manualDedup() {
  // Fetch all products (id, name, brand) and find duplicates in JS
  let allProducts: Array<{ id: string; name_en: string; brand_en: string; created_at: string }> = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('ss_products')
      .select('id, name_en, brand_en, created_at')
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error || !data || data.length === 0) break
    allProducts = allProducts.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  console.log(`  Loaded ${allProducts.length} products for dedup check`)

  // Group by lowercase name + brand
  const groups = new Map<string, typeof allProducts>()
  for (const p of allProducts) {
    const key = `${p.name_en.toLowerCase()}|||${p.brand_en.toLowerCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  let totalRemoved = 0
  for (const [key, products] of groups) {
    if (products.length <= 1) continue

    // Keep the oldest (first created), remove the rest
    const keepId = products[0].id
    const removeIds = products.slice(1).map(p => p.id)

    for (const removeId of removeIds) {
      // Delete ingredient links
      await supabase
        .from('ss_product_ingredients')
        .delete()
        .eq('product_id', removeId)

      // Update staging references
      await supabase
        .from('ss_product_staging')
        .update({ processed_product_id: keepId })
        .eq('processed_product_id', removeId)

      // Delete the duplicate
      const { error: delError } = await supabase
        .from('ss_products')
        .delete()
        .eq('id', removeId)

      if (delError) {
        console.log(`  Failed to delete ${removeId}: ${delError.message}`)
      } else {
        totalRemoved++
      }
    }

    if (removeIds.length > 0) {
      const name = products[0].name_en.substring(0, 60)
      console.log(`  Deduped: "${name}" (${products[0].brand_en}) — removed ${removeIds.length}`)
    }
  }

  console.log(`\nTotal duplicates removed: ${totalRemoved}`)
}

async function deduplicateIngredients() {
  console.log('\n=== INGREDIENT DEDUPLICATION ===')

  // Find case-insensitive ingredient duplicates
  let allIngredients: Array<{ id: string; name_inci: string; name_en: string | null; created_at: string }> = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('ss_ingredients')
      .select('id, name_inci, name_en, created_at')
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error || !data || data.length === 0) break
    allIngredients = allIngredients.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  console.log(`  Loaded ${allIngredients.length} ingredients for dedup check`)

  // Group by lowercase name_inci
  const groups = new Map<string, typeof allIngredients>()
  for (const ing of allIngredients) {
    const key = ing.name_inci.toLowerCase().trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(ing)
  }

  let totalMerged = 0
  let totalLinksMoved = 0

  for (const [, ingredients] of groups) {
    if (ingredients.length <= 1) continue

    // Keep the one with the best metadata (has name_en, oldest)
    const sorted = ingredients.sort((a, b) => {
      // Prefer ones with name_en
      if (a.name_en && !b.name_en) return -1
      if (!a.name_en && b.name_en) return 1
      // Then by age (oldest first)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    const keepId = sorted[0].id
    const removeIds = sorted.slice(1).map(i => i.id)

    for (const removeId of removeIds) {
      // Move product_ingredient links to the canonical ingredient
      const { data: links } = await supabase
        .from('ss_product_ingredients')
        .select('id, product_id, position')
        .eq('ingredient_id', removeId)

      if (links && links.length > 0) {
        for (const link of links) {
          // Check if canonical already has a link for this product
          const { data: existing } = await supabase
            .from('ss_product_ingredients')
            .select('id')
            .eq('product_id', link.product_id)
            .eq('ingredient_id', keepId)
            .limit(1)

          if (existing && existing.length > 0) {
            // Delete the duplicate link
            await supabase.from('ss_product_ingredients').delete().eq('id', link.id)
          } else {
            // Move the link to canonical
            await supabase
              .from('ss_product_ingredients')
              .update({ ingredient_id: keepId })
              .eq('id', link.id)
            totalLinksMoved++
          }
        }
      }

      // Delete the duplicate ingredient
      const { error: delError } = await supabase
        .from('ss_ingredients')
        .delete()
        .eq('id', removeId)

      if (delError) {
        console.log(`  Failed to delete ingredient ${removeId}: ${delError.message}`)
      } else {
        totalMerged++
      }
    }
  }

  console.log(`  Ingredients merged: ${totalMerged}`)
  console.log(`  Links moved: ${totalLinksMoved}`)
}

async function printStats() {
  console.log('\n=== FINAL DATABASE STATE ===')

  const queries = [
    { label: 'Products', query: supabase.from('ss_products').select('*', { count: 'exact', head: true }) },
    { label: 'Brands', query: supabase.from('ss_products').select('brand_en') },
    { label: 'Ingredients', query: supabase.from('ss_ingredients').select('*', { count: 'exact', head: true }) },
    { label: 'Product-Ingredient Links', query: supabase.from('ss_product_ingredients').select('*', { count: 'exact', head: true }) },
  ]

  const { count: productCount } = await supabase.from('ss_products').select('*', { count: 'exact', head: true })
  const { count: ingredientCount } = await supabase.from('ss_ingredients').select('*', { count: 'exact', head: true })
  const { count: linkCount } = await supabase.from('ss_product_ingredients').select('*', { count: 'exact', head: true })

  // Get distinct brand count
  let brands = new Set<string>()
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('ss_products')
      .select('brand_en')
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    data.forEach(d => brands.add(d.brand_en))
    if (data.length < 1000) break
    offset += 1000
  }

  // Category distribution
  let categories = new Map<string, number>()
  offset = 0
  while (true) {
    const { data } = await supabase
      .from('ss_products')
      .select('category')
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    data.forEach(d => categories.set(d.category, (categories.get(d.category) ?? 0) + 1))
    if (data.length < 1000) break
    offset += 1000
  }

  console.log(`  Products:              ${productCount}`)
  console.log(`  Brands:                ${brands.size}`)
  console.log(`  Ingredients:           ${ingredientCount}`)
  console.log(`  Product-Ingredient Links: ${linkCount}`)
  console.log(`\n  Categories:`)
  const sortedCats = [...categories.entries()].sort((a, b) => b[1] - a[1])
  for (const [cat, count] of sortedCats) {
    console.log(`    ${cat}: ${count}`)
  }
}

async function main() {
  await normalizeBrands()
  await deduplicateProducts()
  await deduplicateIngredients()
  await printStats()
}

main().catch(err => {
  console.error('Script error:', err)
  process.exit(1)
})
