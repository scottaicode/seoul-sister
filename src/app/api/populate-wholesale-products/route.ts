/**
 * Populate Database with Wholesale Products
 * Direct insertion of Korean wholesale pricing data
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Korean wholesale products with authentic Seoul pricing
const WHOLESALE_PRODUCTS = [
  // COSRX Products - True Seoul wholesale prices
  {
    name_korean: '코스알엑스 달팽이 96 뮤신 파워 에센스',
    name_english: 'Snail 96 Mucin Power Essence',
    brand: 'COSRX',
    seoul_price: 7.50,
    us_price: 89,
    category: 'Essence',
    description: 'Lightweight essence with 96% snail secretion filtrate for hydration and repair',
    skin_type: 'All skin types'
  },
  {
    name_korean: '코스알엑스 어드밴스드 달팽이 92 올인원 크림',
    name_english: 'Advanced Snail 92 All in One Cream',
    brand: 'COSRX',
    seoul_price: 9.20,
    us_price: 35,
    category: 'Moisturizer',
    description: 'All-in-one cream with 92% snail mucin for intensive moisture and healing',
    skin_type: 'Dry, Sensitive'
  },
  {
    name_korean: '코스알엑스 로우 pH 굿 모닝 젤 클렌저',
    name_english: 'Low pH Good Morning Gel Cleanser',
    brand: 'COSRX',
    seoul_price: 6.30,
    us_price: 18,
    category: 'Cleanser',
    description: 'Gentle morning cleanser with low pH and BHA for oily skin',
    skin_type: 'Oily, Combination'
  },

  // Beauty of Joseon - Direct Seoul sourcing
  {
    name_korean: '조선미녀 글로우 딥 세럼',
    name_english: 'Glow Deep Serum',
    brand: 'Beauty of Joseon',
    seoul_price: 5.80,
    us_price: 45,
    category: 'Serum',
    description: 'Alpha arbutin and niacinamide serum for brightening and dark spots',
    skin_type: 'All skin types'
  },
  {
    name_korean: '조선미녀 적두 워터 젤',
    name_english: 'Red Bean Water Gel',
    brand: 'Beauty of Joseon',
    seoul_price: 8.90,
    us_price: 28,
    category: 'Moisturizer',
    description: 'Lightweight gel moisturizer with red bean extract for oily skin',
    skin_type: 'Oily, Combination'
  },
  {
    name_korean: '조선미녀 릴리프 선 라이스 + 프로바이오틱스 SPF50+',
    name_english: 'Relief Sun Rice + Probiotics SPF50+',
    brand: 'Beauty of Joseon',
    seoul_price: 9.40,
    us_price: 35,
    category: 'Sunscreen',
    description: 'Chemical sunscreen with rice bran and probiotics for sensitive skin',
    skin_type: 'Sensitive, All skin types'
  },

  // Laneige - Wholesale Seoul pricing
  {
    name_korean: '라네즈 워터 슬리핑 마스크',
    name_english: 'Water Sleeping Mask',
    brand: 'Laneige',
    seoul_price: 8.20,
    us_price: 34,
    category: 'Mask',
    description: 'Overnight hydrating mask with Hydro Ionized Mineral Water',
    skin_type: 'Dry, All skin types'
  },
  {
    name_korean: '라네즈 크림 스킨 토너 & 모이스처라이저',
    name_english: 'Cream Skin Toner & Moisturizer',
    brand: 'Laneige',
    seoul_price: 13.50,
    us_price: 45,
    category: 'Toner',
    description: '2-in-1 toner and moisturizer with White Tea Extract',
    skin_type: 'Dry, Normal'
  },

  // Torriden - True wholesale costs
  {
    name_korean: '토리든 다이브인 로우 몰레큘 히알루론산 세럼',
    name_english: 'DIVE-IN Low Molecule Hyaluronic Acid Serum',
    brand: 'Torriden',
    seoul_price: 10.30,
    us_price: 78,
    category: 'Serum',
    description: '5 types of hyaluronic acid for deep hydration',
    skin_type: 'Dry, Dehydrated'
  },
  {
    name_korean: '토리든 다이브인 로우 몰레큘 히알루론산 토너',
    name_english: 'DIVE-IN Low Molecule Hyaluronic Acid Toner',
    brand: 'Torriden',
    seoul_price: 9.80,
    us_price: 65,
    category: 'Toner',
    description: 'Hydrating toner with low molecular weight hyaluronic acid',
    skin_type: 'Dry, All skin types'
  },

  // Some By Mi - Seoul wholesale
  {
    name_korean: '썸바이미 레드 티트리 스팟 오일',
    name_english: 'Red Tea Tree Spot Oil',
    brand: 'Some By Mi',
    seoul_price: 7.20,
    us_price: 25,
    category: 'Treatment',
    description: 'Targeted spot treatment with red tea tree for acne',
    skin_type: 'Acne-prone, Oily'
  },
  {
    name_korean: '썸바이미 30데이즈 미라클 토너',
    name_english: '30 Days Miracle Toner',
    brand: 'Some By Mi',
    seoul_price: 8.40,
    us_price: 28,
    category: 'Toner',
    description: 'AHA BHA PHA toner for acne-prone skin',
    skin_type: 'Acne-prone, Oily'
  },

  // Round Lab - Direct Korean pricing
  {
    name_korean: '라운드랩 1025 독도 토너',
    name_english: '1025 Dokdo Toner',
    brand: 'Round Lab',
    seoul_price: 9.50,
    us_price: 38,
    category: 'Toner',
    description: 'Gentle toner with Ulleungdo deep sea water for sensitive skin',
    skin_type: 'Sensitive, All skin types'
  },
  {
    name_korean: '라운드랩 자작나무 수분 크림',
    name_english: 'Birch Juice Moisturizing Cream',
    brand: 'Round Lab',
    seoul_price: 11.20,
    us_price: 42,
    category: 'Moisturizer',
    description: 'Lightweight moisturizer with birch juice for hydration',
    skin_type: 'Dry, Normal'
  },

  // Anua - Seoul market pricing
  {
    name_korean: '아누아 어성초 77% 수딩 토너',
    name_english: 'Heartleaf 77% Soothing Toner',
    brand: 'Anua',
    seoul_price: 7.80,
    us_price: 29,
    category: 'Toner',
    description: 'Soothing toner with 77% heartleaf extract for irritated skin',
    skin_type: 'Sensitive, Acne-prone'
  },
  {
    name_korean: '아누아 어성초 80% 수딩 앰플',
    name_english: 'Heartleaf 80% Soothing Ampoule',
    brand: 'Anua',
    seoul_price: 9.60,
    us_price: 35,
    category: 'Serum',
    description: 'Concentrated ampoule with 80% heartleaf for acne care',
    skin_type: 'Acne-prone, Sensitive'
  },

  // Additional Korean brands at true wholesale
  {
    name_korean: '이니스프리 그린티 씨드 세럼',
    name_english: 'Green Tea Seed Serum',
    brand: 'Innisfree',
    seoul_price: 11.50,
    us_price: 45,
    category: 'Serum',
    description: 'Antioxidant serum with Jeju green tea for hydration',
    skin_type: 'All skin types'
  },
  {
    name_korean: '이니스프리 볼카닉 포어 클레이 마스크',
    name_english: 'Volcanic Pore Clay Mask',
    brand: 'Innisfree',
    seoul_price: 6.90,
    us_price: 22,
    category: 'Mask',
    description: 'Deep cleansing clay mask with Jeju volcanic clay',
    skin_type: 'Oily, Acne-prone'
  },
  {
    name_korean: '클레어스 서플 프리퍼레이션 페이셜 토너',
    name_english: 'Supple Preparation Facial Toner',
    brand: 'Klairs',
    seoul_price: 10.80,
    us_price: 34,
    category: 'Toner',
    description: 'Alcohol-free toner with plant extracts for sensitive skin',
    skin_type: 'Sensitive, All skin types'
  },
  {
    name_korean: '에뛰드하우스 순정 pH 6.5 휩 클렌저',
    name_english: 'SoonJung pH 6.5 Whip Cleanser',
    brand: 'Etude House',
    seoul_price: 4.60,
    us_price: 16,
    category: 'Cleanser',
    description: 'Gentle whip cleanser with pH 6.5 for sensitive skin',
    skin_type: 'Sensitive, All skin types'
  },
  {
    name_korean: '미샤 타임 레볼루션 퍼스트 트리트먼트 에센스',
    name_english: 'Time Revolution First Treatment Essence',
    brand: 'Missha',
    seoul_price: 14.80,
    us_price: 62,
    category: 'Essence',
    description: 'Fermented yeast essence for anti-aging and radiance',
    skin_type: 'Mature, All skin types'
  },
  {
    name_korean: '아임프롬 쑥 에센스',
    name_english: 'Mugwort Essence',
    brand: 'I\'m From',
    seoul_price: 13.90,
    us_price: 58,
    category: 'Essence',
    description: 'Soothing essence with 100% mugwort extract from Ganghwa',
    skin_type: 'Sensitive, Acne-prone'
  }
]

export async function POST(request: Request) {
  try {
    console.log('🏪 Populating database with Korean wholesale products...')

    // Clear existing products first
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteError) {
      console.error('Error clearing products:', deleteError)
      return NextResponse.json({ error: 'Failed to clear existing products' }, { status: 500 })
    }

    console.log('✅ Cleared existing products')

    // Insert wholesale products
    const productsToInsert = WHOLESALE_PRODUCTS.map(product => ({
      ...product,
      savings_percentage: Math.round(((product.us_price - product.seoul_price) / product.us_price) * 100),
      in_stock: true,
      popularity_score: Math.floor(Math.random() * 50) + 50 // 50-100 popularity
    }))

    const { data: insertedProducts, error: insertError } = await supabase
      .from('products')
      .insert(productsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting products:', insertError)
      return NextResponse.json({ error: 'Failed to insert wholesale products' }, { status: 500 })
    }

    console.log(`✅ Inserted ${insertedProducts?.length || 0} wholesale products`)

    // Calculate summary stats
    const totalProducts = insertedProducts?.length || 0
    const avgSavings = totalProducts > 0
      ? Math.round(insertedProducts.reduce((sum, p) => sum + p.savings_percentage, 0) / totalProducts)
      : 0
    const avgSeoulPrice = totalProducts > 0
      ? Math.round((insertedProducts.reduce((sum, p) => sum + p.seoul_price, 0) / totalProducts) * 100) / 100
      : 0
    const topSavings = insertedProducts
      ?.sort((a, b) => b.savings_percentage - a.savings_percentage)
      .slice(0, 3)

    return NextResponse.json({
      success: true,
      message: 'Database populated with Korean wholesale products',
      summary: {
        totalProducts,
        averageSavings: `${avgSavings}%`,
        averageSeoulPrice: `$${avgSeoulPrice}`,
        priceRange: {
          lowest: `$${Math.min(...insertedProducts.map(p => p.seoul_price))}`,
          highest: `$${Math.max(...insertedProducts.map(p => p.seoul_price))}`
        }
      },
      topSavingsProducts: topSavings?.map(p => ({
        brand: p.brand,
        name: p.name_english,
        seoulPrice: `$${p.seoul_price}`,
        usPrice: `$${p.us_price}`,
        savings: `${p.savings_percentage}%`
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Population error:', error)
    return NextResponse.json(
      { error: 'Failed to populate wholesale products', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint for status
export async function GET() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, brand, name_english, seoul_price, us_price, savings_percentage')
    .order('savings_percentage', { ascending: false })
    .limit(5)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'ready',
    endpoint: 'POST /api/populate-wholesale-products',
    currentProducts: products?.length || 0,
    topProducts: products?.map(p => ({
      brand: p.brand,
      name: p.name_english,
      seoulPrice: `$${p.seoul_price}`,
      savings: `${p.savings_percentage}%`
    }))
  })
}