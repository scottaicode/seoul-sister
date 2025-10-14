import { NextRequest, NextResponse } from 'next/server';

interface TrendingProduct {
  name: string;
  brand: string;
  category: string;
  seoulPrice: number;
  usPrice: number;
  ranking: number;
  source: string;
}

interface TrendingIngredient {
  name: string;
  popularity: number;
  benefits: string[];
  products: string[];
}

interface TrendData {
  products: TrendingProduct[];
  ingredients: TrendingIngredient[];
  trends: string[];
  hashtags: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { sources, limit = 10 } = await request.json();

    // In production, these would call actual APIs
    // For now, we'll use curated data that updates daily
    const trendData = await fetchTrendData(sources, limit);

    return NextResponse.json(trendData);
  } catch (error) {
    console.error('Error fetching Korean trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}

async function fetchTrendData(sources: string[], limit: number): Promise<TrendData> {
  // This would normally aggregate data from multiple Korean beauty APIs
  // For now, we'll return curated, rotating data

  const today = new Date().getDay(); // Use day of week for variety
  const dataSet = getTrendDataForDay(today);

  return {
    products: dataSet.products.slice(0, limit),
    ingredients: dataSet.ingredients.slice(0, 5),
    trends: dataSet.trends.slice(0, 5),
    hashtags: dataSet.hashtags.slice(0, 10)
  };
}

function getTrendDataForDay(dayOfWeek: number): TrendData {
  // Rotate through different trending products based on day
  const allProducts: TrendingProduct[] = [
    // Sunday/Monday Focus: Sunscreens & Protection
    {
      name: 'Relief Sun: Rice + Probiotics SPF50+',
      brand: 'Beauty of Joseon',
      category: 'Sunscreen',
      seoulPrice: 12000,
      usPrice: 18,
      ranking: 1,
      source: 'Olive Young'
    },
    {
      name: 'Aqua Rich Watery Essence SPF50+',
      brand: 'Biore',
      category: 'Sunscreen',
      seoulPrice: 9800,
      usPrice: 25,
      ranking: 2,
      source: 'Hwahae'
    },
    // Tuesday/Wednesday Focus: Essences & Serums
    {
      name: 'Advanced Snail 96 Mucin Power Essence',
      brand: 'COSRX',
      category: 'Essence',
      seoulPrice: 23000,
      usPrice: 29,
      ranking: 1,
      source: 'Olive Young'
    },
    {
      name: 'Green Tea Seed Intensive Hydrating Serum',
      brand: 'Innisfree',
      category: 'Serum',
      seoulPrice: 27000,
      usPrice: 35,
      ranking: 2,
      source: 'Naver Beauty'
    },
    // Thursday/Friday Focus: Masks & Treatment
    {
      name: 'Real Nature Face Mask Collection',
      brand: 'The Face Shop',
      category: 'Sheet Mask',
      seoulPrice: 1500,
      usPrice: 5,
      ranking: 1,
      source: 'Olive Young'
    },
    {
      name: 'Water Sleeping Mask',
      brand: 'Laneige',
      category: 'Sleeping Mask',
      seoulPrice: 28000,
      usPrice: 35,
      ranking: 2,
      source: 'Hwahae'
    },
    // Weekend Focus: Premium Lines
    {
      name: 'First Care Activating Serum',
      brand: 'Sulwhasoo',
      category: 'Premium Serum',
      seoulPrice: 89000,
      usPrice: 150,
      ranking: 1,
      source: 'Department Store'
    },
    {
      name: 'Time Revolution First Treatment Essence',
      brand: 'Missha',
      category: 'First Essence',
      seoulPrice: 38000,
      usPrice: 52,
      ranking: 2,
      source: 'Naver Beauty'
    },
    // Additional Trending Products
    {
      name: 'Heartleaf 77% Soothing Toner',
      brand: 'Anua',
      category: 'Toner',
      seoulPrice: 18000,
      usPrice: 28,
      ranking: 3,
      source: 'TikTok Viral'
    },
    {
      name: 'Madagascar Centella Ampoule',
      brand: 'SKIN1004',
      category: 'Ampoule',
      seoulPrice: 16000,
      usPrice: 24,
      ranking: 4,
      source: 'Hwahae'
    },
    {
      name: 'Glow Deep Serum',
      brand: 'Beauty of Joseon',
      category: 'Serum',
      seoulPrice: 18000,
      usPrice: 25,
      ranking: 5,
      source: 'Olive Young'
    },
    {
      name: 'Retinol Intense Reactivating Serum',
      brand: 'Some By Mi',
      category: 'Anti-aging',
      seoulPrice: 22000,
      usPrice: 35,
      ranking: 6,
      source: 'Naver Beauty'
    },
    {
      name: 'Black Rice Moisture Deep Cleansing Oil',
      brand: 'Haruharu Wonder',
      category: 'Cleanser',
      seoulPrice: 14000,
      usPrice: 22,
      ranking: 7,
      source: 'Olive Young'
    },
    {
      name: 'Snail Bee High Content Essence',
      brand: 'Benton',
      category: 'Essence',
      seoulPrice: 19000,
      usPrice: 26,
      ranking: 8,
      source: 'Hwahae'
    },
    {
      name: 'Vitamin C 23% Serum',
      brand: 'Some By Mi',
      category: 'Brightening',
      seoulPrice: 17000,
      usPrice: 30,
      ranking: 9,
      source: 'TikTok Viral'
    }
  ];

  const ingredients: TrendingIngredient[] = [
    {
      name: 'Centella Asiatica',
      popularity: 98,
      benefits: ['Soothing', 'Healing', 'Anti-inflammatory'],
      products: ['SKIN1004 Madagascar Centella', 'Purito Centella Serum']
    },
    {
      name: 'Snail Mucin',
      popularity: 95,
      benefits: ['Hydration', 'Repair', 'Anti-aging'],
      products: ['COSRX Snail Essence', 'Benton Snail Bee']
    },
    {
      name: 'Niacinamide',
      popularity: 93,
      benefits: ['Brightening', 'Pore care', 'Oil control'],
      products: ['The Ordinary Niacinamide', 'Some By Mi Snail Truecica']
    },
    {
      name: 'Rice Extract',
      popularity: 91,
      benefits: ['Brightening', 'Nourishing', 'Softening'],
      products: ['Beauty of Joseon Rice Toner', 'I\'m From Rice Mask']
    },
    {
      name: 'Propolis',
      popularity: 89,
      benefits: ['Anti-bacterial', 'Healing', 'Glow'],
      products: ['Beauty of Joseon Glow Serum', 'COSRX Propolis Toner']
    },
    {
      name: 'Heartleaf (Houttuynia Cordata)',
      popularity: 87,
      benefits: ['Calming', 'Acne care', 'Purifying'],
      products: ['Anua Heartleaf Toner', 'Goodal Heartleaf Essence']
    },
    {
      name: 'Mugwort (Artemisia)',
      popularity: 85,
      benefits: ['Soothing', 'Anti-inflammatory', 'Healing'],
      products: ['I\'m From Mugwort Essence', 'Round Lab Mugwort Toner']
    },
    {
      name: 'Tea Tree',
      popularity: 83,
      benefits: ['Acne fighting', 'Purifying', 'Oil control'],
      products: ['Some By Mi Tea Tree Serum', 'Innisfree Tea Tree Mask']
    }
  ];

  const trends = [
    'Glass Skin',
    'Slugging',
    '7-Skin Method',
    'Skip-care',
    'Skin Cycling',
    'Double Cleansing',
    'Barrier Repair',
    'Skin Flooding',
    'Retinol Sandwich Method',
    'Morning Shed'
  ];

  const hashtags = [
    '#KBeauty',
    '#GlassSkin',
    '#KoreanSkincare',
    '#SeoulBeauty',
    '#KBeautyAddict',
    '#10StepRoutine',
    '#KBeautySecrets',
    '#DewyMakeup',
    '#CentellaAsiatica',
    '#SnailMucin',
    '#KoreanGlow',
    '#SeoulSister'
  ];

  // Rotate products based on day of week
  const startIdx = (dayOfWeek * 3) % allProducts.length;
  const selectedProducts = [
    ...allProducts.slice(startIdx, startIdx + 10),
    ...allProducts.slice(0, Math.max(0, 10 - (allProducts.length - startIdx)))
  ];

  return {
    products: selectedProducts,
    ingredients: rotateArray(ingredients, dayOfWeek),
    trends: rotateArray(trends, dayOfWeek),
    hashtags: rotateArray(hashtags, dayOfWeek * 2)
  };
}

function rotateArray<T>(arr: T[], offset: number): T[] {
  const normalizedOffset = offset % arr.length;
  return [...arr.slice(normalizedOffset), ...arr.slice(0, normalizedOffset)];
}

export async function GET(request: NextRequest) {
  // Quick endpoint to check trending status
  const quickTrends = {
    topProduct: 'Beauty of Joseon Relief Sun',
    topIngredient: 'Centella Asiatica',
    topTrend: 'Glass Skin',
    lastUpdated: new Date().toISOString()
  };

  return NextResponse.json(quickTrends);
}