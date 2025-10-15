import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const retailerId = searchParams.get('retailerId');
    const recalculate = searchParams.get('recalculate') === 'true';

    const supabase = createClient();

    if (retailerId) {
      // Get dynamic score for specific retailer
      const score = await getDynamicRetailerScore(supabase, retailerId, recalculate);
      return NextResponse.json({
        success: true,
        retailer_id: retailerId,
        score,
        timestamp: new Date().toISOString()
      });
    } else {
      // Get all retailer scores
      const scores = await getAllDynamicScores(supabase, recalculate);
      return NextResponse.json({
        success: true,
        scores,
        total_retailers: scores.length,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error in dynamic scoring:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

// POST endpoint to trigger recalculation
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { retailerId, force = false } = body;

    if (retailerId) {
      const score = await getDynamicRetailerScore(supabase, retailerId, true);
      return NextResponse.json({
        success: true,
        message: 'Retailer score recalculated',
        retailer_id: retailerId,
        score
      });
    } else {
      // Recalculate all retailer scores
      const scores = await recalculateAllScores(supabase, force);
      return NextResponse.json({
        success: true,
        message: 'All retailer scores recalculated',
        updated_count: scores.length,
        scores: scores.slice(0, 10) // Return first 10 for verification
      });
    }

  } catch (error) {
    console.error('Error recalculating scores:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function getDynamicRetailerScore(supabase: any, retailerId: string, recalculate: boolean = false) {
  // Get existing reputation score
  let { data: existingScore, error: scoreError } = await supabase
    .from('retailer_reputation_scores')
    .select('*')
    .eq('retailer_id', retailerId)
    .single();

  if (scoreError && scoreError.code !== 'PGRST116') { // Not found is OK
    throw new Error(`Failed to fetch existing score: ${scoreError.message}`);
  }

  // Get retailer info
  const { data: retailer, error: retailerError } = await supabase
    .from('price_retailers')
    .select('*')
    .eq('id', retailerId)
    .single();

  if (retailerError) {
    throw new Error(`Failed to fetch retailer: ${retailerError.message}`);
  }

  // Calculate dynamic score if needed
  if (!existingScore || recalculate) {
    const dynamicData = await calculateDynamicScore(supabase, retailerId);

    // Upsert the calculated score
    const { data: updatedScore, error: upsertError } = await supabase
      .from('retailer_reputation_scores')
      .upsert({
        retailer_id: retailerId,
        base_authenticity_score: getBaseScore(retailer.name),
        ...dynamicData,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'retailer_id'
      })
      .select()
      .single();

    if (upsertError) {
      throw new Error(`Failed to update score: ${upsertError.message}`);
    }

    existingScore = updatedScore;
  }

  return {
    retailer_id: retailerId,
    retailer_name: retailer.name,
    retailer_domain: retailer.domain,
    base_score: existingScore.base_authenticity_score,
    dynamic_score: existingScore.dynamic_authenticity_score,
    confidence_level: existingScore.confidence_level,
    data_points: {
      authentic_reports: existingScore.user_reported_authentic_count,
      counterfeit_reports: existingScore.user_reported_counterfeit_count,
      successful_purchases: existingScore.successful_purchases_count,
      failed_purchases: existingScore.failed_purchases_count
    },
    risk_assessment: getRiskAssessment(existingScore.dynamic_authenticity_score),
    last_updated: existingScore.last_updated
  };
}

async function calculateDynamicScore(supabase: any, retailerId: string) {
  // Get authenticity reports for this retailer
  const { data: reports, error: reportsError } = await supabase
    .from('authenticity_reports')
    .select('is_authentic, confidence_level, created_at')
    .eq('retailer_id', retailerId);

  if (reportsError) {
    throw new Error(`Failed to fetch reports: ${reportsError.message}`);
  }

  // Get purchase decisions for this retailer
  const { data: decisions, error: decisionsError } = await supabase
    .from('user_purchase_decisions')
    .select('purchase_confirmed, clicked_through, reported_authentic, reported_counterfeit, created_at')
    .eq('retailer_id', retailerId);

  if (decisionsError) {
    throw new Error(`Failed to fetch decisions: ${decisionsError.message}`);
  }

  // Calculate metrics
  const authenticReports = reports?.filter((r: any) => r.is_authentic).length || 0;
  const counterfeitReports = reports?.filter((r: any) => !r.is_authentic).length || 0;
  const successfulPurchases = decisions?.filter((d: any) => d.purchase_confirmed).length || 0;
  const failedPurchases = decisions?.filter((d: any) => d.reported_counterfeit).length || 0;

  // Time-weighted scoring (recent reports matter more)
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentAuthenticReports = reports?.filter((r: any) =>
    r.is_authentic && new Date(r.created_at) > threeDaysAgo
  ).length || 0;

  const recentCounterfeitReports = reports?.filter((r: any) =>
    !r.is_authentic && new Date(r.created_at) > threeDaysAgo
  ).length || 0;

  // Calculate weighted impact
  const recentWeightMultiplier = 2; // Recent reports count double
  const totalAuthentic = authenticReports + (recentAuthenticReports * recentWeightMultiplier);
  const totalCounterfeit = counterfeitReports + (recentCounterfeitReports * recentWeightMultiplier);

  return {
    user_reported_authentic_count: authenticReports,
    user_reported_counterfeit_count: counterfeitReports,
    successful_purchases_count: successfulPurchases,
    failed_purchases_count: failedPurchases
  };
}

async function getAllDynamicScores(supabase: any, recalculate: boolean = false) {
  // Get all retailers
  const { data: retailers, error: retailersError } = await supabase
    .from('price_retailers')
    .select('id, name, domain');

  if (retailersError) {
    throw new Error(`Failed to fetch retailers: ${retailersError.message}`);
  }

  const scores = [];

  for (const retailer of retailers) {
    try {
      const score = await getDynamicRetailerScore(supabase, retailer.id, recalculate);
      scores.push(score);
    } catch (error) {
      console.warn(`Failed to get score for retailer ${retailer.name}:`, error);
      // Continue with other retailers
    }
  }

  return scores.sort((a, b) => b.dynamic_score - a.dynamic_score);
}

async function recalculateAllScores(supabase: any, force: boolean = false) {
  // Get retailers that need recalculation
  let query = supabase
    .from('retailer_reputation_scores')
    .select('retailer_id, last_updated');

  if (!force) {
    // Only recalculate if older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    query = query.lt('last_updated', oneHourAgo);
  }

  const { data: outdatedScores, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch outdated scores: ${error.message}`);
  }

  const updatedScores = [];

  // Also get retailers that don't have scores yet
  const { data: allRetailers, error: retailersError } = await supabase
    .from('price_retailers')
    .select('id');

  if (retailersError) {
    throw new Error(`Failed to fetch all retailers: ${retailersError.message}`);
  }

  const existingRetailerIds = new Set(outdatedScores.map((s: any) => s.retailer_id));
  const newRetailerIds = allRetailers
    .filter((r: any) => !existingRetailerIds.has(r.id))
    .map((r: any) => r.id);

  // Recalculate outdated scores
  for (const scoreRecord of outdatedScores) {
    try {
      const score = await getDynamicRetailerScore(supabase, scoreRecord.retailer_id, true);
      updatedScores.push(score);
    } catch (error) {
      console.warn(`Failed to recalculate score for retailer ${scoreRecord.retailer_id}:`, error);
    }
  }

  // Calculate scores for new retailers
  for (const retailerId of newRetailerIds) {
    try {
      const score = await getDynamicRetailerScore(supabase, retailerId, true);
      updatedScores.push(score);
    } catch (error) {
      console.warn(`Failed to calculate score for new retailer ${retailerId}:`, error);
    }
  }

  return updatedScores;
}

function getBaseScore(retailerName: string): number {
  // Base scores from our research
  const baseScores: Record<string, number> = {
    'YesStyle': 95,
    'StyleKorean': 95,
    'Olive Young Global': 98,
    'Sephora': 90,
    'Ulta': 85,
    'Amazon': 65,
    'eBay': 45,
    'AliExpress': 30,
    'DHgate': 25,
    'Wish': 20
  };

  return baseScores[retailerName] || 50; // Default score
}

function getRiskAssessment(score: number) {
  if (score >= 90) {
    return {
      level: 'VERIFIED',
      color: '#D4AF37',
      recommendation: 'VERIFIED AUTHENTIC - Highest trust level',
      icon_type: 'verified'
    };
  } else if (score >= 80) {
    return {
      level: 'TRUSTED',
      color: '#10B981',
      recommendation: 'TRUSTED RETAILER - Reliable choice',
      icon_type: 'trusted'
    };
  } else if (score >= 65) {
    return {
      level: 'CAUTION',
      color: '#F59E0B',
      recommendation: 'PROCEED WITH CAUTION - Verify seller',
      icon_type: 'warning'
    };
  } else if (score >= 45) {
    return {
      level: 'HIGH_RISK',
      color: '#F97316',
      recommendation: 'HIGH COUNTERFEIT RISK - Not recommended',
      icon_type: 'danger'
    };
  } else {
    return {
      level: 'AVOID',
      color: '#DC2626',
      recommendation: 'AVOID - Extremely high risk',
      icon_type: 'blocked'
    };
  }
}