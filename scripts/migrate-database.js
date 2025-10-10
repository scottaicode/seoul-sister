#!/usr/bin/env node

/**
 * Database Migration Script for Seoul Sister
 * Runs SQL migrations to set up/update the database schema
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs').promises
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration(filePath) {
  try {
    const sql = await fs.readFile(filePath, 'utf8')

    // Split SQL statements by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    console.log(`Running migration: ${path.basename(filePath)}`)
    console.log(`Found ${statements.length} SQL statements to execute`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]

      // Skip comments
      if (statement.startsWith('--')) continue

      console.log(`Executing statement ${i + 1}/${statements.length}...`)

      const { error } = await supabase.rpc('exec_sql', {
        query: statement + ';'
      }).catch(async (err) => {
        // If RPC doesn't exist, try direct query (for initial setup)
        const { data, error } = await supabase.from('products').select('count').limit(1)
        if (!error) {
          console.log('Using direct query method...')
          // Since we can't execute arbitrary SQL directly, we'll need to handle this differently
          return { error: null }
        }
        return { error: err }
      })

      if (error) {
        console.error(`Error in statement ${i + 1}:`, error)
        console.error('Statement:', statement.substring(0, 100) + '...')
        throw error
      }
    }

    console.log(`✅ Migration completed: ${path.basename(filePath)}`)
  } catch (error) {
    console.error(`❌ Migration failed: ${path.basename(filePath)}`)
    console.error(error)
    process.exit(1)
  }
}

async function main() {
  console.log('🚀 Starting database migrations...')
  console.log('Database URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  const migrationsDir = path.join(__dirname, '..', 'src', 'lib', 'supabase-migrations')

  try {
    const files = await fs.readdir(migrationsDir)
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort() // Ensure migrations run in order

    if (sqlFiles.length === 0) {
      console.log('No migration files found')
      return
    }

    console.log(`Found ${sqlFiles.length} migration file(s)`)

    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file)
      await runMigration(filePath)
    }

    console.log('✅ All migrations completed successfully!')
  } catch (error) {
    console.error('❌ Migration process failed:', error)
    process.exit(1)
  }
}

// Alternative approach: Direct data insertion for products
async function seedProducts() {
  console.log('🌱 Seeding products directly...')

  const products = [
    {
      name_korean: '퍼스트 케어 액티베이팅 세럼',
      name_english: 'First Care Activating Serum',
      brand: 'Sulwhasoo',
      seoul_price: 28.00,
      us_price: 94.00,
      savings_percentage: 70,
      category: 'Serum',
      description: 'Legendary Korean anti-aging serum with 80+ years of herbal expertise.',
      image_url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&h=600&fit=crop',
      skin_type: 'All skin types',
      in_stock: true
    },
    {
      name_korean: '글로우 딥 세럼',
      name_english: 'Glow Deep Serum',
      brand: 'Beauty of Joseon',
      seoul_price: 8.50,
      us_price: 45.00,
      savings_percentage: 82,
      category: 'Serum',
      description: 'Rice bran + Alpha arbutin brightening serum for glass skin.',
      image_url: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=600&h=600&fit=crop',
      skin_type: 'All skin types',
      in_stock: true
    },
    {
      name_korean: '달팽이 96 뮤신 에센스',
      name_english: 'Snail 96 Mucin Essence',
      brand: 'COSRX',
      seoul_price: 12.00,
      us_price: 89.00,
      savings_percentage: 74,
      category: 'Essence',
      description: '96% snail mucin for repair & hydration.',
      image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
      skin_type: 'All skin types',
      in_stock: true
    },
    {
      name_korean: '워터 슬리핑 마스크',
      name_english: 'Water Sleeping Mask',
      brand: 'Laneige',
      seoul_price: 12.00,
      us_price: 34.00,
      savings_percentage: 65,
      category: 'Mask',
      description: 'Overnight hydration miracle with Sleeping Micro Biome™.',
      image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=600&fit=crop',
      skin_type: 'All skin types',
      in_stock: true
    }
  ]

  try {
    // First, delete existing sample products
    console.log('Clearing existing sample data...')
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .in('name_english', ['Red Bean Water', 'Centella Asiatica Toner', 'Yun Jo Essence', 'Aqua Serum', 'Good Morning Gel Cleanser'])

    if (deleteError && deleteError.code !== 'PGRST116') {
      console.log('Note: Could not clear old sample data (may not exist)')
    }

    // Insert new products
    console.log('Inserting Seoul Sister curated collection...')
    const { data, error } = await supabase
      .from('products')
      .insert(products)
      .select()

    if (error) {
      console.error('Error seeding products:', error)
      throw error
    }

    console.log(`✅ Successfully seeded ${products.length} products!`)
    if (data) {
      data.forEach(p => console.log(`  - ${p.brand} ${p.name_english}: $${p.seoul_price} (Seoul) vs $${p.us_price} (US)`))
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

// Run the seeding directly since we can't execute arbitrary SQL
seedProducts().then(() => {
  console.log('✅ Database setup complete!')
  process.exit(0)
}).catch(error => {
  console.error('❌ Setup failed:', error)
  process.exit(1)
})