import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const dealDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const minSavings = parseInt(searchParams.get('minSavings') || '15');
    const limit = parseInt(searchParams.get('limit') || '20');
    const dealType = searchParams.get('type');

    let query = supabase
      .from('daily_deals')
      .select(`
        *,
        price_retailers (
          name,
          domain,
          country
        )
      `)
      .gte('savings_percentage', minSavings)
      .order('deal_score', { ascending: false })
      .limit(limit);

    if (dealType) {
      query = query.eq('deal_type', dealType);
    }

    const { data: deals, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch deals: ${error.message}`);
    }

    // Get product information for each deal - using mock data until products table is created
    const productMap: Record<string, any> = {
      'cosrx-snail-essence': { name: 'Advanced Snail 96 Mucin Power Essence', brand: 'COSRX', category: 'skincare' },
      'beauty-joseon-spf': { name: 'Relief Sun: Rice + Probiotics SPF50+ PA++++', brand: 'Beauty of Joseon', category: 'skincare' },
      'innisfree-green-tea-serum': { name: 'Green Tea Seed Hyaluronic Serum', brand: 'Innisfree', category: 'skincare' },
      'some-by-mi-bye-bye-toner': { name: 'Bye Bye Blackhead Wonder Miracle Toner', brand: 'Some By Mi', category: 'skincare' },
      'torriden-dive-in-serum': { name: 'DIVE-IN Low Molecule Hyaluronic Acid Serum', brand: 'Torriden', category: 'skincare' }
    };

    const dealsWithProducts = (deals || []).map((deal: any) => {
      const product = productMap[deal.product_id] || { name: 'Korean Beauty Product', brand: 'K-Beauty', category: 'skincare' };
      return {
        ...deal,
        product
      };
    });

    const summary = {
      totalDeals: dealsWithProducts.length,
      avgSavingsPercentage: dealsWithProducts.length > 0 ?
        dealsWithProducts.reduce((sum: number, deal: any) => sum + deal.savings_percentage, 0) / dealsWithProducts.length : 0,
      totalSavingsAmount: dealsWithProducts.reduce((sum: number, deal: any) => sum + deal.savings_amount, 0),
      topRetailers: [...new Set(dealsWithProducts.map((deal: any) => deal.price_retailers?.name))].slice(0, 5)
    };

    return NextResponse.json({
      success: true,
      date: dealDate,
      deals: dealsWithProducts,
      summary,
      count: dealsWithProducts.length
    });

  } catch (error) {
    console.error('Error fetching deals:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

// Get deal analytics for premium members
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { userId, startDate, endDate } = body;

    // Get user's deal interaction history
    const { data: userDeals, error } = await supabase
      .from('daily_deals')
      .select(`
        *,
        price_retailers (name, domain)
      `)
      .gte('deal_date', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lte('deal_date', endDate || new Date().toISOString().split('T')[0])
      .order('deal_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch user deals: ${error.message}`);
    }

    // Calculate analytics
    const analytics = {
      totalDealsAvailable: userDeals?.length || 0,
      totalPotentialSavings: userDeals?.reduce((sum: number, deal: any) => sum + deal.savings_amount, 0) || 0,
      avgSavingsPercentage: userDeals?.length ?
        userDeals.reduce((sum: number, deal: any) => sum + deal.savings_percentage, 0) / userDeals.length : 0,
      topCategories: await getTopDealCategories(userDeals || []),
      dealsByRetailer: getDealsByRetailer(userDeals || []),
      dealTrends: getDealTrends(userDeals || [])
    };

    return NextResponse.json({
      success: true,
      analytics,
      dealsCount: userDeals?.length || 0
    });

  } catch (error) {
    console.error('Error generating deal analytics:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function getTopDealCategories(deals: any[]): Promise<any[]> {
  const categoryMap = new Map();

  // Use the same product mapping for consistency
  const productMap: Record<string, any> = {
    'cosrx-snail-essence': { category: 'skincare' },
    'beauty-joseon-spf': { category: 'skincare' },
    'innisfree-green-tea-serum': { category: 'skincare' },
    'some-by-mi-bye-bye-toner': { category: 'skincare' },
    'torriden-dive-in-serum': { category: 'skincare' }
  };

  deals.forEach((deal: any) => {
    const product = productMap[deal.product_id] || { category: 'skincare' };
    const category = product.category;

    if (category) {
      const current = categoryMap.get(category) || { count: 0, totalSavings: 0 };
      categoryMap.set(category, {
        count: current.count + 1,
        totalSavings: current.totalSavings + (deal.savings_amount || 0)
      });
    }
  });

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.totalSavings - a.totalSavings)
    .slice(0, 5);
}

function getDealsByRetailer(deals: any[]): any[] {
  const retailerMap = new Map();

  deals.forEach((deal: any) => {
    const retailerName = deal.price_retailers?.name || 'Unknown';
    const current = retailerMap.get(retailerName) || { count: 0, totalSavings: 0 };
    retailerMap.set(retailerName, {
      count: current.count + 1,
      totalSavings: current.totalSavings + (deal.savings_amount || 0)
    });
  });

  return Array.from(retailerMap.entries())
    .map(([retailer, data]) => ({ retailer, ...data }))
    .sort((a, b) => b.totalSavings - a.totalSavings);
}

function getDealTrends(deals: any[]): any[] {
  const dateMap = new Map();

  deals.forEach((deal: any) => {
    const date = deal.deal_date;
    const current = dateMap.get(date) || { count: 0, avgSavings: 0 };
    dateMap.set(date, {
      count: current.count + 1,
      avgSavings: current.count > 0 ?
        (current.avgSavings * current.count + (deal.savings_percentage || 0)) / (current.count + 1) :
        (deal.savings_percentage || 0)
    });
  });

  return Array.from(dateMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}