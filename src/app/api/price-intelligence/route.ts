import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { compareRetailerPrices, getBestAffiliateDeal } from '@/lib/affiliates'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const action = searchParams.get('action')

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    switch (action) {
      case 'compare':
        // Get price comparisons across retailers
        const comparisons = await compareRetailerPrices(productId)
        return NextResponse.json({
          product,
          comparisons,
          lowestPrice: comparisons[0]?.totalCost || (product as any).best_price_found || (product as any).seoul_price || 0,
          highestPrice: comparisons[comparisons.length - 1]?.totalCost || (product as any).us_price || 0,
          averagePrice: comparisons.length > 0 ? comparisons.reduce((sum, c) => sum + c.totalCost, 0) / comparisons.length : ((product as any).best_price_found || (product as any).seoul_price || 0),
        })

      case 'best-deal':
        // Get the best affiliate deal
        const bestDeal = await getBestAffiliateDeal(productId)
        return NextResponse.json({
          product,
          bestDeal,
        })

      case 'history':
        // Get price history for trend analysis
        const { data: priceHistory, error: historyError } = await supabase
          .from('price_tracking_history')
          .select('*')
          .eq('product_id', productId)
          .order('tracked_at', { ascending: false })
          .limit(30)

        if (historyError) {
          throw historyError
        }

        // Group by retailer for charting
        const historyByRetailer = (priceHistory || []).reduce((acc: Record<string, any[]>, record: any) => {
          const retailer = record.retailer || 'Unknown'
          if (!acc[retailer]) {
            acc[retailer] = []
          }
          acc[retailer].push({
            date: record.tracked_at,
            price: record.price || 0,
            totalCost: record.total_cost || record.price || 0,
          })
          return acc
        }, {} as Record<string, any[]>)

        return NextResponse.json({
          product,
          history: historyByRetailer,
          priceRange: {
            min: priceHistory && priceHistory.length > 0 ? Math.min(...priceHistory.map((h: any) => h.price || 0)) : 0,
            max: priceHistory && priceHistory.length > 0 ? Math.max(...priceHistory.map((h: any) => h.price || 0)) : 0,
            current: (product as any).best_price_found || (product as any).seoul_price || 0,
          },
        })

      case 'alerts':
        // Get or set price alerts for user
        const userId = request.headers.get('x-user-id')
        if (!userId) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }

        const { data: alerts, error: alertError } = await supabase
          .from('deal_alerts')
          .select('*')
          .eq('user_id', userId)
          .eq('product_id', productId)

        if (alertError) {
          throw alertError
        }

        return NextResponse.json({
          product,
          alerts,
          hasAlert: alerts.length > 0,
        })

      default:
        // Return basic price intelligence
        const { data: retailers } = await supabase
          .from('retailer_trust_scores')
          .select('*')
          .order('overall_trust_rating', { ascending: false })

        return NextResponse.json({
          product: {
            ...(product as any),
            bestPrice: (product as any).best_price_found || (product as any).seoul_price || 0,
            bestRetailer: (product as any).best_retailer || 'Seoul Sister',
            savingsAmount: ((product as any).us_price || 0) - ((product as any).best_price_found || (product as any).seoul_price || 0),
            savingsPercentage: (product as any).us_price ? Math.round((((product as any).us_price - ((product as any).best_price_found || (product as any).seoul_price || 0)) / (product as any).us_price) * 100) : 0,
          },
          retailers,
          lastUpdated: (product as any).price_last_updated || (product as any).updated_at || new Date().toISOString(),
        })
    }
  } catch (error) {
    console.error('Price intelligence API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch price intelligence' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, action, userId, data } = body

    if (!productId || !action) {
      return NextResponse.json(
        { error: 'Product ID and action are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    switch (action) {
      case 'track-price':
        // Add a new price tracking entry
        const { retailer, price, shipping, promotion } = data
        if (!retailer || !price) {
          return NextResponse.json(
            { error: 'Retailer and price are required' },
            { status: 400 }
          )
        }

        const { data: trackingEntry, error: trackingError } = await supabase
          .from('price_tracking_history')
          .insert({
            product_id: productId,
            retailer,
            price,
            shipping_cost: shipping || 0,
            total_cost: price + (shipping || 0),
            promotion_info: promotion,
            availability: true,
          })
          .select()
          .single()

        if (trackingError) {
          throw trackingError
        }

        return NextResponse.json({
          success: true,
          entry: trackingEntry,
        })

      case 'set-alert':
        // Create or update a price alert
        if (!userId) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }

        const { targetPrice, alertOnDiscount, alertWhenAvailable } = data
        const { data: alert, error: alertError } = await supabase
          .from('deal_alerts')
          .upsert({
            user_id: userId,
            product_id: productId,
            target_price: targetPrice,
            alert_on_any_discount: alertOnDiscount || false,
            alert_when_available: alertWhenAvailable || false,
            is_active: true,
          })
          .select()
          .single()

        if (alertError) {
          throw alertError
        }

        return NextResponse.json({
          success: true,
          alert,
        })

      case 'add-to-wishlist':
        // Add product to user's wishlist
        if (!userId) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }

        const { notes, priority } = data
        const { data: wishlistItem, error: wishlistError } = await supabase
          .from('wishlists')
          .upsert({
            user_id: userId,
            product_id: productId,
            notes,
            priority: priority || 0,
          })
          .select()
          .single()

        if (wishlistError) {
          throw wishlistError
        }

        return NextResponse.json({
          success: true,
          item: wishlistItem,
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Price intelligence API error:', error)
    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    )
  }
}