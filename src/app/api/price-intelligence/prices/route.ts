import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const retailerId = searchParams.get('retailerId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeHistory = searchParams.get('history') === 'true';

    let query = supabase
      .from('product_prices')
      .select(`
        *,
        price_retailers (
          name,
          domain,
          country,
          average_shipping_cost,
          free_shipping_threshold
        )
      `)
      .order('price_date', { ascending: false })
      .limit(limit);

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (retailerId) {
      query = query.eq('retailer_id', retailerId);
    }

    const { data: prices, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch prices: ${error.message}`);
    }

    let response: any = {
      success: true,
      prices: prices || [],
      count: prices?.length || 0
    };

    // Include price history if requested
    if (includeHistory && productId) {
      const { data: history } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', productId)
        .order('recorded_date', { ascending: false })
        .limit(30);

      response.priceHistory = history || [];
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching prices:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Manual price update endpoint (for admin use)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, retailerId, price, inStock, notes } = body;

    if (!productId || !retailerId || !price) {
      return NextResponse.json({
        error: 'Missing required fields: productId, retailerId, price'
      }, { status: 400 });
    }

    const priceData = {
      product_id: productId,
      retailer_id: retailerId,
      current_price: price,
      currency: 'USD',
      in_stock: inStock ?? true,
      stock_level: inStock ? 'high' : 'out_of_stock',
      retailer_product_name: 'Manual Entry',
      retailer_product_url: '',
      price_confidence: 1.0,
      data_source: 'manual',
      price_date: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('product_prices')
      .upsert(priceData)
      .select();

    if (error) {
      throw new Error(`Failed to save price: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Price updated successfully',
      data: data[0]
    });

  } catch (error) {
    console.error('Error updating price:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}