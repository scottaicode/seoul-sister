import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST() {
  try {
    const supabase = createClient();

    // Get retailer IDs first
    const { data: retailers, error: retailerError } = await supabase
      .from('price_retailers')
      .select('id, name');

    if (retailerError) {
      console.error('Error fetching retailers:', retailerError);
      return NextResponse.json({ error: 'Failed to fetch retailers' }, { status: 500 });
    }

    const yesStyleId = retailers?.find((r: any) => r.name === 'YesStyle')?.id;
    const styleKoreanId = retailers?.find((r: any) => r.name === 'StyleKorean')?.id;
    const oliveYoungId = retailers?.find((r: any) => r.name === 'Olive Young Global')?.id;
    const sephoraId = retailers?.find((r: any) => r.name === 'Sephora')?.id;

    // Insert sample deal data
    const sampleDeals = [
      {
        product_id: 'cosrx-snail-essence',
        retailer_id: yesStyleId,
        current_price: 23.50,
        previous_price: 29.00,
        savings_amount: 5.50,
        savings_percentage: 19.00,
        deal_type: 'price_drop',
        deal_score: 85,
        stock_status: 'in_stock'
      },
      {
        product_id: 'beauty-joseon-spf',
        retailer_id: styleKoreanId,
        current_price: 15.99,
        previous_price: 21.00,
        savings_amount: 5.01,
        savings_percentage: 23.86,
        deal_type: 'flash_sale',
        deal_score: 92,
        stock_status: 'in_stock'
      },
      {
        product_id: 'innisfree-green-tea-serum',
        retailer_id: oliveYoungId,
        current_price: 19.20,
        previous_price: 24.00,
        savings_amount: 4.80,
        savings_percentage: 20.00,
        deal_type: 'new_low',
        deal_score: 88,
        stock_status: 'in_stock'
      },
      {
        product_id: 'some-by-mi-bye-bye-toner',
        retailer_id: yesStyleId,
        current_price: 12.90,
        previous_price: 16.50,
        savings_amount: 3.60,
        savings_percentage: 21.82,
        deal_type: 'clearance',
        deal_score: 79,
        stock_status: 'in_stock'
      },
      {
        product_id: 'torriden-dive-in-serum',
        retailer_id: styleKoreanId,
        current_price: 14.99,
        previous_price: 18.00,
        savings_amount: 3.01,
        savings_percentage: 16.72,
        deal_type: 'price_drop',
        deal_score: 84,
        stock_status: 'in_stock'
      }
    ];

    const { data: dealsData, error: dealsError } = await supabase
      .from('daily_deals')
      .insert(sampleDeals)
      .select();

    if (dealsError) {
      console.error('Error inserting deals:', dealsError);
      return NextResponse.json({ error: 'Failed to insert deals' }, { status: 500 });
    }

    // Insert sample product prices
    const samplePrices = [
      {
        product_id: 'cosrx-snail-essence',
        retailer_id: yesStyleId,
        current_price: 23.50,
        original_price: 29.00,
        currency: 'USD',
        in_stock: true,
        retailer_product_name: 'COSRX Advanced Snail 96 Mucin Power Essence',
        shipping_cost: 7.99,
        total_cost: 31.49
      },
      {
        product_id: 'cosrx-snail-essence',
        retailer_id: sephoraId,
        current_price: 29.00,
        currency: 'USD',
        in_stock: true,
        retailer_product_name: 'Advanced Snail 96 Mucin Power Essence',
        shipping_cost: 5.95,
        total_cost: 34.95
      },
      {
        product_id: 'beauty-joseon-spf',
        retailer_id: styleKoreanId,
        current_price: 15.99,
        original_price: 21.00,
        currency: 'USD',
        in_stock: true,
        retailer_product_name: 'Relief Sun: Rice + Probiotics SPF50+ PA++++',
        shipping_cost: 6.99,
        total_cost: 22.98
      },
      {
        product_id: 'innisfree-green-tea-serum',
        retailer_id: oliveYoungId,
        current_price: 19.20,
        original_price: 24.00,
        currency: 'USD',
        in_stock: true,
        retailer_product_name: 'Green Tea Seed Hyaluronic Serum',
        shipping_cost: 12.99,
        total_cost: 32.19
      }
    ];

    const { data: pricesData, error: pricesError } = await supabase
      .from('product_prices')
      .insert(samplePrices)
      .select();

    if (pricesError) {
      console.error('Error inserting prices:', pricesError);
      return NextResponse.json({ error: 'Failed to insert prices' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Sample data seeded successfully',
      dealsInserted: dealsData?.length || 0,
      pricesInserted: pricesData?.length || 0
    });

  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}