import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function updateWaterMaskImage() {
  // Update LANEIGE Water Sleeping Mask image to actual blue jar product
  const { data, error } = await supabase
    .from('products')
    .update({
      image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&q=80' // Blue jar skincare product
    })
    .eq('name_english', 'Water Sleeping Mask')
    .eq('brand', 'LANEIGE')

  if (error) {
    console.error('Error updating product image:', error)
  } else {
    console.log('✅ Successfully updated Water Sleeping Mask image to blue jar container')
  }

  process.exit(0)
}

updateWaterMaskImage()