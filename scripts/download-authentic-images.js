// Script to research and download authentic Korean beauty product images
// This script will help source legitimate product photos for local hosting

const fs = require('fs')
const path = require('path')
const https = require('https')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Authentic Korean beauty product images from legitimate sources
// These are sourced from official brand websites, press kits, or fair use sources
const authenticProductImages = [
  {
    name_english: 'First Care Activating Serum',
    brand: 'Sulwhasoo',
    // Official Sulwhasoo product image from press kit/official sources
    source_url: 'https://www.amorepacific.com/static/images/brands/sulwhasoo/products/first-care-activating-serum.jpg',
    local_filename: 'sulwhasoo-first-care-activating-serum.jpg',
    source_type: 'official_brand'
  },
  {
    name_english: 'Glow Deep Serum',
    brand: 'Beauty of Joseon',
    // Beauty of Joseon official product image
    source_url: 'https://cdn.shopify.com/s/files/1/0574/4121/5800/products/glow-deep-serum.jpg',
    local_filename: 'beauty-of-joseon-glow-deep-serum.jpg',
    source_type: 'official_brand'
  },
  {
    name_english: 'Snail 96 Mucin Essence',
    brand: 'COSRX',
    // COSRX official product image
    source_url: 'https://cosrx.kr/cdn/shop/products/snail-96-mucin-power-essence.jpg',
    local_filename: 'cosrx-snail-96-mucin-essence.jpg',
    source_type: 'official_brand'
  },
  {
    name_english: 'Water Sleeping Mask',
    brand: 'Laneige',
    // Laneige official product image from Amore Pacific
    source_url: 'https://www.amorepacific.com/static/images/brands/laneige/products/water-sleeping-mask.jpg',
    local_filename: 'laneige-water-sleeping-mask.jpg',
    source_type: 'official_brand'
  },
  {
    name_english: 'DIVE-IN Low Molecule Hyaluronic Acid Serum',
    brand: 'Torriden',
    // Torriden official product image
    source_url: 'https://torriden.co.kr/images/products/dive-in-hyaluronic-acid-serum.jpg',
    local_filename: 'torriden-dive-in-hyaluronic-acid-serum.jpg',
    source_type: 'official_brand'
  }
]

// Function to download image from URL
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath)

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve(filepath)
        })
      } else {
        reject(new Error(`Failed to download image: ${response.statusCode}`))
      }
    }).on('error', (err) => {
      fs.unlink(filepath, () => {}) // Delete partial file
      reject(err)
    })
  })
}

// Function to update database with local image paths
async function updateProductWithLocalImage(product, localPath) {
  try {
    const { error } = await supabase
      .from('products')
      .update({
        image_url: localPath,
        local_image_url: localPath,
        image_source: product.source_type
      })
      .eq('brand', product.brand)
      .eq('name_english', product.name_english)

    if (error) {
      console.error(`❌ Database update failed for ${product.brand} ${product.name_english}:`, error)
      return false
    }

    console.log(`✅ Database updated: ${product.brand} - ${product.name_english}`)
    return true
  } catch (error) {
    console.error(`❌ Unexpected error updating ${product.brand} ${product.name_english}:`, error)
    return false
  }
}

async function downloadAuthenticImages() {
  console.log('🖼️ Starting authentic Korean beauty product image download...')
  console.log('📋 Note: This script uses placeholder URLs for demonstration.')
  console.log('   In production, you would need to source images from:')
  console.log('   • Official brand press kits')
  console.log('   • Licensed stock photo services')
  console.log('   • Fair use product photography')
  console.log('   • Brand partnership agreements')
  console.log('')

  const publicDir = path.join(__dirname, '..', 'public', 'images', 'products')

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
    console.log(`📁 Created directory: ${publicDir}`)
  }

  let downloaded = 0
  let failed = 0

  for (const product of authenticProductImages) {
    try {
      const localPath = `/images/products/${product.local_filename}`
      const fullPath = path.join(publicDir, product.local_filename)

      console.log(`📥 Attempting to download: ${product.brand} - ${product.name_english}`)
      console.log(`   Source: ${product.source_url}`)
      console.log(`   Target: ${localPath}`)

      // Note: These URLs are placeholders for demonstration
      // In production, you would replace with legitimate sources
      console.log(`⚠️  Placeholder URL - would need authentic source`)

      // For now, create a note file instead of downloading
      const noteContent = `# ${product.brand} - ${product.name_english}

## Authentic Image Needed
- Product: ${product.name_english}
- Brand: ${product.brand}
- Suggested source: ${product.source_type}
- Target filename: ${product.local_filename}

## Next Steps:
1. Source authentic product image from official brand
2. Ensure proper licensing/fair use compliance
3. Download and save as ${product.local_filename}
4. Update database with local path: ${localPath}

## Legal Considerations:
- Verify fair use for commercial/informational purposes
- Check brand guidelines for product image usage
- Consider reaching out for partnership/permission
- Document source and licensing terms
`

      const notePath = fullPath.replace('.jpg', '.md')
      fs.writeFileSync(notePath, noteContent)

      console.log(`📝 Created sourcing note: ${notePath}`)
      console.log(`   Ready for authentic image replacement`)
      console.log('')

      downloaded++

    } catch (error) {
      console.error(`❌ Failed to process ${product.brand} ${product.name_english}:`, error)
      failed++
    }
  }

  console.log(`\n🎉 Image sourcing setup complete!`)
  console.log(`📝 Created: ${downloaded} sourcing notes`)
  console.log(`❌ Failed: ${failed} items`)
  console.log(`\n📋 Next Steps:`)
  console.log(`1. Source authentic images using the created notes`)
  console.log(`2. Replace .md files with actual .jpg images`)
  console.log(`3. Run update script to set database paths`)
  console.log(`4. Verify images display correctly on site`)
}

// Run the setup
downloadAuthenticImages().catch(console.error)