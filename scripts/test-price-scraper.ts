/**
 * Quick test for price scrapers. Run:
 * npx tsx --tsconfig tsconfig.json scripts/test-price-scraper.ts
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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
  console.error('No .env.local found')
}

async function testSokoGlam() {
  console.log('\n=== Testing Soko Glam Scraper ===')
  const { SokoGlamScraper } = await import('../src/lib/pipeline/sources/soko-glam')
  const scraper = new SokoGlamScraper({ delayMs: 1000 })

  const results = await scraper.searchProduct('COSRX', 'Snail Mucin')
  console.log(`Found ${results.length} results`)
  for (const r of results.slice(0, 3)) {
    console.log(`  $${r.price_usd} | ${r.brand} - ${r.product_name.slice(0, 60)}`)
    console.log(`  URL: ${r.url}`)
  }
  return results
}

async function testStyleKorean() {
  console.log('\n=== Testing StyleKorean Scraper (Playwright) ===')
  const { StyleKoreanScraper } = await import('../src/lib/pipeline/sources/stylekorean')
  const scraper = new StyleKoreanScraper({ delayMs: 1000 })

  try {
    const results = await scraper.searchProduct('COSRX', 'Snail Mucin')
    console.log(`Found ${results.length} results`)
    for (const r of results.slice(0, 3)) {
      console.log(`  $${r.price_usd} | ${r.brand} - ${r.product_name.slice(0, 60)}`)
      console.log(`  URL: ${r.url}`)
    }
    return results
  } finally {
    await scraper.close()
  }
}

async function testYesStyle() {
  console.log('\n=== Testing YesStyle Scraper (Playwright) ===')
  const { YesStyleScraper } = await import('../src/lib/pipeline/sources/yesstyle')
  const scraper = new YesStyleScraper({ delayMs: 1000 })

  try {
    const results = await scraper.searchProduct('COSRX', 'Snail Mucin')
    console.log(`Found ${results.length} results`)
    for (const r of results.slice(0, 3)) {
      console.log(`  $${r.price_usd} | ${r.brand} - ${r.product_name.slice(0, 60)}`)
      console.log(`  URL: ${r.url}`)
    }
    return results
  } finally {
    await scraper.close()
  }
}

async function testAmazon() {
  console.log('\n=== Testing Amazon Scraper (Playwright) ===')
  const { AmazonScraper } = await import('../src/lib/pipeline/sources/amazon')
  const scraper = new AmazonScraper({ delayMs: 2000 })

  try {
    const results = await scraper.searchProduct('COSRX', 'Snail Mucin')
    console.log(`Found ${results.length} results`)
    for (const r of results.slice(0, 3)) {
      console.log(`  $${r.price_usd} | ${r.brand} - ${r.product_name.slice(0, 60)}`)
      console.log(`  URL: ${r.url}`)
    }
    return results
  } finally {
    await scraper.close()
  }
}

async function testPriceMatcher() {
  console.log('\n=== Testing Price Matcher ===')
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { PriceMatcher } = await import('../src/lib/pipeline/price-matcher')
  const matcher = new PriceMatcher()

  const count = await matcher.loadProducts(supabase)
  console.log(`Loaded ${count} products for matching`)

  // Test matching a scraped price
  const testPrice = {
    retailer: 'soko_glam' as const,
    product_name: 'COSRX Advanced Snail 96 Mucin Power Essence',
    brand: 'COSRX',
    price_usd: 25.00,
    price_krw: null,
    url: 'https://sokoglam.com/products/cosrx-advanced-snail-96-mucin-power-essence',
    in_stock: true,
    image_url: null,
  }

  const match = matcher.matchProduct(testPrice)
  if (match) {
    console.log(`Matched: ${match.product_brand} - ${match.product_name}`)
    console.log(`Confidence: ${match.confidence.toFixed(2)} (${match.match_method})`)
    console.log(`Product ID: ${match.product_id}`)
  } else {
    console.log('No match found')
  }

  // Test retailer ID lookup
  const retailerId = await matcher.getRetailerId(supabase, 'soko_glam')
  console.log(`Soko Glam retailer ID: ${retailerId}`)
}

async function main() {
  const arg = process.argv[2]

  if (arg === 'soko_glam') {
    await testSokoGlam()
  } else if (arg === 'stylekorean') {
    await testStyleKorean()
  } else if (arg === 'yesstyle') {
    await testYesStyle()
  } else if (arg === 'amazon') {
    await testAmazon()
  } else if (arg === 'matcher') {
    await testPriceMatcher()
  } else {
    // Run all tests
    await testPriceMatcher()
    await testSokoGlam()
    await testYesStyle()
    await testStyleKorean()
    await testAmazon()
  }
}

main().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
