import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const insightType = searchParams.get('type') || 'retailer_patterns';

    const supabase = createClient();

    switch (insightType) {
      case 'retailer_patterns':
        return await getRetailerPatterns(supabase);

      case 'price_anomalies':
        return await getPriceAnomalies(supabase);

      case 'user_behavior':
        return await getUserBehaviorInsights(supabase);

      case 'prediction_confidence':
        return await getPredictionConfidence(supabase);

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid insight type. Available: retailer_patterns, price_anomalies, user_behavior, prediction_confidence'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error generating ML insights:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function getRetailerPatterns(supabase: any) {
  // Get retailer authenticity patterns from user reports
  const { data: patterns, error } = await supabase
    .from('authenticity_reports')
    .select(`
      retailer_id,
      is_authentic,
      confidence_level,
      purchase_price,
      price_retailers (name, domain, country)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch retailer patterns: ${error.message}`);
  }

  // Group by retailer and calculate patterns
  const retailerMap = new Map();

  patterns.forEach((report: any) => {
    const retailerId = report.retailer_id;
    if (!retailerMap.has(retailerId)) {
      retailerMap.set(retailerId, {
        retailer: report.price_retailers,
        authentic_count: 0,
        counterfeit_count: 0,
        total_reports: 0,
        avg_confidence: 0,
        price_points: [],
        recent_trend: 'stable'
      });
    }

    const retailerData = retailerMap.get(retailerId);
    retailerData.total_reports++;
    retailerData.price_points.push(report.purchase_price);

    if (report.is_authentic) {
      retailerData.authentic_count++;
    } else {
      retailerData.counterfeit_count++;
    }

    // Update average confidence
    retailerData.avg_confidence = (retailerData.avg_confidence * (retailerData.total_reports - 1) +
                                  report.confidence_level) / retailerData.total_reports;
  });

  // Calculate authenticity rates and risk scores
  const retailerInsights = Array.from(retailerMap.values()).map((data: any) => {
    const authenticityRate = data.total_reports > 0 ?
      (data.authentic_count / data.total_reports) * 100 : 50;

    const riskScore = Math.max(0, 100 - authenticityRate);

    let riskLevel = 'MODERATE';
    if (authenticityRate >= 90) riskLevel = 'VERIFIED';
    else if (authenticityRate >= 80) riskLevel = 'TRUSTED';
    else if (authenticityRate >= 65) riskLevel = 'CAUTION';
    else if (authenticityRate >= 45) riskLevel = 'HIGH_RISK';
    else riskLevel = 'AVOID';

    return {
      ...data,
      authenticity_rate: authenticityRate,
      risk_score: riskScore,
      risk_level: riskLevel,
      confidence_score: data.avg_confidence * 20, // Convert to percentage
      sample_size: data.total_reports
    };
  }).sort((a, b) => b.authenticity_rate - a.authenticity_rate);

  return NextResponse.json({
    success: true,
    type: 'retailer_patterns',
    insights: retailerInsights,
    summary: {
      total_retailers_analyzed: retailerInsights.length,
      verified_retailers: retailerInsights.filter(r => r.risk_level === 'VERIFIED').length,
      high_risk_retailers: retailerInsights.filter(r => r.risk_level === 'HIGH_RISK' || r.risk_level === 'AVOID').length
    },
    generated_at: new Date().toISOString()
  });
}

