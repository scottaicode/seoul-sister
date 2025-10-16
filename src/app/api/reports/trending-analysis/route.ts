import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (reportId) {
      // Get trending analysis for specific report
      const { data: analysis, error } = await supabase
        .from('trending_analysis')
        .select(`
          *,
          beauty_intelligence_reports!inner(title, report_date)
        `)
        .eq('report_id', reportId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching trending analysis:', error);
        return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
      }

      if (!analysis) {
        return NextResponse.json({
          report_id: reportId,
          analysis: null,
          message: 'No trending analysis available for this report'
        });
      }

      return NextResponse.json({
        report_id: reportId,
        analysis: analysis
      });
    }

    // Get trending metrics across multiple days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: metrics, error: metricsError } = await supabase
      .from('trending_metrics')
      .select(`
        *,
        beauty_intelligence_reports!inner(title, report_date)
      `)
      .gte('created_at', cutoffDate.toISOString())
      .order('trending_score', { ascending: false })
      .limit(limit * 4); // Get more to filter

    if (metricsError) {
      console.error('Error fetching trending metrics:', metricsError);
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }

    // Aggregate trending data by type
    const trendingData = {
      products: metrics?.filter(m => m.metric_type === 'product')
        .slice(0, limit)
        .map(m => ({
          name: m.metric_name,
          score: m.trending_score,
          growth_rate: m.growth_rate,
          mentions: m.mentions_count,
          sentiment: m.sentiment_score,
          regions: m.regions || [],
          platforms: m.platforms || [],
          report_date: m.beauty_intelligence_reports.report_date
        })) || [],

      ingredients: metrics?.filter(m => m.metric_type === 'ingredient')
        .slice(0, limit)
        .map(m => ({
          name: m.metric_name,
          score: m.trending_score,
          growth_rate: m.growth_rate,
          mentions: m.mentions_count,
          sentiment: m.sentiment_score,
          keywords: m.keywords || [],
          report_date: m.beauty_intelligence_reports.report_date
        })) || [],

      brands: metrics?.filter(m => m.metric_type === 'brand')
        .slice(0, limit)
        .map(m => ({
          name: m.metric_name,
          score: m.trending_score,
          growth_rate: m.growth_rate,
          mentions: m.mentions_count,
          sentiment: m.sentiment_score,
          platforms: m.platforms || [],
          report_date: m.beauty_intelligence_reports.report_date
        })) || [],

      trends: metrics?.filter(m => m.metric_type === 'trend')
        .slice(0, limit)
        .map(m => ({
          name: m.metric_name,
          score: m.trending_score,
          growth_rate: m.growth_rate,
          mentions: m.mentions_count,
          sentiment: m.sentiment_score,
          keywords: m.keywords || [],
          regions: m.regions || [],
          report_date: m.beauty_intelligence_reports.report_date
        })) || []
    };

    // Calculate overall trending scores
    const overallStats = {
      total_metrics: metrics?.length || 0,
      avg_trending_score: metrics?.length ?
        metrics.reduce((sum, m) => sum + (m.trending_score || 0), 0) / metrics.length : 0,
      top_regions: getTopItems(metrics?.flatMap(m => m.regions || []) || []),
      top_platforms: getTopItems(metrics?.flatMap(m => m.platforms || []) || []),
      sentiment_distribution: {
        positive: metrics?.filter(m => (m.sentiment_score || 0) > 0.1).length || 0,
        neutral: metrics?.filter(m => Math.abs(m.sentiment_score || 0) <= 0.1).length || 0,
        negative: metrics?.filter(m => (m.sentiment_score || 0) < -0.1).length || 0
      }
    };

    return NextResponse.json({
      period_days: days,
      trending_data: trendingData,
      overall_stats: overallStats,
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in trending analysis:', error);
    return NextResponse.json({
      error: 'Failed to fetch trending analysis',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { reportId, forceRegenerate = false } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      );
    }

    // Get the report
    const { data: report, error: reportError } = await supabase
      .from('beauty_intelligence_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Check if analysis already exists
    const { data: existingAnalysis } = await supabase
      .from('trending_analysis')
      .select('*')
      .eq('report_id', reportId)
      .single();

    if (existingAnalysis && !forceRegenerate) {
      return NextResponse.json({
        success: true,
        analysis: existingAnalysis,
        message: 'Analysis already exists'
      });
    }

    console.log(`🔍 Generating trending analysis for report: ${report.title}`);

    // Generate sample trending metrics and analysis
    const trendingMetrics = generateSampleTrendingMetrics(reportId);
    const trendingAnalysis = generateSampleTrendingAnalysis(reportId, report.report_date);

    // Insert trending metrics
    for (const metric of trendingMetrics) {
      const { error } = await supabase
        .from('trending_metrics')
        .upsert(metric, { onConflict: 'id' });

      if (error) {
        console.error('Error inserting metric:', error);
      }
    }

    // Insert or update trending analysis
    const { data: analysisData, error: analysisError } = await supabase
      .from('trending_analysis')
      .upsert(trendingAnalysis, { onConflict: 'report_id,analysis_date' })
      .select()
      .single();

    if (analysisError) {
      console.error('Error inserting analysis:', analysisError);
      return NextResponse.json(
        { error: 'Failed to save trending analysis' },
        { status: 500 }
      );
    }

    console.log('✅ Trending analysis generated successfully');

    return NextResponse.json({
      success: true,
      analysis: analysisData,
      metrics_count: trendingMetrics.length
    });

  } catch (error) {
    console.error('Error generating trending analysis:', error);
    return NextResponse.json({
      error: 'Failed to generate trending analysis',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

function getTopItems(items: string[], limit: number = 5): { name: string; count: number }[] {
  const counts: Record<string, number> = {};
  items.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });

  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function generateSampleTrendingMetrics(reportId: string) {
  const products = [
    'Beauty of Joseon Dynasty Cream', 'COSRX Snail 96 Mucin Power Essence',
    'Torriden DIVE-IN Low Molecule Hyaluronic Acid Serum', 'Anua Heartleaf 77% Soothing Toner',
    'ROUND LAB 1025 Dokdo Toner', 'Medicube Triple Collagen Serum',
    'IOPE Bio Intensive Conditioning Ampoule', 'Sulwhasoo First Care Activating Serum'
  ];

  const ingredients = [
    'Snail Secretion Filtrate', 'Hyaluronic Acid', 'Heartleaf Extract',
    'Niacinamide', 'Centella Asiatica', 'Retinol', 'Vitamin C', 'Collagen'
  ];

  const brands = [
    'Beauty of Joseon', 'COSRX', 'Torriden', 'Anua', 'ROUND LAB',
    'Medicube', 'IOPE', 'Sulwhasoo', 'Laneige', 'Innisfree'
  ];

  const trends = [
    'Glass Skin', 'Slugging', 'Skin Minimalism', 'Double Cleansing',
    'Essence First', 'Skip-Care', 'Gua Sha', 'LED Light Therapy'
  ];

  const regions = ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon', 'Gwangju'];
  const platforms = ['Instagram', 'TikTok', 'YouTube', 'Naver Blog'];

  const metrics = [];

  // Generate product metrics
  products.slice(0, 6).forEach((product, index) => {
    metrics.push({
      report_id: reportId,
      metric_type: 'product',
      metric_name: product,
      trending_score: Math.round((95 - index * 8) * 100) / 100,
      growth_rate: Math.round((Math.random() * 40 + 10) * 100) / 100,
      mentions_count: Math.floor(Math.random() * 5000) + 1000,
      sentiment_score: Math.round((Math.random() * 0.6 + 0.3) * 100) / 100,
      regions: regions.slice(0, Math.floor(Math.random() * 3) + 2),
      platforms: platforms.slice(0, Math.floor(Math.random() * 2) + 2),
      keywords: [`#${product.split(' ')[0].toLowerCase()}`, '#kbeauty', '#skincare'],
      metadata: {
        price_range: '$10-30',
        category: 'skincare'
      }
    });
  });

  // Generate ingredient metrics
  ingredients.slice(0, 5).forEach((ingredient, index) => {
    metrics.push({
      report_id: reportId,
      metric_type: 'ingredient',
      metric_name: ingredient,
      trending_score: Math.round((90 - index * 10) * 100) / 100,
      growth_rate: Math.round((Math.random() * 35 + 15) * 100) / 100,
      mentions_count: Math.floor(Math.random() * 3000) + 500,
      sentiment_score: Math.round((Math.random() * 0.8 + 0.1) * 100) / 100,
      regions: regions.slice(0, Math.floor(Math.random() * 4) + 1),
      platforms: platforms,
      keywords: [`#${ingredient.toLowerCase().replace(/\s+/g, '')}`, '#ingredients', '#skincare'],
      metadata: {
        benefits: ['hydrating', 'anti-aging', 'soothing'],
        concentration: 'variable'
      }
    });
  });

  // Generate brand metrics
  brands.slice(0, 4).forEach((brand, index) => {
    metrics.push({
      report_id: reportId,
      metric_type: 'brand',
      metric_name: brand,
      trending_score: Math.round((85 - index * 12) * 100) / 100,
      growth_rate: Math.round((Math.random() * 30 + 5) * 100) / 100,
      mentions_count: Math.floor(Math.random() * 4000) + 800,
      sentiment_score: Math.round((Math.random() * 0.7 + 0.2) * 100) / 100,
      regions: regions,
      platforms: platforms.slice(0, 3),
      keywords: [`#${brand.toLowerCase().replace(/\s+/g, '')}`, '#kbeauty', '#brand'],
      metadata: {
        founded: '2010s',
        specialty: 'natural ingredients'
      }
    });
  });

  // Generate trend metrics
  trends.slice(0, 4).forEach((trend, index) => {
    metrics.push({
      report_id: reportId,
      metric_type: 'trend',
      metric_name: trend,
      trending_score: Math.round((80 - index * 15) * 100) / 100,
      growth_rate: Math.round((Math.random() * 50 + 20) * 100) / 100,
      mentions_count: Math.floor(Math.random() * 2000) + 300,
      sentiment_score: Math.round((Math.random() * 0.6 + 0.3) * 100) / 100,
      regions: regions.slice(0, Math.floor(Math.random() * 5) + 2),
      platforms: platforms,
      keywords: [`#${trend.toLowerCase().replace(/\s+/g, '')}`, '#skincare', '#trend'],
      metadata: {
        difficulty: 'easy',
        time_commitment: 'daily'
      }
    });
  });

  return metrics;
}

function generateSampleTrendingAnalysis(reportId: string, reportDate: string) {
  return {
    report_id: reportId,
    analysis_date: reportDate.split('T')[0],
    top_trending_products: [
      {
        name: 'Beauty of Joseon Dynasty Cream',
        score: 95.2,
        growth: '+42%',
        reason: 'Viral TikTok reviews and Instagram posts from Korean influencers'
      },
      {
        name: 'COSRX Snail 96 Mucin Power Essence',
        score: 87.8,
        growth: '+28%',
        reason: 'Sustained popularity due to proven results and affordable price point'
      },
      {
        name: 'Torriden DIVE-IN Hyaluronic Acid Serum',
        score: 79.6,
        growth: '+35%',
        reason: 'Rising demand for hydrating serums in dry winter months'
      }
    ],
    top_trending_ingredients: [
      {
        name: 'Snail Secretion Filtrate',
        score: 90.1,
        growth: '+38%',
        benefits: ['healing', 'hydrating', 'anti-aging']
      },
      {
        name: 'Hyaluronic Acid',
        score: 85.5,
        growth: '+25%',
        benefits: ['hydrating', 'plumping', 'moisture retention']
      },
      {
        name: 'Heartleaf Extract',
        score: 78.9,
        growth: '+44%',
        benefits: ['soothing', 'anti-inflammatory', 'acne-fighting']
      }
    ],
    emerging_trends: [
      {
        name: 'Glass Skin 2.0',
        score: 82.3,
        description: 'Enhanced glass skin routine with focus on barrier repair and minimal makeup'
      },
      {
        name: 'Microbiome Skincare',
        score: 67.8,
        description: 'Growing interest in products that support skin microbiome health'
      }
    ],
    viral_content: [
      {
        platform: 'TikTok',
        content: 'Korean 10-step nighttime routine',
        views: '2.8M',
        engagement: '15.2%'
      },
      {
        platform: 'Instagram',
        content: 'Before/After snail mucin transformation',
        views: '1.2M',
        engagement: '12.8%'
      }
    ],
    market_shifts: [
      {
        shift: 'Premium to Mid-Range Migration',
        description: 'Consumers increasingly choosing effective mid-range Korean products over luxury Western brands',
        impact: 'high'
      },
      {
        shift: 'Ingredient Transparency Demand',
        description: 'Growing demand for complete ingredient disclosure and source transparency',
        impact: 'medium'
      }
    ],
    regional_preferences: {
      'Seoul': ['glass skin', 'minimal makeup', 'essence layering'],
      'Busan': ['hydrating products', 'sun protection', 'anti-pollution'],
      'Jeju': ['natural ingredients', 'volcanic clay', 'green tea'],
      'Incheon': ['quick routines', 'multi-purpose products', 'travel-friendly']
    },
    ai_insights: `Today's analysis reveals a significant shift toward ingredient-conscious consumers who prioritize proven effectiveness over brand prestige. Snail mucin products continue their dominance, with Beauty of Joseon leading viral conversations. The emergence of "Glass Skin 2.0" indicates evolution beyond just appearance to include skin health fundamentals. Regional data shows Seoul consumers driving minimalist trends while coastal cities prioritize environmental protection. Social media engagement peaks around transformation content and routine tutorials, suggesting consumers want proof and education over advertising.`,
    confidence_score: 0.87
  };
}