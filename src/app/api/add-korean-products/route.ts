/**
 * Add Korean Products API
 * Manually adds a batch of trending Korean products to expand the catalog
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// New trending Korean products to add (different from existing ones)
const NEW_KOREAN_PRODUCTS = [
  {
    name_korean: "스네일 96 뮤신 파워 에센스",
    name_english: "Snail 96 Mucin Power Essence",
    brand: "COSRX",
    seoul_price: 13,
    us_price: 25,
    savings_percentage: 48,
    category: "Essence",
    description: "Lightweight essence with 96% snail secretion filtrate for hydration and repair",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    korean_site_url: "https://global.oliveyoung.com/product/snail-96-mucin-power-essence",
    skin_type: "All skin types",
    in_stock: true,
    popularity_score: 95
  },
  {
    name_korean: "다이브인 저분자 히알루론산 세럼",
    name_english: "DIVE-IN Low Molecule Hyaluronic Acid Serum",
    brand: "Torriden",
    seoul_price: 18,
    us_price: 78,
    savings_percentage: 77,
    category: "Serum",
    description: "5 types of hyaluronic acid for deep hydration",
    image_url: "https://images.unsplash.com/photo-1617897094665-d019c0ac14f5",
    korean_site_url: "https://global.oliveyoung.com/product/dive-in-hyaluronic-acid-serum",
    skin_type: "Dry, Dehydrated",
    in_stock: true,
    popularity_score: 91
  },
  {
    name_korean: "하트리프 77% 수딩 토너",
    name_english: "Heartleaf 77% Soothing Toner",
    brand: "Anua",
    seoul_price: 13,
    us_price: 29,
    savings_percentage: 55,
    category: "Toner",
    description: "Soothing toner with 77% heartleaf extract for irritated skin",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    korean_site_url: "https://global.oliveyoung.com/product/heartleaf-soothing-toner",
    skin_type: "Sensitive, Acne-prone",
    in_stock: true,
    popularity_score: 94
  },
  {
    name_korean: "1025 독도 토너",
    name_english: "1025 Dokdo Toner",
    brand: "Round Lab",
    seoul_price: 17,
    us_price: 38,
    savings_percentage: 55,
    category: "Toner",
    description: "Gentle toner with Ulleungdo deep sea water for sensitive skin",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    korean_site_url: "https://global.oliveyoung.com/product/1025-dokdo-toner",
    skin_type: "Sensitive, All types",
    in_stock: true,
    popularity_score: 90
  },
  {
    name_korean: "릴리프 선 라이스 + 프로바이오틱스 SPF50+",
    name_english: "Relief Sun Rice + Probiotics SPF50+",
    brand: "Beauty of Joseon",
    seoul_price: 15,
    us_price: 35,
    savings_percentage: 57,
    category: "Sunscreen",
    description: "Chemical sunscreen with rice bran and probiotics for sensitive skin",
    image_url: "https://images.unsplash.com/photo-1556760544-74068565f05c",
    korean_site_url: "https://global.oliveyoung.com/product/relief-sun-rice-probiotics",
    skin_type: "Sensitive, All types",
    in_stock: true,
    popularity_score: 96
  },
  {
    name_korean: "레드 티트리 스팟 오일",
    name_english: "Red Tea Tree Spot Oil",
    brand: "Some By Mi",
    seoul_price: 12,
    us_price: 25,
    savings_percentage: 52,
    category: "Treatment",
    description: "Targeted spot treatment with red tea tree for acne",
    image_url: "https://images.unsplash.com/photo-1617897094665-d019c0ac14f5",
    korean_site_url: "https://global.oliveyoung.com/product/red-tea-tree-spot-oil",
    skin_type: "Acne-prone, Oily",
    in_stock: true,
    popularity_score: 86
  },
  {
    name_korean: "저pH 굿모닝 젤 클렌저",
    name_english: "Low pH Good Morning Gel Cleanser",
    brand: "COSRX",
    seoul_price: 11,
    us_price: 18,
    savings_percentage: 39,
    category: "Cleanser",
    description: "Gentle morning cleanser with low pH and BHA for oily skin",
    image_url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b",
    korean_site_url: "https://global.oliveyoung.com/product/low-ph-good-morning-gel-cleanser",
    skin_type: "Oily, Combination",
    in_stock: true,
    popularity_score: 82
  },
  {
    name_korean: "아이엠프롬 쑥 에센스",
    name_english: "Mugwort Essence",
    brand: "I'm From",
    seoul_price: 24,
    us_price: 58,
    savings_percentage: 59,
    category: "Essence",
    description: "Soothing essence with 100% mugwort extract from Ganghwa",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    korean_site_url: "https://global.oliveyoung.com/product/mugwort-essence",
    skin_type: "Sensitive, Acne-prone",
    in_stock: true,
    popularity_score: 89
  },
  {
    name_Korean: "그린티 씨드 세럼",
    name_english: "Green Tea Seed Serum",
    brand: "Innisfree",
    seoul_price: 20,
    us_price: 45,
    savings_percentage: 56,
    category: "Serum",
    description: "Antioxidant serum with Jeju green tea for hydration",
    image_url: "https://images.unsplash.com/photo-1617897094665-d019c0ac14f5",
    korean_site_url: "https://global.oliveyoung.com/product/green-tea-seed-serum",
    skin_type: "All types",
    in_stock: true,
    popularity_score: 81
  },
  {
    name_korean: "순정 pH 6.5 휩 클렌저",
    name_english: "SoonJung pH 6.5 Whip Cleanser",
    brand: "Etude House",
    seoul_price: 8,
    us_price: 16,
    savings_percentage: 50,
    category: "Cleanser",
    description: "Gentle whip cleanser with pH 6.5 for sensitive skin",
    image_url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b",
    korean_site_url: "https://global.oliveyoung.com/product/soonjung-ph-whip-cleanser",
    skin_type: "Sensitive, All types",
    in_stock: true,
    popularity_score: 86
  }
]

export async function POST(request: Request) {
  try {
    const { count = 10, force = false } = await request.json()

    console.log(`🚀 Adding ${count} trending Korean products to Seoul Sister...`)

    let addedCount = 0
    const addedProducts = []
    const skippedProducts = []

    for (let i = 0; i < Math.min(count, NEW_KOREAN_PRODUCTS.length); i++) {
      const product = NEW_KOREAN_PRODUCTS[i]

      try {
        // Check if product already exists
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id, name_english, brand')
          .eq('brand', product.brand)
          .eq('name_english', product.name_english)
          .single()

        if (existingProduct && !force) {
          console.log(`⏭️  Skipping existing product: ${product.brand} ${product.name_english}`)
          skippedProducts.push({
            brand: product.brand,
            name: product.name_english,
            reason: 'Already exists'
          })
          continue
        }

        // Insert new product
        const { data: insertedProduct, error: insertError } = await supabase
          .from('products')
          .insert(product)
          .select()

        if (insertError) {
          console.error(`❌ Error adding ${product.name_english}:`, insertError)
          skippedProducts.push({
            brand: product.brand,
            name: product.name_english,
            reason: insertError.message
          })
        } else {
          console.log(`✅ Added: ${product.brand} ${product.name_english} (${product.savings_percentage}% savings)`)
          addedCount++
          addedProducts.push({
            brand: product.brand,
            name: product.name_english,
            seoul_price: product.seoul_price,
            us_price: product.us_price,
            savings_percentage: product.savings_percentage,
            category: product.category
          })
        }
      } catch (error) {
        console.error(`❌ Exception adding ${product.name_english}:`, error)
        skippedProducts.push({
          brand: product.brand,
          name: product.name_english,
          reason: String(error)
        })
      }
    }

    // Get updated product count
    const { count: totalProducts } = await supabase
      .from('products')
      .select('id', { count: 'exact' })

    console.log(`🎉 Successfully added ${addedCount} Korean products to Seoul Sister!`)

    return NextResponse.json({
      success: true,
      added_count: addedCount,
      skipped_count: skippedProducts.length,
      total_products: totalProducts,
      added_products: addedProducts,
      skipped_products: skippedProducts,
      message: `Successfully added ${addedCount} trending Korean products! Catalog expanded from 4 to ${totalProducts} products.`,
      transformation: {
        before: '4 manually-seeded products',
        after: `${totalProducts} products including trending Korean discoveries`,
        savings_range: '39-77% typical savings vs US retail',
        categories_added: [...new Set(addedProducts.map(p => p.category))]
      }
    })

  } catch (error) {
    console.error('❌ Add Korean products failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to add Korean products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { count: currentProducts } = await supabase
      .from('products')
      .select('id', { count: 'exact' })

    return NextResponse.json({
      status: 'Ready to add Korean products',
      current_products: currentProducts,
      available_products: NEW_KOREAN_PRODUCTS.length,
      sample_products: NEW_KOREAN_PRODUCTS.slice(0, 3).map(p => ({
        name: p.name_english,
        brand: p.brand,
        seoul_price: p.seoul_price,
        us_price: p.us_price,
        savings: p.savings_percentage + '%'
      })),
      usage: {
        add_all: 'POST {"count": 10}',
        add_specific: 'POST {"count": 5}',
        force_replace: 'POST {"count": 10, "force": true}'
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}