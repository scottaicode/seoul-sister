import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

interface PriceDataInsert {
  product_id: string;
  retailer_id: string;
  current_price: number;
  original_price?: number;
  currency: string;
  in_stock: boolean;
  retailer_product_name: string;
  shipping_cost: number;
  total_cost: number;
}

export async function GET() {
  return await seedComprehensiveData();
}

export async function POST() {
  return await seedComprehensiveData();
}

async function seedComprehensiveData() {
  try {
    const supabase = createClient();

    // Get retailer IDs first
    const { data: retailers, error: retailerError } = await supabase
      .from('price_retailers')
      .select('id, name, domain');

    if (retailerError) {
      console.error('Error fetching retailers:', retailerError);
      return NextResponse.json({ error: 'Failed to fetch retailers' }, { status: 500 });
    }

    const retailerMap = (retailers as any[]).reduce((acc: any, retailer: any) => {
      acc[retailer.name] = retailer;
      return acc;
    }, {});

    // Products to seed price data for
    const products = [
      'cosrx-snail-essence',
      'beauty-joseon-spf',
      'innisfree-green-tea-serum',
      'some-by-mi-bye-bye-toner',
      'torriden-dive-in-serum'
    ];

    // Comprehensive price data for each product across all retailers
    const allPriceData: PriceDataInsert[] = [];

    for (const productId of products) {
      // YesStyle - Korean specialist (often best prices)
      if (retailerMap['YesStyle']) {
        allPriceData.push({
          product_id: productId,
          retailer_id: retailerMap['YesStyle'].id,
          current_price: getBasePrice(productId) * 0.85, // Best price
          original_price: getBasePrice(productId),
          currency: 'USD',
          in_stock: true,
          retailer_product_name: getProductName(productId),
          shipping_cost: 7.99,
          total_cost: (getBasePrice(productId) * 0.85) + 7.99
        });
      }

      // StyleKorean - K-beauty focused
      if (retailerMap['StyleKorean']) {
        allPriceData.push({
          product_id: productId,
          retailer_id: retailerMap['StyleKorean'].id,
          current_price: getBasePrice(productId) * 0.90,
          original_price: getBasePrice(productId) * 1.05,
          currency: 'USD',
          in_stock: true,
          retailer_product_name: getProductName(productId),
          shipping_cost: 6.99,
          total_cost: (getBasePrice(productId) * 0.90) + 6.99,
        });
      }

      // Sephora - Premium retailer
      if (retailerMap['Sephora']) {
        allPriceData.push({
          product_id: productId,
          retailer_id: retailerMap['Sephora'].id,
          current_price: getBasePrice(productId) * 1.15, // Premium pricing
          currency: 'USD',
          in_stock: true,
          retailer_product_name: getProductName(productId),
          shipping_cost: 5.95,
          total_cost: (getBasePrice(productId) * 1.15) + 5.95,
        });
      }

      // Olive Young Global - Official Korean retailer
      if (retailerMap['Olive Young Global']) {
        allPriceData.push({
          product_id: productId,
          retailer_id: retailerMap['Olive Young Global'].id,
          current_price: getBasePrice(productId) * 0.95,
          original_price: getBasePrice(productId) * 1.10,
          currency: 'USD',
          in_stock: Math.random() > 0.2, // 80% in stock
          retailer_product_name: getProductName(productId),
          shipping_cost: 12.99,
          total_cost: (getBasePrice(productId) * 0.95) + 12.99,
        });
      }

      // Amazon - Mass market
      if (retailerMap['Amazon']) {
        allPriceData.push({
          product_id: productId,
          retailer_id: retailerMap['Amazon'].id,
          current_price: getBasePrice(productId) * 1.05,
          currency: 'USD',
          in_stock: Math.random() > 0.1, // 90% in stock
          retailer_product_name: getProductName(productId),
          shipping_cost: 0, // Free shipping
          total_cost: getBasePrice(productId) * 1.05,
        });
      }

      // Ulta - Beauty retailer
      if (retailerMap['Ulta']) {
        allPriceData.push({
          product_id: productId,
          retailer_id: retailerMap['Ulta'].id,
          current_price: getBasePrice(productId) * 1.10,
          currency: 'USD',
          in_stock: Math.random() > 0.3, // 70% in stock
          retailer_product_name: getProductName(productId),
          shipping_cost: 4.95,
          total_cost: (getBasePrice(productId) * 1.10) + 4.95,
        });
      }
    }

    // Clear existing price data first
    const { error: deleteError } = await (supabase as any)
      .from('product_prices')
      .delete()
      .in('product_id', products);

    if (deleteError) {
      console.error('Error clearing existing prices:', deleteError);
    }

    // Insert comprehensive price data
    const { data: pricesData, error: pricesError } = await (supabase as any)
      .from('product_prices')
      .insert(allPriceData)
      .select();

    if (pricesError) {
      console.error('Error inserting comprehensive prices:', pricesError);
      return NextResponse.json({ error: 'Failed to insert price data', details: pricesError }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Comprehensive price data seeded successfully',
      pricesInserted: pricesData?.length || 0,
      productsSeeded: products.length,
      retailersIncluded: Object.keys(retailerMap).length
    });

  } catch (error) {
    console.error('Error seeding comprehensive data:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getBasePrice(productId: string): number {
  const basePrices: Record<string, number> = {
    'cosrx-snail-essence': 25.00,
    'beauty-joseon-spf': 18.00,
    'innisfree-green-tea-serum': 22.00,
    'some-by-mi-bye-bye-toner': 15.00,
    'torriden-dive-in-serum': 16.00
  };
  return basePrices[productId] || 20.00;
}

function getProductName(productId: string): string {
  const productNames: Record<string, string> = {
    'cosrx-snail-essence': 'Advanced Snail 96 Mucin Power Essence',
    'beauty-joseon-spf': 'Relief Sun: Rice + Probiotics SPF50+ PA++++',
    'innisfree-green-tea-serum': 'Green Tea Seed Hyaluronic Serum',
    'some-by-mi-bye-bye-toner': 'Bye Bye Blackhead Wonder Miracle Toner',
    'torriden-dive-in-serum': 'DIVE-IN Low Molecule Hyaluronic Acid Serum'
  };
  return productNames[productId] || 'Korean Beauty Product';
}