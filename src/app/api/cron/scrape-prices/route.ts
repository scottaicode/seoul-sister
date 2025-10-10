/**
 * Automated Price Scraping Cron Job
 * Runs daily to update all product prices
 * Can be triggered by Vercel Cron or manually
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verify cron secret for security
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.log('Warning: CRON_SECRET not configured')
    return true // Allow in development
  }

  return authHeader === `Bearer ${cronSecret}`
}

// Scrape prices for a single product
async function scrapeProduct(product: any) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scrape-v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: product.name_english,
        brand: product.brand,
        autoUpdate: true
      })
    })

    const result = await response.json()

    if (result.success) {
      console.log(`✅ Updated prices for ${product.brand} ${product.name_english}`)
      return { success: true, product: product.name_english, ...result.analysis }
    } else {
      console.error(`❌ Failed to scrape ${product.brand} ${product.name_english}`)
      return { success: false, product: product.name_english, error: result.error }
    }
  } catch (error) {
    console.error(`❌ Error scraping ${product.brand} ${product.name_english}:`, error)
    return { success: false, product: product.name_english, error: String(error) }
  }
}

export async function GET(request: Request) {
  try {
    // Verify cron secret in production
    if (process.env.NODE_ENV === 'production' && !verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🤖 Starting automated price scraping...')

    // Create scraping job record
    const { data: job, error: jobError } = await supabase
      .from('scraping_jobs')
      .insert({
        job_type: 'price_check',
        status: 'running',
        started_at: new Date().toISOString(),
        target_data: { type: 'all_products' }
      })
      .select()
      .single()

    if (jobError) {
      console.error('Failed to create job record:', jobError)
    }

    // Get all products that need updating
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .or('auto_update.eq.true,last_scraped.is.null,last_scraped.lt.' +
         new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24 hours old

    if (fetchError) {
      console.error('Failed to fetch products:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    console.log(`Found ${products?.length || 0} products to update`)

    // Scrape prices for each product (with rate limiting)
    const results = []
    const BATCH_SIZE = 3 // Process 3 at a time to avoid rate limits

    for (let i = 0; i < (products?.length || 0); i += BATCH_SIZE) {
      const batch = products!.slice(i, i + BATCH_SIZE)

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(product => scrapeProduct(product))
      )

      results.push(...batchResults)

      // Rate limit: wait 2 seconds between batches
      if (i + BATCH_SIZE < products!.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    // Update job record with results
    if (job) {
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          results: {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            details: results
          }
        })
        .eq('id', job.id)
    }

    // Calculate summary statistics
    const summary = {
      totalProducts: results.length,
      successfulUpdates: results.filter(r => r.success).length,
      failedUpdates: results.filter(r => !r.success).length,
      avgSavingsPercent: Math.round(
        results
          .filter(r => r.success && r.savingsPercentage)
          .reduce((acc, r) => acc + r.savingsPercentage, 0) /
        results.filter(r => r.success && r.savingsPercentage).length || 0
      ),
      timestamp: new Date().toISOString()
    }

    console.log('✅ Scraping job completed:', summary)

    // Send notification if configured (Discord, Slack, etc)
    if (process.env.NOTIFICATION_WEBHOOK) {
      await fetch(process.env.NOTIFICATION_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `📊 Seoul Sister Price Update Complete!\n` +
                `Updated: ${summary.successfulUpdates}/${summary.totalProducts} products\n` +
                `Average savings: ${summary.avgSavingsPercent}%`
        })
      }).catch(console.error)
    }

    return NextResponse.json({
      success: true,
      message: 'Price scraping completed',
      summary,
      results: process.env.NODE_ENV === 'development' ? results : undefined
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Cron job failed', details: String(error) },
      { status: 500 }
    )
  }
}

// Manual trigger endpoint (POST)
export async function POST(request: Request) {
  // Allow manual trigger with proper auth
  const { products } = await request.json()

  if (products && Array.isArray(products)) {
    // Scrape specific products
    const results = await Promise.all(
      products.map(p => scrapeProduct(p))
    )

    return NextResponse.json({
      success: true,
      results
    })
  }

  // Otherwise run full cron
  return GET(request)
}