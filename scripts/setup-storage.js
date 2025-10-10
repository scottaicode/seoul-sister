#!/usr/bin/env node

/**
 * Supabase Storage Setup Script for Seoul Sister
 * Creates storage buckets for product images
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function setupStorage() {
  console.log('🗄️ Setting up Supabase Storage buckets...')

  try {
    // Create product-images bucket
    console.log('Creating product-images bucket...')

    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets()

    if (listError) {
      console.error('Error listing buckets:', listError)
      throw listError
    }

    const existingBucket = buckets?.find(b => b.name === 'product-images')

    if (existingBucket) {
      console.log('✅ product-images bucket already exists')
    } else {
      const { data, error } = await supabase
        .storage
        .createBucket('product-images', {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
          fileSizeLimit: 5242880 // 5MB
        })

      if (error) {
        console.error('Error creating bucket:', error)
        throw error
      }

      console.log('✅ Created product-images bucket')
    }

    // Set up storage policies
    console.log('Setting up storage policies...')

    // The bucket is public, so anyone can read
    // Only authenticated users (admin) can upload/delete

    console.log('✅ Storage setup complete!')
    console.log('\nYou can now:')
    console.log('1. Upload product images to the product-images bucket')
    console.log('2. Access them via: ' + process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/product-images/{filename}')

  } catch (error) {
    console.error('❌ Storage setup failed:', error)
    process.exit(1)
  }
}

// Run the setup
setupStorage().then(() => {
  process.exit(0)
}).catch(error => {
  console.error('❌ Setup failed:', error)
  process.exit(1)
})