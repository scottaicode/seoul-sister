import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Fallback products data when Supabase is not available
const fallbackProducts = [
  {
    id: '1',
    name_korean: '글로우 딥 세럼',
    name_english: 'Glow Deep Serum',
    brand: 'Beauty of Joseon',
    seoul_price: 8.5,
    us_price: 45,
    savings_percentage: 82,
    category: 'Serum',
    description: 'Rice bran + Alpha arbutin brightening serum for glass skin',
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
    skin_type: 'All skin types',
    in_stock: true,
    popularity_score: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '2',
    name_korean: '달팽이 96 뮤신 에센스',
    name_english: 'Snail 96 Mucin Essence',
    brand: 'COSRX',
    seoul_price: 12,
    us_price: 89,
    savings_percentage: 74,
    category: 'Essence',
    description: '96% snail mucin for repair & hydration',
    image_url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&h=600&fit=crop',
    skin_type: 'All skin types',
    in_stock: true,
    popularity_score: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '3',
    name_korean: '퍼스트 케어 액티베이팅 세럼',
    name_english: 'First Care Activating Serum',
    brand: 'Sulwhasoo',
    seoul_price: 28,
    us_price: 94,
    savings_percentage: 70,
    category: 'Serum',
    description: 'Premium anti-aging serum with ginseng and traditional Korean herbs',
    image_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&h=600&fit=crop',
    skin_type: 'All skin types',
    in_stock: true,
    popularity_score: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '4',
    name_korean: '워터 슬리핑 마스크',
    name_english: 'Water Sleeping Mask',
    brand: 'Laneige',
    seoul_price: 12,
    us_price: 34,
    savings_percentage: 65,
    category: 'Mask',
    description: 'Overnight hydrating mask for deep moisture replenishment',
    image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=600&fit=crop',
    skin_type: 'All skin types',
    in_stock: true,
    popularity_score: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// Initialize Supabase client only if environment variables are available
let supabase: any = null
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }
} catch (error) {
  console.warn('Supabase not available, using fallback data')
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const featured = searchParams.get('featured')

    // If Supabase is not available, use fallback data
    if (!supabase) {
      console.log('Using fallback products data')
      let products = [...fallbackProducts]

      if (category) {
        products = products.filter(p => p.category === category)
      }

      if (featured === 'true') {
        products = products.slice(0, 4)
      }

      return NextResponse.json({ products })
    }

    let query = supabase
      .from('products')
      .select('*')
      .eq('in_stock', true)
      .order('savings_percentage', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    if (featured === 'true') {
      query = query.limit(4)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching products:', error)
      // Fall back to static data if Supabase fails
      console.log('Falling back to static products due to Supabase error')
      let products = [...fallbackProducts]

      if (category) {
        products = products.filter(p => p.category === category)
      }

      if (featured === 'true') {
        products = products.slice(0, 4)
      }

      return NextResponse.json({ products })
    }

    return NextResponse.json({ products: data || [] })
  } catch (error) {
    console.error('Unexpected error:', error)
    // Fall back to static data on any error
    console.log('Falling back to static products due to unexpected error')
    let products = [...fallbackProducts]

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const featured = searchParams.get('featured')

    if (category) {
      products = products.filter(p => p.category === category)
    }

    if (featured === 'true') {
      products = products.slice(0, 4)
    }

    return NextResponse.json({ products })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // If Supabase is not available, return error
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 })
    }

    const { data, error } = await supabase
      .from('products')
      .insert([body])
      .select()
      .single()

    if (error) {
      console.error('Error creating product:', error)
      return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
    }

    return NextResponse.json({ product: data })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}