async function getPriceAnomalies(supabase: any) {
  // Analyze price patterns that correlate with counterfeit reports
  const { data: priceData, error } = await supabase
    .from('authenticity_reports')
    .select(`
      purchase_price,
      is_authentic,
      confidence_level,
      product_id,
      price_retailers (name)
    `)
    .not('purchase_price', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch price data: ${error.message}`);
  }

  // Group by product and analyze price patterns
  const productPriceMap = new Map();

  priceData.forEach((report: any) => {
    const productId = report.product_id;
    if (!productPriceMap.has(productId)) {
      productPriceMap.set(productId, {
        product_id: productId,
        authentic_prices: [],
        counterfeit_prices: [],
        total_reports: 0
      });
    }

    const productData = productPriceMap.get(productId);
    productData.total_reports++;

    if (report.is_authentic) {
      productData.authentic_prices.push(report.purchase_price);
    } else {
      productData.counterfeit_prices.push(report.purchase_price);
    }
  });

  // Calculate anomaly patterns
  const anomalyInsights = Array.from(productPriceMap.values())
    .filter((data: any) => data.total_reports >= 3) // Minimum sample size
    .map((data: any) => {
      const authenticPrices = data.authentic_prices;
      const counterfeitPrices = data.counterfeit_prices;

      if (authenticPrices.length === 0) {
        return null; // Skip if no authentic price data
      }

      const authenticAvg = authenticPrices.reduce((a: number, b: number) => a + b, 0) / authenticPrices.length;
      const authenticMin = Math.min(...authenticPrices);
      const authenticMax = Math.max(...authenticPrices);

      let counterfeitAvg = 0;
      let priceAnomalyThreshold = 40; // Default 40% below authentic average

      if (counterfeitPrices.length > 0) {
        counterfeitAvg = counterfeitPrices.reduce((a: number, b: number) => a + b, 0) / counterfeitPrices.length;
        priceAnomalyThreshold = Math.round(((authenticAvg - counterfeitAvg) / authenticAvg) * 100);
      }

      return {
        product_id: data.product_id,
        authentic_price_range: {
          min: authenticMin,
          max: authenticMax,
          average: authenticAvg
        },
        counterfeit_average_price: counterfeitAvg,
        anomaly_threshold_percentage: priceAnomalyThreshold,
        sample_size: data.total_reports,
        confidence_score: Math.min(95, data.total_reports * 15) // Confidence based on sample size
      };
    })
    .filter(insight => insight !== null)
    .sort((a: any, b: any) => b.sample_size - a.sample_size);

  return NextResponse.json({
    success: true,
    type: 'price_anomalies',
    insights: anomalyInsights,
    summary: {
      products_analyzed: anomalyInsights.length,
      high_confidence_patterns: anomalyInsights.filter((i: any) => i.confidence_score >= 80).length,
      avg_anomaly_threshold: anomalyInsights.reduce((sum: number, i: any) => sum + i.anomaly_threshold_percentage, 0) / anomalyInsights.length
    },
    generated_at: new Date().toISOString()
  });
}

async function getUserBehaviorInsights(supabase: any) {
  // Analyze user behavior patterns around authenticity decisions
  const { data: behaviorData, error } = await supabase
    .from('user_purchase_decisions')
    .select(`
      *,
      price_retailers (name)
    `)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(`Failed to fetch behavior data: ${error.message}`);
  }

  // Analyze patterns
  const totalDecisions = behaviorData.length;
  const clickThroughRate = behaviorData.filter((d: any) => d.clicked_through).length / totalDecisions;
  const guideViewRate = behaviorData.filter((d: any) => d.viewed_authenticity_guide).length / totalDecisions;
  const purchaseRate = behaviorData.filter((d: any) => d.purchase_confirmed).length / totalDecisions;

  // Risk level behavior analysis
  const riskLevelBehavior = ['VERIFIED', 'TRUSTED', 'CAUTION', 'HIGH_RISK', 'AVOID'].map(riskLevel => {
    const decisions = behaviorData.filter((d: any) => d.risk_level_shown === riskLevel);
    const count = decisions.length;

    if (count === 0) return null;

    return {
      risk_level: riskLevel,
      total_decisions: count,
      click_through_rate: decisions.filter((d: any) => d.clicked_through).length / count,
      guide_view_rate: decisions.filter((d: any) => d.viewed_authenticity_guide).length / count,
      avg_time_spent: decisions.reduce((sum: number, d: any) => sum + (d.time_spent_viewing || 0), 0) / count,
      purchase_rate: decisions.filter((d: any) => d.purchase_confirmed).length / count
    };
  }).filter(insight => insight !== null);

  // Price sensitivity analysis
  const priceRanges = [
    { min: 0, max: 15, label: 'Budget ($0-$15)' },
    { min: 15, max: 30, label: 'Mid-range ($15-$30)' },
    { min: 30, max: 50, label: 'Premium ($30-$50)' },
    { min: 50, max: 999, label: 'Luxury ($50+)' }
  ].map(range => {
    const decisions = behaviorData.filter((d: any) =>
      d.price_shown && d.price_shown >= range.min && d.price_shown < range.max
    );
    const count = decisions.length;

    if (count === 0) return null;

    return {
      price_range: range.label,
      total_decisions: count,
      click_through_rate: decisions.filter((d: any) => d.clicked_through).length / count,
      guide_view_rate: decisions.filter((d: any) => d.viewed_authenticity_guide).length / count,
      purchase_rate: decisions.filter((d: any) => d.purchase_confirmed).length / count
    };
  }).filter(insight => insight !== null);

  return NextResponse.json({
    success: true,
    type: 'user_behavior',
    insights: {
      overall_metrics: {
        total_decisions: totalDecisions,
        click_through_rate: clickThroughRate,
        guide_view_rate: guideViewRate,
        purchase_rate: purchaseRate
      },
      risk_level_behavior: riskLevelBehavior,
      price_sensitivity: priceRanges
    },
    generated_at: new Date().toISOString()
  });
}

async function getPredictionConfidence(supabase: any) {
  // Analyze how accurate our authenticity predictions are
  const { data: validationData, error } = await supabase
    .from('user_purchase_decisions')
    .select(`
      authenticity_score_shown,
      risk_level_shown,
      reported_authentic,
      reported_counterfeit,
      purchase_confirmed
    `)
    .or('reported_authentic.eq.true,reported_counterfeit.eq.true')
    .not('authenticity_score_shown', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch validation data: ${error.message}`);
  }

  if (validationData.length === 0) {
    return NextResponse.json({
      success: true,
      type: 'prediction_confidence',
      insights: {
        message: 'Insufficient validation data - need more user reports',
        total_validations: 0
      },
      generated_at: new Date().toISOString()
    });
  }

  // Calculate prediction accuracy by score ranges
  const scoreRanges = [
    { min: 90, max: 100, label: 'Very High (90-100)' },
    { min: 80, max: 89, label: 'High (80-89)' },
    { min: 65, max: 79, label: 'Medium (65-79)' },
    { min: 45, max: 64, label: 'Low (45-64)' },
    { min: 0, max: 44, label: 'Very Low (0-44)' }
  ].map(range => {
    const predictions = validationData.filter((d: any) =>
      d.authenticity_score_shown >= range.min && d.authenticity_score_shown <= range.max
    );

    if (predictions.length === 0) return null;

    const correctPredictions = predictions.filter((d: any) => {
      const predictedAuthentic = d.authenticity_score_shown >= 65;
      const actuallyAuthentic = d.reported_authentic;
      return predictedAuthentic === actuallyAuthentic;
    }).length;

    return {
      score_range: range.label,
      total_predictions: predictions.length,
      correct_predictions: correctPredictions,
      accuracy_rate: correctPredictions / predictions.length,
      false_positives: predictions.filter((d: any) =>
        d.authenticity_score_shown >= 65 && d.reported_counterfeit
      ).length,
      false_negatives: predictions.filter((d: any) =>
        d.authenticity_score_shown < 65 && d.reported_authentic
      ).length
    };
  }).filter(insight => insight !== null);

  const overallAccuracy = validationData.filter((d: any) => {
    const predictedAuthentic = d.authenticity_score_shown >= 65;
    const actuallyAuthentic = d.reported_authentic;
    return predictedAuthentic === actuallyAuthentic;
  }).length / validationData.length;

  return NextResponse.json({
    success: true,
    type: 'prediction_confidence',
    insights: {
      overall_accuracy: overallAccuracy,
      total_validations: validationData.length,
      score_range_accuracy: scoreRanges,
      model_performance: {
        precision: calculatePrecision(validationData),
        recall: calculateRecall(validationData),
        f1_score: calculateF1Score(validationData)
      }
    },
    generated_at: new Date().toISOString()
  });
}

function calculatePrecision(data: any[]): number {
  const truePositives = data.filter(d => d.authenticity_score_shown >= 65 && d.reported_authentic).length;
  const falsePositives = data.filter(d => d.authenticity_score_shown >= 65 && d.reported_counterfeit).length;

  return truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
}

function calculateRecall(data: any[]): number {
  const truePositives = data.filter(d => d.authenticity_score_shown >= 65 && d.reported_authentic).length;
  const falseNegatives = data.filter(d => d.authenticity_score_shown < 65 && d.reported_authentic).length;

  return truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
}

function calculateF1Score(data: any[]): number {
  const precision = calculatePrecision(data);
  const recall = calculateRecall(data);

  return precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
}