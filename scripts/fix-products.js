#!/usr/bin/env node

/**
 * Fix product duplicates and ensure proper images
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixProducts() {
  console.log('🔧 Fixing product database...')

  try {
    // First, get all products
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('Error fetching products:', fetchError)
      return
    }

    console.log(`Found ${products.length} products in database`)

    // Find duplicates
    const seen = new Map()
    const toDelete = []

    products.forEach(product => {
      const key = `${product.brand}-${product.name_english}`
      if (seen.has(key)) {
        // Keep the first one, mark this as duplicate
        toDelete.push(product.id)
        console.log(`  Duplicate found: ${key} (ID: ${product.id})`)
      } else {
        seen.set(key, product.id)
      }
    })

    // Delete duplicates
    if (toDelete.length > 0) {
      console.log(`\n🗑️ Deleting ${toDelete.length} duplicate products...`)
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .in('id', toDelete)

      if (deleteError) {
        console.error('Error deleting duplicates:', deleteError)
      } else {
        console.log('✅ Duplicates removed')
      }
    }

    // Now ensure we have all 4 products with correct images
    const correctProducts = [
      {
        name_english: 'First Care Activating Serum',
        name_korean: '퍼스트 케어 액티베이팅 세럼',
        brand: 'Sulwhasoo',
        seoul_price: 28,
        us_price: 94,
        savings_percentage: 70,
        category: 'Serum',
        description: 'Premium anti-aging serum with ginseng and traditional Korean herbs',
        image_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&h=600&fit=crop',
        in_stock: true
      },
      {
        name_english: 'Glow Deep Serum',
        name_korean: '글로우 딥 세럼',
        brand: 'Beauty of Joseon',
        seoul_price: 8.5,
        us_price: 45,
        savings_percentage: 82,
        category: 'Serum',
        description: 'Rice bran + Alpha arbutin brightening serum for glass skin',
        image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
        in_stock: true
      },
      {
        name_english: 'Snail 96 Mucin Essence',
        name_korean: '달팽이 96 뮤신 에센스',
        brand: 'COSRX',
        seoul_price: 12,
        us_price: 89,
        savings_percentage: 74,
        category: 'Essence',
        description: '96% snail mucin for repair & hydration',
        image_url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&h=600&fit=crop',
        in_stock: true
      },
      {
        name_english: 'Water Sleeping Mask',
        name_korean: '워터 슬리핑 마스크',
        brand: 'Laneige',
        seoul_price: 12,
        us_price: 34,
        savings_percentage: 65,
        category: 'Mask',
        description: 'Overnight hydrating mask for deep moisture replenishment',
        image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=600&fit=crop',
        in_stock: true
      }
    ]

    // Check which products exist
    console.log('\n📦 Ensuring all 4 core products exist...')

    for (const product of correctProducts) {
      const { data: existing } = await supabase
        .from('products')
        .select('*')
        .eq('brand', product.brand)
        .eq('name_english', product.name_english)
        .single()

      if (existing) {
        // Update the existing product with correct image
        console.log(`  Updating: ${product.brand} - ${product.name_english}`)
        const { error: updateError } = await supabase
          .from('products')
          .update({
            image_url: product.image_url,
            description: product.description,
            seoul_price: product.seoul_price,
            us_price: product.us_price,
            savings_percentage: product.savings_percentage
          })
          .eq('id', existing.id)

        if (updateError) {
          console.error(`    Error updating: ${updateError.message}`)
        }
      } else {
        // Insert new product
        console.log(`  Adding: ${product.brand} - ${product.name_english}`)
        const { error: insertError } = await supabase
          .from('products')
          .insert(product)

        if (insertError) {
          console.error(`    Error inserting: ${insertError.message}`)
        }
      }
    }

    // Final check
    const { data: finalProducts } = await supabase
      .from('products')
      .select('*')
      .order('brand')

    console.log(`\n✅ Database now has ${finalProducts.length} products:`)
    finalProducts.forEach(p => {
      console.log(`  - ${p.brand} ${p.name_english}: $${p.seoul_price} (Seoul) vs $${p.us_price} (US)`)
    })

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Run the fix
fixProducts().then(() => {
  console.log('\n✨ Product database fixed!')
  process.exit(0)
}).catch(error => {
  console.error('Failed:', error)
  process.exit(1)
})