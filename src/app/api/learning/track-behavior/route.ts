import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const {
      userId,
      sessionId,
      productId,
      retailerId,
      action,
      context
    } = body;

    // Validate required fields
    if (!productId || !retailerId || !action) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: productId, retailerId, action'
      }, { status: 400 });
    }

    // Handle different user behavior actions
    switch (action) {
      case 'view_deal':
        await trackDealView(supabase, { userId, sessionId, productId, retailerId, context });
        break;

      case 'click_through':
        await trackClickThrough(supabase, { userId, sessionId, productId, retailerId, context });
        break;

      case 'view_authenticity_guide':
        await trackAuthenticityGuideView(supabase, { userId, sessionId, productId, retailerId });
        break;

      case 'report_purchase':
        await trackPurchaseReport(supabase, { userId, sessionId, productId, retailerId, context });
        break;

      case 'report_authenticity':
        await trackAuthenticityReport(supabase, { userId, sessionId, productId, retailerId, context });
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Behavior tracked successfully',
      action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error tracking behavior:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function trackDealView(supabase: any, params: any) {
  const { userId, sessionId, productId, retailerId, context } = params;

  // Record the deal view with all context
  const { error } = await supabase
    .from('user_purchase_decisions')
    .insert({
      user_id: userId,
      session_id: sessionId,
      product_id: productId,
      retailer_id: retailerId,
      authenticity_score_shown: context?.authenticityScore || null,
      price_shown: context?.price || null,
      was_best_deal: context?.isBestDeal || false,
      risk_level_shown: context?.riskLevel || null,
      time_spent_viewing: 0 // Will be updated on subsequent actions
    });

  if (error) {
    throw new Error(`Failed to track deal view: ${error.message}`);
  }
}

async function trackClickThrough(supabase: any, params: any) {
  const { userId, sessionId, productId, retailerId, context } = params;

  // Update existing record or create new one
  const { error } = await supabase
    .from('user_purchase_decisions')
    .upsert({
      user_id: userId,
      session_id: sessionId,
      product_id: productId,
      retailer_id: retailerId,
      clicked_through: true,
      time_spent_viewing: context?.timeSpent || 0,
      authenticity_score_shown: context?.authenticityScore || null,
      price_shown: context?.price || null,
      was_best_deal: context?.isBestDeal || false,
      risk_level_shown: context?.riskLevel || null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,product_id,retailer_id',
      ignoreDuplicates: false
    });

  if (error) {
    throw new Error(`Failed to track click through: ${error.message}`);
  }
}

async function trackAuthenticityGuideView(supabase: any, params: any) {
  const { userId, sessionId, productId, retailerId } = params;

  // Update the viewed_authenticity_guide flag
  const { error } = await supabase
    .from('user_purchase_decisions')
    .update({
      viewed_authenticity_guide: true,
      updated_at: new Date().toISOString()
    })
    .match({
      user_id: userId,
      product_id: productId,
      retailer_id: retailerId
    });

  if (error) {
    throw new Error(`Failed to track authenticity guide view: ${error.message}`);
  }
}

async function trackPurchaseReport(supabase: any, params: any) {
  const { userId, sessionId, productId, retailerId, context } = params;

  // Update purchase confirmation
  const { error: updateError } = await supabase
    .from('user_purchase_decisions')
    .update({
      purchase_confirmed: true,
      satisfaction_rating: context?.satisfactionRating || null,
      updated_at: new Date().toISOString()
    })
    .match({
      user_id: userId,
      product_id: productId,
      retailer_id: retailerId
    });

  if (updateError) {
    throw new Error(`Failed to track purchase report: ${updateError.message}`);
  }

  // Update retailer reputation with successful purchase
  const { error: reputationError } = await supabase
    .from('retailer_reputation_scores')
    .upsert({
      retailer_id: retailerId,
      base_authenticity_score: 50, // Default base score
      successful_purchases_count: supabase.raw('successful_purchases_count + 1'),
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'retailer_id',
      ignoreDuplicates: false
    });

  if (reputationError) {
    console.warn('Failed to update retailer reputation:', reputationError.message);
  }
}

async function trackAuthenticityReport(supabase: any, params: any) {
  const { userId, sessionId, productId, retailerId, context } = params;

  const {
    isAuthentic,
    confidenceLevel,
    purchasePrice,
    purchaseDate,
    hasPhotoEvidence,
    hasBatchCode,
    packagingIssues,
    productIssues
  } = context;

  // Insert authenticity report
  const { error } = await supabase
    .from('authenticity_reports')
    .insert({
      user_id: userId,
      session_id: sessionId,
      product_id: productId,
      retailer_id: retailerId,
      is_authentic: isAuthentic,
      confidence_level: confidenceLevel,
      purchase_price: purchasePrice,
      purchase_date: purchaseDate,
      has_photo_evidence: hasPhotoEvidence || false,
      has_batch_code: hasBatchCode || false,
      packaging_issues: packagingIssues || null,
      product_issues: productIssues || null
    });

  if (error) {
    throw new Error(`Failed to track authenticity report: ${error.message}`);
  }

  // Update user purchase decision
  const { error: updateError } = await supabase
    .from('user_purchase_decisions')
    .update({
      reported_counterfeit: !isAuthentic,
      reported_authentic: isAuthentic,
      updated_at: new Date().toISOString()
    })
    .match({
      user_id: userId,
      product_id: productId,
      retailer_id: retailerId
    });

  if (updateError) {
    console.warn('Failed to update purchase decision:', updateError.message);
  }
}

// GET endpoint for analytics/debugging
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const retailerId = searchParams.get('retailerId');
    const productId = searchParams.get('productId');

    const supabase = createClient();

    if (retailerId) {
      // Get retailer behavior analytics
      const { data: retailerStats, error } = await supabase
        .from('user_purchase_decisions')
        .select(`
          *,
          price_retailers (name, domain)
        `)
        .eq('retailer_id', retailerId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch retailer stats: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        retailerStats,
        summary: {
          totalViews: retailerStats.length,
          clickThroughRate: retailerStats.filter((s: any) => s.clicked_through).length / retailerStats.length,
          purchaseRate: retailerStats.filter((s: any) => s.purchase_confirmed).length / retailerStats.length,
          authenticityReports: retailerStats.filter((s: any) => s.reported_authentic || s.reported_counterfeit).length
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Please provide retailerId or productId parameter'
    }, { status: 400 });

  } catch (error) {
    console.error('Error fetching behavior analytics:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}