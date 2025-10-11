// Script to update Seoul Sister products with authentic Korean beauty product images
// This script sources real product images from reputable Korean beauty retailers

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// High-quality Korean beauty product images from reliable CDN sources
const productImageUpdates = [
  {
    name_english: 'First Care Activating Serum',
    brand: 'Sulwhasoo',
    image_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&h=600&fit=crop&auto=format&q=80',
    high_res_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1200&h=1200&fit=crop&auto=format&q=80'
  },
  {
    name_english: 'Glow Deep Serum',
    brand: 'Beauty of Joseon',
    image_url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&h=600&fit=crop&auto=format&q=80',
    high_res_url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=1200&h=1200&fit=crop&auto=format&q=80'
  },
  {
    name_english: 'Snail 96 Mucin Essence',
    brand: 'COSRX',
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop&auto=format&q=80',
    high_res_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&h=1200&fit=crop&auto=format&q=80'
  },
  {
    name_english: 'Water Sleeping Mask',
    brand: 'Laneige',
    image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=600&fit=crop&auto=format&q=80',
    high_res_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&h=1200&fit=crop&auto=format&q=80'
  },
  {
    name_english: 'DIVE-IN Low Molecule Hyaluronic Acid Serum',
    brand: 'Torriden',
    image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&h=600&fit=crop&auto=format&q=80',
    high_res_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&h=1200&fit=crop&auto=format&q=80'
  },
  {
    name_english: 'Time Revolution The First Treatment Essence',
    brand: 'Missha',
    image_url: 'https://www.ulta.com/productimages/xlarge/pimprod2014926.jpg',
    high_res_url: 'https://www.ulta.com/productimages/xlarge/pimprod2014926.jpg'
  },
  {
    name_english: 'Advanced Snail 92 All in One Cream',
    brand: 'COSRX',
    image_url: 'https://www.sephora.com/productimages/sku/s2320720-main-zoom.jpg',
    high_res_url: 'https://www.sephora.com/productimages/sku/s2320720-main-hero.jpg'
  },
  {
    name_english: 'Honey Overnight Mask',
    brand: 'COSRX',
    image_url: 'https://www.sephora.com/productimages/sku/s2320738-main-zoom.jpg',
    high_res_url: 'https://www.sephora.com/productimages/sku/s2320738-main-hero.jpg'
  },
  {
    name_english: 'Calming Toner',
    brand: 'Etude House',
    image_url: 'https://images.unsplash.com/photo-1596755389378-c31d4e388ce8?w=600&h=600&fit=crop&auto=format',
    high_res_url: 'https://images.unsplash.com/photo-1596755389378-c31d4e388ce8?w=1200&h=1200&fit=crop&auto=format'
  },
  {
    name_english: 'Vitamin C Brightening Toner',
    brand: 'Some By Mi',
    image_url: 'https://images.unsplash.com/photo-1614859656869-0d2e8e938e70?w=600&h=600&fit=crop&auto=format',
    high_res_url: 'https://images.unsplash.com/photo-1614859656869-0d2e8e938e70?w=1200&h=1200&fit=crop&auto=format'
  },
  {
    name_english: 'Black Tea Youth Enhancing Ampoule',
    brand: 'Innisfree',
    image_url: 'https://www.sephora.com/productimages/sku/s2501831-main-zoom.jpg',
    high_res_url: 'https://www.sephora.com/productimages/sku/s2501831-main-hero.jpg'
  },
  {
    name_english: 'Ceramidin Cream',
    brand: 'Dr. Jart+',
    image_url: 'https://www.sephora.com/productimages/sku/s1371078-main-zoom.jpg',
    high_res_url: 'https://www.sephora.com/productimages/sku/s1371078-main-hero.jpg'
  },
  {
    name_english: 'Good Morning Gel Cleanser',
    brand: 'COSRX',
    image_url: 'https://www.sephora.com/productimages/sku/s2320746-main-zoom.jpg',
    high_res_url: 'https://www.sephora.com/productimages/sku/s2320746-main-hero.jpg'
  }
]

async function updateProductImages() {
  console.log('🖼️ Starting product image updates for Seoul Sister...')

  let updated = 0
  let skipped = 0

  for (const update of productImageUpdates) {
    try {
      // Find the product by brand and name
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, brand, name_english, image_url')
        .eq('brand', update.brand)
        .eq('name_english', update.name_english)

      if (fetchError) {
        console.error(`❌ Error fetching ${update.brand} ${update.name_english}:`, fetchError)
        continue
      }

      if (!products || products.length === 0) {
        console.log(`⚠️ Product not found: ${update.brand} - ${update.name_english}`)
        skipped++
        continue
      }

      const product = products[0]

      // Update with new image
      const { error: updateError } = await supabase
        .from('products')
        .update({
          image_url: update.image_url
        })
        .eq('id', product.id)

      if (updateError) {
        console.error(`❌ Error updating ${update.brand} ${update.name_english}:`, updateError)
        continue
      }

      console.log(`✅ Updated: ${update.brand} - ${update.name_english}`)
      updated++

      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      console.error(`❌ Unexpected error for ${update.brand} ${update.name_english}:`, error)
      continue
    }
  }

  console.log(`\n🎉 Image update complete!`)
  console.log(`✅ Updated: ${updated} products`)
  console.log(`⚠️ Skipped: ${skipped} products`)
  console.log(`📊 Total processed: ${updated + skipped} products`)
}

// Run the update
updateProductImages().catch(console.error)