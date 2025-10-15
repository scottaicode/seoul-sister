import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const retailerId = searchParams.get('retailerId');
    const productId = searchParams.get('productId');

    if (!retailerId) {
      return NextResponse.json({
        success: false,
        error: 'Retailer ID is required'
      }, { status: 400 });
    }

    const supabase = createClient();

    // Get retailer information
    const { data: retailer, error: retailerError } = await supabase
      .from('price_retailers')
      .select('*')
      .eq('id', retailerId)
      .single();

    if (retailerError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch retailer data'
      }, { status: 500 });
    }

    // Calculate authenticity score based on multiple factors
    const authenticityScore = calculateAuthenticityScore(retailer, productId);

    return NextResponse.json({
      success: true,
      retailer,
      authenticityScore,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in retailer verification:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

function calculateAuthenticityScore(retailer: any, productId?: string | null): any {
  let score = 0;
  const factors = [];

  // Official retailer status (highest weight)
  const officialRetailers = {
    'YesStyle': { score: 95, reason: 'Official authorized retailer for major K-beauty brands' },
    'StyleKorean': { score: 95, reason: 'Official K-beauty specialist with direct brand partnerships' },
    'Olive Young Global': { score: 98, reason: 'Official Korean pharmacy chain with guaranteed authenticity' },
    'Sephora': { score: 90, reason: 'Authorized premium retailer with strict authenticity policies' },
    'Ulta': { score: 85, reason: 'Authorized beauty retailer with brand partnerships' },
    'Amazon': { score: 65, reason: 'Marketplace with variable seller authenticity - requires verification' },
    'eBay': { score: 45, reason: 'Marketplace platform with high counterfeit risk' },
    'AliExpress': { score: 30, reason: 'High-risk marketplace for counterfeit products' }
  };

  const officialStatus = officialRetailers[retailer.name as keyof typeof officialRetailers];
  if (officialStatus) {
    score = officialStatus.score;
    factors.push({
      factor: 'Official Retailer Status',
      impact: officialStatus.score,
      description: officialStatus.reason
    });
  } else {
    score = 50; // Unknown retailer
    factors.push({
      factor: 'Unknown Retailer',
      impact: 50,
      description: 'Retailer not in verified database - proceed with caution'
    });
  }

  // Domain authenticity check
  const trustedDomains = [
    'yesstyle.com',
    'stylekorean.com',
    'global.oliveyoung.com',
    'sephora.com',
    'ulta.com',
    'amazon.com',
    'cosrx.com',
    'beautyofjoseon.com'
  ];

  if (trustedDomains.includes(retailer.domain)) {
    factors.push({
      factor: 'Verified Domain',
      impact: 5,
      description: 'Domain matches official retailer website'
    });
  }

  // Geographic authenticity (Korean/Asian retailers often more authentic for K-beauty)
  if (retailer.country === 'South Korea' || retailer.country === 'Korea') {
    score += 10;
    factors.push({
      factor: 'Korean Origin',
      impact: 10,
      description: 'Korean retailers typically have authentic K-beauty sourcing'
    });
  }

  // Risk level determination
  let riskLevel = 'LOW';
  let riskColor = 'green';
  let recommendation = 'HIGHLY RECOMMENDED';

  if (score >= 90) {
    riskLevel = 'MINIMAL';
    riskColor = '#10B981'; // green
    recommendation = 'VERIFIED AUTHENTIC - HIGHLY RECOMMENDED';
  } else if (score >= 80) {
    riskLevel = 'LOW';
    riskColor = '#10B981'; // green
    recommendation = 'TRUSTED RETAILER - RECOMMENDED';
  } else if (score >= 70) {
    riskLevel = 'MODERATE';
    riskColor = '#F59E0B'; // yellow
    recommendation = 'PROCEED WITH CAUTION - VERIFY SELLER';
  } else if (score >= 50) {
    riskLevel = 'HIGH';
    riskColor = '#F97316'; // orange
    recommendation = 'HIGH RISK - CHECK SELLER CAREFULLY';
  } else {
    riskLevel = 'VERY HIGH';
    riskColor = '#DC2626'; // red
    recommendation = 'AVOID - HIGH COUNTERFEIT RISK';
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    riskLevel,
    riskColor,
    recommendation,
    factors,
    verificationLevel: score >= 90 ? 'VERIFIED' : score >= 70 ? 'TRUSTED' : 'UNVERIFIED',
    lastUpdated: new Date().toISOString()
  };
}

// POST endpoint for AI-powered listing analysis
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productUrl, retailerName, price, productName } = body;

    if (!productUrl || !retailerName || !price) {
      return NextResponse.json({
        success: false,
        error: 'Product URL, retailer name, and price are required'
      }, { status: 400 });
    }

    // AI-powered authenticity analysis using Claude
    const aiAnalysis = await analyzeProductListingWithAI({
      productUrl,
      retailerName,
      price,
      productName
    });

    return NextResponse.json({
      success: true,
      aiAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in AI listing analysis:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function analyzeProductListingWithAI(params: {
  productUrl: string;
  retailerName: string;
  price: number;
  productName: string;
}): Promise<any> {
  // This would integrate with Claude Opus 4.1 for deep analysis
  // For now, implementing rule-based analysis with AI-like logic

  const { productUrl, retailerName, price, productName } = params;
  const redFlags = [];
  const positiveIndicators = [];
  let suspicionScore = 0;

  // Price analysis against known authentic price ranges
  const authenticPriceRanges: Record<string, { min: number; max: number }> = {
    'Advanced Snail 96 Mucin Power Essence': { min: 18, max: 35 },
    'Relief Sun: Rice + Probiotics': { min: 14, max: 28 },
    'Green Tea Seed Hyaluronic Serum': { min: 16, max: 30 }
  };

  const priceRange = Object.entries(authenticPriceRanges).find(([name]) =>
    productName.toLowerCase().includes(name.toLowerCase().split(' ')[0])
  );

  if (priceRange) {
    const [, range] = priceRange;
    if (price < range.min * 0.6) {
      redFlags.push('Price significantly below authentic range - possible counterfeit');
      suspicionScore += 30;
    } else if (price > range.max * 1.5) {
      redFlags.push('Price significantly above typical range - possible markup');
      suspicionScore += 10;
    } else {
      positiveIndicators.push('Price within expected authentic range');
    }
  }

  // Retailer-specific analysis
  const highRiskRetailers = ['aliexpress', 'wish', 'dhgate', 'alibaba'];
  if (highRiskRetailers.some(risky => retailerName.toLowerCase().includes(risky))) {
    redFlags.push('High-risk marketplace known for counterfeit products');
    suspicionScore += 40;
  }

  // URL analysis
  if (productUrl.includes('amazon.com')) {
    if (productUrl.includes('/dp/') && !productUrl.includes('?seller=')) {
      positiveIndicators.push('Amazon direct product listing');
    } else {
      redFlags.push('Amazon third-party seller - verify seller credentials');
      suspicionScore += 15;
    }
  }

  // Overall authenticity assessment
  let authenticityLevel = 'AUTHENTIC';
  let confidence = 90 - suspicionScore;

  if (suspicionScore >= 50) {
    authenticityLevel = 'LIKELY_COUNTERFEIT';
  } else if (suspicionScore >= 25) {
    authenticityLevel = 'SUSPICIOUS';
  } else if (suspicionScore >= 10) {
    authenticityLevel = 'CAUTION_ADVISED';
  }

  return {
    authenticityLevel,
    confidence: Math.max(10, Math.min(95, confidence)),
    suspicionScore,
    redFlags,
    positiveIndicators,
    recommendation: generateRecommendation(authenticityLevel, suspicionScore),
    analysisTimestamp: new Date().toISOString()
  };
}

function generateRecommendation(authenticityLevel: string, suspicionScore: number): string {
  switch (authenticityLevel) {
    case 'AUTHENTIC':
      return 'Product appears authentic - safe to purchase';
    case 'CAUTION_ADVISED':
      return 'Some concerns detected - verify seller and check reviews';
    case 'SUSPICIOUS':
      return 'Multiple red flags - proceed with extreme caution';
    case 'LIKELY_COUNTERFEIT':
      return 'High probability of counterfeit - recommend avoiding this listing';
    default:
      return 'Unable to determine authenticity - manual verification recommended';
  }
}